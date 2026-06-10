# Marcação v2 — Barra lateral + Popover de ícones (plano)

> **Para executores:** SUB-SKILL: `superpowers:subagent-driven-development`. **A SPEC CANÔNICA é o mock aprovado:** `docs/superpowers/specs/2026-06-10-marcacao-v2-mock.html` — abra e leia o HTML/CSS/JS dele; o comportamento e o visual devem ser **exatamente iguais** (ordem do Aldemir: "implemente exatamente igual, não mude nada").

**Goal:** Levar o design aprovado no mock pro app real (página /questoes): barra lateral flutuante (setinha-modo + bancada expansível), popover de seleção com 4 ferramentas em ícones (pegadinha/grifar/sublinhar/tachar) com paletas no hover e teclado, dois novos tipos de marca (sublinhado/tachado), borracha, olhinho, cursor-marcador.

**Arquitetura:** Estado de ferramenta é **da página** (um `MarkingToolsContext` em volta da lista + barra); a marcação continua **por card** (MarkableBlock/HighlightLayer/useQuestionHighlights). Sem popover quando caneta ativa; marcação restrita a enunciado+alternativas (já garantido pelo MarkableBlock). Desktop-only por ora (barra escondida <768px; mobile é tarefa futura).

---

## Decisões fixadas (do mock)
- **Cores (8):** `['#E0484D','#E8703A','#F2C231','#4CAF6E','#2BB7A3','#4F86E0','#8B5CF6','#8A8F98']` (substituem QUICK_COLORS nos pontos da marcação).
- **Memória de cor POR ferramenta** (`lastCol`): comum=`#F2C231`, peg=`#E0484D`, sub=`#4F86E0`, tax=`#E0484D`. Persistir em localStorage (`marking-lastcol`), junto com `selTool`.
- **Kinds novos:** `underline` (linha 2px na base, sem fundo) e `strike` (linha 2px a **52%** da altura + texto **ofuscado** ~42%). `attention`/`plain` inalterados.
- **Popover (seleção):** SÓ ícones `△ |sep| 🖊(marca-texto) |sep| U̲ |sep| S̶`, cada um seguido de paleta que desliza no hover (e no fluxo numérico, com numerozinhos 1-8 nas bolinhas). Placement **top** (em cima da seleção). Clique no ícone = última cor; `.last` destaca o último usado. `preventDefault` no mousedown (não colapsar seleção).
- **Teclado com seleção no card:** `A`=pegadinha `G`=grifar `S`=sublinhar `T`=tachar (instante, última cor); `1-4` abre paleta numerada da ferramenta → `1-8` escolhe cor; `Esc` cancela. Ignorar se digitando em input/textarea/balão.
- **Teclado sem seleção:** `1-4` ativa caneta (última cor), `E` borracha, `H` olhinho, `Esc` solta tudo.
- **Barra:** fixa, centrada verticalmente, à ESQUERDA da coluna de questões. Encolhida (selTool on) = setinha acesa + caderno(badge). Setinha clicada: com caneta/borracha → volta seleção; senão → liga/desliga popover. Expandida = 4 tipos + borracha + olhinho; clique no tipo → **accordion vertical** de cores embaixo dele (recolhe ao escolher) → caneta ativa naquela cor (`.on` = translateX(4px)+bg, ícone tingido). Pegar caneta = selTool false (expande). Badge do caderno = `useHighlightsCount()` (total do usuário); clique = no-op "em breve".
- **Caneta ativa:** seleção em enunciado/alternativa marca NA HORA (pegadinha abre balão de edição; demais só toast curto opcional — no app: sem toast, feedback é a marca aparecer). Cursor vira marcador colorido sobre os blocos markáveis (SVG data-uri, cor da caneta).
- **Borracha:** marcas com outline tracejado vermelho; hover = wash vermelho; clique apaga (sem confirmação).
- **Olhinho:** oculta TODAS as marcas (fundos, linhas, triângulos, wash do tachado) e desativa hover/balão.
- **Mini-menu (clique em marca plain/underline/strike):** 8 bolinhas + lixeira (substitui o PlainHighlightMenu atual — sai o "Virar Atenção" e o layout antigo).
- **Balão (attention):** mantém o já implementado (hover lê / lápis edita / dropdown tipo muda cor semântica / fileira de cores / salvar). Ícone do grifar = Lucide `highlighter` (paths no mock).
- **Dark mode:** tudo tokenizado (seguir o padrão `--qh-*` de highlights.css). O wash do tachado usa a cor do card (`--qc-card`).

## Files
- `supabase/migrations/<ts>_question_highlights_kinds.sql` — DROP/ADD do check de `kind` p/ ('plain','attention','underline','strike'). (Aldemir roda no painel.)
- `src/components/questoes/highlights/types.ts` — MarkKind + ToolId.
- `src/components/questoes/highlights/highlights.config.ts` — MARK_COLORS(8), DEFAULT_LAST_COLORS, ícones/metadata das 4 ferramentas.
- NEW `src/components/questoes/highlights/MarkingToolsContext.tsx` — provider+hook: {selTool, mode, modeColor, erase, hideMarks, lastCol, setters, pick/release}; localStorage; default value sem provider = comportamento atual (selTool on, sem caneta).
- NEW `src/components/questoes/highlights/MarkingSidebar.tsx` + estilos em `highlights.css` — a barra (estados, accordion, atalhos globais sem seleção, cursor-marcador via <style> dinâmico).
- `src/components/questoes/highlights/HighlightLayer.tsx` — render underline/strike (linha + wash em overlay superior `z:2, pointer-events:none`), hideMarks, visual da borracha (hovered mark).
- `src/components/questoes/highlights/SelectionToolbar.tsx` — REESCREVER: 4 ícones + paletas hover/numéricas; onPick(kind, color).
- `src/components/questoes/highlights/PlainHighlightMenu.tsx` — REESCREVER: 8 cores + lixeira.
- `src/components/QuestionCard.tsx` — integração: caneta marca direto; seleção "silenciosa" quando selTool off (teclas funcionam sem popover); teclado com seleção (A/G/S/T + numérico 2 toques) por card (listener só quando há seleção própria); placement top; clique com borracha apaga; clique em plain/underline/strike → mini-menu; hover/balão off com caneta/borracha/olhinho.
- `src/views/...` (QuestoesListaView) — montar Provider + <MarkingSidebar/> em volta da lista (só desktop, só view 'questoes').
- Tests: atualizar/criar em `highlights/__tests__` (toolbar nova, menu novo, context, layer underline/strike).

## Tasks
1. **Fundação+render:** migração, types, config, Context, HighlightLayer (underline/strike/hide/erase), CSS tokens dark/light. Testes verdes.
2. **Barra:** MarkingSidebar + wiring na página + atalhos sem seleção + cursor. 
3. **Popover+card:** SelectionToolbar nova, PlainHighlightMenu novo, QuestionCard integrado (instante/silencioso/teclado/borracha), placement top.
4. **QA:** vitest + eslint + revisão adversarial + teste manual Aldemir (claro/escuro).
