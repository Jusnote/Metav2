import { useState, useEffect, useCallback, useRef } from 'react';
import type { CommentDraft } from '@/types/question-comments';

const DRAFT_PREFIX = 'comment_draft_';

function getDraftKey(questionId: number, context: string) {
  return `${DRAFT_PREFIX}${questionId}_${context}`;
}

export function useCommentDraft(questionId: number, context: string) {
  const key = getDraftKey(questionId, context);

  const [draft, setDraftState] = useState<CommentDraft | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const setDraft = useCallback((content_json: Record<string, unknown>, content_text: string) => {
    const newDraft: CommentDraft = { content_json, content_text, updated_at: Date.now() };
    setDraftState(newDraft);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(newDraft));
      } catch { /* quota exceeded — ignore */ }
    }, 500);
  }, [key]);

  const clearDraft = useCallback(() => {
    setDraftState(null);
    localStorage.removeItem(key);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, [key]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { draft, setDraft, clearDraft };
}
