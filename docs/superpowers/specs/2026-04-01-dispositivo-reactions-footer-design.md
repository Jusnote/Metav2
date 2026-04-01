# Dispositivo — Reações + Footer Inline

**Data:** 2026-04-01
**Status:** Aprovado
**Escopo:** Gutter de ações nos dispositivos da Lei Seca — reações pessoais, reações da comunidade, footer inline com ações

---

## 1. Visão Geral

Cada dispositivo da Lei Seca ganha um gutter à direita com 3 zonas separadas por pipes verticais:

```
[texto do dispositivo]     [pessoal] | [comunidade] | [···]
```

- **Pessoal**: emoji escolhido pelo usuário (ou ♡ outline se não reagiu)
- **Comunidade**: emoji mais votado + total de reações (clica → popover com breakdown)
- **···**: abre footer inline com ações (Copiar, Anotar, Grifar, Reportar)

---

## 2. Gutter

### Layout

- Largura fixa: 3 zonas com `gap: 0`, separadores `1px solid #eceae7`, `height: 16px`
- Posição: à direita do texto, `flex-shrink: 0`, `margin-left: 12px`
- **Desktop**: invisível, aparece no hover do dispositivo (`opacity: 0 → 1`, `transition: 0.2s`)
- **Mobile**: semi-visível (`opacity: 0.3`), full no hover/tap
- **Se o usuário reagiu**: gutter fica sempre visível (classe `.vis`)

### Zona 1 — Pessoal

**Não reagiu:**
- Ícone: coração outline SVG, 14px, stroke `#d4d4d4`, stroke-width 1.8
- Hover: background `#f5f5f4`, cor `#dc7c7c`
- Click: abre picker de reações

**Reagiu:**
- Mostra o emoji escolhido (🔥, 📌, ⚠️, 💡, ❤️), font-size 15px
- Click: abre picker pra trocar reação
- Gutter fica sempre visível

### Picker de reações

- Posição: absolute, acima do botão (`bottom: calc(100% + 4px)`)
- Visual: pill arredondada (`border-radius: 24px`), fundo branco, borda `#eee`
- Shadow: `0 8px 24px rgba(0,0,0,0.06)`
- Animação: `scale(0.85) → scale(1)`, cubic-bezier bounce, 180ms
- 5 emojis: 🔥 (Cai em prova), 📌 (Decorar), ⚠️ (Pegadinha), 💡 (Insight), ❤️ (Importante)
- Cada emoji: 32x32px, border-radius 18px, hover `scale(1.2)` + bg `#f8f8f7`
- Dismiss: clique fora

### Zona 2 — Comunidade

**Sem reações:**
- Texto: `—`, font 9px, cor `#ddd`

**Com reações:**
- Mostra emoji mais votado + total de reações (soma de todos os emojis)
- Formato: `🔥 47`, font 12px, counter font 9px cor `#bbb` weight 600
- Visual: padding `2px 5px`, border-radius `8px`, hover bg `#f5f5f4`
- Click: abre popover

**Popover da comunidade:**
- Posição: acima do badge, centralizado (`bottom: calc(100% + 6px)`, `transform: translateX(-50%)`)
- Visual: fundo branco, borda `#eee`, border-radius `14px`, padding `8px 10px`
- Shadow: `0 8px 24px rgba(0,0,0,0.07)`
- Seta: triângulo CSS apontando pra baixo
- Conteúdo: lista horizontal de `emoji count` (ex: 🔥 24 · 📌 15 · ⚠️ 8)
- Cada item: padding `3px 8px`, border-radius `8px`, hover bg `#f8f8f7`
- Animação: fade up 150ms
- Dismiss: clique fora

### Zona 3 — Mais ações (···)

- Ícone: 3 dots horizontais outline SVG, 15px, cor `#d4d4d4`
- Hover: bg `#f5f5f4`, cor `#888`
- Active (footer aberto): bg `#f0f0ef`, cor `#555`
- Click: abre/fecha footer inline

---

## 3. Footer Inline

Ao clicar "···", abre uma barra abaixo do dispositivo.

### Visual

- `display: flex`, `gap: 0`, padding `6px 0 4px`
- Animação: slide down 180ms ease-out (`translateY(-6px) → 0`)
- Indentação: acompanha o dispositivo (0px, 24px, 48px conforme nível)
- Só um footer aberto por vez — clicar "···" de outro fecha o anterior

### Ações

4 botões, cada um com ícone SVG 13px + label 11.5px:

1. **Copiar** — copia texto do dispositivo pro clipboard
2. **Anotar** — abre o GrifoNoteInline existente
3. **Grifar** — ativa modo grifo no dispositivo
4. **Reportar** — abre LeiReportModal

Separador vertical (`1px #eee`, `height: 14px`) antes de "Reportar".

Estilo dos botões:
- Padding `6px 12px`, border-radius `7px`, background transparent
- Font: Inter 11.5px, weight 500, cor `#b0b0b0`
- SVG: opacity 0.5
- Hover: bg `#f5f5f4`, cor `#555`, SVG opacity 0.8

---

## 4. Modelo de Dados

### Tabela `dispositivo_reactions`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid PK | DEFAULT gen_random_uuid() |
| `user_id` | uuid FK → auth.users | Quem reagiu |
| `dispositivo_id` | text | ID do dispositivo |
| `lei_id` | text | ID da lei |
| `emoji` | text | '🔥', '📌', '⚠️', '💡', '❤️' |
| `created_at` | timestamptz | DEFAULT now() |

**Constraints:**
- UNIQUE(user_id, dispositivo_id) — um usuário, uma reação por dispositivo (trocar = update)
- RLS: user pode INSERT/UPDATE/DELETE próprias reações, SELECT de todas

### RPC `get_dispositivo_reactions`

Input: `lei_id text`
Output: para cada dispositivo com reações:
- `dispositivo_id`
- `top_emoji` — emoji com mais votos
- `total_count` — soma de todas reações
- `breakdown` — jsonb `{"🔥": 24, "📌": 15, "⚠️": 8}`
- `user_emoji` — emoji do usuário logado (null se não reagiu)

### RPC `toggle_dispositivo_reaction`

Input: `p_dispositivo_id text, p_lei_id text, p_emoji text`
- Se user já tem reação com mesmo emoji → remove (unreact)
- Se user já tem reação com emoji diferente → update
- Se user não tem reação → insert

---

## 5. Hooks

### `useDispositivoReactions(leiId: string)`

- Busca reações de todos os dispositivos da lei via `get_dispositivo_reactions`
- Retorna `Map<string, { topEmoji, totalCount, breakdown, userEmoji }>`
- Cache: react-query, staleTime 60s

### `useToggleDispositivoReaction()`

- Mutation que chama `toggle_dispositivo_reaction`
- Optimistic update no Map local
- Invalidate query on settle

---

## 6. Componentes

### `DispositivoActions` (novo)

Props: `dispositivoId, leiId, texto, tipo, posicao, userEmoji, topEmoji, totalCount, breakdown`

Renderiza as 3 zonas. Gerencia estado do picker, popover e footer.

### Modificação em `DispositivoRenderer`

- Adiciona `<DispositivoActions>` ao lado do conteúdo
- Remove o botão de report atual (migra pro footer)
- Passa dados de reação como props

---

## 7. O que NÃO muda

- Texto do dispositivo, tipografia, indentação
- Sistema de grifos existente
- Notas inline existentes
- Navegação por artigos
- Comportamento do GrifoPopup
