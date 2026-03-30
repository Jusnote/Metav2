'use client';

import { useState, useCallback } from 'react';
import { ChevronDownIcon, MessageSquarePlusIcon } from 'lucide-react';
import { useQuestionComments } from '@/hooks/useQuestionComments';
import { useCommentMutations } from '@/hooks/useCommentMutations';
import type { QuestionComment, CommentSortOption } from '@/types/question-comments';
import { CommunityCommentItem } from './CommunityCommentItem';
import { CommunityCommentReplies } from './CommunityCommentReplies';
import { CommunityCommentEditor } from './CommunityCommentEditor';
import { CollapsedThread } from './CollapsedThread';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CommunityCommentsProps {
  questionId: number;
  currentUserId?: string;
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

const SORT_LABELS: Record<CommentSortOption, string> = {
  top: 'Mais votados',
  recent: 'Mais recentes',
  teacher: 'Professor primeiro',
};

function sortRoots(roots: QuestionComment[], option: CommentSortOption): QuestionComment[] {
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
  | { type: 'reply'; commentId: string }
  | { type: 'edit'; commentId: string };

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function CommentSkeleton() {
  return (
    <div className="flex gap-3 py-3 animate-pulse">
      <div className="h-8 w-8 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />
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
        className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
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
// DeletedRootWithReplies — collapsed thread for a deleted root that has replies
// ---------------------------------------------------------------------------

interface DeletedRootWithRepliesProps {
  rootId: string;
  replies: QuestionComment[];
  questionId: number;
  currentUserId?: string;
  onReply: (commentId: string) => void;
  onEdit: (commentId: string) => void;
  onDelete: (commentId: string) => void;
}

function DeletedRootWithReplies({
  rootId,
  replies,
  questionId,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
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
        <CommunityCommentReplies
          replies={replies}
          questionId={questionId}
          currentUserId={currentUserId}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          defaultExpanded
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CommunityComments({ questionId, currentUserId }: CommunityCommentsProps) {
  const { data: comments, isLoading } = useQuestionComments(questionId);
  const { createComment, editComment, deleteComment, isCreating, isEditing, isDeleting } =
    useCommentMutations(questionId);

  const [sortOption, setSortOption] = useState<CommentSortOption>('top');
  const [activeEditor, setActiveEditor] = useState<ActiveEditor | null>(null);

  // ---- Derived data -------------------------------------------------------

  const roots: QuestionComment[] = (comments ?? []).filter((c) => c.root_id === null);
  const allReplies: QuestionComment[] = (comments ?? []).filter((c) => c.root_id !== null);

  // Group replies by root_id
  const repliesByRoot = allReplies.reduce<Record<string, QuestionComment[]>>((acc, reply) => {
    const key = reply.root_id!;
    if (!acc[key]) acc[key] = [];
    acc[key].push(reply);
    return acc;
  }, {});

  // Sort each bucket by created_at ASC
  Object.values(repliesByRoot).forEach((bucket) =>
    bucket.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  );

  const sortedRoots = sortRoots(roots, sortOption);

  // ---- Editor management --------------------------------------------------

  const openEditor = useCallback((next: ActiveEditor) => {
    setActiveEditor(next);
  }, []);

  const closeEditor = useCallback(() => {
    setActiveEditor(null);
  }, []);

  const handleReply = useCallback(
    (commentId: string) => {
      // Always reply at root level — find the root for this comment
      const comment = comments?.find((c) => c.id === commentId);
      const rootId = comment?.root_id ?? commentId; // if it's already a root, use itself
      openEditor({ type: 'reply', commentId: rootId });
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
      if (!window.confirm('Remover este comentário?')) return;
      await deleteComment(commentId);
    },
    [deleteComment]
  );

  // ---- Submit handlers ----------------------------------------------------

  const handleSubmitNew = useCallback(
    async (content_json: Record<string, unknown>, content_text: string) => {
      await createComment({ question_id: questionId, content_json, content_text });
      closeEditor();
    },
    [createComment, questionId, closeEditor]
  );

  const handleSubmitReply = useCallback(
    async (
      rootId: string,
      content_json: Record<string, unknown>,
      content_text: string
    ) => {
      await createComment({
        question_id: questionId,
        content_json,
        content_text,
        root_id: rootId,
        reply_to_id: rootId,
      });
      closeEditor();
    },
    [createComment, questionId, closeEditor]
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

  const replyToNameFor = (rootId: string): string | undefined => {
    const root = comments?.find((c) => c.id === rootId);
    return root?.author_name ?? root?.author_email ?? undefined;
  };

  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3">
        <SortDropdown value={sortOption} onChange={setSortOption} />

        <button
          type="button"
          onClick={() => openEditor({ type: 'new' })}
          className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <MessageSquarePlusIcon className="size-3.5" />
          <span>Escrever comentário</span>
        </button>
      </div>

      {/* New comment editor */}
      {activeEditor?.type === 'new' && (
        <div className="mb-4">
          <CommunityCommentEditor
            questionId={questionId}
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
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {sortedRoots.map((root) => {
            const replies = repliesByRoot[root.id] ?? [];
            const isEditingThis =
              activeEditor?.type === 'edit' && activeEditor.commentId === root.id;
            const isReplyingToThis =
              activeEditor?.type === 'reply' && activeEditor.commentId === root.id;

            if (root.is_deleted && replies.length === 0) {
              // Deleted root with no replies — skip rendering entirely
              return null;
            }

            if (root.is_deleted && replies.length > 0) {
              // Deleted root with replies — show collapsed thread
              return (
                <div key={root.id} className="py-1">
                  <DeletedRootWithReplies
                    rootId={root.id}
                    replies={replies}
                    questionId={questionId}
                    currentUserId={currentUserId}
                    onReply={handleReply}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                </div>
              );
            }

            return (
              <div key={root.id} className="py-1">
                {/* Root comment (or inline edit editor) */}
                {isEditingThis ? (
                  <CommunityCommentEditor
                    questionId={questionId}
                    mode="edit"
                    draftContext={`edit_${root.id}`}
                    initialValue={root.content_json as any}
                    onSubmit={(content_json, content_text) =>
                      handleSubmitEdit(root.id, content_json, content_text)
                    }
                    onCancel={closeEditor}
                    isSubmitting={isEditing}
                  />
                ) : (
                  <CommunityCommentItem
                    comment={root}
                    questionId={questionId}
                    currentUserId={currentUserId}
                    onReply={handleReply}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                )}

                {/* Replies */}
                {replies.length > 0 && (
                  <CommunityCommentReplies
                    replies={replies}
                    questionId={questionId}
                    currentUserId={currentUserId}
                    onReply={handleReply}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                )}

                {/* Reply editor below this thread */}
                {isReplyingToThis && (
                  <div className="ml-10 mt-2">
                    <CommunityCommentEditor
                      questionId={questionId}
                      mode="reply"
                      draftContext={`reply_${root.id}`}
                      replyToName={replyToNameFor(root.id)}
                      onSubmit={(content_json, content_text) =>
                        handleSubmitReply(root.id, content_json, content_text)
                      }
                      onCancel={closeEditor}
                      isSubmitting={isCreating}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && sortedRoots.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-zinc-400">
          <MessageSquarePlusIcon className="size-8 opacity-40" />
          <p className="text-sm">Nenhum comentário. Seja o primeiro!</p>
        </div>
      )}
    </div>
  );
}
