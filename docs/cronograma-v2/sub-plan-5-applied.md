# Sub-plan 5 — Moderação de Editais / curadoria admin (applied)

## Problema resolvido

`/api/cronograma/criar-plano` rodava `syncEdital(skipAI:false)` inline na request do user:
- Setup aguardava ~2-5 min com barra de progresso enquanto Claude decompunha tópicos
- Erros de IA (timeout, rate limit) bloqueavam o setup inteiro
- Cada user que criasse plano pra o mesmo cargo re-pagava custo de IA
- Subtópicos ruins chegavam diretamente ao user sem revisão humana
- Two-tier UX: users com cargo já cacheado eram rápidos, users novos eram lentos

## Solução

Pivot de **IA-em-runtime** para **admin pré-curadoria**:

- Admin acessa `/moderacao` → Editais → drilla até nível de cargo
- Dispara curadoria IA via endpoint dedicado (`/api/admin/editais/curate`) com streaming de progresso
- Revisa/edita a árvore inline (disciplinas → tópicos → subtópicos) antes de publicar
- Clica "Publicar" → cargo fica com `status='published'` no `edital_cache`
- Setup do user lê do cache publicado: lookup instantâneo (sub-1s), sem IA, sem espera
- Cargos não publicados mostram banner amber; V1 é o fallback

`edital_cache` ganhou coluna `status TEXT CHECK (draft/published/archived)` + `published_at` + `published_by` para rastreabilidade.

## Mudança arquitetural (ADR-001 implícita)

| Dimensão | Antes (Sub-plan 4.5) | Depois (Sub-plan 5) |
|---|---|---|
| Quem paga custo IA | Cada user no 1º setup | Admin 1x por cargo |
| Latência setup | ~2-5 min (blocking) | < 1s (cache lookup) |
| Erros de IA | Bloqueiam user com mensagem de erro | Ficam no painel admin, isolados |
| Qualidade subtópicos | User vê output cru da IA | Admin revisa antes de publicar |
| Disponibilidade cargo | Imediata (mas com espera) | Depende de curadoria prévia |

## Commit chain

```
a4d0d6a feat(cronograma-v2): add status workflow to edital_cache (draft/published/archived)
3f007ec feat(cronograma-v2): add status-aware cache helpers (published/draft/archived)
8cab77d feat(cronograma-v2): admin endpoint POST /admin/editais/curate (streaming IA)
e39e864 feat(cronograma-v2): admin endpoints publish + unpublish for edital cache
b36c4a6 feat(cronograma-v2): admin endpoints list curated + update tree decomposicao
f47e3a2 feat(cronograma-v2): useCurarEdital hook (streaming progress)
7cbd6c4 feat(cronograma-v2): hooks for lista/publish/unpublish/update of curated editais
226bfcc feat(cronograma-v2): EditalCuradoriaPanel + fix curated-list to return decomposicao
95b243f feat(cronograma-v2): tree + progress + status badge components
90ae41c feat(cronograma-v2): integrate EditalCuradoriaPanel into moderation page (disciplinas level)
5c5bebf refactor(cronograma-v2): remove inline IA from criar-plano, require published cache
9389afa feat(cronograma-v2): only expose published cargos to setup wizard
```

## Novos endpoints (5 rotas admin)

Todos em `src/app/api/admin/editais/`:

| Rota | Método | Descrição |
|---|---|---|
| `curate/route.ts` | POST | Streaming IA — dispara `syncEdital(skipAI:false)`, salva `draft` |
| `publish/route.ts` | POST | Muda `status → published`, grava `published_at` + `published_by` |
| `unpublish/route.ts` | POST | Muda `status → archived` |
| `curated-list/route.ts` | GET | Lista todos cargos + status agregado (admin dashboard) |
| `update-decomposicao/route.ts` | POST | Salva edição inline do JSONB `decomposicao` |

Todos verificam `user_roles.role IN ('admin', 'moderator')` via service role client.

## Novos componentes UI (4 componentes)

Em `src/components/moderation/editais/`:

| Componente | Função |
|---|---|
| `EditalCuradoriaPanel.tsx` | Host status-aware: orquestra todos os estados (sem cache / streaming / draft / published) |
| `EditalCuradoriaTree.tsx` | Árvore editável 3 níveis (tópico → conceito → subtópico), inputs inline + debounce 800ms |
| `EditalCuradoriaProgress.tsx` | Barra de progresso emerald para streaming IA (done/total + %) |
| `EditalCuradoriaStatusBadge.tsx` | Pill colorida: `draft` amber / `published` emerald / `archived` slate / sem cache outline |

## Novos hooks

Em `src/hooks/moderation/`:

| Hook | Tipo | Descrição |
|---|---|---|
| `useCurarEdital.ts` | mutation (stream) | POST streaming pra `/api/admin/editais/curate`; expõe `progress` state |
| `useListaEditaisCurados.ts` | query | GET lista de cargos + status agregado |
| `usePublishEdital.ts` | mutation | POST publish; invalida lista |
| `useUpdateDecomposicao.ts` | mutation | POST update-decomposicao; invalida lista |

## Gating user-side

`src/hooks/useCargoEdital.ts` — segunda query verifica `edital_cache.status='published'` pra o (cargoId, editalId) do match. Retorna `notFound=true` se não publicado.

`src/app/api/cronograma/criar-plano/route.ts` — substituiu `syncEdital(skipAI:false, forceRefresh:true)` por `getPublishedDecomposicao(...)`. Se não publicado: emite `{ type: 'error', message: 'Cargo ainda não foi curado pelo admin — V2 indisponível.' }` e encerra stream.

## Fluxo admin (como usar)

1. Acessa `/moderacao` → aba/seção Editais
2. Navega hierarquia: Concurso → Edital → Cargo (nível 'disciplinas')
3. Painel "Curadoria" aparece abaixo da tabela de disciplinas
4. Clica **"Curar com IA"** → barra de progresso NDJSON → após ~2-5min vira `draft`
5. Revisa árvore: edita nomes de subtópicos, ajusta `duracao_min`, deleta itens ruins
6. Clica **"Publicar"** → cargo fica disponível no setup do V2

## Fluxo user (como usar)

1. Acessa `/cronograma/setup` com cargo ativo (ex: PF Agente)
2. Se cargo está `published`: wizard normal, disciplinas carregam do cache, plano cria em < 1s
3. Se cargo **não** está publicado: banner amber "Cargo ainda em curadoria — V2 indisponível", fallback para V1

## Known limitations

- `user_roles` verificado inline em cada endpoint admin — futuro refatorar pra middleware de autenticação compartilhado
- `EditalCuradoriaTree` não tem optimistic lock — dois admins editando ao mesmo tempo → last-write-wins
- Re-curadoria com "Curar com IA" sobrescreve o `draft` atual sem versionamento anterior (edições manuais perdidas)
- `useCargoEdital` retorna só `published=true/false` — não diferencia "draft pronto pra revisar" de "totalmente ausente"; banner é igual para os dois casos
- Árvores com 100+ tópicos × 5+ subtópicos (500 inputs) podem lagar — virtualização não implementada

## Próximo passo

**Sub-plan 6** — event loop reativo: FSRS revisões integradas ao V2, `week.completed` handlers, recalibração automática de carga quando user marca sessão feita/pulada. Agora que o setup do V2 é estável e sub-1s, o foco passa para o comportamento durante o estudo.
