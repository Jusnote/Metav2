import { useEffect, useCallback } from 'react'
import type { Dispositivo } from '@/types/lei-api'
import { activeArtigoStore } from '@/stores/activeArtigoStore'

interface UseKeyboardNavOptions {
  dispositivos: Dispositivo[]
  toggleLeiSecaMode: () => void
  toggleRevogados: () => void
}

export function useKeyboardNav({
  dispositivos,
  toggleLeiSecaMode,
  toggleRevogados,
}: UseKeyboardNavOptions) {

  const findNextArtigo = useCallback((currentIndex: number, direction: 1 | -1) => {
    let i = currentIndex + direction
    while (i >= 0 && i < dispositivos.length) {
      if (dispositivos[i].tipo === 'ARTIGO') return i
      i += direction
    }
    return -1
  }, [dispositivos])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'j' && !e.ctrlKey && !e.metaKey) {
        const current = activeArtigoStore.getSnapshot()
        const next = findNextArtigo(current, 1)
        if (next >= 0) {
          const targetItem = dispositivos[next]
          if (targetItem) {
            const el = document.querySelector(`[data-posicao="${targetItem.posicao}"]`)
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }
        }
      }

      if (e.key === 'k' && !e.ctrlKey && !e.metaKey) {
        const current = activeArtigoStore.getSnapshot()
        const prev = findNextArtigo(current, -1)
        if (prev >= 0) {
          const targetItem = dispositivos[prev]
          if (targetItem) {
            const el = document.querySelector(`[data-posicao="${targetItem.posicao}"]`)
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }
        }
      }

      if (e.key === 'l' && !e.ctrlKey && !e.metaKey) {
        toggleLeiSecaMode()
      }

      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        toggleRevogados()
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [findNextArtigo, dispositivos, toggleLeiSecaMode, toggleRevogados])
}
