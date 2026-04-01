'use client';

import { useState, useCallback } from 'react';
import { type Value } from 'platejs';
import { ChevronDownIcon, MessageCircleIcon } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { useDispositivoComments } from '@/hooks/useDispositivoComments';
import { useDispositivoCommentMutations } from '@/hooks/useDispositivoCommentMutations';
import { useToggleDispositivoCommentUpvote } from '@/hooks/useToggleDispositivoCommentUpvote';
import { useToggleDispositivoCommentReaction } from '@/hooks/useToggleDispositivoCommentReaction';
import type { DispositivoComment, CommentSortOption } from '@/types/comments';

import { CommentItem } from '@/components/shared/comments/CommentItem';
import { CommentEditor } from '@/components/shared/comments/CommentEditor';
import { CollapsedThread } from '@/components/shared/comments/CollapsedThread';
import { useIsMobile } from '@/hooks/use-mobile';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DispositivoCommunityCommentsProps {
  dispositivoId: string;
  leiId: string;
  leiUpdatedAt?: string;
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

const SORT_LABELS: Record<CommentSortOption, string> = {
  top: 'Mais votados',
  recent: 'Mais recentes',
  teacher: 'Professor primeiro',
};

function sortComments(roots: DispositivoComment[], option: CommentSortOption): DispositivoComment[] {
  return [...roots].sort((a, b) => {
    // Pinned always first
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;

    if (option === 'top') {
      if (b.upvote_count !== a.upvote_count) return b.upvote_count - a.upvote_count;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }

    if (option === 'recent') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }

    // teacher: endorsed first, then upvotes
    if (a.is_endorsed !== b.is_endorsed) return a.is_endorsed ? -1 : 1;
    if (b.upvote_count !== a.upvote_count) return b.upvote_count - a.upvote_count;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

// ---------------------------------------------------------------------------
// Active editor state
// ---------------------------------------------------------------------------

type ActiveEditor =
  | { type: 'new' }
  | { type: 'reply'; commentId: string; replyToId: string }
  | { type: 'edit'; commentId: string };

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function CommentSkeleton() {
  return (
    <div className="flex gap-2.5 py-2.5 animate-pulse">
      <div className="h-7 w-7 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortDropdown
// ---------------------------------------------------------------------------

interface SortDropdownProps {
  value: CommentSortOption;
  onChange: (v: CommentSortOption) => void;
}

function SortDropdown({ value, onChange }: SortDropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        <span>{SORT_LABELS[value]}</span>
        <ChevronDownIcon className="size-3.5 text-zinc-400" />
      </button>

      {open && (
        <>
          {/* Backdrop to close */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] rounded-md border border-border bg-background shadow-md">
            {(Object.keys(SORT_LABELS) as CommentSortOption[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                  opt === value ? 'font-medium text-foreground' : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {SORT_LABELS[opt]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeletedRootWithReplies
// ---------------------------------------------------------------------------

interface DeletedRootWithRepliesProps {
  replies: DispositivoComment[];
  dispositivoId: string;
  leiId: string;
  currentUserId?: string;
  onReply: (commentId: string) => void;
  onEdit: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  onToggleUpvote: (commentId: string) => void;
  onToggleReaction: (commentId: string, emoji: string) => void;
  outdatedThreshold?: string;
}

function DeletedRootWithReplies({
  replies,
  dispositivoId,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onToggleUpvote,
  onToggleReaction,
  outdatedThreshold,
}: DeletedRootWithRepliesProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <CollapsedThread
        replyCount={replies.length}
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
      />
      {expanded && (
        <div className="ml-[38px] space-y-1">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              entityType="dispositivo"
              entityId={dispositivoId}
              isReply
              currentUserId={currentUserId}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleUpvote={onToggleUpvote}
              onToggleReaction={onToggleReaction}
              outdatedThreshold={outdatedThreshold}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DispositivoCommunityComments({
  dispositivoId,
  leiId,
  leiUpdatedAt,
}: DispositivoCommunityCommentsProps) {
  const { user } = useAuth();
  const currentUserId = user?.id;

  const { data: comments, isLoading } = useDispositivoComments(dispositivoId, leiId);
  const {
    createComment,
    editComment,
    deleteComment,
    pinComment,
    endorseComment,
    isCreating,
    isEditing,
  } = useDispositivoCommentMutations(dispositivoId, leiId);

  const { mutate: toggleUpvote } = useToggleDispositivoCommentUpvote(dispositivoId, leiId);
  const { mutate: toggleReaction } = useToggleDispositivoCommentReaction(dispositivoId, leiId);

  const isMobile = useIsMobile();
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [sortOption, setSortOption] = useState<CommentSortOption>('top');
  const [activeEditor, setActiveEditor] = useState<ActiveEditor | null>(null);

  // ---- Derived data -------------------------------------------------------

  const roots: DispositivoComment[] = (comments ?? []).filter((c) => c.root_id === null);
  const allReplies: DispositivoComment[] = (comments ?? []).filter((c) => c.root_id !== null);

  // Group replies by root_id
  const repliesByRoot = allReplies.reduce<Record<string, DispositivoComment[]>>((acc, reply) => {
    const key = reply.root_id!;
    if (!acc[key]) acc[key] = [];
    acc[key].push(reply);
    return acc;
  }, {});

  // Sort each bucket by created_at ASC
  Object.values(repliesByRoot).forEach((bucket) =>
    bucket.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  );

  const sortedRoots = sortComments(roots, sortOption);

  // ---- Editor management --------------------------------------------------

  const openEditor = useCallback((next: ActiveEditor) => {
    setActiveEditor(next);
  }, []);

  const closeEditor = useCallback(() => {
    setActiveEditor(null);
  }, []);

  const handleReply = useCallback(
    (commentId: string) => {
      const comment = comments?.find((c) => c.id === commentId);
      const rootId = comment?.root_id ?? commentId;
      openEditor({ type: 'reply', commentId: rootId, replyToId: commentId });
    },
    [comments, openEditor]
  );

  const handleEdit = useCallback(
    (commentId: string) => {
      openEditor({ type: 'edit', commentId });
    },
    [openEditor]
  );

  const handleDelete = useCallback(
    async (commentId: string) => {
      if (!window.confirm('Remover este comentario?')) return;
      await deleteComment(commentId);
    },
    [deleteComment]
  );

  const handlePin = useCallback(
    async (commentId: string, isPinned: boolean) => {
      await pinComment({ commentId, isPinned });
    },
    [pinComment]
  );

  const handleEndorse = useCallback(
    async (commentId: string, isEndorsed: boolean) => {
      await endorseComment({ commentId, isEndorsed });
    },
    [endorseComment]
  );

  const handleToggleUpvote = useCallback(
    (commentId: string) => {
      toggleUpvote(commentId);
    },
    [toggleUpvote]
  );

  const handleToggleReaction = useCallback(
    (commentId: string, emoji: string) => {
      toggleReaction({ commentId, emoji });
    },
    [toggleReaction]
  );

  // ---- Submit handlers ----------------------------------------------------

  const handleSubmitNew = useCallback(
    async (content_json: Record<string, unknown>, content_text: string) => {
      await createComment({
        dispositivo_id: dispositivoId,
        lei_id: leiId,
        content_json,
        content_text,
      });
      closeEditor();
    },
    [createComment, dispositivoId, leiId, closeEditor]
  );

  const handleSubmitReply = useCallback(
    async (
      rootId: string,
      replyToId: string,
      content_json: Record<string, unknown>,
      content_text: string
    ) => {
      await createComment({
        dispositivo_id: dispositivoId,
        lei_id: leiId,
        content_json,
        content_text,
        root_id: rootId,
        reply_to_id: replyToId,
      });
      closeEditor();
    },
    [createComment, dispositivoId, leiId, closeEditor]
  );

  const handleSubmitEdit = useCallback(
    async (
      commentId: string,
      content_json: Record<string, unknown>,
      content_text: string
    ) => {
      await editComment({ comment_id: commentId, content_json, content_text });
      closeEditor();
    },
    [editComment, closeEditor]
  );

  // ---- Render helpers -----------------------------------------------------

  const replyToNameFor = (commentId: string): string | undefined => {
    const comment = comments?.find((c) => c.id === commentId);
    return comment?.author_name ?? comment?.author_email ?? undefined;
  };

  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-0 rounded-lg bg-[#fafafa] px-3 py-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-1.5">
          <MessageCircleIcon className="size-3.5 text-blue-600" />
          <span className="text-[13px] font-semibold text-blue-600">
            {(comments ?? []).filter((c) => c.root_id === null && !c.is_deleted).length} comentarios
          </span>
          <span className="text-zinc-300">*</span>
          <SortDropdown value={sortOption} onChange={setSortOption} />
        </div>

        <button
          type="button"
          onClick={() => openEditor({ type: 'new' })}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Escrever comentario
        </button>
      </div>

      {/* New comment editor */}
      {activeEditor?.type === 'new' && (
        <div className="mb-4">
          <CommentEditor
            entityType="dispositivo"
            entityId={dispositivoId}
            mode="new"
            draftContext="new"
            onSubmit={handleSubmitNew}
            onCancel={closeEditor}
            isSubmitting={isCreating}
          />
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          <CommentSkeleton />
          <CommentSkeleton />
          <CommentSkeleton />
        </div>
      )}

      {/* Comment threads */}
      {!isLoading && sortedRoots.length > 0 && (
        <div>
          {(isMobile && !commentsExpanded ? sortedRoots.slice(0, 3) : sortedRoots).map((root, index) => {
            const replies = repliesByRoot[root.id] ?? [];
            const isEditingThis =
              activeEditor?.type === 'edit' && activeEditor.commentId === root.id;
            const isReplyingToThis =
              activeEditor?.type === 'reply' && activeEditor.commentId === root.id;

            if (root.is_deleted && replies.length === 0) {
              return null;
            }

            if (root.is_deleted && replies.length > 0) {
              return (
                <div key={root.id} className={index > 0 ? 'border-t border-zinc-100 dark:border-zinc-800/50' : ''}>
                  <DeletedRootWithReplies
                    replies={replies}
                    dispositivoId={dispositivoId}
                    leiId={leiId}
                    currentUserId={currentUserId}
                    onReply={handleReply}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleUpvote={handleToggleUpvote}
                    onToggleReaction={handleToggleReaction}
                    outdatedThreshold={leiUpdatedAt}
                  />
                </div>
              );
            }

            return (
              <div key={root.id} className={index > 0 ? 'border-t border-zinc-100 dark:border-zinc-800/50' : ''}>
                {/* Root comment (or inline edit editor) */}
                {isEditingThis ? (
                  <CommentEditor
                    entityType="dispositivo"
                    entityId={dispositivoId}
                    mode="edit"
                    draftContext={`edit_${root.id}`}
                    initialValue={root.content_json as unknown as Value}
                    onSubmit={(content_json, content_text) =>
                      handleSubmitEdit(root.id, content_json, content_text)
                    }
                    onCancel={closeEditor}
                    isSubmitting={isEditing}
                  />
                ) : (
                  <CommentItem
                    comment={root}
                    entityType="dispositivo"
                    entityId={dispositivoId}
                    currentUserId={currentUserId}
                    onReply={handleReply}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onPin={handlePin}
                    onEndorse={handleEndorse}
                    onToggleUpvote={handleToggleUpvote}
                    onToggleReaction={handleToggleReaction}
                    outdatedThreshold={leiUpdatedAt}
                  />
                )}

                {/* Replies */}
                {replies.length > 0 && (
                  <div className="ml-[38px] space-y-1">
                    {replies.map((reply) => {
                      const isEditingReply =
                        activeEditor?.type === 'edit' && activeEditor.commentId === reply.id;

                      if (isEditingReply) {
                        return (
                          <CommentEditor
                            key={reply.id}
                            entityType="dispositivo"
                            entityId={dispositivoId}
                            mode="edit"
                            draftContext={`edit_${reply.id}`}
                            initialValue={reply.content_json as unknown as Value}
                            onSubmit={(content_json, content_text) =>
                              handleSubmitEdit(reply.id, content_json, content_text)
                            }
                            onCancel={closeEditor}
                            isSubmitting={isEditing}
                          />
                        );
                      }

                      return (
                        <CommentItem
                          key={reply.id}
                          comment={reply}
                          entityType="dispositivo"
                          entityId={dispositivoId}
                          isReply
                          currentUserId={currentUserId}
                          onReply={handleReply}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          onToggleUpvote={handleToggleUpvote}
                          onToggleReaction={handleToggleReaction}
                          outdatedThreshold={leiUpdatedAt}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Reply editor below this thread */}
                {isReplyingToThis && activeEditor?.type === 'reply' && (
                  <div className="ml-[38px] mt-2">
                    <CommentEditor
                      entityType="dispositivo"
                      entityId={dispositivoId}
                      mode="reply"
                      draftContext={`reply_${root.id}`}
                      replyToName={replyToNameFor(activeEditor.replyToId)}
                      onSubmit={(content_json, content_text) =>
                        handleSubmitReply(root.id, activeEditor.replyToId, content_json, content_text)
                      }
                      onCancel={closeEditor}
                      isSubmitting={isCreating}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {isMobile && !commentsExpanded && sortedRoots.length > 3 && (
            <button
              onClick={() => setCommentsExpanded(true)}
              className="mt-2 w-full py-2 text-center text-[12px] font-medium text-violet-600 transition-colors hover:text-violet-700"
            >
              Ver {sortedRoots.length - 3} comentarios restantes
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && sortedRoots.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-zinc-400">
          <MessageCircleIcon className="size-8 opacity-40" />
          <p className="text-sm">Nenhum comentario. Seja o primeiro!</p>
        </div>
      )}
    </div>
  );
}
