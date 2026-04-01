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
- `useLeiIncidencia(leiId)` → **single request** to FastAPI, returns `Record<string, number>` dictionary (`{ "art_1": 45, "art_2": 12, ... }`). Stubbed until pipeline ready. See Section 11.1 for rationale.

> **N+1 Alert:** Incidence data MUST be fetched per-lei, never per-dispositivo. A lei like the Constituição Federal renders hundreds of artigos on one page. Per-dispositivo fetching would fire 200+ simultaneous requests, freezing the browser and overwhelming the API. The parent component (lei page) fetches once via `useLeiIncidencia(leiId)` and passes data down via props or React Context. `DispositivoGutter` only consumes the dictionary — zero fetching.

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

**Accordion behavior:** Only one footer open at a time across all dispositivos. The `footerOpen` state is NOT local to `DispositivoRenderer` — it's managed by the parent (`DispositivoList`) or via a lightweight context/store. Opening a footer on one dispositivo automatically closes the previously open one.

This limits Platejs Static instances to ~20-30 comments max (one footer's worth), which the browser handles without issues.

```tsx
// DispositivoList manages which dispositivo has its footer open
function DispositivoList({ dispositivos, leiId, ... }) {
  const [openFooterId, setOpenFooterId] = useState<string | null>(null);

  return dispositivos.map(item => (
    <DispositivoRenderer
      key={item.id}
      item={item}
      leiId={leiId}
      footerOpen={openFooterId === String(item.id)}
      onToggleFooter={() => setOpenFooterId(prev =>
        prev === String(item.id) ? null : String(item.id)
      )}
      ...
    />
  ));
}

// DispositivoRenderer receives footerOpen + onToggleFooter as props
function DispositivoRenderer({ item, leiId, footerOpen, onToggleFooter, ... }) {
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
          onToggleFooter={onToggleFooter}
        />
      </div>
      {footerOpen && (
        <DispositivoFooter
          texto={item.texto}
          dispositivoId={String(item.id)}
          leiId={leiId}
          commentsCount={commentsCount}
          hasNote={hasNote}
          onReport={() => { setReportOpen(true); onToggleFooter(); }}
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

### Indexes

```sql
-- Composite index for fast comment lookup per dispositivo (covers sort by pinned + upvotes)
CREATE INDEX idx_disp_comments_lookup
  ON dispositivo_comments (lei_id, dispositivo_id, is_pinned DESC, upvote_count DESC);

-- Index for user's own comments (profile, edit, delete)
CREATE INDEX idx_disp_comments_user
  ON dispositivo_comments (user_id, created_at DESC);

-- Indexes for reaction/upvote lookups
CREATE INDEX idx_disp_comment_reactions_comment
  ON dispositivo_comment_reactions (comment_id);

CREATE INDEX idx_disp_comment_upvotes_comment
  ON dispositivo_comment_upvotes (comment_id);

-- Likes lookup per lei
CREATE INDEX idx_disp_likes_lei_user
  ON dispositivo_likes (lei_id, user_id);

-- Notes lookup per user
CREATE INDEX idx_disp_notes_user_disp
  ON dispositivo_notes (user_id, dispositivo_id);
```

> **Performance Note:** Without `idx_disp_comments_lookup`, loading comments for "Art. 5 da CF" would trigger a full table scan. With the composite index, the query resolves in ~2ms even with millions of comments.

### RPCs

**Per-dispositivo (called when footer is opened):**
- `get_dispositivo_comments_with_votes(p_dispositivo_id, p_lei_id, p_user_id)` — mirrors `get_comments_with_votes`, returns comments with has_upvoted, reaction_counts, user_reactions, author info
- `toggle_dispositivo_comment_upvote(p_comment_id)` — mirrors question version
- `toggle_dispositivo_comment_reaction(p_comment_id, p_emoji)` — mirrors question version

**Per-lei batch (called once when lei loads — feeds the gutter badges):**
- `get_dispositivo_comment_counts(p_lei_id)` — returns `{ dispositivo_id, count }[]` for all dispositivos with comments
- `get_dispositivo_note_flags(p_lei_id, p_user_id)` — returns `dispositivo_id[]` where user has a saved note

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

> **Cache Collision Alert:** All React Query keys MUST include `entityType` as a namespace. A questão with ID `15` and a dispositivo with ID `15` must never share cache. Correct key format: `['comments', entityType, entityId]` — e.g. `['comments', 'question', 15]` vs `['comments', 'dispositivo', '15']`. This applies to all parametrized hooks: comments, upvotes, reactions, drafts.

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

> **Mobile Unmount Alert:** `onBlur` alone is not reliable on mobile. When the user swipes away a Bottom Sheet or hits the native "X", the component unmounts before `onBlur` fires — losing the text. Solution: keep the current editor value in a `useRef`, and add a `useEffect` cleanup that fires the save mutation on unmount if the ref contains unsaved changes. This guarantees no data loss regardless of how the component is destroyed.

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

---

## 11. Architecture Alerts

### 11.1 N+1 Front-end Fetching (Critical)

**Problem:** A lei like the Constituição Federal renders 200+ artigos on one page. If `DispositivoGutter` calls `useDispositivoIncidencia(dispositivoId)` individually, the browser fires 200+ simultaneous requests to FastAPI — freezing the tab and overwhelming the API.

**Rule:** All per-dispositivo data (incidence, likes, comment counts, note existence) MUST be fetched **per-lei in a single batch request**, then distributed to children via props or React Context.

**Implementation:**
- `useLeiIncidencia(leiId)` → 1 request → `Record<string, number>`
- `useDispositivoLikes(leiId)` → 1 request → `Set<string>`
- Comment counts come from a single `get_dispositivo_comment_counts(p_lei_id)` RPC → `Record<string, number>`
- Note existence comes from a single `get_dispositivo_note_flags(p_lei_id, p_user_id)` RPC → `Set<string>`

The lei-level component fetches all 4 dictionaries and passes them down. `DispositivoGutter` does zero fetching — it only reads props.

### 11.2 React Query Cache Collision

**Problem:** If a questão has ID `15` and a dispositivo also has ID `15`, and the query key is `['comments', entityId]`, comments from one entity leak into the other.

**Rule:** All parametrized query keys MUST include `entityType` as a namespace segment:
```typescript
// Correct
queryKey: ['comments', 'question', questionId]
queryKey: ['comments', 'dispositivo', dispositivoId]

// Wrong — will cause cache collision
queryKey: ['comments', entityId]
```

This applies to all shared hooks: comments, upvotes, reactions, drafts.

### 11.3 Mobile Auto-Save on Unmount

**Problem:** On mobile, `onBlur` may not fire before component unmount (user swipes away sheet, hits native X). The note content is lost.

**Rule:** `DispositivoNote` (and `PrivateNote` in questões) must keep the current editor value in a `useRef` and implement a `useEffect` cleanup:
```typescript
const contentRef = useRef(currentValue);
contentRef.current = currentValue;

useEffect(() => {
  return () => {
    if (contentRef.current !== savedValue) {
      saveMutation.mutate(contentRef.current); // fire-and-forget on unmount
    }
  };
}, []);
```

### 11.4 Platejs Static Performance (Accordion)

**Problem:** A lei renders all dispositivos on one page (~2,000 for Código Civil). If multiple footers with comments are open simultaneously, each comment renders a Platejs Static instance. 200 open footers × 10 comments = 2,000 Platejs instances — the browser will freeze.

**Rule:** Only one footer open at a time (accordion behavior). The `openFooterId` state lives in `DispositivoList` (parent), not in individual `DispositivoRenderer` instances. Opening a new footer closes the previous one. This caps Platejs Static instances at ~20-30 max (one footer's worth).

**Future escalation path (if accordion alone becomes insufficient):**

1. **Pre-rendered HTML** — add `content_html text` column to `dispositivo_comments` and `question_comments`. Generate HTML from `content_json` at save time (server-side or on mutation). Read-only rendering uses `dangerouslySetInnerHTML` instead of Platejs Static — zero JS overhead per comment. The editor still uses Platejs for writing. This eliminates the Platejs dependency entirely for reading and allows multiple footers open simultaneously without performance concern.

2. **IntersectionObserver lazy mount** — if keeping Platejs Static, wrap each `CommentItem` in an observer that only mounts the Platejs renderer when the comment scrolls into the viewport. Off-screen comments render a placeholder `<div>` with the correct height (estimated or cached). This handles the case where a single dispositivo has hundreds of comments.

3. **Comment pagination** — for dispositivos with 100+ comments (e.g. Art. 5 da CF), paginate server-side: first load returns 20 comments, "carregar mais" fetches the next page. Reduces both network payload and DOM nodes.

These are ordered by impact. Option 1 alone would solve performance permanently. Options 2-3 are complementary if needed.

---

## 12. UX Polish

### 12.1 Outdated Comment Badge (Legal Safety)

**Scenario:** Art. 157 do Código Penal has 120 comments. A new law changes the penalty text. The comments now reference outdated text — potentially misleading students.

**Rule:** If `comment.created_at < lei.updated_at`, display a subtle yellow badge on the comment:

```
⚠️ Comentário anterior à última atualização da lei
```

**Implementation:**
- The lei's `updated_at` timestamp is already available from the GraphQL API
- Pass `leiUpdatedAt` to `DispositivoCommunityComments`
- `CommentItem` receives an optional `outdatedThreshold` date prop — if `created_at < outdatedThreshold`, renders the badge
- Badge is informational only (no blocking, no hiding)

### 12.2 Deep Linking to Comments (Notification UX)

**Scenario:** Pedro replies to Maria's comment on "Parágrafo Único do Art. 1.022 do CPC". Maria clicks the notification. The CPC has 1,000+ artigos — she'd have to scroll forever to find it.

**Rule:** Support deep links in the format: `/leis/{lei-slug}#disp_{dispositivoId}?commentId={commentId}`

**Implementation:**
1. `DispositivoRenderer` renders `<div id={`disp_${item.id}`}>` on the wrapper
2. On page load, check `window.location.hash` and `searchParams.commentId`
3. If hash matches a dispositivo: scroll into view with `scrollIntoView({ behavior: 'smooth' })`
4. If `commentId` is present: auto-open the footer, switch to "Comunidade" tab, highlight the target comment with a yellow flash animation (2s fade)
5. URL structure supports future notification system integration
