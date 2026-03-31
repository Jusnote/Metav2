# Emoji Reactions — Design Spec

## Overview

Feature aditiva ao sistema de comentários de questões. Permite reações expressivas em comentários e replies, coexistindo com o upvote existente (semânticas diferentes: relevância vs expressão).

## Decisões

- **Set fixo**: ❤️ (Amei) · 🔥 (Destaque) · 🎯 (Preciso) · 👏 (Boa explicação)
- **Sem 👍/👎** — upvote cobre essa semântica
- **Múltiplas reações** por usuário por comentário (toggle independente)
- **Root + replies** — comportamento idêntico
- **Upvote coexiste** — não é modificado

## Display

- Flat inline na actions row, mesmo peso visual do upvote
- Emoji 12px + contagem. Azul (blue-600) = usuário reagiu, zinc-400 = não reagiu
- Ordem: `▲ 4 · ❤️ 2 · 🎯 1 · 😀+ · Responder`
- Sem reações + sem hover = actions row idêntica à atual
- Botão 😀+ visível no hover (desktop) / sempre visível (mobile)

## Picker

- Ghost popover: sem borda, sombra mínima (`box-shadow: 0 2px 8px rgba(0,0,0,0.08)`), border-radius 8px
- Emojis 15px dentro do popover
- Posição: acima do botão 😀+, alinhado à esquerda
- Fecha ao: clicar emoji, clicar fora, Esc
- Emoji já reagido aparece com fundo sutil no popover

## Banco de dados

### Tabela

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

### RPC toggle_reaction

```sql
-- toggle_reaction(p_comment_id uuid, p_user_id uuid, p_emoji text)
-- Se existe → DELETE, retorna false
-- Se não existe → INSERT, retorna true
```

### Alteração em get_comments_with_votes

Adicionar 2 campos ao retorno:
- `reaction_counts` — `jsonb` ex: `{"❤️": 3, "🔥": 1}`
- `user_reactions` — `text[]` ex: `['❤️','🔥']`

Calculados via subquery/lateral join, sem mudar estrutura existente.

### RLS

- SELECT: authenticated users
- INSERT: authenticated, `user_id = auth.uid()`
- DELETE: authenticated, `user_id = auth.uid()`

## Componentes frontend

### Novos

- `ReactionButtons` — mapeia `reaction_counts` em botões inline (emoji 12px + count)
- `ReactionPicker` — Radix UI Popover estilizado ghost, 4 emojis
- `useToggleReaction` — mutation com optimistic update no React Query cache

### Modificados

- `CommunityCommentItem.tsx` — adiciona ReactionButtons + ReactionPicker na actions row
- `question-comments.ts` (types) — adiciona `reaction_counts` e `user_reactions` ao tipo

## Interações

- **Optimistic update**: atualiza cache imediatamente, rollback on error (mesmo padrão do useToggleUpvote)
- **Animação**: scale bounce 300ms (mesmo do upvote)
- **Toggle direto**: clicar em reação existente faz toggle sem abrir picker
- **Comentário deletado**: não mostra reações
- **Shadowban**: reações contam normalmente
- **Permissões**: qualquer usuário autenticado pode reagir, inclusive no próprio comentário
