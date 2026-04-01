'use client';

import { useState, useCallback, useEffect } from 'react';
import { type Value } from 'platejs';
import { ChevronDownIcon, MessageCircleIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuestionComments } from '@/hooks/useQuestionComments';
import { useCommentMutations } from '@/hooks/useCommentMutations';
import type { QuestionComment, CommentSortOption } from '@/types/question-comments';
import { CommunityCommentItem } from './CommunityCommentItem';
import { CommunityCommentReplies } from './CommunityCommentReplies';
import { CommunityCommentEditor } from './CommunityCommentEditor';
import { CommentReportModal } from './CommentReportModal';
import { CollapsedThread } from '@/components/shared/comments/CollapsedThread';
import { usePendingReportCounts } from '@/hooks/moderation/usePendingReportCounts';
import { useIsMobile } from '@/hooks/use-mobile';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CommunityCommentsProps {
  questionId: number;
  currentUserId?: string;
  /** Pre-fill the editor with content (e.g. from "Post to Community" on a private note) */
  initialContent?: Value | null;
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
  onReport: (commentId: string) => void;
  onPin: (commentId: string, isPinned: boolean) => void;
  onEndorse: (commentId: string, isEndorsed: boolean) => void;
}

function DeletedRootWithReplies({
  rootId,
  replies,
  questionId,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onReport,
  onPin,
  onEndorse,
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
          onReport={onReport}
          onPin={onPin}
          onEndorse={onEndorse}
          defaultExpanded
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CommunityComments({ questionId, currentUserId: externalUserId, initialContent }: CommunityCommentsProps) {
  const { data: comments, isLoading } = useQuestionComments(questionId);
  const { createComment, editComment, deleteComment, pinComment, endorseComment, isCreating, isEditing, isDeleting } =
    useCommentMutations(questionId);

  // Resolve currentUserId from Supabase auth if not passed as prop
  const [resolvedUserId, setResolvedUserId] = useState<string | undefined>(externalUserId);
  useEffect(() => {
    if (externalUserId) { setResolvedUserId(externalUserId); return; }
    supabase.auth.getUser().then(({ data }) => {
      setResolvedUserId(data.user?.id);
    });
  }, [externalUserId]);
  const currentUserId = resolvedUserId;

  const isMobile = useIsMobile();
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [sortOption, setSortOption] = useState<CommentSortOption>('top');
  const [activeEditor, setActiveEditor] = useState<ActiveEditor | null>(null);

  // Report modal state
  const [reportCommentId, setReportCommentId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  // Pre-fill content from "Post to Community" (private note)
  const [prefillContent, setPrefillContent] = useState<Value | null>(initialContent ?? null);

  // When initialContent changes externally, open the editor with it
  useEffect(() => {
    if (initialContent) {
      setPrefillContent(initialContent);
      setActiveEditor({ type: 'new' });
    }
  }, [initialContent]);

  // Batch report counts for inline badges
  const commentIds = (comments ?? []).map(c => c.id);
  const { data: reportCounts } = usePendingReportCounts(commentIds);

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
      // Reply at root level but track the actual comment being replied to
      const comment = comments?.find((c) => c.id === commentId);
      const rootId = comment?.root_id ?? commentId; // if it's already a root, use itself
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
      if (!window.confirm('Remover este comentário?')) return;
      await deleteComment(commentId);
    },
    [deleteComment]
  );

  const handleReport = useCallback((commentId: string) => {
    setReportCommentId(commentId);
    setReportOpen(true);
  }, []);

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

  // ---- Submit handlers ----------------------------------------------------

  const handleSubmitNew = useCallback(
    async (content_json: Record<string, unknown>, content_text: string) => {
      await createComment({ question_id: questionId, content_json, content_text });
      setPrefillContent(null);
      closeEditor();
    },
    [createComment, questionId, closeEditor]
  );

  const handleSubmitReply = useCallback(
    async (
      rootId: string,
      replyToId: string,
      content_json: Record<string, unknown>,
      content_text: string
    ) => {
      await createComment({
        question_id: questionId,
        content_json,
        content_text,
        root_id: rootId,
        reply_to_id: replyToId,
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

  const replyToNameFor = (commentId: string): string | undefined => {
    const comment = comments?.find((c) => c.id === commentId);
    return comment?.author_name ?? comment?.author_email ?? undefined;
  };

  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-1.5">
          <MessageCircleIcon className="size-3.5 text-blue-600" />
          <span className="text-[13px] font-semibold text-blue-600">
            {(comments ?? []).filter((c) => c.root_id === null && !c.is_deleted).length} comentários
          </span>
          <span className="text-zinc-300">·</span>
          <SortDropdown value={sortOption} onChange={setSortOption} />
        </div>

        <button
          type="button"
          onClick={() => openEditor({ type: 'new' })}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Escrever comentário
        </button>
      </div>

      {/* New comment editor */}
      {activeEditor?.type === 'new' && (
        <div className="mb-4">
          <CommunityCommentEditor
            questionId={questionId}
            mode="new"
            draftContext="new"
            initialValue={prefillContent ?? undefined}
            onSubmit={handleSubmitNew}
            onCancel={() => { setPrefillContent(null); closeEditor(); }}
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
              // Deleted root with no replies — skip rendering entirely
              return null;
            }

            if (root.is_deleted && replies.length > 0) {
              // Deleted root with replies — show collapsed thread
              return (
                <div key={root.id} className={index > 0 ? 'border-t border-zinc-100 dark:border-zinc-800/50' : ''}>
                  <DeletedRootWithReplies
                    rootId={root.id}
                    replies={replies}
                    questionId={questionId}
                    currentUserId={currentUserId}
                    onReply={handleReply}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onReport={handleReport}
                    onPin={handlePin}
                    onEndorse={handleEndorse}
                  />
                </div>
              );
            }

            return (
              <div key={root.id} className={index > 0 ? 'border-t border-zinc-100 dark:border-zinc-800/50' : ''}>
                {/* Root comment (or inline edit editor) */}
                {isEditingThis ? (
                  <CommunityCommentEditor
                    questionId={questionId}
                    mode="edit"
                    draftContext={`edit_${root.id}`}
                    initialValue={root.content_json as unknown as import('platejs').Value}
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
                    onReport={handleReport}
                    onPin={handlePin}
                    onEndorse={handleEndorse}
                    pendingReportCount={reportCounts?.get(root.id) ?? 0}
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
                    onReport={handleReport}
                    onPin={handlePin}
                    onEndorse={handleEndorse}
                  />
                )}

                {/* Reply editor below this thread */}
                {isReplyingToThis && activeEditor?.type === 'reply' && (
                  <div className="ml-[38px] mt-2">
                    <CommunityCommentEditor
                      questionId={questionId}
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
              Ver {sortedRoots.length - 3} comentários restantes
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && sortedRoots.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-zinc-400">
          <MessageCircleIcon className="size-8 opacity-40" />
          <p className="text-sm">Nenhum comentário. Seja o primeiro!</p>
        </div>
      )}

      {/* Report modal */}
      <CommentReportModal
        open={reportOpen}
        onOpenChange={setReportOpen}
        commentId={reportCommentId}
      />
    </div>
  );
}
