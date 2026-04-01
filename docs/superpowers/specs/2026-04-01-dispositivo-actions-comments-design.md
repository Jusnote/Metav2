# Dispositivo Actions Refactor + Inline Comments & Notes

**Date:** 2026-04-01
**Status:** Approved
**Scope:** Lei Seca dispositivo gutter, footer, comentários comunitários, notas pessoais

---

## 1. Overview

Refactor the DispositivoActions system to eliminate the render prop pattern, redesign the gutter zones, and implement a full inline comments and notes system for dispositivos — reusing shared components extracted from the existing questões comment system.

### Goals

1. Clean architecture: DispositivoGutter as a pure component, state managed in DispositivoRenderer
2. Simplified gutter: like toggle, question incidence indicator, footer trigger with badges
3. Full comment system: threading, upvotes, reactions, moderation — identical to questões
4. Personal notes: one per user/dispositivo, Platejs editor, persisted in Supabase
5. Shared component library: extract questões comment UI blocks for reuse

### Non-Goals

- Building the incidence data pipeline (FastAPI + Typesense) — UI shows `—` until ready
- Migrating existing localStorage data (no users, no data to migrate)
- Changing questões comment behavior — only reorganizing where code lives

---

## 2. Gutter Redesign

### Current State (to be replaced)

DispositivoActions uses a render prop `children(gutter, below)` with:
- Zone 1: Personal emoji from ReactionPicker (5 emojis)
- Zone 2: Community top emoji + total count + CommunityPopover breakdown
- Zone 3: ··· button with 💬N and ✏️ badges

### New Design

Three zones separated by 1px dividers, right-aligned in a flex row:

| Zone | Content | Behavior |
|------|---------|----------|
| 1 | ♡ / ❤️ | Simple like toggle. Heart outline when not liked, filled red heart when liked. No picker. |
| 2 | 🔥 N | Question incidence count. `🔥 12` = dispositivo appeared in 12 exam questions. Shows `—` when no data. |
| 3 | ··· + badges | Opens/closes footer. Shows 💬N badge if comments exist, ✏️ badge if user has a note. |

### Visibility

- Zones with content (liked, has comments, has note) → always visible
- Empty zones → appear on hover (`group-hover/disp`)

### Components Deleted

- `ReactionPicker.tsx` — no longer needed (simple toggle replaces picker)
- `CommunityPopover.tsx` — no longer needed (incidence replaces community breakdown)
- `DispositivoActions.tsx` — replaced by `DispositivoGutter.tsx` + state in Renderer

### Database Changes

**Delete:**
- Table `dispositivo_reactions` + RPCs `get_dispositivo_reactions` / `toggle_dispositivo_reaction`

**Create:**
- Table `dispositivo_likes`:
  ```sql
  create table dispositivo_likes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    dispositivo_id text not null,
    lei_id text not null,
    created_at timestamptz default now(),
    unique(user_id, dispositivo_id)
  );
  ```
- RPC `toggle_dispositivo_like(p_dispositivo_id text, p_lei_id text)` — insert or delete, returns 'liked' | 'unliked'
- RPC `get_dispositivo_likes(p_lei_id text, p_user_id uuid)` — returns set of dispositivo_id for liked items
- RLS: users can only insert/delete their own rows, select their own rows

### Hooks

- `useDispositivoLikes(leiId)` → React Query, returns `Set<string>` of liked dispositivo IDs
- `useToggleDispositivoLike()` → mutation with optimistic update
- `useDispositivoIncidencia(dispositivoId)` → fetch from FastAPI, returns `{ count: number } | null` (stubbed until pipeline ready)

---

## 3. DispositivoGutter Component

Pure presentational component. Zero internal state except transient UI (tooltip hover).

```typescript
interface DispositivoGutterProps {
  liked: boolean;
  onToggleLike: () => void;
  incidencia: number | null;       // null = no data yet
  commentsCount: number;
  hasNote: boolean;
  footerOpen: boolean;
  onToggleFooter: () => void;
}
```

Renders the three zones as described in Section 2.

---

## 4. DispositivoRenderer Refactor

Current: uses `DispositivoActions` with render prop to position gutter inside flex and footer outside.

New: direct composition in JSX.

```tsx
function DispositivoRenderer({ item, leiId, ... }) {
  const [footerOpen, setFooterOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // ... content selection logic (Artigo, Paragrafo, etc.) unchanged ...

  return (
    <div className="group/disp">
      <div className="flex items-start">
        <div className="flex-1 min-w-0">{content}</div>
        <DispositivoGutter
          liked={liked}
          onToggleLike={handleToggleLike}
          incidencia={incidencia}
          commentsCount={commentsCount}
          hasNote={hasNote}
          footerOpen={footerOpen}
          onToggleFooter={() => setFooterOpen(prev => !prev)}
        />
      </div>
      {footerOpen && (
        <DispositivoFooter
          texto={item.texto}
          dispositivoId={String(item.id)}
          leiId={leiId}
          commentsCount={commentsCount}
          hasNote={hasNote}
          onReport={() => { setReportOpen(true); setFooterOpen(false); }}
        />
      )}
      {reportOpen && <LeiReportModal ... />}
      {/* grifo notes unchanged */}
    </div>
  );
}
```

---

## 5. Shared Comment Components

Extract from `src/components/questoes/comments/` into `src/components/shared/comments/`:

| Source (questões) | Target (shared) | Changes |
|---|---|---|
| `CommunityCommentItem.tsx` | `CommentItem.tsx` | Props accept generic comment type via interface |
| `CommunityCommentEditor.tsx` | `CommentEditor.tsx` | Already generic (onSubmit, mode). Move as-is. |
| `CommunityCommentStatic.tsx` | `CommentStatic.tsx` | No changes needed |
| `CommentVoteButton.tsx` | `CommentVoteButton.tsx` | No changes needed |
| `ReactionButtons.tsx` | `CommentReactionButtons.tsx` | No changes needed |
| `CommentContextMenu.tsx` | `CommentContextMenu.tsx` | No changes needed |
| `MobileCommentEditor.tsx` | `MobileCommentEditor.tsx` | No changes needed |
| `MobileEditorToolbar.tsx` | `MobileEditorToolbar.tsx` | No changes needed |
| `MobileToolbarSheet.tsx` | `MobileToolbarSheet.tsx` | No changes needed |

### Shared Comment Interface

```typescript
interface BaseComment {
  id: string;
  user_id: string;
  root_id: string | null;
  reply_to_id: string | null;
  content_json: Record<string, unknown>;
  content_text: string;
  quoted_text: string | null;
  is_pinned: boolean;
  is_endorsed: boolean;
  is_deleted: boolean;
  is_author_shadowbanned: boolean;
  upvote_count: number;
  reply_count: number;
  edit_count: number;
  last_edited_at: string | null;
  created_at: string;
  updated_at: string;
  has_upvoted: boolean;
  reaction_counts: Record<string, number>;
  user_reactions: string[];
  author_email?: string;
  author_name?: string;
  author_avatar_url?: string;
}

interface QuestionComment extends BaseComment {
  question_id: number;
}

interface DispositivoComment extends BaseComment {
  dispositivo_id: string;
  lei_id: string;
}
```

### Questões Refactor

`QuestionCommentsSection.tsx` and `CommunityComments.tsx` stay in `questoes/comments/`, but import shared components:

```typescript
// Before
import { CommunityCommentItem } from './CommunityCommentItem';
// After
import { CommentItem } from '@/components/shared/comments/CommentItem';
```

Zero behavior change. Only import paths change.

---

## 6. Comment System for Dispositivos

### Database

```sql
-- Comments (mirrors question_comments)
create table dispositivo_comments (
  id uuid primary key default gen_random_uuid(),
  dispositivo_id text not null,
  lei_id text not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  root_id uuid references dispositivo_comments(id) on delete cascade,
  reply_to_id uuid references dispositivo_comments(id) on delete set null,
  content_json jsonb not null default '{}',
  content_text text not null default '',
  quoted_text text,
  is_pinned boolean default false,
  is_endorsed boolean default false,
  is_deleted boolean default false,
  is_author_shadowbanned boolean default false,
  upvote_count integer default 0,
  reply_count integer default 0,
  edit_count integer default 0,
  last_edited_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Reactions on comments
create table dispositivo_comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid references dispositivo_comments(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  emoji text not null,
  created_at timestamptz default now(),
  unique(user_id, comment_id, emoji)
);

-- Upvotes on comments
create table dispositivo_comment_upvotes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid references dispositivo_comments(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, comment_id)
);
```

### RPCs

- `get_dispositivo_comments_with_votes(p_dispositivo_id, p_lei_id, p_user_id)` — mirrors `get_comments_with_votes`, returns comments with has_upvoted, reaction_counts, user_reactions, author info
- `toggle_dispositivo_comment_upvote(p_comment_id)` — mirrors question version
- `toggle_dispositivo_comment_reaction(p_comment_id, p_emoji)` — mirrors question version

### RLS Policies

Mirror question_comments policies:
- SELECT: authenticated users can read all non-shadowbanned comments (or their own shadowbanned ones)
- INSERT: authenticated users can insert their own comments
- UPDATE: users can update their own comments (content, quoted_text only)
- DELETE: users can soft-delete their own comments (set is_deleted = true)

### Hooks (Parametrized)

```typescript
type EntityType = 'question' | 'dispositivo';

// Fetch comments
useComments(entityType: EntityType, entityId: string | number)
// → calls get_comments_with_votes or get_dispositivo_comments_with_votes

// CRUD mutations
useCommentMutations(entityType: EntityType, entityId: string | number)
// → insert/update/delete on correct table

// Upvote toggle
useToggleCommentUpvote(entityType: EntityType)
// → calls correct toggle RPC, optimistic update

// Reaction toggle
useToggleCommentReaction(entityType: EntityType)
// → calls correct toggle RPC, optimistic update

// Draft persistence
useCommentDraft(entityType: EntityType, entityId: string | number, context: string)
// → localStorage key: comment_draft_{entityType}_{entityId}_{context}
```

### Components

```
src/components/lei-seca/comments/
├── DispositivoCommentsSection.tsx   — tab switcher (comunidade | nota)
├── DispositivoCommunityComments.tsx — orchestrator: threading, sort, editor state
└── DispositivoNote.tsx              — personal note (one per user/dispositivo)
```

These compose shared blocks from `@/components/shared/comments/`.

---

## 7. Personal Notes (Dispositivo)

### Database

```sql
create table dispositivo_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  dispositivo_id text not null,
  lei_id text not null,
  content_json jsonb not null default '{}',
  content_text text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, dispositivo_id)
);
```

### RLS

- SELECT/INSERT/UPDATE/DELETE: users can only access their own notes

### Hook

```typescript
useDispositivoNote(dispositivoId: string, leiId: string)
// → fetch user's note, upsert on save
```

### Component

`DispositivoNote.tsx` uses shared `CommentEditor` in `mode: 'note'`. Auto-saves on blur with debounce (same pattern as `PrivateNote` in questões).

---

## 8. DispositivoFooter Update

Current footer has placeholder content in tabs. Update to render real components:

```tsx
function DispositivoFooter({ dispositivoId, leiId, commentsCount, hasNote, ... }) {
  const [activeTab, setActiveTab] = useState<'comunidade' | 'nota' | null>(null);

  return (
    <div>
      {/* Footer bar — tabs + actions (unchanged layout) */}
      <div className="flex items-center ...">
        <button onClick={() => toggleTab('comunidade')}>💬 Comunidade {commentsCount}</button>
        <button onClick={() => toggleTab('nota')}>✏️ Nota {hasNote && dot}</button>
        <div className="flex-1" />
        <button>Copiar</button>
        <button>Grifar</button>
        <button>Reportar</button>
      </div>

      {/* Tab content — real components */}
      {activeTab === 'comunidade' && (
        <DispositivoCommunityComments dispositivoId={dispositivoId} leiId={leiId} />
      )}
      {activeTab === 'nota' && (
        <DispositivoNote dispositivoId={dispositivoId} leiId={leiId} />
      )}
    </div>
  );
}
```

### Mobile Behavior

- Footer bar: inline (compact, fits on mobile)
- Comments: inline with collapse (show 3, "ver mais" — same as questões)
- Editor: fullscreen sheet via shared `MobileCommentEditor`
- Note editor: inline with auto-save

---

## 9. Cleanup

### Files to Delete

- `src/components/lei-seca/dispositivos/DispositivoActions.tsx` — replaced by DispositivoGutter
- `src/components/lei-seca/dispositivos/ReactionPicker.tsx` — no longer needed
- `src/components/lei-seca/dispositivos/CommunityPopover.tsx` — no longer needed
- `src/stores/leiCommentsStore.ts` — replaced by Supabase
- `src/components/lei-seca/lei-comments-panel.tsx` — replaced by inline comments
- `src/hooks/useDispositivoReactions.ts` — replaced by useDispositivoLikes

### Database to Delete

- Table `dispositivo_reactions` (if exists)
- RPCs `get_dispositivo_reactions`, `toggle_dispositivo_reaction` (if exist)

---

## 10. Data Sources Summary

| Data | Source | Storage |
|------|--------|---------|
| Dispositivo likes | Supabase | `dispositivo_likes` table |
| Question incidence | FastAPI (Typesense + Voyage) | Fetched on demand, cached in React Query |
| Comments + threading | Supabase | `dispositivo_comments` table + RPCs |
| Comment reactions | Supabase | `dispositivo_comment_reactions` table |
| Comment upvotes | Supabase | `dispositivo_comment_upvotes` table |
| Personal notes | Supabase | `dispositivo_notes` table |
| Comment drafts | localStorage | `comment_draft_dispositivo_{id}_{context}` |
