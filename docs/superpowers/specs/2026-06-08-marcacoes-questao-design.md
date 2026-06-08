# Marcações na Questão — Atenção & Grifo Comum

**Data:** 2026-06-08
**Branch:** `feat/marcacoes-questao`
**Status:** Design aprovado (validado via mockups) → pronto para plano de implementação

## Visão geral

Permitir que o aluno **marque trechos da questão** (enunciado e alternativas) com
dois tipos de marca:

1. **Grifo comum** — destaque só com cor. Sem ícone, sem nota. Rápido, é o marca-texto.
2. **Atenção** — destaque com cor + um **triângulo de atenção** na bordinha + uma
   **classificação** (tipo) + uma **anotação privada**. É a "pegadinha anotada".

A escolha entre os dois acontece **no momento de marcar**, num popover que aparece ao
selecionar o texto. Tudo que o aluno marca fica reunido num **Caderno** (painel lateral)
para revisar antes da prova.

Substitui o grifo efêmero atual (`lisere` / `TextHighlighter`), que não persiste.

### Princípios

- **Não quebrar a questão.** O HTML das questões é "sujo" (KaTeX, tabelas, `<sup>`,
  spans). A renderização da marca **não pode corromper** esse HTML.
- **Não empurrar o texto.** A marca não pode deslocar o layout.
- **Leve.** Funciona numa lista longa e virtualizada, inclusive no mobile.
- **Elegante e minimalista.** Popovers arejados, auto-save, sem chrome desnecessário.

## Fora de escopo (v1)

Revisão espaçada (FSRS), heatmap social/comunidade, sugestão por IA, compartilhar marca.
O **modelo de dados deixa as portas abertas** para esses (campos `quote`/`type`/`target`),
mas nenhum é construído agora.

## Modelo conceitual das marcas

Uma marca é sempre um **highlight** com:

| Conceito | Grifo comum | Atenção |
|---|---|---|
| Cor | ✅ (livre, da paleta) | ✅ (livre, da paleta) |
| Triângulo na bordinha | ❌ | ✅ (na cor da marca) |
| Tipo (classificação) | ❌ | ✅ (dropdown) |
| Anotação | ❌ | ✅ (texto privado) |

O triângulo **só existe** quando a marca é do tipo Atenção. Um Grifo comum pode ser
**promovido** a Atenção depois ("Virar Atenção").

**Tipos (Atenção):** Pegadinha · Palavra-chave · Cuidado · Sacada · Revisar depois.
São rótulos para filtrar o Caderno — não mudam a cor (a cor é escolha livre do aluno).

## Visual (congelado)

- **Triângulo:** ícone de alerta preenchido (path do Lucide `triangle-alert`) com o
  **"!" vazado em branco**, na **cor da marca**. Fica na **bordinha superior esquerda**
  do trecho, com um respiro branco mínimo (drop-shadow) para legibilidade. ~13px.
- **Destaque:** fundo na cor escolhida com baixa opacidade (`color` + `~2b` hex ≈ 17%
  para Atenção; `~3d` ≈ 24% para Grifo comum, levemente mais forte por não ter ícone).
  **Sem sublinhado** (o antigo "tem nota" foi removido).
- **Paleta de cores:** 12 cores curadas (vermelho, laranja, amarelo, verde, teal, azul,
  roxo, rosa, marrom, cinza, esmeralda, terracota). Quick-row de 8 na seleção; 12 na nota.
- **Popovers (elegantes, brancos, sombra suave, swatches circulares):**
  - **Seleção:** toggle `△ Atenção | Grifo comum` (segmented) + fileira de bolinhas de cor.
  - **Nota (Atenção):** triângulo (cor) + **dropdown de tipo sem caixa** + 🗑 discreto;
    textarea **sem borda**; hairline; fileira de cores. **Auto-save ao fechar.**
  - **Mini-menu (Grifo comum):** fileira de cores + `△ Virar Atenção` + Remover.
- Mocks de referência: `.superpowers/brainstorm/3358-1780926013/content/mockup-toggle.html`
  (interação) e `.../3304-1780878746/content/mockup-elegant.html` (estilo dos popovers).

## Fluxos

### Marcar
1. Seleciona um trecho dentro do enunciado ou de uma alternativa.
2. Popover de seleção aparece ancorado: toggle (lembra a última escolha) + cores.
3. **Atenção + cor** → cria a marca com triângulo e **abre a nota** (tipo default
   "Pegadinha", textarea focado).
4. **Grifo comum + cor** → cria a marca só com a cor. Fim, sem popup de nota.

### Editar / anotar
- Clicar numa marca **Atenção** → abre a nota (trocar tipo no dropdown, anotar, trocar
  cor, remover). Auto-save ao clicar fora.
- Clicar num **Grifo comum** → mini-menu (trocar cor / Virar Atenção / Remover).

### Remover
- Pela nota (Atenção) ou mini-menu (comum), botão 🗑. (Sem `Ctrl+clique`.)

### Caderno
- Botão **"Meu Caderno"** (com o triângulo) no header da página de questões.
- Drawer lateral (desktop) / `MobileSheet` (mobile): lista de todas as marcas do aluno,
  **filtro por tipo** (chips), **busca** textual, cada item = trecho + nota + origem
  (questão/banca/ano) + "Revisar / Ir pra questão" (deep-link com scroll até a marca).

## Arquitetura técnica

### Renderização & ancoragem (o coração)

**Decisão: pintar sem mutar o DOM.**

- **Fundo da marca:** **CSS Custom Highlight API** (`Highlight` + `::highlight()`).
  Como a paleta é **finita (12 cores)**, registramos **um `Highlight` por cor** (×2 para
  os dois níveis de opacidade Atenção/comum) e definimos as regras `::highlight(mark-c1)`
  etc. no CSS. Pintar = adicionar o `Range` da marca ao `Highlight` da sua cor. **Zero
  alteração no DOM da questão → impossível quebrar o HTML sujo; zero empurrão de layout.**
- **Triângulo (Atenção):** a Highlight API não desenha ícone. Então uma **camada de
  overlay** absoluta sobre o bloco posiciona cada triângulo no **primeiro retângulo** do
  `Range` (`range.getClientRects()[0]`), recalculado em resize/reflow (`ResizeObserver`).
- **Fallback** (navegadores sem Highlight API): embrulhar **apenas nós de texto** do
  range (sem atravessar/duplicar elementos), com `background` inline. Nunca usar offsets.
- **Clique numa marca:** hit-testing — clique no triângulo (overlay, fácil) **ou** no
  texto pintado (`caretRangeFromPoint` → achar qual marca contém o ponto). Abre o popover.

**Ancoragem persistente por quote + contexto (W3C TextQuote Selector):** guardamos o
`quote` (texto exato), `prefix` e `suffix` (~32 chars de contexto). Ao renderizar,
varremos o `textContent` do bloco e achamos a ocorrência cujo prefixo/sufixo casa. Robusto
à re-sanitização/re-render (≠ offset, que o `lisere` usava e quebrava).

### Modelo de dados (Supabase)

Tabela nova `question_highlights`, espelhando o padrão de `question_notes`:

| coluna | tipo | nota |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid | RLS: dono |
| `question_id` | int8 | |
| `target` | text | `'enunciado'` ou `'alt:A'`, `'alt:B'`… (qual bloco) |
| `kind` | text | `'plain'` \| `'attention'` |
| `color` | text | hex (`#E0484D`) |
| `type` | text null | só Atenção: `pegadinha\|chave\|cuidado\|sacada\|revisar` |
| `quote` | text | texto exato grifado |
| `prefix` | text | ~32 chars antes |
| `suffix` | text | ~32 chars depois |
| `note` | text null | só Atenção |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

- **RLS** em todas as operações (dono lê/escreve as suas).
- **Índices:** `(user_id, question_id)` (render por questão), `(user_id, type)` e
  `(user_id, created_at desc)` (Caderno).
- Regenerar `src/types/database.ts` após criar a tabela.

### Hooks (React Query, padrão `useServerFirst`/`useQuestionNote`)

- `useQuestionHighlights(questionId)` — lista por questão + `create` / `update` /
  `remove`, com optimistic update.
- `useHighlightsAll({ filterType?, search? })` — paginado, alimenta o Caderno.
- `useHighlightsCount()` — badge do botão Caderno.

### Componentes (`src/components/questoes/highlights/`)

- `HighlightLayer.tsx` — recebe o ref do bloco "markable" + as marcas; resolve âncoras,
  pinta via Highlight API e posiciona os triângulos no overlay. Reposiciona em resize.
- `SelectionToolbar.tsx` — popover de seleção (toggle Atenção/Comum + paleta).
- `HighlightNotePopover.tsx` — nota da Atenção (dropdown de tipo + textarea + cores + 🗑,
  auto-save).
- `PlainHighlightMenu.tsx` — mini-menu do grifo comum.
- `PegadinhasDrawer.tsx` + `PegadinhaItem.tsx` — o Caderno (filtros, busca, deep-link).
- `highlights.config.ts` — fonte única de `COLORS` e dos `TYPES` (emoji/triângulo, label).
- `lib/highlight-anchor.ts` — `createAnchor(range)` e `resolveAnchor(block, anchor)`.

### Integração

- **`QuestionCard.tsx`:**
  - Marcar o container do enunciado e de **cada alternativa** com `data-markable` +
    `data-target` (`enunciado` / `alt:A`…), e um ref.
  - Montar o `HighlightLayer` sobre esses blocos.
  - **Remover** o `lisere` / `TextHighlighter` / `HIGHLIGHT_STYLES` / estado
    `highlightMode` e os botões Highlighter/Strikethrough do header (substituídos).
  - Fiar o `SelectionToolbar` (mouseup/touchend dentro de `[data-markable]`).
- **Header da página de questões / `AppTopNav`:** botão **"Meu Caderno"** + badge.
- **Deep-link:** `?hl=<id>` → abrir a questão, rolar e piscar a marca.

### Mobile

- Popover de seleção e nota viram **bottom sheet** (`MobileSheet`, já existe) no mobile.
- Swatches com área de toque confortável; long-press não conflita com seleção nativa.

## Testes

- **Anchoring:** unit tests de `createAnchor`/`resolveAnchor` (quote único, quote
  repetido desambiguado por prefix/suffix, trecho com entidades/acentos, re-render).
- **Render:** marca não altera `innerHTML` do bloco; sobreposição de duas marcas;
  marca que quebra em duas linhas (triângulo na 1ª linha).
- **Fluxos:** criar comum, criar atenção, promover comum→atenção, trocar cor, trocar
  tipo, remover, auto-save da nota.
- **Caderno:** filtro por tipo, busca, deep-link.
- **Perf:** N marcas numa questão + scroll da lista virtualizada sem jank.

## Pontas deixadas abertas (futuro, sem retrabalho)

- `quote`/`type`/`target` já modelados → flashcard FSRS lê a tabela direto.
- View agregada anônima por `question_id`+`quote` → heatmap social.
- `note` + contexto → entrada de IA (sugerir/explicar a pegadinha).
