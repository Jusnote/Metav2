'use client';

import * as React from 'react';

import { Lock, Pencil, Trash2 } from 'lucide-react';
import { type Value } from 'platejs';

import { useDispositivoNote } from '@/hooks/useDispositivoNote';
import { cn } from '@/lib/utils';

import { CommentStatic } from '@/components/shared/comments/CommentStatic';
import { CommentEditor } from '@/components/shared/comments/CommentEditor';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DispositivoNoteProps {
  dispositivoId: string;
  leiId: string;
}

// ---------------------------------------------------------------------------
// Loading skeleton (amber shimmer)
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

export function DispositivoNote({ dispositivoId, leiId }: DispositivoNoteProps) {
  const { note, isLoading, save, remove, isSaving, isRemoving } = useDispositivoNote(dispositivoId, leiId);

  // Start in edit mode when no note exists (determined after load).
  const [isEditing, setIsEditing] = React.useState(false);

  // Unmount save pattern: keep editor value in a ref, fire save on cleanup
  const contentRef = React.useRef<{ content_json: Record<string, unknown>; content_text: string } | null>(null);
  const savedRef = React.useRef(note);
  savedRef.current = note;

  React.useEffect(() => {
    return () => {
      const current = contentRef.current;
      const saved = savedRef.current;
      if (current && current.content_text && current.content_text !== (saved?.content_text ?? '')) {
        save(current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      contentRef.current = null; // Clear ref so unmount save doesn't re-fire
      setIsEditing(false);
    },
    [save]
  );

  const handleCancel = React.useCallback(() => {
    contentRef.current = null;
    setIsEditing(false);
  }, []);

  const handleDelete = React.useCallback(async () => {
    if (!window.confirm('Excluir sua anotacao? Esta acao nao pode ser desfeita.')) return;
    await remove();
    // After deletion, auto-open editor so user can write a new one
    setIsEditing(true);
  }, [remove]);

  const handleChange = React.useCallback(
    (content_json: Record<string, unknown>, content_text: string) => {
      contentRef.current = { content_json, content_text };
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className={cn(
        'rounded-lg border bg-[#fffdf5] border-[#fef3c7]',
        'dark:border-amber-800/30 dark:bg-amber-950/10',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <Lock className="size-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Minha anotacao
        </span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">So voce ve</span>

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
              <span>{isRemoving ? 'Excluindo...' : 'Excluir'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-4 pb-3">
        {isLoading ? (
          <NoteSkeleton />
        ) : isEditing ? (
          <CommentEditor
            entityType="dispositivo"
            entityId={dispositivoId}
            mode="note"
            draftContext="note"
            initialValue={note ? (note.content_json as unknown as Value) : undefined}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onChange={handleChange}
            isSubmitting={isSaving}
          />
        ) : note ? (
          <CommentStatic
            value={note.content_json as unknown as Value}
            className="text-sm"
          />
        ) : null}
      </div>
    </div>
  );
}
