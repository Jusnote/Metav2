# Home v4 — Implementação (plano)

> **Para executores:** SUB-SKILL: `superpowers:subagent-driven-development`. **A SPEC CANÔNICA é o mock aprovado:**
> `docs/superpowers/specs/2026-06-11-home-v4-perfeita.html` (estado COMMITADO — medalhas metálicas claras).
> Ordem do Aldemir: **"implementar exatamente, idêntico"** — fidelidade visual 1:1 ao mock.

**Goal:** Reescrever a página Início (`src/views/HomePage.tsx`) idêntica ao mock v4: hero (saudação + Nível/XP + Sequência) → CTA verde "Continuar" → stats 3 → [Constância ⅓ | Pontos de atenção ⅔] → [Quadro de conquistas ⅔ | Atividade recente ⅓] → Últimos 14 dias (rodapé full-width).

**Arquitetura:** A página renderiza dentro do `AppTopNav` (header/nav/fio já implementados) sobre o `AuroraBackground` (Luz de estúdio — `/` já está nas auroraRoutes). Implementar SÓ o conteúdo da página. Quebrar em componentes em `src/components/home/` + um `home.css` com as animações (rise stagger, ringfill, hover lift, prefers-reduced-motion).

## Dados: reais onde existem, placeholder marcado onde não
- **Reais:** nome do usuário (useAuth user_metadata, como hoje), medalhas (array `medals` local existente em HomePage.tsx — preservar), contagens que já existirem em hooks.
- **Placeholder com os MESMOS valores do mock** (TODO comentado, sem inventar backend): Nível/XP (12, 820/1500, +40), streak (14 dias, recorde 21, dots da semana), CTA continuar (Dir. Adm › Atos, 18/40, 73%, 45%), stats (73% ↑3pts, ↑18%/↑12%, 47/50, 12 revisões ~9min), heatmap (padrão do mock, 84 dias), pontos de atenção (3 linhas do mock), atividade recente (5 itens do mock), sparkline (14 barras do mock).
- Regra: zero dado fake NOVO; manter exatamente os números do mock como estado inicial.

## Files
- REESCREVER `src/views/HomePage.tsx` — orquestra as fileiras; remove TODAS as seções antigas (XP/Nível antigo, quadro navy, Atividade Recente fake antiga, Ações rápidas, navigation cards). O array `medals` (dados) PERMANECE no arquivo (ou move pra `home-data.ts`); o Dialog "ver todas" existente PERMANECE ligado ao link "Ver todas →" (reskin é follow-up, não desta entrega).
- NEW `src/components/home/home.css` — todos os estilos do mock portados (classes do mock viram classes reais; manter os nomes pra conferência 1:1: .hero, .lvl, .ringsvg, .stk, .wk, .cta, .grid3, .stat, .grid12, .heatcard, .minihm, .med, .mgrid, .mi, .hex variants, .medft, .pgdots, .grid21, .rad, .act, .tl, .ti, .spark, .sft, .r/.d1-.d6, @keyframes rise/ringfill).
- NEW `src/components/home/HeroRow.tsx` — saudação (h1 Source Serif + sub) + card Nível (anel SVG animado, chip XP, popover "Como ganho XP" no hover do info) + card Sequência (chama, dots da semana com .today).
- NEW `src/components/home/ContinueCta.tsx` — CTA verde com highlight radial, hairline 45%, botão com seta deslizante.
- NEW `src/components/home/ConstanciaCard.tsx` — mini-heatmap 12×7 (células 9px, hover scale) + "84 dias ativos".
- NEW `src/components/home/PontosAtencao.tsx` — 3 linhas dot/diagnóstico/% /Treinar→ (Treinar → navega `/questoes`).
- NEW `src/components/home/StatsRow.tsx` — 3 cards com baselines travadas, micro-trend, hairline da meta, "ver detalhes →" no hover.
- NEW `src/components/home/MedalsBoard.tsx` — grid 5 com os hexágonos SVG metálicos claros DO MOCK (gGold/gSilver/gBronze/gLock + shine + drop-shadow colorida; ícones lucide reais no lugar dos paths do mock), barras+"faltam X" nas travadas, rodapé "Próxima:..." + pgdots; "Ver todas →" abre o Dialog existente.
- NEW `src/components/home/AtividadeRecente.tsx` — timeline (fio, tiles tonais, 5 itens, link "Rever as 7 →" → `/questoes`), rodapé "Ver histórico →".
- NEW `src/components/home/SparklineCard.tsx` — 14 barras com labels de dia, barra de hoje destacada, footer.
- Test: `src/components/home/__tests__/home.test.tsx` — smoke: renderiza fileiras, nome do usuário aparece, 5 medalhas, links navegam (mock de router).

## Regras
1. **Fidelidade 1:1**: cores, tamanhos, espaçamentos, textos EXATOS do mock (committed). Na dúvida, abrir o mock e copiar o valor.
2. Tailwind onde natural; CSS do home.css pro que o mock define em CSS (animações, hexágonos, heatmap).
3. Ícones: lucide-react (Flame, Info, etc.) stroke 1.6-1.8 — zero emoji.
4. Dark mode: NÃO é desta entrega (o app usa a Home clara); não quebrar se .dark ativo (texto legível), mas sem polimento dark.
5. `prefers-reduced-motion` desliga animações.
6. Navegações: Retomar→`/questoes`, Revisar→`/flashcards`, Treinar→`/questoes`, ver detalhes→`/estatisticas` (se a rota não existir, `/questoes`), Ajuste fino é aceitável.
7. Não tocar em AppTopNav/AuroraBackground/outras views.

## Tasks
1. **Página completa** (um implementador): css + componentes + HomePage reescrita + teste smoke. Vitest verde, eslint limpo.
2. **QA**: revisão adversarial focada em fidelidade ao mock + regressões (Dialog medalhas abre? navegações? nada do antigo sobrou órfão — imports mortos, ícones não usados). Conferência visual do Aldemir no app.
