import { useSyncExternalStore } from 'react';

/**
 * External store for annotation UI state.
 * Tracks which provision slug has an open annotation slot,
 * and the current editing mode.
 *
 * Uses useSyncExternalStore pattern (same as activeArtigoStore)
 * so annotation state changes don't cause parent re-renders.
 */

interface AnnotationState {
  /** Slug of the provision with open annotation (null = none open) */
  activeSlug: string | null;
  /** Current mode: 'indicator' shows collapsed preview, 'expanded' shows full editor */
  mode: 'indicator' | 'expanded';
}

let state: AnnotationState = {
  activeSlug: null,
  mode: 'indicator',
};

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export const annotationStore = {
  getSnapshot(): AnnotationState {
    return state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Open an annotation slot for a provision */
  open(slug: string, mode: 'indicator' | 'expanded' = 'expanded') {
    if (state.activeSlug === slug && state.mode === mode) return;
    state = { activeSlug: slug, mode };
    emitChange();
  },

  /** Close the currently open annotation slot */
  close() {
    if (state.activeSlug === null) return;
    state = { activeSlug: null, mode: 'indicator' };
    emitChange();
  },

  /** Toggle: if same slug is open, close; otherwise open */
  toggle(slug: string, mode: 'indicator' | 'expanded' = 'expanded') {
    if (state.activeSlug === slug) {
      this.close();
    } else {
      this.open(slug, mode);
    }
  },

  /** Check if a specific slug is currently open */
  isOpen(slug: string): boolean {
    return state.activeSlug === slug;
  },

  reset() {
    state = { activeSlug: null, mode: 'indicator' };
    emitChange();
  },
};

/** Hook: subscribe to annotation state without causing parent re-renders */
export function useAnnotationState(): AnnotationState {
  return useSyncExternalStore(
    annotationStore.subscribe,
    annotationStore.getSnapshot,
    () => ({ activeSlug: null, mode: 'indicator' as const }),
  );
}
