import { useSyncExternalStore } from 'react'

let progress = 0
let lastPosition: number | null = null
const listeners = new Set<() => void>()
function emit() { listeners.forEach(fn => fn()) }

export const readingProgressStore = {
  getSnapshot: () => progress,
  getPosition: () => lastPosition,
  subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn) },
  set: (p: number, pos: number) => {
    progress = p
    lastPosition = pos
    emit()
  },
}

export function useReadingProgress() {
  return useSyncExternalStore(readingProgressStore.subscribe, readingProgressStore.getSnapshot)
}
