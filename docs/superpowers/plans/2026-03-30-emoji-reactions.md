# Emoji Reactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add emoji reactions (❤️ 🔥 🎯 👏) to question comments, displayed inline with the upvote button.

**Architecture:** New Supabase table `question_comment_reactions` with toggle RPC. Frontend adds `ReactionButtons` + `ReactionPicker` components to the existing `CommunityCommentItem` actions row. Optimistic updates via React Query, same pattern as `useToggleUpvote`.

**Tech Stack:** Supabase (PostgreSQL + RPC), React 19, React Query, Radix UI Popover, Tailwind CSS, Lucide icons.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/question-comments.ts` | Modify | Add `reaction_counts` and `user_reactions` fields to `QuestionComment` |
| `src/hooks/useToggleReaction.ts` | Create | Mutation hook with optimistic update |
| `src/components/questoes/comments/ReactionButtons.tsx` | Create | Inline reaction display + toggle + picker trigger |
| `src/components/questoes/comments/CommunityCommentItem.tsx` | Modify | Add `ReactionButtons` to actions row |

---

### Task 1: Supabase — Tabela + RPC

**Context:** O usuário precisa rodar este SQL no Supabase SQL Editor manualmente.

- [ ] **Step 1: Criar tabela question_comment_reactions**

Rodar no Supabase SQL Editor:

```sql
CREATE TABLE question_comment_reactions (
  comment_id  uuid        NOT NULL REFERENCES question_comments(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id),
  emoji       text        NOT NULL CHECK (emoji IN ('❤️','🔥','🎯','👏')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id, emoji)
);

CREATE INDEX idx_reactions_comment ON question_comment_reactions(comment_id);
```

- [ ] **Step 2: Habilitar RLS**

```sql
ALTER TABLE question_comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all reactions"
  ON question_comment_reactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own reactions"
  ON question_comment_reactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own reactions"
  ON question_comment_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
```

- [ ] **Step 3: Criar RPC toggle_reaction**

```sql
CREATE OR REPLACE FUNCTION toggle_reaction(
  p_comment_id uuid,
  p_user_id    uuid,
  p_emoji      text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existed boolean;
BEGIN
  DELETE FROM question_comment_reactions
  WHERE comment_id = p_comment_id
    AND user_id    = p_user_id
    AND emoji      = p_emoji;

  v_existed := FOUND;

  IF NOT v_existed THEN
    INSERT INTO question_comment_reactions (comment_id, user_id, emoji)
    VALUES (p_comment_id, p_user_id, p_emoji);
  END IF;

  RETURN NOT v_existed; -- true = added, false = removed
END;
$$;
```

- [ ] **Step 4: Alterar get_comments_with_votes para incluir reações**

A RPC existente `get_comments_with_votes` precisa retornar dois campos extras. Adicionar estas subqueries ao SELECT:

```sql
-- Adicionar ao SELECT da RPC existente get_comments_with_votes:

, COALESCE(
    (SELECT jsonb_object_agg(r.emoji, r.cnt)
     FROM (
       SELECT emoji, COUNT(*) as cnt
       FROM question_comment_reactions
       WHERE comment_id = c.id
       GROUP BY emoji
     ) r),
    '{}'::jsonb
  ) AS reaction_counts

, COALESCE(
    ARRAY(
      SELECT emoji
      FROM question_comment_reactions
      WHERE comment_id = c.id
        AND user_id = p_user_id
    ),
    '{}'::text[]
  ) AS user_reactions
```

**Nota:** O usuário precisa editar a RPC existente no Supabase SQL Editor e adicionar estes dois campos ao SELECT. A estrutura exata depende do body atual da RPC.

- [ ] **Step 5: Verificar no Supabase**

Testar no SQL Editor:

```sql
-- Deve retornar os novos campos
SELECT * FROM get_comments_with_votes(1, '<seu-user-id>'::uuid) LIMIT 1;
```

Verificar que `reaction_counts` retorna `{}` e `user_reactions` retorna `{}` para comentários sem reações.

---

### Task 2: Types — Adicionar campos de reação

**Files:**
- Modify: `src/types/question-comments.ts`

- [ ] **Step 1: Adicionar campos ao QuestionComment**

No arquivo `src/types/question-comments.ts`, adicionar dois campos após `has_upvoted`:

```typescript
  // Joined fields from get_comments_with_votes RPC
  has_upvoted: boolean;
  reaction_counts: Record<string, number>;  // e.g. {"❤️": 3, "🔥": 1}
  user_reactions: string[];                  // e.g. ["❤️", "🔥"]
  author_email?: string;
```

- [ ] **Step 2: Adicionar constante do emoji set**

No mesmo arquivo, adicionar no final:

```typescript
export const REACTION_EMOJIS = [
  { emoji: '❤️', label: 'Amei' },
  { emoji: '🔥', label: 'Destaque' },
  { emoji: '🎯', label: 'Preciso' },
  { emoji: '👏', label: 'Boa explicação' },
] as const;
```

- [ ] **Step 3: Commit**

```bash
git add src/types/question-comments.ts
git commit -m "feat(reactions): add reaction types and emoji set constant"
```

---

### Task 3: Hook — useToggleReaction

**Files:**
- Create: `src/hooks/useToggleReaction.ts`

- [ ] **Step 1: Criar o hook**

Criar `src/hooks/useToggleReaction.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { QuestionComment } from '@/types/question-comments';

export function useToggleReaction(questionId: number) {
  const queryClient = useQueryClient();
  const queryKey = ['question-comments', questionId];

  return useMutation({
    mutationFn: async ({ commentId, emoji }: { commentId: string; emoji: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await (supabase as any).rpc('toggle_reaction', {
        p_comment_id: commentId,
        p_user_id: user.id,
        p_emoji: emoji,
      });
      if (error) throw error;
    },
    onMutate: async ({ commentId, emoji }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<QuestionComment[]>(queryKey);

      queryClient.setQueryData<QuestionComment[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((c) => {
          if (c.id !== commentId) return c;

          const hadReaction = c.user_reactions.includes(emoji);
          const newUserReactions = hadReaction
            ? c.user_reactions.filter((e) => e !== emoji)
            : [...c.user_reactions, emoji];

          const newCounts = { ...c.reaction_counts };
          if (hadReaction) {
            newCounts[emoji] = (newCounts[emoji] ?? 1) - 1;
            if (newCounts[emoji] <= 0) delete newCounts[emoji];
          } else {
            newCounts[emoji] = (newCounts[emoji] ?? 0) + 1;
          }

          return {
            ...c,
            user_reactions: newUserReactions,
            reaction_counts: newCounts,
          };
        });
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useToggleReaction.ts
git commit -m "feat(reactions): add useToggleReaction hook with optimistic update"
```

---

### Task 4: Componente — ReactionButtons

**Files:**
- Create: `src/components/questoes/comments/ReactionButtons.tsx`

- [ ] **Step 1: Criar o componente**

Criar `src/components/questoes/comments/ReactionButtons.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { REACTION_EMOJIS } from '@/types/question-comments';
import { useToggleReaction } from '@/hooks/useToggleReaction';

interface ReactionButtonsProps {
  commentId: string;
  questionId: number;
  reactionCounts: Record<string, number>;
  userReactions: string[];
}

export function ReactionButtons({
  commentId,
  questionId,
  reactionCounts,
  userReactions,
}: ReactionButtonsProps) {
  const { mutate: toggleReaction } = useToggleReaction(questionId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bouncing, setBouncing] = useState<string | null>(null);

  function handleToggle(emoji: string) {
    setBouncing(emoji);
    setTimeout(() => setBouncing(null), 300);
    toggleReaction({ commentId, emoji });
    setPickerOpen(false);
  }

  // Emojis with counts > 0, ordered by REACTION_EMOJIS order
  const activeReactions = REACTION_EMOJIS
    .filter((r) => (reactionCounts[r.emoji] ?? 0) > 0)
    .map((r) => ({
      ...r,
      count: reactionCounts[r.emoji],
      hasReacted: userReactions.includes(r.emoji),
    }));

  return (
    <>
      {/* Existing reactions — inline toggles */}
      {activeReactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => handleToggle(r.emoji)}
          className={cn(
            'inline-flex items-center gap-0.5 text-xs transition-transform',
            bouncing === r.emoji && 'scale-125',
          )}
          aria-label={r.hasReacted ? `Remover ${r.label}` : r.label}
        >
          <span className="text-xs">{r.emoji}</span>
          <span
            className={cn(
              'tabular-nums',
              r.hasReacted ? 'font-medium text-blue-600' : 'text-zinc-400',
            )}
          >
            {r.count}
          </span>
        </button>
      ))}

      {/* Add reaction button + ghost popover */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          className="inline-flex items-center gap-0.5 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          aria-label="Adicionar reação"
        >
          <SmilePlus className="h-[13px] w-[13px]" strokeWidth={2} />
        </button>

        {pickerOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setPickerOpen(false)}
              onKeyDown={(e) => e.key === 'Escape' && setPickerOpen(false)}
              aria-hidden="true"
            />
            {/* Ghost popover */}
            <div className="absolute bottom-6 left-0 z-20 flex gap-0.5 rounded-lg bg-white p-1 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:bg-zinc-900">
              {REACTION_EMOJIS.map((r) => (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => handleToggle(r.emoji)}
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[15px] transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800',
                    userReactions.includes(r.emoji) && 'bg-blue-50 dark:bg-blue-950/30',
                  )}
                  aria-label={r.label}
                  title={r.label}
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/questoes/comments/ReactionButtons.tsx
git commit -m "feat(reactions): add ReactionButtons component with ghost popover"
```

---

### Task 5: Integração — CommunityCommentItem

**Files:**
- Modify: `src/components/questoes/comments/CommunityCommentItem.tsx`

- [ ] **Step 1: Adicionar import**

No topo de `CommunityCommentItem.tsx`, adicionar:

```typescript
import { ReactionButtons } from './ReactionButtons';
```

- [ ] **Step 2: Adicionar ReactionButtons na actions row**

Localizar a actions row (linha ~173):

```tsx
        {/* Actions row */}
        <div className="mt-2 flex items-center gap-3.5">
          <CommentVoteButton
            commentId={comment.id}
            questionId={questionId}
            upvoteCount={comment.upvote_count}
            hasUpvoted={comment.has_upvoted}
          />
          {!isReply && onReply && (
            <button
              type="button"
              onClick={() => onReply(comment.id)}
              className="text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              Responder
            </button>
          )}
        </div>
```

Substituir por:

```tsx
        {/* Actions row */}
        <div className="mt-2 flex items-center gap-3.5">
          <CommentVoteButton
            commentId={comment.id}
            questionId={questionId}
            upvoteCount={comment.upvote_count}
            hasUpvoted={comment.has_upvoted}
          />
          <ReactionButtons
            commentId={comment.id}
            questionId={questionId}
            reactionCounts={comment.reaction_counts ?? {}}
            userReactions={comment.user_reactions ?? []}
          />
          {!isReply && onReply && (
            <button
              type="button"
              onClick={() => onReply(comment.id)}
              className="text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              Responder
            </button>
          )}
        </div>
```

- [ ] **Step 3: Verificar build**

```bash
npm run build:dev
```

Deve compilar sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/questoes/comments/CommunityCommentItem.tsx
git commit -m "feat(reactions): integrate ReactionButtons into comment actions row"
```

---

### Task 6: Teste manual e verificação

- [ ] **Step 1: Verificar display sem reações**

Abrir uma questão com comentários. A actions row deve estar idêntica à anterior — só o botão 😀+ aparece no hover (desktop) ou sempre (mobile).

- [ ] **Step 2: Testar adicionar reação**

1. Hover num comentário → botão SmilePlus aparece
2. Clicar → ghost popover abre com ❤️ 🔥 🎯 👏
3. Clicar ❤️ → popover fecha, ❤️ 1 aparece inline (azul)
4. Clicar ❤️ inline → toggle off, some

- [ ] **Step 3: Testar múltiplas reações**

1. Adicionar ❤️ e 🎯 no mesmo comentário
2. Ambos aparecem inline: ❤️ 1 · 🎯 1
3. No popover, ambos têm fundo azul sutil

- [ ] **Step 4: Testar em reply**

Expandir replies, verificar que reações funcionam identicamente.

- [ ] **Step 5: Testar bounce animation**

Clicar numa reação → scale bounce 300ms (mesmo efeito do upvote).

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "feat(reactions): emoji reactions complete — ❤️ 🔥 🎯 👏"
```
