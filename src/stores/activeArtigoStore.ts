import { useSyncExternalStore } from 'react';

let activeArtigoIndex = 0;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export const activeArtigoStore = {
  getSnapshot(): number {
    return activeArtigoIndex;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setActiveArtigoIndex(index: number): void {
    if (index === activeArtigoIndex) return;
    activeArtigoIndex = index;
    emitChange();
  },

  reset(): void {
    activeArtigoIndex = 0;
    emitChange();
  },
};

export function useActiveArtigoIndex(): number {
  return useSyncExternalStore(
    activeArtigoStore.subscribe,
    activeArtigoStore.getSnapshot,
    () => 0,
  );
}
