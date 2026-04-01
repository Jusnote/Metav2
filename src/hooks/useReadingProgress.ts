import { useEffect, useCallback } from 'react'
import { readingProgressStore } from '@/stores/readingProgressStore'
import type { Dispositivo } from '@/types/lei-api'

const STORAGE_PREFIX = 'lei-seca:progress:'

export function useReadingProgressTracker(
  leiId: string,
  dispositivos: Dispositivo[],
  totalCount: number,
  activeIndex: number,
) {
  useEffect(() => {
    if (totalCount === 0) return
    const pct = Math.round((activeIndex / totalCount) * 100)
    const posicao = dispositivos[activeIndex]?.posicao ?? 0
    readingProgressStore.set(pct, posicao)

    try {
      localStorage.setItem(STORAGE_PREFIX + leiId, JSON.stringify({
        posicao,
        percentage: pct,
        timestamp: Date.now(),
      }))
    } catch {}
  }, [activeIndex, totalCount, leiId, dispositivos])

  const getSavedPosition = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + leiId)
      if (saved) return JSON.parse(saved) as { posicao: number; percentage: number; timestamp: number }
    } catch {}
    return null
  }, [leiId])

  return { getSavedPosition }
}
