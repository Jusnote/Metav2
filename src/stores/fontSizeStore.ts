import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'lei-seca:font-size'
const DEFAULT_SIZE = 16
const MIN_SIZE = 13
const MAX_SIZE = 22

let fontSize = DEFAULT_SIZE
try {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) fontSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE, parseInt(saved, 10)))
} catch {}

const listeners = new Set<() => void>()
function emit() { listeners.forEach(fn => fn()) }

export const fontSizeStore = {
  getSnapshot: () => fontSize,
  subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn) },
  increase: () => {
    if (fontSize < MAX_SIZE) {
      fontSize += 1
      try { localStorage.setItem(STORAGE_KEY, String(fontSize)) } catch {}
      emit()
    }
  },
  decrease: () => {
    if (fontSize > MIN_SIZE) {
      fontSize -= 1
      try { localStorage.setItem(STORAGE_KEY, String(fontSize)) } catch {}
      emit()
    }
  },
  reset: () => {
    fontSize = DEFAULT_SIZE
    try { localStorage.setItem(STORAGE_KEY, String(fontSize)) } catch {}
    emit()
  },
}

export function useFontSize() {
  return useSyncExternalStore(fontSizeStore.subscribe, fontSizeStore.getSnapshot)
}
