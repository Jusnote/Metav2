# Sub-plan 3 — SyncEditalService + TopicoDecomposer (applied)

## Estrutura

- `src/lib/cronograma-v2/` — biblioteca core (errors, schemas, hash, decomposer, cache, sync)
- `src/app/api/cronograma-v2/sync-edital` — POST endpoint (full edital)
- `src/app/api/cronograma-v2/decompose-topico` — POST endpoint (single, debug)
- `src/hooks/useSyncEdital` — React Query hook

## Como usar

```ts
import { useSyncEdital } from '@/hooks/useSyncEdital'

const { mutate, isPending, data } = useSyncEdital()
mutate({ edital: editalFromGraphQL })  // data.decomposicao.by_topico[topicoId]
```

## Testes

```bash
npx vitest run src/lib/cronograma-v2
```

## Commit chain

```
625bb81 feat(cronograma-v2): add useSyncEdital hook (React Query mutation)
2be8fb8 feat(cronograma-v2): add POST /api/cronograma-v2/decompose-topico single endpoint
0ab496a feat(cronograma-v2): add POST /api/cronograma-v2/sync-edital endpoint
94572a1 test(cronograma-v2): sync-edital orchestrator (cache hit/miss/force/skipAI)
7e90816 feat(cronograma-v2): add syncEdital orchestrator (cache + hash + AI decompose)
0420c07 feat(cronograma-v2): add edital-cache read/upsert with schema validation
eb3cd2d feat(cronograma-v2): add topico-decomposer with Claude Haiku + Zod + fallback
a982373 feat(cronograma-v2): add Zod schemas for edital + decomposition validation
8ddcf55 feat(cronograma-v2): add composite payload hash with tests
3781dc4 feat(cronograma-v2): add typed errors for sync-edital subsystem
a2126dc chore(cronograma-v2): install p-limit for sync-edital concurrency control
```

## Known limitations

- Daily AI spend cap (spec §5.5) **not implemented** — natural throttle by p-limit(3) only.
  Future: tabela `daily_ai_spend` ou usar `app_settings` quando criado.
- Warming cron (`sync_edital_warmer`) **not implemented** — deferred to Sub-plan 6.

## Próximo passo

Sub-plan 4 — Refactor do setup flow (CronogramaSetupPage) usando `useSyncEdital` + chamando `criar_plano_completo`.
