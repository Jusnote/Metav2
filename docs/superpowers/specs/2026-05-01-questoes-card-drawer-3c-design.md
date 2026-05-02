# Plano 3c — Card + Drawer Inline (Leva 2)

**Data:** 2026-05-01
**Autor:** Aldemir + Claude Opus 4.7
**Status:** design aprovado — pronto pra plano de implementação
**Spec base:** [`2026-04-29-questoes-inline-drawer-filtros-design.md`](./2026-04-29-questoes-inline-drawer-filtros-design.md)
**Referência visual:** screenshot fornecido pelo usuário em 2026-05-01 (chip strip + drawer 2 colunas com FILTROS ATIVOS · 6 mostrando 3 grupos amber)

## Escopo

Substituir o `QuestoesFilterBar` legacy pelo card novo (chip strip + drawer 2 colunas + painel direito) **dentro da tab "Filtros"** da página `/questoes`. Card vive atrás de feature flag pra permitir flip-back instantâneo.

Os pickers (Banca, Ano, Órgão+Cargo, Matéria+Assuntos), o backend de count/facets/pair-filtering, e o shell de tabs já existem (Planos 1, 2, 3a, 3b, 3b-pre, 3b-pre-2, 3b-bonus mergeados). Este plano apenas costura tudo no card visual.

## Granularidade — 3 sub-planos sequenciais

```
3c-1 (Foundation)              ─────► 3c-2 (Card + Drawer + Chips)  ─────► 3c-3 (Painel Direito + Flag)
Draft context, serialização,         Card, ChipStrip, Drawer 2-col,        Painel direito completo,
toggles na URL (sem UI)              Picker wrapper, Pickers wiring,       toggles de visibilidade,
                                     EscolaridadePicker novo, perf         Aplicar, feature flag
```

Cada sub-plano entrega valor visível e testável isolado:
- **3c-1:** plumbing — testes unitários + dev console mostram estado pendente correto
- **3c-2:** card visual completo no `/dev/filter-pickers` (sem painel direito ativo)
- **3c-3:** card real em produção atrás da flag — encerra Leva 2 (sem mobile, que é 3d)

## Decisões fechadas neste brainstorm (2026-05-01)

### (1) Chip strip — 6 chips fixos

Sem "Mais ⌄". Sequência:

```
📚 Matéria · Assuntos | 🏛 Banca | 🏢 Órgão · Cargo | 📅 Ano | 🎯 Área (Carreira) | 🎓 Escolaridade
```

- Chip ativa: **underline** de 2px abaixo do label na cor de texto primária do tema (`#1f2937`/cinza-escuro, igual ao texto de heading). Sem fundo branco, sem badge.
- Chip inativa: ícone + label cinza, hover claro
- Trocar de chip → **fade 150ms** via Framer Motion `AnimatePresence mode="wait"` (já confirmada na spec original)
- Trocar de chip **não fecha** o drawer e **não dispara** count

### (2) Drawer — sempre aberto, 2 colunas

Layout:
- Coluna esquerda ~60% — picker da chip ativa
- Coluna direita ~40% — `QuestoesActiveFiltersPanel` (sempre visível)
- Sem estado colapsado (drawer sempre aberto enquanto na tab Filtros)

### (3) Painel direito — sequência vertical

```
┌──────────────────────────────────────┐
│ FILTROS ATIVOS · N    Carregar ↑     │  header (Carregar ↑ disabled, tooltip "em breve")
├──────────────────────────────────────┤
│                                      │
│  [grupos com borda amber + ×]        │  ou empty state
│                                      │
├──────────────────────────────────────┤
│ 3.886.057                            │  count grande + label
│ questões encontradas                 │
├──────────────────────────────────────┤
│ Anuladas:                            │  toggles ternárias estilo
│ ● Mostrar  ○ Esconder                │  radio horizontal "B"
│                                      │
│ Desatualizadas:                      │
│ ● Mostrar  ○ Esconder                │
│                                      │
│ Já respondidas:                      │
│ ● Mostrar  ○ Esconder      [🔒]      │  disabled + tooltip "em breve"
│                                      │
│ Errei antes:                         │
│ ● Mostrar  ○ Esconder  ○ Somente [🔒]│  ternário, disabled
├──────────────────────────────────────┤
│  [Aplicar filtros]                   │  full-width, preto, disabled quando
│                                      │  count = total ou pendentes = aplicados
└──────────────────────────────────────┘
```

### (4) Toggles de visibilidade (4 linhas no painel direito)

Estilo radio horizontal com label uppercase em cima, ponto preto pra estado ativo.

| Toggle | Opções | Default | Status |
|---|---|---|---|
| Anuladas | Mostrar / Esconder | Mostrar | ✅ funcional |
| Desatualizadas | Mostrar / Esconder | Mostrar | ✅ funcional |
| Já respondidas | Mostrar / Esconder | Mostrar | 🔒 disabled, tooltip "em breve" |
| Errei antes | Mostrar / Esconder / Somente | Mostrar | 🔒 disabled, tooltip "em breve" |

**Sem opção "Indiferente"** — "Mostrar" é semanticamente igual e default.

**Por que disabled em "Já respondidas" e "Errei antes":** o backend não tem tabela `user_questao_history` nem auth-aware filtros nas queries. Implementar requer ~1 sprint de backend (migration + auth + JOIN em `/search`/`/count`/`/facets` + persistência em `/responder`). Volta como Leva separada quando a feature for prioridade. UI já preparada — destravar é trocar `disabled` por `onChange`.

**"Errei antes"** é o único ternário porque "Somente as que errei" tem caso de uso real (revisar erros), enquanto "Somente anuladas/desatualizadas/respondidas" não.

### (5) Empty state — variante minimalista

Quando `pendentes = 0`:

```
FILTROS ATIVOS · 0       Carregar ↑

  Nenhum filtro selecionado.

3.886.057
total no banco

[toggles igual normal]

[Aplicar filtros] (disabled)
```

Mensagem centralizada, sem grupos. O número exibe **total da base** (label "total no banco" em vez de "questões encontradas") pra deixar claro que não há filtro aplicado. Botão Aplicar fica disabled.

### (6) "Editar qtd." — removido do design

Comportamento nunca foi definido (paginação? caderno? quiz aleatório?). Adiar pra brainstorm próprio quando aparecer demanda real. Sem ele, "Aplicar filtros" ocupa full-width no fundo do painel.

### (7) "Carregar ↑" — disabled com tooltip

Mantém paridade visual exata com a foto referência. Cor opaca (cinza claro), `aria-disabled`, tooltip "em breve" no hover. Quando filter presets virarem feature, basta trocar `disabled` por `onClick`.

### (8) Estado dirty (pendentes ≠ aplicados)

Reusa pattern já decidido na spec original:
- Botão muda label: "Aplicar filtros" → **"Aplicar mudanças"**
- Dot indicador (cinza claro, 6px) na chip que tem campo modificado vs aplicado
- Quando `pendentes = aplicados`: botão fica disabled

### (9) Feature flag

`NEXT_PUBLIC_FEATURE_NEW_FILTER_CARD` (default `false`).

Integração em `QuestoesPage.tsx` na tab Filtros:

```tsx
const useNewCard = process.env.NEXT_PUBLIC_FEATURE_NEW_FILTER_CARD === 'true';
return useNewCard ? <QuestoesFilterCard /> : <QuestoesFilterBar />;
```

Tab Filtros é o único ponto de integração — outras tabs (Filtro semântico, Cadernos, Questões) não mudam. Flip da flag no Coolify ativa em produção sem deploy.

### (10) Performance — `enabled` prop em `useQuestoesFacets`

Quando o card está em modo lista de órgãos (drilldown ainda não ativo) ou em chip que não usa facets de cargo, o request de facets fica pesado sem necessidade. Solução:

```ts
useQuestoesFacets({ ..., enabled: shouldFetch })
```

Onde `shouldFetch = chipAtiva === 'orgao_cargo' && (modo === 'drilldown' || modo === 'flat-search')`.

Nos pickers ainda em loading (sem facets ainda), exibir **skeleton placeholders** em vez de dados stale. Alvo: cargos no drilldown ≤ 300ms.

### (11) URL serialization estendida

`AppliedFilters` ganha 2 campos:

```ts
interface AppliedFilters {
  // ... existentes ...
  visibility_anuladas?: 'mostrar' | 'esconder';     // default mostrar (omitido na URL)
  visibility_desatualizadas?: 'mostrar' | 'esconder'; // default mostrar (omitido na URL)
}
```

Serialização: só inclui na URL quando ≠ default ("esconder"). Ex: `?anuladas=esconder&desatualizadas=esconder`.

**"Já respondidas" e "Errei antes" não vão pra URL** porque não funcionam — destravam quando o backend de user history existir, e aí ganham campos próprios.

### (12) DraftContext — sessionStorage + URL hydration

Storage: `sessionStorage` (rascunho perde quando fecha aba — comportamento desejado).

Hydration ao montar:
1. Lê URL params → calcula `aplicados` (canônico)
2. Lê `sessionStorage.questoes_draft` → calcula `pendentes`
3. Se `sessionStorage` vazio: `pendentes = aplicados`
4. Se URL params mudaram (deep link): `pendentes = aplicados`, drop draft anterior

Hook expõe:

```ts
useFiltrosPendentes() => {
  pendentes: AppliedFilters,
  aplicados: AppliedFilters,
  isDirty: boolean,
  setPendentes: (next: AppliedFilters) => void,
  apply: () => void,        // serializa pendentes → URL → troca tab pra Questões
  reset: () => void,        // pendentes := aplicados
}
```

## Componentes — novos no 3c

### 3c-1 — Foundation (sem UI)

```
src/contexts/QuestoesFilterDraftContext.tsx        novo
src/hooks/useFiltrosPendentes.ts                   novo
src/lib/questoes/filter-serialization.ts           extender (2 toggles funcionais)
```

**Testes (obrigatórios):**
- Hidratação inicial sem sessionStorage → pendentes = aplicados
- Hidratação com sessionStorage → pendentes = stored
- URL muda externamente (back button) → pendentes = nova URL
- isDirty correto em todos os estados (igual / diferente / vazio)
- Serialização default (mostrar) é omitida na URL
- Serialização não-default (esconder) aparece na URL
- Round-trip: filters → params → filters preserva valores

### 3c-2 — Card + Drawer + Chips

```
src/components/questoes/filtros/
  QuestoesFilterCard.tsx                            novo (container)
  QuestoesFilterChipStrip.tsx                       novo (6 chips + Framer Motion)
  QuestoesFilterDrawer.tsx                          novo (layout 60/40)
  QuestoesFilterPicker.tsx                          novo (wrapper que escolhe sub-picker)
  pickers/
    EscolaridadePicker.tsx                          novo (lista alfabética com FilterCheckboxItem + facet count)
    AreaCarreiraPicker.tsx                          novo (lista de carreiras, fonte useCarreiras)
src/hooks/
  useQuestoesFacets.ts                              extender (prop `enabled`)
```

**Pickers existentes** (Banca, Ano, Órgão+Cargo, Matéria+Assuntos) — apenas wiring dentro do `QuestoesFilterPicker`, sem mudar internals.

**Pickers novos:**
- `EscolaridadePicker`: lista alfabética simples + facet count via `useQuestoesFacets`. **⚠️ Depende de backend:** `escolaridades: string[]` precisa ser adicionado ao endpoint `GET /api/v1/filtros/dicionario`. Trabalho mínimo (1 query distinct + serializer); deve ser primeira task do 3c-2.
- `AreaCarreiraPicker`: lista das áreas de carreira como filtro discreto. **⚠️ Decidir fonte de dados antes do 3c-2:**
  - **Opção A:** usar `useCarreiras` (mesma fonte do OBJETIVO) — verificar se é Supabase ou mock; alinhar nome "carreira" vs filtro backend `areas_concurso`
  - **Opção B:** adicionar `areas_concurso: string[]` ao dicionário (paralelo ao escolaridades), e `AreaCarreiraPicker` consome dele direto

Ambas opções aceitam facet count via `useQuestoesFacets.facets.area_concurso`. Decidir no início do 3c-2 olhando o código de `useCarreiras`.

### Pré-requisitos backend para 3c-2

| Item | Trabalho | Bloqueador? |
|---|---|---|
| `escolaridades` no dicionário | 1 query distinct + serializer | ✅ sim |
| Fonte "Área (Carreira)" | decidir A vs B + possível alteração de dicionário | ✅ sim |

**Estratégia:** primeira task do 3c-2 = "Backend mini-update do dicionário" (Plano 3c-2-pre se virar grande, ou primeira sub-task se ficar pequeno).

**Skeleton state:** todo picker que depende de `useQuestoesFacets` mostra skeleton (cinza claro + animação pulse) enquanto `loading && !facets`. Sem dados stale.

**Testes (mínimo):**
- ChipStrip renderiza 6 chips na ordem correta
- Click em chip ativa underline e troca conteúdo da coluna esquerda
- Animação fade 150ms entre chips (smoke test sem assert visual)
- Drawer mantém layout 60/40 desktop
- Skeleton visível em loading, dados quando carrega
- `enabled: false` em useQuestoesFacets não dispara request (mock fetch)

**Validação visual:** atualizar `/dev/filter-pickers` pra renderizar `QuestoesFilterCard` completo (sem painel direito). Confere chip strip, drawer, transições.

### 3c-3 — Painel Direito + Toggles + Aplicar + Flag

```
src/components/questoes/filtros/
  QuestoesActiveFiltersPanel.tsx                    novo (header + grupos amber + count)
  QuestoesFilterEmptyState.tsx                      novo (variante minimalista)
  VisibilityTogglesPanel.tsx                        novo (4 toggles)
  ApplyFiltersButton.tsx                            novo (gerencia disabled + label dirty)
src/views/QuestoesPage.tsx                          modificar (feature flag + swap)
```

**Testes (mínimo):**
- Empty state renderiza quando pendentes = 0
- Grupo amber renderiza por categoria com itens corretos
- × no header do grupo limpa categoria inteira
- × hover no item remove só o item
- Count grande mostra valor de useQuestoesCount
- Toggle Anuladas funcional altera URL/state
- Toggle Já respondidas e Errei antes têm `aria-disabled` e tooltip
- Botão Aplicar disabled quando count = total OU pendentes = aplicados
- Botão muda label "Aplicar filtros" ↔ "Aplicar mudanças" conforme dirty
- Feature flag false renderiza QuestoesFilterBar legacy
- Feature flag true renderiza QuestoesFilterCard

**Validação produção:** flip da flag no Coolify, alunos beta testam, rollback se algo bugar.

## Edge cases (herdados da spec base + novos)

1. `count = 0` → painel mostra `0 · questões encontradas`, botão Aplicar continua habilitado
2. Aplicar com `count = 0` → tab Questões mostra empty state
3. Landing direto em `/questoes?view=filtros&banca=cespe` → `pendentes = aplicados = parsed URL`
4. Browser back de tab Questões pra Filtros → draft = URL atual
5. Pendentes ≠ aplicados, troca de chip → não invalida draft
6. **Conflito count/total**: se backend devolve `count > total`, ignora (treat como total)
7. **Toggle disabled clicado**: não muda estado, tooltip aparece
8. **`useQuestoesFacets` com `enabled=false`** durante drilldown ainda não pronto: skeleton no picker

## Telemetria mínima (recomendada, não bloqueante)

Eventos no 3c-3:
- `filter_chip_change` (chip_anterior, chip_nova, ms_until_render)
- `filter_apply` (n_grupos, n_itens, count, dirty_para_aplicado_ms)
- `filter_clear_group` (categoria)
- `filter_remove_item` (categoria, valor)
- `count_load_ms` (cache_hit, ms)

Útil pra entender: chip mais usada, latência percebida do count, tempo médio até Aplicar.

## Fora do escopo deste 3c

- **Mobile (3d)** — `MobileSheet` + chip strip mobile + variantes A/B
- **Cleanup (3e)** — aposentar QuestoesFilterBar / Pill / Popover / Sheet / Overlay / FilterChipsBidirectional / AdvancedPopover
- **Backend de user history** — `user_questao_history` + auth + filtros JOIN. Destrava "Já respondidas" e "Errei antes". Leva separada.
- **Filter presets ("Carregar ↑" funcional)** — link existe disabled. Spec separado quando virar feature.
- **"Editar qtd."** — feature deferida.
- **`Mais ⌄` (overflow chip)** — removido do design.
- **Tab Questões** — já implementada Plano 2.

## Critérios de pronto (Definition of Done)

3c está fechado quando:
- ✅ Feature flag em produção, default false
- ✅ Flag = true mostra card novo, idêntico à foto referência
- ✅ Flag = false mostra QuestoesFilterBar legacy intacto (rollback funciona)
- ✅ Aplicar filtros serializa pra URL e troca pra tab Questões
- ✅ Count em tempo real funciona (debounce 300ms, sem race condition)
- ✅ Facets contextuais funcionam nos 6 pickers
- ✅ 2 toggles funcionais (anuladas, desatualizadas) afetam count e listagem
- ✅ 2 toggles disabled mostram tooltip "em breve"
- ✅ Empty state aparece quando sem filtros pendentes
- ✅ Estado dirty muda label do botão e mostra dot na chip
- ✅ Skeleton states em loading; sem flash de dados stale
- ✅ Browser back/forward navega entre estados aplicados
- ✅ Deep link `/questoes?view=filtros&banca=cespe` hidrata corretamente

## Mockups de referência

- Screenshot de 2026-05-01 (chip strip + drawer 6-grupos amber + toggles ternárias)
- `.superpowers/brainstorm/6058-1777681689/content/empty-state-variants.html` — comparativo empty states (variante A escolhida)
- `.superpowers/brainstorm/6058-1777681689/content/ternary-toggle-styles.html` — toggle styles (variante B escolhida)
