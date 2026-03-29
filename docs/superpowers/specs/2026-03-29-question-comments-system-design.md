# Question Comments System — Design Spec

**Status:** APPROVED
**Date:** 2026-03-29
**Mockups:** `.superpowers/brainstorm/9163-1774704983/comments-inline-v2.html`, `highlight-contextual.html`

---

## 1. Overview

Two separate systems sharing the same editor infrastructure:

- **Anotações Privadas** — notas pessoais do aluno por questão. Só ele vê.
- **Comunidade** — comentários públicos com threads, votos, moderação, professor/aluno.

Toggle exclusivo no footer do card: ícone 💬 (comunidade, azul) ou ✏️ (anotação, amber). Um fecha o outro. Seção expande inline dentro do card.

## 2. Architecture

| | Anotações Privadas | Comunidade |
|---|---|---|
| **Visibilidade** | Só o autor | Todos (exceto shadowbanned) |
| **Editor** | Plate.js (subset) | Plate.js (subset) |
| **Armazenamento** | `content_json` (Plate) + `content_text` (busca FTS) | `content_json` + `content_text` |
| **Leitura** | PlateStatic (zero JS do editor) | PlateStatic |
| **Escrita** | 1 instância Plate por vez + auto-save draft localStorage | 1 instância Plate por vez + auto-save draft localStorage |
| **Threads** | Não (1 nota por questão por aluno) | 1 nível de profundidade (flat reply, @mention) |
| **Votos** | Não | Upvote + Report |
| **Ordenação** | N/A | Mais votados / Recentes / Professor primeiro |
| **Busca** | Full-text via `content_text` + tsvector | Full-text via `content_text` + tsvector |
| **Ponte** | Botão "Postar na Comunidade" | — |
| **Deleção** | Autor deleta livremente (hard delete) | Deleta, mas Colapsa (ver seção 2.4) |

### 2.1 Performance: regra da 1 instância

- PlateStatic para toda leitura. 200 comentários = 200 divs HTML. Zero peso.
- Plate editor monta APENAS ao clicar "Escrever", "Responder" ou "Editar".
- Máximo 1 instância viva na página inteira.
- Se editor aberto em outro local: auto-save draft no localStorage (keyed por `question_id + context`) → desmonta → monta no novo local. Draft restaurado quando volta.

### 2.2 Interceptação de mídia (anti-Base64)

Quando o aluno cola imagem (Ctrl+V) ou faz upload:
- Frontend intercepta o paste/upload.
- Upload silencioso para Supabase Storage (bucket `comment-media`).
- Insere apenas a URL no JSON do Plate.
- Limites: 5MB imagem, 10MB áudio, 50MB vídeo.
- Formatos: jpg/png/gif/webp, mp3/ogg, mp4/webm + YouTube/Vimeo embed via URL.

### 2.3 Flat Reply (1 nível de profundidade)

Todas as respostas ficam no mesmo nível visual (sem aninhamento infinito):
- Comentário PAI (root)
- Resposta 1 (filho, recuo 1 nível, ~20px margin-left)
- Resposta 2 (filho, mesmo recuo)
- Se Pedro responde Maria (que é filho), Pedro fica no mesmo nível com @Maria auto-injetado.

No banco: `root_id` (thread) + `reply_to_id` (quem respondeu, para notificação/mention).
Query: `SELECT * FROM question_comments WHERE root_id = X ORDER BY created_at ASC` — flat list, zero recursão.

### 2.4 Deleção: "Deleta, mas Colapsa"

- Sem respostas (`reply_count = 0`): hard delete total (banco + storage).
- Com respostas (`reply_count > 0`): soft delete via `handle_soft_delete()`:
  1. `is_deleted = true`
  2. `content_json` e `content_text` sobrescritos com `{"text": "[Comentário removido]"}` (LGPD)
  3. Hard delete na tabela `question_comment_edits` para esse comment_id (LGPD)
- UI: thread colapsada por padrão → "↳ [+] Ver N respostas de um comentário removido"

### 2.5 Edição

- Autor pode editar sempre.
- Indicador "Editado" com timestamp visível.
- Histórico de versões salvo em `question_comment_edits` (JSON + texto anterior).
- Na deleção soft, histórico é destruído (LGPD).

### 2.6 Highlight Contextual (citação de trecho)

O aluno seleciona texto no enunciado → tooltip "💬 Comentar sobre isso" → editor abre com blockquote do trecho.

- O **enunciado fica sempre limpo** — sem highlights, sem badges, sem poluição visual.
- O trecho citado aparece **só dentro do comentário** como blockquote azul.
- No banco: `quoted_text` (texto selecionado) salvo no comentário.
- Se enunciado mudar, a citação ainda vive no blockquote do comentário.

## 3. Roles & Permissions

| Ação | Aluno | Prof. (matéria) | Prof. (global) | Admin |
|------|-------|----------------|----------------|-------|
| Comentar | ✅ | ✅ | ✅ | ✅ |
| Editar próprio | ✅ | ✅ | ✅ | ✅ |
| Deletar próprio | ✅ | ✅ | ✅ | ✅ |
| Deletar de outros | — | ✅ (sua matéria) | ✅ | ✅ |
| Fixar no topo (pin) | — | ✅ (sua matéria) | ✅ | ✅ |
| Endossar (👑 melhor resposta) | — | ✅ (sua matéria) | ✅ | ✅ |
| Silenciar (timeout 24h/7d) | — | — | ✅ | ✅ |
| Banir permanente | — | — | — | ✅ |
| Shadowban | — | — | — | ✅ |
| Fila de reports | — | Julga (sua matéria) | Julga | Julga |
| Upvote | ✅ | ✅ | ✅ | ✅ |
| Report | ✅ | ✅ | ✅ | — |

**Pin → `has_teacher_resolution`:** Trigger automático. Quando professor faz pin, flag `has_teacher_resolution = true` na questão (API Verus). Permite filtro "só com explicação do professor" na listagem.

## 4. Schema do Banco (Supabase)

### 4.1 `question_comments`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid PK | |
| `question_id` | bigint NOT NULL | ID da questão na API Verus |
| `user_id` | uuid FK → auth.users | Autor |
| `root_id` | uuid NULL | ID do comentário pai (NULL = é o root) |
| `reply_to_id` | uuid NULL | ID do comentário que respondeu (@mention + notificação) |
| `content_json` | jsonb NOT NULL | JSON do Plate.js |
| `content_text` | text NOT NULL | Texto puro (busca FTS) |
| `quoted_text` | text NULL | Trecho do enunciado citado (highlight contextual) |
| `is_pinned` | boolean DEFAULT false | Fixado pelo professor |
| `is_endorsed` | boolean DEFAULT false | Endossado como melhor resposta |
| `is_deleted` | boolean DEFAULT false | Soft delete |
| `deleted_by` | uuid NULL | Quem deletou |
| `is_author_shadowbanned` | boolean DEFAULT false | Denormalizado (evita JOIN na leitura) |
| `upvote_count` | int DEFAULT 0 | Atomic counter |
| `reply_count` | int DEFAULT 0 | Counter de filhos (para regra deleta vs colapsa) |
| `report_count` | int DEFAULT 0 | Counter de denúncias |
| `edit_count` | int DEFAULT 0 | Quantas vezes editado |
| `last_edited_at` | timestamptz NULL | |
| `created_at` | timestamptz DEFAULT now() | |
| `updated_at` | timestamptz DEFAULT now() | |

**Índices:**
```sql
CREATE INDEX idx_comments_sort ON question_comments
  (question_id, is_pinned DESC, upvote_count DESC, created_at DESC);
CREATE INDEX idx_comments_root ON question_comments (root_id, created_at);
CREATE INDEX idx_comments_user ON question_comments (user_id, created_at);
CREATE INDEX idx_comments_text ON question_comments
  USING GIN (to_tsvector('portuguese', content_text));
```

### 4.2 `question_comment_votes`

| Coluna | Tipo |
|--------|------|
| `user_id` | uuid FK |
| `comment_id` | uuid FK |
| `created_at` | timestamptz |

PK: `(user_id, comment_id)` — 1 voto por pessoa.

### 4.3 `question_comment_reports`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid PK | |
| `comment_id` | uuid FK | |
| `reporter_id` | uuid FK | |
| `reason` | text | spam / ofensivo / errado / outro |
| `status` | text DEFAULT 'pending' | pending / resolved_kept / resolved_deleted |
| `resolved_by` | uuid NULL | |
| `resolved_at` | timestamptz NULL | |
| `created_at` | timestamptz | |

### 4.4 `question_comment_edits`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid PK | |
| `comment_id` | uuid FK | |
| `content_json` | jsonb | Versão anterior |
| `content_text` | text | Versão anterior texto |
| `edited_at` | timestamptz | |

### 4.5 `question_notes` (Anotações privadas)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `user_id` | uuid FK | |
| `question_id` | bigint NOT NULL | |
| `content_json` | jsonb NOT NULL | |
| `content_text` | text NOT NULL | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**PK composta: `(user_id, question_id)`** — sem UUID, 1 nota por questão por aluno.

**Índices:**
```sql
CREATE INDEX idx_notes_user ON question_notes (user_id);
CREATE INDEX idx_notes_text ON question_notes
  USING GIN (to_tsvector('portuguese', content_text));
```

### 4.6 `user_moderation`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `user_id` | uuid PK FK | |
| `is_shadowbanned` | boolean DEFAULT false | |
| `timeout_until` | timestamptz NULL | |
| `timeout_reason` | text NULL | |
| `banned_by` | uuid NULL | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 4.7 Alteração na API Verus

Tabela `questoes` — adicionar:
```python
comments_count = Column(Integer, default=0, server_default="0")
has_teacher_resolution = Column(Boolean, default=False, server_default="false")
```

Novo endpoint webhook:
```
PATCH /api/v1/questoes/{id}/community-stats
Body: { "comments_count": 12, "has_teacher_resolution": true }
Auth: API key interna
```

Filtro existente: `GET /api/v1/questoes?has_teacher_resolution=true`

## 5. Supabase RPCs & Triggers

### RPCs

| RPC | Descrição |
|-----|-----------|
| `toggle_upvote(comment_id, user_id)` | Atomic increment/decrement + insert/delete vote. Zero race condition. |
| `handle_soft_delete(comment_id, user_id)` | Se `reply_count = 0` → hard delete. Se > 0 → soft delete + limpa content + mata edits (LGPD). |
| `get_comments_with_votes(question_id, user_id)` | View/function que retorna comentários + `has_upvoted` flag em 1 query (resolve N+1). |

### Triggers

| Trigger | Evento | Ação |
|---------|--------|------|
| `on_comment_insert` | INSERT | `reply_count++` no parent + notify_api_stats via Edge Function |
| `on_comment_delete` | UPDATE `is_deleted` ou DELETE | `reply_count--` no parent + notify_api_stats |
| `on_comment_pin` | UPDATE `is_pinned` | notify_api_stats (atualiza `has_teacher_resolution`) |
| `on_shadowban` | UPDATE on `user_moderation` | UPDATE `is_author_shadowbanned` em todos os comments do user |

### Edge Function: notify_api_stats

Trigger dispara Supabase Edge Function (não HTTP direto do Postgres):
- Conta `comments_count` para a questão
- Checa se há `is_pinned = true`
- Chama `PATCH /api/v1/questoes/{id}/community-stats` na API Verus com retry

### Validação content_text

Edge Function no INSERT/UPDATE valida que `content_text` não está vazio. Se frontend enviou texto vazio, a Edge Function extrai do `content_json` como fallback.

### Rate limit

Máximo 5 comentários por minuto por usuário. Enforced via Edge Function no INSERT.

## 6. Frontend Components

### 6.1 Estrutura de arquivos

```
src/components/questoes/comments/
├── QuestionCommentsSection.tsx    — Container: toggle exclusivo (comunidade vs nota)
├── CommunityComments.tsx          — Lista de comentários
├── CommunityCommentItem.tsx       — Um comentário: avatar, texto, votos, ações
├── CommunityCommentReplies.tsx    — Flat list de respostas (@mention)
├── CommunityCommentEditor.tsx     — Plate.js editor (1 instância)
├── CommunityCommentStatic.tsx     — PlateStatic renderizador leve
├── CollapsedThread.tsx            — "↳ [+] Ver N respostas de comentário removido"
├── PrivateNote.tsx                — Anotação: leitura + editor inline
├── PrivateNoteStatic.tsx          — PlateStatic para nota
├── CommentVoteButton.tsx          — Upvote com otimistic update
├── CommentReportModal.tsx         — Modal de denúncia
├── CommentContextMenu.tsx         — Menu ··· com ações por role
├── PinnedBadge.tsx                — "📌 FIXADO" + estilo
├── EndorsedBadge.tsx              — "👑 Endossado por..."
├── ModerationBadge.tsx            — Badges visuais
├── PostToCommunityCTA.tsx         — "Postar na Comunidade" (ponte nota → comunidade)
├── QuoteTooltip.tsx               — Tooltip "Comentar sobre isso" ao selecionar texto
└── QuotedTextBlock.tsx            — Blockquote azul com trecho citado

src/components/questoes/comments/moderation/
├── TimeoutModal.tsx               — Silenciar 24h/7d
└── ShadowbanConfirm.tsx           — Confirmação shadowban

src/views/
├── ModerationPage.tsx             — Painel /moderacao
├── ModerationReportQueue.tsx      — Fila de reports
└── ModerationUserList.tsx         — Usuários silenciados/banidos
```

### 6.2 Hooks

```typescript
useQuestionComments(questionId)    — React Query: fetch + cache comunidade
useQuestionNote(questionId)        — SWR: localStorage + Supabase
useCommentDraft(key)               — Auto-save rascunho localStorage
useToggleUpvote(commentId)         — RPC atômica + optimistic update
useMyNoteIds()                     — Busca reversa para filtro "Minhas Anotações"
useMyNoteBadges(questionIds[])     — Batch sync SWR para badges na listagem
```

### 6.3 Plate.js config para comentários

**Plugins habilitados:**
- Texto: bold, italic, underline, strikethrough, code
- Blocos: paragraph, heading (h3), blockquote, list, code-block, table
- Mídia: image (upload), audio, video, media-embed (YouTube/Vimeo)
- Math: equation (LaTeX inline e block)
- Menção: @mention (autocomplete de usuários da thread)
- Link: autodetect URL

**Não habilitados:** column, excalidraw, AI, TOC, toggle, date, tag.

### 6.4 UX do footer do card

```
[ 💬 12 ] [ ✏️ 1 ] ────────── [ 🔖 ] [ 🚩 ]
   azul     amber              bookmark  report
```

- 💬 toggle comunidade (azul `#2563EB` quando aberto, bg `#EFF6FF`)
- ✏️ toggle anotação (amber `#D97706` quando aberto, bg `#FFFBEB`)
- Toggle exclusivo: abre um, fecha outro

### 6.5 Comunidade visual

- **Pinned:** borda left `3px solid #2563EB`, bg `#F8FAFF`, badge "📌 FIXADO". Sempre primeiro.
- **Endossado:** borda left `3px solid #F59E0B`, badge "👑 Endossado por Prof. X".
- **Removido com filhos:** colapsado → "↳ [+] Ver N respostas de comentário removido"
- **Editado:** "(editado)" em cinza ao lado do timestamp
- **Sort:** dropdown "Mais votados ▾" / "Mais recentes" / "Professor primeiro". Pinned sempre no topo.

### 6.6 Anotação visual

- Seção com bg `#FFFDF7`, header "Minha anotação" + 🔒 "Só você vê"
- PlateStatic para leitura, Plate editor ao clicar "Editar"
- Botão "Postar na Comunidade" — copia JSON da nota, abre editor de comentário pré-preenchido

## 7. Data Sync

### 7.1 Flags denormalizadas na API Verus

| Flag | Atualizado via | Uso |
|------|---------------|-----|
| `has_teacher_resolution` | Edge Function on pin/unpin | Filtro "com explicação do professor" |
| `comments_count` | Edge Function on insert/delete | Badge no footer do card |

### 7.2 Per-user sync (Stale-While-Revalidate)

**Listagem normal:**
1. Cache local (localStorage): `{ [question_id]: true }` para notas
2. Frontend mostra badges instantaneamente do cache
3. Background: `SELECT question_id FROM question_notes WHERE user_id = X AND question_id IN (...)` — batch sync
4. Reconcilia diferenças silenciosamente

**Filtro "Minhas Anotações":**
1. `SELECT question_id FROM question_notes WHERE user_id = X` — busca reversa
2. Array de IDs injetado no filtro da API Verus

## 8. Moderação UI

### 8.1 Inline (dentro do card)

Menu `···` no hover/long-press do comentário:

- **Aluno:** Editar, Deletar, Reportar
- **Professor (matéria):** + Fixar, Endossar, Deletar outros, Ver reports
- **Admin:** + Silenciar, Shadowban, Banir

Ações destrutivas em vermelho com confirmação.

### 8.2 Painel dedicado (`/moderacao`)

- **Fila de Reports:** filtro por matéria/status/gravidade. Ações: Manter, Deletar, Silenciar.
- **Usuários:** lista de silenciados/banidos/shadowbanned. Ações: remover timeout, remover shadowban.
- Professor da matéria: vê e julga reports da matéria dele.
- Admin: vê tudo + pode shadowban/banir.

## 9. Fase 2 (futuro)

### 9.1 Reações rápidas em emoji

Além do upvote: 👍 🔥 💡 ❓ no comentário. Click rápido sem escrever. Schema: tabela `question_comment_reactions` com `(user_id, comment_id, emoji)`.

### 9.2 Notificações

O `reply_to_id` já permite:
- "Pedro respondeu seu comentário" → push para Maria
- "Prof. Ricardo endossou seu comentário" → push para Marcos
- "Seu report foi analisado" → push para quem reportou

### 9.3 Busca nas anotações

Tela "Buscar nas Minhas Anotações" usando `content_text` com tsvector. Full-text search em português.
