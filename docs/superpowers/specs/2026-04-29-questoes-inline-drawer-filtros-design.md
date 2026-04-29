# Leva 2 — Inline Drawer de Filtros (página Questões)

**Data:** 2026-04-29
**Autor:** Aldemir + Claude Opus 4.7
**Status:** design aprovado — pronto pra plano de implementação

## Problema

A barra de filtros atual da página `/questoes` empilha pills + chips com pipes + search bar + results header em faixas horizontais sequenciais. O modelo "click pill → popover → escolhe → fecha → click próxima pill" obriga o aluno a abrir e fechar várias vezes pra montar a busca, e o sumário do que está selecionado fica fragmentado.

Após a Leva 1 (seção OBJETIVO), o próximo passo é colapsar todo o trabalho de seleção em **um card único** com chips no topo e um drawer 2 colunas que mostra o picker da chip ativa de um lado e o sumário global dos filtros do outro — tudo visível ao mesmo tempo.

## Objetivo desta spec

Substituir `QuestoesFilterBar` (e seus satélites — popover, sheet, overlay, chips bar, advanced popover) por um **card de filtros com drawer inline** + separação dos resultados em **tab "Questões"** dentro da mesma página `/questoes`.

A página passa a ter 4 tabs no topo:

```
[Filtros · Filtro semântico · Cadernos]                              [Questões]
```

- **Filtros** (default): hospeda o card novo (chip strip + drawer 2 colunas)
- **Filtro semântico**: mantém comportamento atual (slash autocomplete + busca semântica)
- **Cadernos**: mantém comportamento atual
- **Questões** (afastada à direita): destino de "Aplicar filtros" — mostra resumo dos filtros aplicados, busca textual, sort, view mode e a lista de questões

## Decisões-chave

### (1) Tabs com URL sync (não rotas separadas)

Tab ativa controlada por search param `?view=filtros|semantico|cadernos|questoes`. Default ao entrar = `filtros`.

Trocar de tab faz `router.push` → empurra no histórico → botão "voltar" do navegador alterna naturalmente entre as tabs. Filtros aplicados também viram search params (`?view=questoes&bancas=cespe&ano=2023`), tornando o link compartilhável e bookmarkavel. URL é a fonte da verdade dos filtros aplicados.

**Por quê tabs e não rotas separadas (`/questoes/lista`):** o usuário expressou que o fluxo "edita filtros → vê questões → edita de novo" é mais fluido como troca de tab dentro do mesmo workspace do que como navegação entre páginas. Tabs preservam a metáfora de "estou trabalhando na minha sessão de estudo".

### (2) Chip strip no topo do card

Sempre **uma chip ativa** (default: `Matéria · Assuntos`). Trocar de chip troca o conteúdo da coluna esquerda do drawer; **não fecha** o drawer.

Sequência das chips (alinhada com `filter-config.ts` atual):

```
📚 Matéria · Assuntos | 🏛 Banca | 🏢 Órgão · Cargo | 📅 Ano | 🎯 Área (Carreira) | 🎓 Escolaridade | Mais ⌄
```

- Chip ativa: fundo branco, indicador (underline) na cor primária do app
- Chip inativa: ícone + label cinza, hover claro
- **Sem badges numéricos** nas chips (mockup é limpo nesse ponto)
- `Mais ⌄`: dropdown com categorias menos usadas (lista a definir no plano)

### (3) Drawer 2 colunas (desktop)

Abaixo do chip strip, sempre visível. Coluna esquerda ~60%, coluna direita ~40%.

#### Coluna esquerda — Picker da chip ativa

Anatomia comum a todos os pickers:

- **Título grande** da tab (ex: "Matérias e assuntos") em texto escuro
- **Subtítulo** em cinza (ex: "19 matérias · clique nas pastas para abrir os assuntos")
- **Atalho à direita do título** em azul com seta (ex: "Pesquisar por nome →") — toggle de modo de navegação quando aplicável
- **Search input** dedicado da tab
- **Bloco "Recentes"** acima da lista quando `recentes.length > 0` (top 5, pattern já existente via `useRecentFilters`)
- **Lista agrupada alfabeticamente**: divisor de letra (`A`, `B`, `C`…) em cinza claro antes do bloco
- Cada item da lista: ícone de pasta cinza + nome **em azul** (link clicável)

Conteúdo varia por tab:

- **Matéria · Assuntos**: usa `TaxonomiaTreePicker` quando matéria tem taxonomia (Direito Administrativo hoje, outras matérias conforme pipeline avança); cai pra lista flat de assuntos quando não tem taxonomia
- **Banca / Ano / Órgão · Cargo / Escolaridade**: lista checkable agrupada (alfabética para texto, decrescente para anos), reusa lógica dos popovers atuais extraída para componentes plug-and-play
- **Área (Carreira)**: lista das carreiras (mesma fonte do OBJETIVO mas como filtro discreto, não foco)

#### Coluna direita — Painel de filtros ativos

Fixa em todas as tabs (mostra todos os filtros pendentes, independente da chip ativa).

- Header: `FILTROS ATIVOS · N` (uppercase, cinza médio) + atalho **"Carregar ↑"** em azul à direita (comportamento TBD — fora do escopo desta Leva)
- **Grupos por categoria** com nome em uppercase pequeno (ex: `DIREITO ADMINISTRATIVO`) e `×` à direita do header pra limpar o grupo inteiro
- Cada item dentro do grupo: **borda accent amber/dourada** à esquerda + texto cinza escuro + **`×` à direita aparece no hover** (remove só aquele item)
- Separador entre grupos
- Após último grupo: separador → número grande da contagem (`3.886.057`) → label "questões encontradas" em cinza
- **Botão primário "Aplicar filtros"** (fundo escuro, texto branco) lado a lado com **botão secundário "Editar qtd."** (outline)

#### Empty state do painel direito

Quando `N = 0` (nenhum filtro pendente): grupos somem, painel mostra mensagem em cinza claro como "Nenhum filtro ativo · selecione opções na esquerda" e o count exibe o total da base.

### (4) Contagem em tempo real

Cada mudança nos filtros pendentes dispara `GET /api/v1/questoes/count?<params>` — **endpoint dedicado novo** na verus-api (não flag `count_only` no endpoint de listagem). Razões: query mais rápida (só `COUNT`, não paginate dados), cache mais limpo, separation of concerns.

- **Debounce 300ms** — margem suficiente pra usuário marcar 2-3 itens em sequência sem disparar 3 requests
- **AbortController** — cancela request anterior quando novo começa, evita race condition
- **Cache local em memória** — LRU 50 entries, key = serialização canônica dos filtros pendentes ordenados
- **Cache backend (Redis)** — key `questoes:count:<hash-filtros>`, TTL 30 min, invalidação por ingestão (fora do escopo desta spec)
- **Loading state** — spinner pequeno ao lado do número (não substitui), evita layout shift
- **Erro** — mostra "—" + tooltip "Não foi possível atualizar a contagem" + retry automático em 5s; "Aplicar filtros" desabilitado até count voltar
- **Guardrail de performance** — alvo <300ms cache hit, <2s cache miss; passou de 2s mostra "Calculando…"
- Trocar de chip **não dispara** count (só seleção/desseleção de valor recalcula)

### (5) Filtros pendentes vs aplicados

- **Pendentes** (em construção, ainda não aplicados): contexto React `QuestoesFilterDraftContext` + `sessionStorage` como rascunho
- **Aplicados**: search params da URL — fonte da verdade pra query da listagem
- **Painel direito** reflete sempre os **pendentes** (não aplicados) — usuário vê o que vai aplicar
- **"Aplicar filtros"** → serializa pendentes pra URL + troca tab pra Questões
- **"Editar filtros"** na tab Questões → pendentes herdam dos aplicados, troca tab pra Filtros (sem perder nada)

#### Estado dirty (mudanças não aplicadas)

Quando `pendentes !== aplicados`:

- Botão primário muda de **"Aplicar filtros"** para **"Aplicar mudanças"** (mesmo visual, label distinto)
- Sutil dot indicador na chip da tab onde houver mudança vs aplicado (ex: chip Banca com dot quando o usuário mexeu em bancas pendentes mas ainda não aplicou)
- Quando `pendentes === aplicados`: botão fica desabilitado (não há nada pra aplicar)

Esse padrão dá feedback claro de "tem trabalho não salvo" e evita confusão entre "o que vejo" e "o que está aplicado".

### (6) Tab "Questões"

Conteúdo (na ordem):

- **Resumo dos filtros aplicados no topo**: chips compactos tipo "Banca: CESPE | Ano: 2023 | …" + botão "← Editar filtros" (volta `view=filtros`)
- **Busca textual** ("Pesquisar enunciado") — **refinamento separado** sobre a lista já filtrada; **não entra no count do drawer** nem vira chip no painel direito quando volta pra Filtros. Mantém comportamento atual.
- **Sort** (Mais relevantes / Mais recentes / etc.) + **view mode** (cards / lista) — controles atuais reposicionados aqui. **Persistem em `localStorage`** entre sessões (default 1ª visita: "Mais relevantes" + cards).
- **Lista virtualizada** de questões (`VirtualizedQuestionList`, sem mudança estrutural — só recebe filtros via URL params)

### (7) Mobile (bottom sheet)

Reusa `MobileSheet` (componente compartilhado já existente: `dvh`, `confirmClose`, CSS transitions, fallback `useVisualViewport`).

- **Chip strip permanece visível na página** (não é colapsado num sheet — diferente do modelo atual)
- **Tap em uma chip** → abre `MobileSheet` fullscreen com o picker daquela chip
- **Header do sheet** contém um strip de chips horizontal scrollável — usuário troca de chip dentro do sheet sem fechar e reabrir
- **Bar fixa no rodapé do sheet**: `Ver filtros (N) · 3.886.057 · [Aplicar]`
- **Tap em "Ver filtros (N)"** → segundo sheet (ou troca de conteúdo no mesmo) com a coluna direita (grupos amber, ×, etc.)
- **Aplicar** → fecha sheet + serializa URL + troca tab pra Questões
- Bloco "Recentes" idêntico no topo do sheet do picker

## Pré-requisitos e sequência de entrega

A implementação **depende de backend pronto**. Sequência obrigatória:

1. **Backend (verus-api)** — implementar `GET /api/v1/questoes/count` com cache Redis. Bloqueador frontend.
2. **Frontend — refator do shell de tabs** — `QuestoesPage.tsx` vira shell com strip de tabs + view router. Sem ainda mudar a tab Filtros (mantém `QuestoesFilterBar` antigo nessa fase). Garante que tab Questões funciona como destino.
3. **Frontend — card novo na tab Filtros** — implementar `QuestoesFilterCard` + chip strip + drawer 2 colunas + pickers + painel direito. Substitui `QuestoesFilterBar` apenas dentro da tab Filtros.
4. **Frontend — mobile** — `QuestoesFilterMobileSheet` reusando `MobileSheet` existente.
5. **Cleanup** — aposentar arquivos da lista "A aposentar" (após validar que nada mais consome).

Os passos 2 e 3 podem ser PRs separados pra reduzir risco. O backend (passo 1) **não pode ser pulado** — sem o endpoint de count, a UX em tempo real não funciona.

## Animação

- Troca de chip ativa → **fade simples 150ms** (cross-fade do conteúdo da coluna esquerda)
- Drawer abre/fecha (caso cenário futuro de colapso) → fora do escopo (drawer é sempre aberto)
- Mobile sheet → transições padrão do `MobileSheet` existente

## Arquivos afetados

### Novos

```
src/views/QuestoesPage.tsx                          (modificado pesado — strip de tabs, view router)
src/components/questoes/filtros/
  QuestoesFilterCard.tsx
  QuestoesFilterChipStrip.tsx
  QuestoesFilterDrawer.tsx                          (drawer 2 colunas desktop)
  QuestoesFilterMobileSheet.tsx                     (variante mobile)
  QuestoesFilterPicker.tsx                          (wrapper que escolhe sub-picker por chip ativa)
  QuestoesActiveFiltersPanel.tsx                    (coluna direita)
  QuestoesFilterEmptyState.tsx
  pickers/
    MateriaAssuntosPicker.tsx                       (delega TaxonomiaTreePicker quando há taxonomia)
    BancaPicker.tsx
    AnoPicker.tsx
    OrgaoCargoPicker.tsx
    EscolaridadePicker.tsx
    AreaCarreiraPicker.tsx
  shared/
    FilterAlphabeticList.tsx                        (divisor de letra + linhas com ícone azul)
    FilterRecentesBlock.tsx                         (bloco "Recentes" no topo do picker)
    FilterCheckboxItem.tsx
src/components/questoes/lista/
  QuestoesListaView.tsx                             (conteúdo da tab Questões)
  QuestoesActiveFiltersChips.tsx                    (chips dos filtros aplicados no topo)
src/contexts/QuestoesFilterDraftContext.tsx         (estado pendente + sessionStorage)
src/hooks/useFiltersFromUrl.ts                      (parse + serialize search params <-> objeto)
src/hooks/useQuestoesCount.ts                       (debounced count + AbortController + LRU)
src/lib/questoes/filter-serialization.ts            (canonical key + URL encoding)
```

### Modificados

```
src/views/QuestoesPage.tsx                          (já listado — vira shell com tab strip + view router)
src/components/questoes/QuestoesSearchBar.tsx       (move pra dentro de QuestoesListaView)
src/components/questoes/QuestoesResultsHeader.tsx   (move pra dentro de QuestoesListaView)
src/components/questoes/VirtualizedQuestionList.tsx (lê filtros aplicados via URL params, sem mudança estrutural)
src/components/questoes/filter-config.ts            (review da lista de chips de 1ª linha vs "Mais ⌄")
src/hooks/useQuestoesV2.ts                          (lê filtros da URL)
```

### A aposentar

```
src/components/questoes/QuestoesFilterBar.tsx
src/components/questoes/QuestoesFilterPill.tsx
src/components/questoes/QuestoesFilterPopover.tsx
src/components/questoes/QuestoesFilterSheet.tsx
src/components/questoes/QuestoesFilterOverlay.tsx
src/components/questoes/FilterChipsBidirectional.tsx
src/components/questoes/QuestoesAdvancedPopover.tsx
src/components/questoes/QuestoesSlashInlineDropdown.tsx (movido para tab Filtro Semântico)
```

### Backend (verus-api)

```
GET /api/v1/questoes/count?<params>                  (novo — count debounced em tempo real)
   └─ ou flag count_only=true no endpoint atual de listagem
   └─ cache Redis: key=questoes:count:<hash-filtros>, TTL 30min
```

## Edge cases

1. **`count = 0`** → painel mostra `0 · questões encontradas` em cinza, botão "Aplicar filtros" continua habilitado (não bloqueia, não infantiliza)
2. **Aplicar com 0 resultados** → tab Questões mostra empty state com "Nenhuma questão atende aos filtros · ajustar filtros" (link volta `view=filtros`)
3. **Landing direto em `/questoes?view=questoes&...params`** (link compartilhado) → contexto hidrata pendentes a partir da URL, count sincronizado, tab abre direto em Questões
4. **Browser back de Lista → Filtros** → draft reflete a URL atual, sem perda de estado
5. **Pendentes ≠ aplicados, usuário troca de chip** → não invalida draft; só troca picker visível; painel direito sempre reflete pendentes
6. **Conflito de filtros** (ex: combinação retorna 0) → não bloqueia; só atualiza contador
7. **`Mais ⌄` overflow** → comportamento exato (substitui chip vs aba efêmera) decidido no plano
8. **Mobile** → mesmo modelo de count debounced; UX adapatada via `MobileSheet`

## Telemetria mínima (recomendada, não bloqueante)

Eventos: `filter_chip_change`, `filter_apply`, `filter_clear_group`, `filter_remove_item`, `count_load_ms`. Útil pra entender qual chip mais usada, tempo médio até Aplicar, taxa de Aplicar com 0.

## Fora de escopo (Leva 2)

- Mudanças na tab "Filtro semântico" (mantém slash autocomplete + busca semântica como hoje)
- Mudanças na tab "Cadernos"
- Comportamento exato de **"Carregar ↑"** (TBD — provável que seja outra Leva)
- Implementação real do `SemanticScopeToggle` (Fase 2 de Objetivo, brainstorm separado)
- Lista definitiva de **"Mais ⌄"** (alinhar no plano)
- Editor de comentários, moderação, reactions — sem mudança
- OBJETIVO section — mantida 1:1 (Leva 1 já mergeada)

## Decisões resolvidas neste brainstorm

- **Roteamento**: tabs com URL sync (`?view=...`) — não rotas separadas
- **Endpoint de count**: dedicado novo `/api/v1/questoes/count`
- **Animação de troca de chip**: fade simples 150ms
- **Busca textual**: refinamento separado, não entra no count
- **Sort/view persistência**: localStorage
- **Migração de localStorage antigo**: sem migração (base pequena, custo > benefício)

## Decisões abertas pro plano de implementação

1. **Comportamento de "Carregar ↑"** — deixar oculto até definir uma próxima Leva (provável "filter sets nomeados")
2. **"Mais ⌄"** — overflow menu vs aba efêmera com close × ao escolher categoria de lá
3. **Cache Redis backend** — TTL e estratégia de invalidação ao ingerir novas questões
4. **`Editar qtd.`** — comportamento exato (paginação? limite tipo caderno?) — alinhar com `filter-config.ts` atual

## Mockups de referência

- `C:\Users\Home\3D Objects\aprimeiro.png` — V1 Inline Drawer (chip 'bloomed') — fornecido pelo usuário em 2026-04-29
