'use client';

import * as React from 'react';

import { Lock, Pencil, Trash2, Send } from 'lucide-react';
import { type Value } from 'platejs';

import { useQuestionNote } from '@/hooks/useQuestionNote';
import { cn } from '@/lib/utils';

import { CommentStatic as CommunityCommentStatic } from '@/components/shared/comments/CommentStatic';
import { CommunityCommentEditor } from './CommunityCommentEditor';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PrivateNoteProps {
  questionId: number;
  onPostToCommunity?: (content_json: Record<string, unknown>, content_text: string) => void;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function NoteSkeleton() {
  return (
    <div className="animate-pulse space-y-2 px-4 py-3">
      <div className="h-3 w-32 rounded bg-amber-200/60 dark:bg-amber-800/40" />
      <div className="h-3 w-full rounded bg-amber-200/60 dark:bg-amber-800/40" />
      <div className="h-3 w-3/4 rounded bg-amber-200/60 dark:bg-amber-800/40" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PrivateNote({ questionId, onPostToCommunity }: PrivateNoteProps) {
  const { note, isLoading, save, remove, isSaving, isRemoving } = useQuestionNote(questionId);

  // Start in edit mode when no note exists (determined after load), or when user clicks Edit.
  // We track this with a lazy initial state: once loading finishes and no note is found,
  // we flip to editing automatically.
  const [isEditing, setIsEditing] = React.useState(false);

  // Once loading is done, auto-open editor if there's no note yet.
  React.useEffect(() => {
    if (!isLoading && note === null) {
      setIsEditing(true);
    }
  }, [isLoading, note]);

  // When a note is saved (and we were editing), exit edit mode.
  const handleSubmit = React.useCallback(
    async (content_json: Record<string, unknown>, content_text: string) => {
      await save({ content_json, content_text });
      setIsEditing(false);
    },
    [save]
  );

  const handleCancel = React.useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleDelete = React.useCallback(async () => {
    if (!window.confirm('Excluir sua anotação? Esta ação não pode ser desfeita.')) return;
    await remove();
    // After deletion, auto-open editor so user can write a new one
    setIsEditing(true);
  }, [remove]);

  const handlePostToCommunity = React.useCallback(() => {
    if (!note || !onPostToCommunity) return;
    onPostToCommunity(note.content_json, note.content_text);
  }, [note, onPostToCommunity]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className={cn(
        'rounded-lg border border-amber-200/50 bg-amber-50/50',
        'dark:border-amber-800/30 dark:bg-amber-950/10',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <Lock className="size-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Minha anotação
        </span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">Só você vê</span>

        {/* Edit / Delete actions — only shown in read mode when note exists */}
        {!isEditing && note && (
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-amber-100/80 hover:text-zinc-700 dark:hover:bg-amber-900/30 dark:hover:text-zinc-300"
            >
              <Pencil className="size-3" />
              <span>Editar</span>
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isRemoving}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            >
              <Trash2 className="size-3" />
              <span>{isRemoving ? 'Excluindo…' : 'Excluir'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-4 pb-3">
        {isLoading ? (
          <NoteSkeleton />
        ) : isEditing ? (
          <CommunityCommentEditor
            questionId={questionId}
            mode="note"
            draftContext="note"
            initialValue={note ? (note.content_json as unknown as Value) : undefined}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isSaving}
          />
        ) : note ? (
          <>
            {/* Static content */}
            <CommunityCommentStatic
              value={note.content_json as unknown as Value}
              className="text-sm"
            />

            {/* Post to community */}
            {onPostToCommunity && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handlePostToCommunity}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                >
                  <Send className="size-3" />
                  <span>Postar na Comunidade</span>
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
