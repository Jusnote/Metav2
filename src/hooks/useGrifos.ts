import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Grifo, CreateGrifoParams } from '@/types/grifo'

interface UseGrifosReturn {
  grifos: Grifo[]
  grifosByDispositivo: Map<string, Grifo[]>
  isLoading: boolean
  createGrifo: (params: CreateGrifoParams) => string
  createGrifosBatch: (params: CreateGrifoParams[]) => string[]
  updateGrifo: (id: string, changes: Partial<Grifo>) => void
  deleteGrifo: (id: string) => void
  undoDelete: (id: string) => void
}

export function useGrifos(leiId: string | null): UseGrifosReturn {
  const [grifos, setGrifos] = useState<Grifo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const mapCacheRef = useRef<Map<string, Grifo[]>>(new Map())
  const prevGrifosRef = useRef<Grifo[]>([])
  const pendingCreatesRef = useRef<Grifo[]>([])
  const pendingUpdatesRef = useRef<Map<string, Partial<Grifo>>>(new Map())
  const pendingDeletesRef = useRef<Map<string, { grifo: Grifo; timer: ReturnType<typeof setTimeout> }>>(new Map())
  const flushTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const fetchGrifos = useCallback(async () => {
    if (!leiId) return
    setIsLoading(true)
    const { data, error } = await supabase
      .from('grifos')
      .select('*')
      .eq('lei_id', leiId)
    if (!error && data) {
      setGrifos(data as Grifo[])
    }
    setIsLoading(false)
  }, [leiId])

  useEffect(() => { fetchGrifos() }, [fetchGrifos])

  // Re-fetch on tab focus
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') fetchGrifos()
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [fetchGrifos])

  // Stable Map refs
  const grifosByDispositivo = useMemo(() => {
    const newMap = new Map<string, Grifo[]>()
    for (const g of grifos) {
      let arr = newMap.get(g.dispositivo_id)
      if (!arr) { arr = []; newMap.set(g.dispositivo_id, arr) }
      arr.push(g)
    }
    const stableMap = new Map<string, Grifo[]>()
    for (const [key, arr] of newMap) {
      const cached = mapCacheRef.current.get(key)
      if (cached && cached.length === arr.length && cached.every((g, i) => g.id === arr[i].id && g.updated_at === arr[i].updated_at)) {
        stableMap.set(key, cached)
      } else {
        stableMap.set(key, arr)
      }
    }
    mapCacheRef.current = stableMap
    return stableMap
  }, [grifos])

  const flush = useCallback(async () => {
    const creates = pendingCreatesRef.current.splice(0)
    if (creates.length > 0) {
      const { data, error } = await supabase
        .from('grifos')
        .insert(creates.map(g => ({
          lei_id: g.lei_id,
          dispositivo_id: g.dispositivo_id,
          start_offset: g.start_offset,
          end_offset: g.end_offset,
          texto_grifado: g.texto_grifado,
          color: g.color,
          note: g.note,
        })))
        .select()
      if (error) {
        const tempIds = new Set(creates.map(g => g.id))
        setGrifos(prev => prev.filter(g => !tempIds.has(g.id)))
      } else if (data) {
        setGrifos(prev => {
          const tempIds = new Set(creates.map(g => g.id))
          const withoutTemp = prev.filter(g => !tempIds.has(g.id))
          return [...withoutTemp, ...(data as Grifo[])]
        })
      }
    }

    const updates = new Map(pendingUpdatesRef.current)
    pendingUpdatesRef.current.clear()
    for (const [id, changes] of updates) {
      await supabase.from('grifos').update(changes).eq('id', id)
    }
  }, [])

  const scheduleFlush = useCallback(() => {
    clearTimeout(flushTimerRef.current)
    flushTimerRef.current = setTimeout(flush, 500)
  }, [flush])

  // Flush on unload (NOT deletes — preserve them)
  useEffect(() => {
    const handler = () => {
      for (const { timer } of pendingDeletesRef.current.values()) {
        clearTimeout(timer)
      }
      pendingDeletesRef.current.clear()
      flush()
    }
    window.addEventListener('beforeunload', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
      handler()
    }
  }, [flush])

  const createGrifo = useCallback((params: CreateGrifoParams): string => {
    const tempId = crypto.randomUUID()
    const now = new Date().toISOString()
    const grifo: Grifo = {
      id: tempId,
      user_id: '',
      ...params,
      note: null,
      tags: [],
      orphan: false,
      created_at: now,
      updated_at: now,
    }
    setGrifos(prev => [...prev, grifo])
    pendingCreatesRef.current.push(grifo)
    scheduleFlush()
    return tempId
  }, [scheduleFlush])

  const createGrifosBatch = useCallback((paramsList: CreateGrifoParams[]): string[] => {
    return paramsList.map(p => createGrifo(p))
  }, [createGrifo])

  const updateGrifo = useCallback((id: string, changes: Partial<Grifo>) => {
    setGrifos(prev => prev.map(g => g.id === id ? { ...g, ...changes, updated_at: new Date().toISOString() } : g))
    pendingUpdatesRef.current.set(id, changes)
    scheduleFlush()
  }, [scheduleFlush])

  const deleteGrifo = useCallback((id: string) => {
    const grifo = grifos.find(g => g.id === id)
    if (!grifo) return
    setGrifos(prev => prev.filter(g => g.id !== id))
    const timer = setTimeout(async () => {
      pendingDeletesRef.current.delete(id)
      await supabase.from('grifos').delete().eq('id', id)
    }, 5000)
    pendingDeletesRef.current.set(id, { grifo, timer })
  }, [grifos])

  const undoDelete = useCallback((id: string) => {
    const pending = pendingDeletesRef.current.get(id)
    if (pending) {
      clearTimeout(pending.timer)
      pendingDeletesRef.current.delete(id)
      setGrifos(prev => [...prev, pending.grifo])
    } else {
      const grifo = prevGrifosRef.current.find(g => g.id === id)
      if (grifo) {
        supabase.from('grifos').insert(grifo).then(() => fetchGrifos())
      }
    }
  }, [fetchGrifos])

  useEffect(() => { prevGrifosRef.current = grifos }, [grifos])

  return {
    grifos,
    grifosByDispositivo,
    isLoading,
    createGrifo,
    createGrifosBatch,
    updateGrifo,
    deleteGrifo,
    undoDelete,
  }
}
