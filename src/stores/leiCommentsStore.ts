import { useSyncExternalStore } from 'react';

// -------- Types --------

export interface LeiComment {
  id: string;
  leiId: string;
  slug: string;
  role: string;
  provisionPreview: string;
  text: string;
  createdAt: number;
  resolved: boolean;
}

export interface PendingComment {
  slug: string;
  role: string;
  provisionPreview: string;
}

// -------- Internal state --------

let comments: LeiComment[] = [];
let panelOpen = false;
let pendingComment: PendingComment | null = null;
let currentLeiId = '';
let activeSlug = '';
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) listener();
}

function storageKey(leiId: string) {
  return `lei-comments-${leiId}`;
}

function loadFromStorage(leiId: string) {
  try {
    const stored = localStorage.getItem(storageKey(leiId));
    comments = stored ? JSON.parse(stored) : [];
  } catch {
    comments = [];
  }
}

function saveToStorage() {
  if (!currentLeiId) return;
  try {
    localStorage.setItem(storageKey(currentLeiId), JSON.stringify(comments));
  } catch {}
}

// -------- Store --------

export const leiCommentsStore = {
  // Subscriptions
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  // Snapshots
  getComments(): LeiComment[] {
    return comments;
  },
  isPanelOpen(): boolean {
    return panelOpen;
  },
  getPendingComment(): PendingComment | null {
    return pendingComment;
  },
  getActiveSlug(): string {
    return activeSlug;
  },

  // Lei management
  setLeiId(leiId: string) {
    if (leiId === currentLeiId) return;
    currentLeiId = leiId;
    loadFromStorage(leiId);
    pendingComment = null;
    emitChange();
  },

  // Panel
  openPanel() {
    panelOpen = true;
    emitChange();
  },
  closePanel() {
    panelOpen = false;
    pendingComment = null;
    emitChange();
  },
  togglePanel() {
    panelOpen = !panelOpen;
    if (!panelOpen) pendingComment = null;
    emitChange();
  },

  // Active provision (filters comments in panel)
  setActiveSlug(slug: string) {
    if (slug === activeSlug) return;
    activeSlug = slug;
    emitChange();
  },

  // Start a new comment (opens panel + shows input)
  startComment(slug: string, role: string, provisionPreview: string) {
    pendingComment = { slug, role, provisionPreview };
    activeSlug = slug;
    panelOpen = true;
    emitChange();
  },

  clearPending() {
    pendingComment = null;
    emitChange();
  },

  // CRUD
  addComment(data: { slug: string; role: string; provisionPreview: string; text: string }): string {
    const id = crypto.randomUUID();
    const newComment: LeiComment = {
      id,
      leiId: currentLeiId,
      slug: data.slug,
      role: data.role,
      provisionPreview: data.provisionPreview,
      text: data.text,
      createdAt: Date.now(),
      resolved: false,
    };
    comments = [...comments, newComment];
    pendingComment = null;
    saveToStorage();
    emitChange();
    return id;
  },

  deleteComment(id: string) {
    comments = comments.filter(c => c.id !== id);
    saveToStorage();
    emitChange();
  },

  resolveComment(id: string) {
    comments = comments.map(c =>
      c.id === id ? { ...c, resolved: !c.resolved } : c
    );
    saveToStorage();
    emitChange();
  },

  editComment(id: string, text: string) {
    comments = comments.map(c =>
      c.id === id ? { ...c, text } : c
    );
    saveToStorage();
    emitChange();
  },

  getCommentSlugs(): Set<string> {
    return new Set(comments.filter(c => !c.resolved).map(c => c.slug));
  },

  getCommentCountForSlug(slug: string): number {
    return comments.filter(c => c.slug === slug && !c.resolved).length;
  },
};

// -------- Hooks --------

export function useLeiComments(): LeiComment[] {
  return useSyncExternalStore(
    leiCommentsStore.subscribe,
    leiCommentsStore.getComments,
    () => [],
  );
}

export function useLeiCommentsOpen(): boolean {
  return useSyncExternalStore(
    leiCommentsStore.subscribe,
    leiCommentsStore.isPanelOpen,
    () => false,
  );
}

export function useLeiCommentsActiveSlug(): string {
  return useSyncExternalStore(
    leiCommentsStore.subscribe,
    leiCommentsStore.getActiveSlug,
    () => '',
  );
}

export function useLeiCommentsPending(): PendingComment | null {
  return useSyncExternalStore(
    leiCommentsStore.subscribe,
    leiCommentsStore.getPendingComment,
    () => null,
  );
}
