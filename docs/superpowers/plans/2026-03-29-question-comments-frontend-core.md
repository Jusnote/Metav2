# Question Comments — Plano 2: Frontend Core

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar os componentes de frontend, hooks, e editor Plate para anotações privadas e comunidade de comentários em questões — wired ao banco já criado no Plano 1.

**Architecture:** Hooks React Query para dados do Supabase, PlateStatic para leitura zero-JS, 1 instância Plate editor para escrita, toggle exclusivo no footer do QuestionCard (💬 comunidade / ✏️ anotação), auto-save draft no localStorage.

**Tech Stack:** React 19, TypeScript, React Query, Supabase JS, Plate.js 52 (editor + PlateStatic), Tailwind CSS v4, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-03-29-question-comments-system-design.md`
**Plano 1 (concluído):** `docs/superpowers/plans/2026-03-29-question-comments-database-api.md`

---

## File Structure

### Hooks

| File | Responsabilidade |
|------|-----------------|
| `src/hooks/useQuestionComments.ts` | React Query: fetch comments via `get_comments_with_votes` RPC |
| `src/hooks/useQuestionNote.ts` | CRUD anotação privada: Supabase `question_notes` + localStorage cache |
| `src/hooks/useCommentDraft.ts` | Auto-save rascunho no localStorage (keyed por question_id + context) |
| `src/hooks/useToggleUpvote.ts` | RPC `toggle_upvote` + optimistic update |
| `src/hooks/useCommentMutations.ts` | Create, edit, delete comments (Supabase direct) |

### Components

| File | Responsabilidade |
|------|-----------------|
| `src/components/questoes/comments/QuestionCommentsSection.tsx` | Container: toggle exclusivo (comunidade vs nota), expande inline |
| `src/components/questoes/comments/CommunityComments.tsx` | Lista de comentários: sort, pinned first, paginação |
| `src/components/questoes/comments/CommunityCommentItem.tsx` | Um comentário: avatar, PlateStatic, votos, ações, badges |
| `src/components/questoes/comments/CommunityCommentReplies.tsx` | Flat list de respostas com recuo |
| `src/components/questoes/comments/CommunityCommentEditor.tsx` | Plate editor wrapper (1 instância) + toolbar + submit |
| `src/components/questoes/comments/CommunityCommentStatic.tsx` | PlateStatic wrapper para renderizar content_json |
| `src/components/questoes/comments/CollapsedThread.tsx` | Thread colapsada de comentário deletado |
| `src/components/questoes/comments/PrivateNote.tsx` | Anotação: leitura PlateStatic + editor inline |
| `src/components/questoes/comments/CommentVoteButton.tsx` | Upvote com optimistic update |
| `src/components/questoes/comments/CommentContextMenu.tsx` | Menu ··· com ações por role |
| `src/components/questoes/comments/PinnedBadge.tsx` | Badge "FIXADO" |
| `src/components/questoes/comments/EndorsedBadge.tsx` | Badge "Endossado por..." |
| `src/components/questoes/comments/comment-editor-plugins.ts` | Plate plugins subset para comentários |

### Modified Files

| File | Mudança |
|------|---------|
| `src/components/QuestionCard.tsx` | Footer: substituir tab "Anotações" por toggles 💬/✏️, wiring |

---

## Task 1: Types e constantes

**Files:**
- Create: `src/types/question-comments.ts`

- [ ] **Step 1: Definir interfaces TypeScript**

```typescript
// src/types/question-comments.ts

export interface QuestionComment {
  id: string;
  question_id: number;
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
  // Joined fields from get_comments_with_votes RPC
  has_upvoted: boolean;
  author_email?: string;
  author_name?: string;
  author_avatar_url?: string;
}

export interface QuestionNote {
  user_id: string;
  question_id: number;
  content_json: Record<string, unknown>;
  content_text: string;
  created_at: string;
  updated_at: string;
}

export type CommentSortOption = 'top' | 'recent' | 'teacher';

export interface CommentDraft {
  content_json: Record<string, unknown>;
  content_text: string;
  updated_at: number;
}
```

**Verify:** TypeScript compila sem erros.

---

## Task 2: Plate editor plugins (subset para comentários)

**Files:**
- Create: `src/components/questoes/comments/comment-editor-plugins.ts`

- [ ] **Step 1: Configurar subset de plugins**

Plugins habilitados (da spec seção 6.3):
- Texto: bold, italic, underline, strikethrough, code
- Blocos: paragraph, heading (h3 only), blockquote, list (ordered + unordered), code-block
- Math: equation (LaTeX inline + block)
- Link: autodetect URL
- Menção: @mention (para comunidade)

Plugins **não** habilitados: AI, copilot, DND, table, column, excalidraw, TOC, toggle, date, tag, media (Plano 3), slash commands.

Usar os mesmos base plugins do `editor-kit.tsx` mas com subset mínimo. Exportar `useCommentEditor()` hook que retorna o editor configurado.

- [ ] **Step 2: Configurar PlateStatic components**

Criar mapa de componentes estáticos para PlateStatic (reutilizar os existentes em `src/components/ui/`). Exportar `commentStaticPlugins` para uso em `CommunityCommentStatic` e `PrivateNote`.

**Verify:** Editor monta sem erros no browser. PlateStatic renderiza um JSON de teste.

---

## Task 3: Hooks de dados

**Files:**
- Create: `src/hooks/useQuestionComments.ts`
- Create: `src/hooks/useQuestionNote.ts`
- Create: `src/hooks/useCommentDraft.ts`
- Create: `src/hooks/useToggleUpvote.ts`
- Create: `src/hooks/useCommentMutations.ts`

- [ ] **Step 1: useQuestionComments**

```typescript
// React Query hook
// Chama RPC get_comments_with_votes(question_id, user_id)
// Returns { comments, isLoading, error, refetch }
// Separar roots vs replies (group by root_id)
// Cache key: ['question-comments', questionId]
// staleTime: 30s, refetchOnWindowFocus: true
```

- [ ] **Step 2: useQuestionNote**

```typescript
// CRUD para question_notes
// Fetch: supabase.from('question_notes').select().eq('question_id', X).eq('user_id', Y).single()
// Save: upsert (PK composta user_id + question_id)
// Delete: supabase.from('question_notes').delete()
// Cache local: localStorage para SWR pattern (show cached → background refresh)
// Cache key: ['question-note', questionId]
// Returns { note, isLoading, save, remove, isSaving }
```

- [ ] **Step 3: useCommentDraft**

```typescript
// Auto-save rascunho no localStorage
// Key: `comment_draft_${questionId}_${context}` (context = 'new' | 'reply_${parentId}' | 'edit_${commentId}')
// Debounce 500ms
// Returns { draft, setDraft, clearDraft }
// Restaura draft ao montar
```

- [ ] **Step 4: useToggleUpvote**

```typescript
// Chama RPC toggle_upvote(comment_id, user_id)
// Optimistic update: flip has_upvoted + increment/decrement upvote_count no cache React Query
// Rollback on error
// Returns { toggleUpvote, isToggling }
```

- [ ] **Step 5: useCommentMutations**

```typescript
// create: INSERT em question_comments + invalidate query
// edit: UPDATE content_json + content_text + increment edit_count
// remove: Chama RPC handle_soft_delete
// Returns { createComment, editComment, deleteComment, isCreating, isEditing, isDeleting }
```

**Verify:** Hooks retornam dados corretos via Supabase. Console log confirma fetch/mutate.

---

## Task 4: CommunityCommentStatic + PlateStatic wrapper

**Files:**
- Create: `src/components/questoes/comments/CommunityCommentStatic.tsx`

- [ ] **Step 1: PlateStatic wrapper**

Componente que recebe `content_json` (Plate JSON) e renderiza via PlateStatic com os plugins de comentário. Zero JS do editor, apenas HTML estático.

```tsx
// Props: { value: Record<string, unknown> }
// Usa commentStaticPlugins do Task 2
// Renderiza via <EditorStatic> existente com variant="none"
// Tipografia: text-sm, text-zinc-700 dark:text-zinc-300
```

**Verify:** Renderiza um JSON de teste com bold, italic, heading, blockquote, list corretamente.

---

## Task 5: CommunityCommentItem + badges

**Files:**
- Create: `src/components/questoes/comments/CommunityCommentItem.tsx`
- Create: `src/components/questoes/comments/CommentVoteButton.tsx`
- Create: `src/components/questoes/comments/CommentContextMenu.tsx`
- Create: `src/components/questoes/comments/PinnedBadge.tsx`
- Create: `src/components/questoes/comments/EndorsedBadge.tsx`

- [ ] **Step 1: CommentVoteButton**

Botão upvote: ícone ArrowBigUp (Lucide), count ao lado. Estado `has_upvoted` → fill azul. Chama `useToggleUpvote`. Transition suave.

- [ ] **Step 2: PinnedBadge + EndorsedBadge**

PinnedBadge: inline-flex, text-xs, "FIXADO", bg blue-50, text blue-700, ícone Pin.
EndorsedBadge: inline-flex, text-xs, "Endossado por Prof. X", bg amber-50, text amber-700, ícone Crown.

- [ ] **Step 3: CommentContextMenu**

Menu ··· (MoreHorizontal icon) — abre dropdown:
- Aluno: Editar (se autor), Deletar (se autor), Reportar
- Professor: + Fixar, Endossar, Deletar outros
- Admin: + Silenciar, Shadowban (futuro, disabled)

Usar Radix DropdownMenu existente.

- [ ] **Step 4: CommunityCommentItem**

Layout:
```
[Avatar 32px] [Nome · timestamp · (editado)]  [···]
              [PinnedBadge] [EndorsedBadge]
              [CommunityCommentStatic content_json]
              [QuotedTextBlock se quoted_text]
              [CommentVoteButton] [Responder btn]
```

- Avatar: iniciais do nome, circle, bg gradient
- Nome: text-sm font-medium. Professor: badge especial com cor
- Timestamp: relativeTime (Agora, 5min, 2h, Ontem, 3d, 15 mar)
- Deleted: "[Comentário removido]" em cinza italic

**Verify:** Renderiza um comentário mockado com todos os estados (normal, pinned, endorsed, deleted, editado).

---

## Task 6: CommunityCommentReplies + CollapsedThread

**Files:**
- Create: `src/components/questoes/comments/CommunityCommentReplies.tsx`
- Create: `src/components/questoes/comments/CollapsedThread.tsx`

- [ ] **Step 1: CommunityCommentReplies**

Flat list de respostas (margin-left 40px). Cada reply é um CommunityCommentItem com prop `isReply`. Se reply tem `reply_to_id` diferente do root, mostra `@Nome` no início.

- [ ] **Step 2: CollapsedThread**

Quando root `is_deleted && reply_count > 0`:
```
↳ [+] Ver N respostas de um comentário removido
```
Click expande as respostas. Colapsado por padrão.

**Verify:** Thread colapsada abre/fecha. Respostas renderizam com recuo.

---

## Task 7: CommunityCommentEditor

**Files:**
- Create: `src/components/questoes/comments/CommunityCommentEditor.tsx`

- [ ] **Step 1: Editor wrapper**

Monta Plate editor com `useCommentEditor()` do Task 2.
- FixedToolbar no topo: bold, italic, underline, strike, code, heading, blockquote, list-ordered, list-unordered, equation, link
- FloatingToolbar ao selecionar texto: bold, italic, link, strike
- Auto-save draft via `useCommentDraft`
- Footer: [Cancelar] [Publicar] — Publicar chama `useCommentMutations.createComment` ou `editComment`
- Regra da 1 instância: recebe `editorContext` prop ('new' | 'reply' | 'edit') para draft key

```
┌─ FixedToolbar: [B] [I] [U] [S] [</>] [H3] [❝] [OL] [UL] [Σ] [🔗] ─┐
│ Editor area (min-height: 80px)                                        │
├───────────────────────────────────────────────────────────────────────┤
│                                    [Cancelar]  [Publicar]             │
└───────────────────────────────────────────────────────────────────────┘
```

- [ ] **Step 2: Edit mode**

Quando editando um comentário existente:
- Preencher editor com `content_json` do comentário
- Botão "Salvar edição" em vez de "Publicar"
- Incrementa `edit_count` via mutation

- [ ] **Step 3: Reply mode**

Quando respondendo:
- Mostra "Respondendo a @Nome" acima do editor
- `root_id` = root do thread, `reply_to_id` = comentário sendo respondido
- Auto-insere @mention se respondendo a uma reply (não ao root)

**Verify:** Editor monta, escreve, publica um comentário. Draft persiste ao fechar/abrir. Edit mode restaura conteúdo.

---

## Task 8: CommunityComments (lista)

**Files:**
- Create: `src/components/questoes/comments/CommunityComments.tsx`

- [ ] **Step 1: Lista principal**

- Usa `useQuestionComments(questionId)` para fetch
- Sort dropdown: "Mais votados" / "Mais recentes" / "Professor primeiro"
- Pinned comments sempre primeiro (independente do sort)
- Botão "Escrever comentário" no topo → monta CommunityCommentEditor
- Loading: skeleton com 3 items
- Empty state: "Nenhum comentário. Seja o primeiro!"
- Regra da 1 instância: state `activeEditor: { type, id } | null`

- [ ] **Step 2: Thread rendering**

Para cada root comment:
1. `CommunityCommentItem` (root)
2. Se `reply_count > 0` e root não deletado: `CommunityCommentReplies` (expandido por padrão se ≤ 3 replies, colapsado se > 3)
3. Se root deletado + replies: `CollapsedThread`

**Verify:** Lista renderiza com sort, pinned first. Threads expandem/colapsam.

---

## Task 9: PrivateNote (anotação)

**Files:**
- Create: `src/components/questoes/comments/PrivateNote.tsx`

- [ ] **Step 1: Read mode**

- Usa `useQuestionNote(questionId)` para fetch
- Se nota existe: renderiza via `CommunityCommentStatic` (reutiliza PlateStatic wrapper)
- Header: "Minha anotação" + 🔒 icon + "Só você vê" em cinza
- Botões: [Editar] [Excluir]
- Bg: `#FFFDF7` (amber-50 suave)

- [ ] **Step 2: Edit/Create mode**

- Se nota não existe: mostra CommunityCommentEditor com placeholder "Escreva sua anotação..."
- Se editando: preenche editor com content_json da nota
- Save: chama `useQuestionNote.save` (upsert)
- Delete: confirmação simples → `useQuestionNote.remove`
- Botão "Postar na Comunidade": copia JSON, abre editor de comunidade pré-preenchido

**Verify:** Cria nota, edita, deleta. PlateStatic renderiza corretamente. Draft persiste.

---

## Task 10: QuestionCommentsSection (container)

**Files:**
- Create: `src/components/questoes/comments/QuestionCommentsSection.tsx`

- [ ] **Step 1: Container com toggle exclusivo**

Props: `{ questionId, commentsCount, activeSection, onToggle }`

- `activeSection`: `'comunidade' | 'nota' | null`
- Renderiza `CommunityComments` ou `PrivateNote` baseado no activeSection
- Transição suave: slide down com max-height animation

**Verify:** Toggle alterna entre comunidade e nota. Um fecha o outro.

---

## Task 11: QuestionCard footer rewiring

**Files:**
- Modify: `src/components/QuestionCard.tsx`

- [ ] **Step 1: Substituir tab "Anotações" por toggle ✏️**

- Remover a tab "Anotações" do footer
- Remover `AnotacoesSection` inline
- Manter tabs: Gabarito, Estatísticas (ficam como estão)
- Adicionar toggle 💬 (comunidade) após o separator
- Adicionar toggle ✏️ (anotação) após 💬
- 💬: azul `#2563EB` quando aberto, bg `#EFF6FF`
- ✏️: amber `#D97706` quando aberto, bg `#FFFBEB`
- Toggle exclusivo: abre um, fecha outro. Clicar no ativo fecha.

- [ ] **Step 2: Expandable section**

- Adicionar `QuestionCommentsSection` como seção expandível abaixo do footer
- State: `commentSection: 'comunidade' | 'nota' | null`
- Abaixo das outras seções (gabarito, estatísticas), ou exclusivo com elas? → Exclusivo: abrir comunidade/nota fecha gabarito/estatísticas e vice-versa.

- [ ] **Step 3: Badge de "tem anotação"**

- Se o aluno tem nota para esta questão, mostrar dot amber no ícone ✏️
- Usar `useQuestionNote` ou localStorage cache para check rápido

- [ ] **Step 4: Limpar código antigo**

- Remover `AnotacoesSection` function
- Remover `noteKey` helper (migrado para useQuestionNote)
- Remover `onSaveNote` prop (substituído por hook direto)
- Atualizar `QuestionCardProps` (remover `onSaveNote`)

**Verify:** Footer mostra 💬 e ✏️ corretamente. Toggle exclusivo funciona. Seções expandem inline. Badge de anotação aparece.

---

## Task 12: Integration test manual

- [ ] **Step 1: Fluxo completo**

1. Abrir questão → footer mostra 💬 com count e ✏️
2. Clicar ✏️ → seção anotação abre, editor aparece
3. Escrever nota com bold/italic → salvar → PlateStatic renderiza
4. Clicar 💬 → seção comunidade abre (nota fecha)
5. Escrever comentário → publicar → aparece na lista
6. Upvote no comentário → count incrementa
7. Responder comentário → reply aparece com recuo
8. Editar comentário → "(editado)" aparece
9. Deletar comentário sem replies → some
10. Fechar e reabrir → draft restaura

**Verify:** Todos os 10 passos funcionam no browser.
