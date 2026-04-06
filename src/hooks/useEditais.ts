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
  const [loadingDetail, setLoadingDetail] = useState(false)

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
    if (openEditalId === id) {
      setOpenEditalId(null)
      return
    }
    setOpenEditalId(id)

    if (expandedCache[id]) return

    setLoadingDetail(true)
    try {
      const result = await editaisClient.query(EDITAL_DETAIL_QUERY, { id }).toPromise()
      if (result.data?.edital) {
        setExpandedCache(prev => ({ ...prev, [id]: result.data.edital }))
      }
    } finally {
      setLoadingDetail(false)
    }
  }, [openEditalId, expandedCache])

  const handleEsferaChange = useCallback((e: EsferaFilter) => {
    setEsfera(e)
    setPagina(1)
  }, [])

  return {
    busca,
    esfera,
    pagina,
    openEditalId,
    loadingDetail,

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
