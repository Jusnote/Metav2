import { useSyncExternalStore } from 'react'
import type { Grifo, GrifoColor } from '@/types/grifo'

interface GrifoPopupState {
  isOpen: boolean
  dispositivoId: string | null
  startOffset: number
  endOffset: number
  textoGrifado: string
  existingGrifo: Grifo | null
  lastColor: GrifoColor
  noteOpenGrifoId: string | null
}

const STORAGE_KEY = 'lei-seca:last-grifo-color'

function loadLastColor(): GrifoColor {
  if (typeof window === 'undefined') return 'yellow'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && ['yellow', 'green', 'blue', 'pink', 'orange'].includes(stored)) {
    return stored as GrifoColor
  }
  return 'yellow'
}

let state: GrifoPopupState = {
  isOpen: false,
  dispositivoId: null,
  startOffset: 0,
  endOffset: 0,
  textoGrifado: '',
  existingGrifo: null,
  lastColor: loadLastColor(),
  noteOpenGrifoId: null,
}

const listeners = new Set<() => void>()

function emitChange() {
  for (const listener of listeners) listener()
}

export const grifoPopupStore = {
  getSnapshot(): GrifoPopupState {
    return state
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  openNew(params: {
    dispositivoId: string
    startOffset: number
    endOffset: number
    textoGrifado: string
  }) {
    state = { ...state, isOpen: true, existingGrifo: null, ...params }
    emitChange()
  },

  openExisting(grifo: Grifo) {
    state = {
      ...state,
      isOpen: true,
      dispositivoId: grifo.dispositivo_id,
      startOffset: grifo.start_offset,
      endOffset: grifo.end_offset,
      textoGrifado: grifo.texto_grifado,
      existingGrifo: grifo,
    }
    emitChange()
  },

  close() {
    if (!state.isOpen) return
    state = { ...state, isOpen: false, existingGrifo: null }
    emitChange()
  },

  setLastColor(color: GrifoColor) {
    state = { ...state, lastColor: color }
    localStorage.setItem(STORAGE_KEY, color)
    emitChange()
  },

  openNote(grifoId: string) {
    state = { ...state, isOpen: false, existingGrifo: null, noteOpenGrifoId: grifoId }
    emitChange()
  },

  closeNote() {
    if (!state.noteOpenGrifoId) return
    state = { ...state, noteOpenGrifoId: null }
    emitChange()
  },

  reset() {
    state = { ...state, isOpen: false, dispositivoId: null, existingGrifo: null, noteOpenGrifoId: null }
    emitChange()
  },
}

export function useGrifoPopupState(): GrifoPopupState {
  return useSyncExternalStore(
    grifoPopupStore.subscribe,
    grifoPopupStore.getSnapshot,
    () => ({ ...state, isOpen: false }),
  )
}
