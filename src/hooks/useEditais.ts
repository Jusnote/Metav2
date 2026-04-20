import { useState, useCallback, useEffect, useRef } from 'react'
import { editaisClient } from '@/lib/editais-client'
import type { EditaisPaginados, Edital, EsferaFilter } from '@/types/editais'

const EDITAIS_LIST_QUERY = `
  query EditaisList($filtro: EditalFiltro, $pagina: Int, $porPagina: Int) {
    editais(filtro: $filtro, pagina: $pagina, porPagina: $porPagina) {
      dados {
        id
        nome
        sigla
        esfera
        tipo
        totalCargos
        totalDisciplinas
        totalTopicos
        logoUrl
      }
      paginacao {
        total
        pagina
        porPagina
        totalPaginas
      }
    }
  }
`

const EDITAL_DETAIL_QUERY = `
  query EditalDetail($id: Int!) {
    edital(id: $id) {
      id
      nome
      sigla
      esfera
      tipo
      totalCargos
      totalDisciplinas
      totalTopicos
      cargos {
        id
        nome
        vagas
        remuneracao
        qtdDisciplinas
        qtdTopicos
      }
    }
  }
`

export function useEditais() {
  const [busca, setBusca] = useState('')
  const [debouncedBusca, setDebouncedBusca] = useState('')
  const [esfera, setEsfera] = useState<EsferaFilter>('todos')
  const [pagina, setPagina] = useState(1)
  const [openEditalId, setOpenEditalId] = useState<number | null>(null)
  const [expandedCache, setExpandedCache] = useState<Record<number, Edital>>({})
  const [loadingDetailId, setLoadingDetailId] = useState<number | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)

  // Refs to avoid stale closures in toggleEdital
  const openEditalIdRef = useRef(openEditalId)
  openEditalIdRef.current = openEditalId
  const expandedCacheRef = useRef(expandedCache)
  expandedCacheRef.current = expandedCache

  // List state
  const [editaisPaginados, setEditaisPaginados] = useState<EditaisPaginados | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const porPagina = 20

  // Debounce search
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedBusca(busca)
      setPagina(1)
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [busca])

  // Fetch list
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    const filtro: Record<string, unknown> = { ativo: true }
    if (debouncedBusca) filtro.busca = debouncedBusca
    if (esfera !== 'todos') filtro.esfera = esfera

    editaisClient
      .query(EDITAIS_LIST_QUERY, { filtro, pagina, porPagina })
      .toPromise()
      .then(result => {
        if (cancelled) return
        if (result.error) {
          setError(result.error.message)
        } else {
          setEditaisPaginados(result.data?.editais ?? null)
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [debouncedBusca, esfera, pagina])

  // Toggle expand + fetch cargos
  const toggleEdital = useCallback(async (id: number) => {
    if (openEditalIdRef.current === id) {
      setOpenEditalId(null)
      return
    }
    setOpenEditalId(id)
    setDetailError(null)

    if (expandedCacheRef.current[id]) return

    setLoadingDetailId(id)
    try {
      const result = await editaisClient.query(EDITAL_DETAIL_QUERY, { id }).toPromise()
      if (result.error) {
        setDetailError(result.error.message)
        return
      }
      if (result.data?.edital) {
        setExpandedCache(prev => ({ ...prev, [id]: result.data.edital }))
      }
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Erro ao carregar cargos')
    } finally {
      setLoadingDetailId(null)
    }
  }, [])

  const handleEsferaChange = useCallback((e: EsferaFilter) => {
    setEsfera(e)
    setPagina(1)
  }, [])

  return {
    busca,
    esfera,
    pagina,
    openEditalId,
    loadingDetailId,
    detailError,

    editais: editaisPaginados?.dados ?? [],
    paginacao: editaisPaginados?.paginacao ?? null,
    isLoading,
    error,
    expandedEdital: openEditalId ? expandedCache[openEditalId] ?? null : null,

    setBusca,
    setEsfera: handleEsferaChange,
    setPagina,
    toggleEdital,
  }
}
