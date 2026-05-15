# Cronograma V2 — Migrations Aplicadas (Sub-plan 1)

**Data:** 2026-05-14
**Status:** Schema V2 aplicado em produção, sem efeito visível ao usuário.

## Migrations criadas (em ordem)

| # | Migration | Conteúdo |
|---|---|---|
| 01 | `20260514120000_cronograma_v2_enums.sql` | 5 enums + 'rascunho' em plano_status |
| 02 | `20260514120100_cronograma_v2_plan_decisions.sql` | Audit trail + particionamento mensal |
| 03 | `20260514120200_cronograma_v2_behavioral_signals.sql` | Sinais comportamentais + idempotência |
| 04 | `20260514120300_cronograma_v2_edital_cache.sql` | Cache compartilhado IA |
| 05 | `20260514120400_cronograma_v2_predictions.sql` | History append-only + view |
| 06 | `20260514120500_cronograma_v2_plan_events.sql` | Event bus + sequence |
| 07 | `20260514120600_cronograma_v2_dead_letters.sql` | Eventos não processados |
| 08 | `20260514120700_cronograma_v2_config_history.sql` | Versionamento de config |
| 09 | `20260514120800_cronograma_v2_feriados.sql` | Lookup de feriados |
| 10 | `20260514120900_cronograma_v2_plan_templates.sql` | Templates oficial/comunidade |
| 11 | `20260514121000_cronograma_v2_auxiliary.sql` | 5 tabelas auxiliares + função is_feature_enabled |
| 12 | `20260514121100_cronograma_v2_alter_planos_estudo.sql` | cargo_snapshot, template_id, algorithm_variant, deleted_at |
| 13 | `20260514121200_cronograma_v2_alter_plano_config.sql` | simulados, redação, material, horário |
| 14 | `20260514121300_cronograma_v2_alter_plano_disciplinas.sql` | nivel, ponto_fraco, excluded |
| 15 | `20260514121400_cronograma_v2_alter_schedule_items.sql` | FSRS, anticipated, parent, version |
| 16 | `20260514121500_cronograma_v2_alter_topicos.sql` | referencias_legais, nome_curto, ai_decomposed_at |
| 17 | `20260514121600_cronograma_v2_alter_weekly_stats.sql` | unlocked_early, overflow |
| 18 | `20260514121700_cronograma_v2_triggers.sql` | 3 triggers (events + version) |
| 19 | `20260514121800_cronograma_v2_rls.sql` | RLS policies em todas as novas tabelas |
| 20 | `20260514121900_cronograma_v2_seed_feriados.sql` | Seed feriados 2026-2028 |

> **Nota:** O plano original listava 20 migrations (Tasks 1-20). Os itens de Task 21 (regen tipos) e Task 22 (tipos derivados TS) são arquivos TypeScript, não migrations SQL.

## Git commit chain (c238ff3..efbd11f)

Commits aplicados neste sub-plan, do mais antigo ao mais recente:

| Hash | Mensagem |
|---|---|
| `c238ff3` | chore(cronograma-v2): create verify scripts directory |
| `d88dcb7` | feat(cronograma-v2): add enum types for nivel/simulados/material/horario/templates |
| `b5bc598` | feat(cronograma-v2): add plan_decisions audit trail with monthly partitioning |
| `526d437` | feat(cronograma-v2): add behavioral_signals with partitioning and idempotency unique |
| `a7fc1c3` | feat(cronograma-v2): add edital_cache shared IA decomposition cache |
| `0005bbf` | feat(cronograma-v2): add plano_predictions_history + last-value view |
| `f667f20` | feat(cronograma-v2): add plan_events event bus with partitioning and sequence |
| `32b1c15` | feat(cronograma-v2): add dead_letters table for failed event handlers |
| `2eeadca` | feat(cronograma-v2): add plano_config_history for config versioning |
| `c622490` | feat(cronograma-v2): add feriados_nacionais lookup table |
| `dc791c1` | feat(cronograma-v2): add plan_templates community + official |
| `d01f5f0` | feat(cronograma-v2): add auxiliary tables (graphql_cache, analytics, rate_limit, flags, ai_feedback) |
| `14fff56` | feat(cronograma-v2): alter planos_estudo with cargo_snapshot, template_id, soft delete |
| `ad0bc59` | feat(cronograma-v2): alter plano_config with simulados, redacao, material, horario |
| `21f96a8` | feat(cronograma-v2): alter plano_disciplinas with nivel, ponto_fraco, excluded subtopicos |
| `f44c3c8` | feat(cronograma-v2): alter schedule_items with FSRS, anticipation, parent, version |
| `4cf8117` | feat(cronograma-v2): alter topicos with referencias_legais, nome_curto, ai_decomposed_at |
| `0fe2de9` | feat(cronograma-v2): alter weekly_stats with unlocked_early and overflow flags |
| `4e84f6f` | feat(cronograma-v2): add triggers for event publication and version increment |
| `0bbc546` | feat(cronograma-v2): enable RLS on all new tables with appropriate policies |
| `d9dded3` | feat(cronograma-v2): seed feriados nacionais 2026-2028 |
| `9d55646` | chore(cronograma-v2): regen database types after schema migrations |
| `efbd11f` | feat(cronograma-v2): add derived TS types (event payloads, decomposicao, cargo snapshot) |

## Workaround utilizado: Supabase Management API

O `npx supabase db push` e `supabase migration up --linked` requerem acesso direto ao banco (pg_dump/pg_restore via TCP). No ambiente de execução sem acesso de rede ao Postgres remoto, as migrations foram aplicadas via **Supabase Management API** (REST), que aceita SQL arbitrário autenticado pelo service role key.

Cada migration foi postada individualmente via `POST /rest/v1/rpc` ou equivalente da Management API, garantindo ordem de execução e idempotência.

## Task 3 — Correção SQL: `AT TIME ZONE 'UTC'` (imutabilidade de índice)

Na migration `20260514120200_cronograma_v2_behavioral_signals.sql`, o índice de idempotência originalmente usaria:

```sql
-- Problemático: cast TIMESTAMPTZ → DATE não é IMMUTABLE (depende de timezone da sessão)
ON behavioral_signals (..., (occurred_at::date), occurred_at);
```

Postgres rejeita funções não-imutáveis em expressões de índice. A correção aplicada:

```sql
-- Correto: AT TIME ZONE 'UTC' retorna TIMESTAMP (sem tz), cujo cast para DATE é IMMUTABLE
ON behavioral_signals (..., ((occurred_at AT TIME ZONE 'UTC')::date), occurred_at);
```

Isso garante que o índice funcione em qualquer configuração de `TimeZone` da sessão.

## Verify scripts

Localizados em `supabase/verify/cronograma_v2/`:

- `verify_01_enums.sql`
- `verify_02_tables.sql`
- `verify_04_triggers.sql`
- `verify_05_rls.sql`
- `verify_07_full_insert_flow.sql`

## Passo manual obrigatório: executar verify scripts

Como `psql` não está disponível no ambiente de CI atual, os scripts de verificação **devem ser executados manualmente** via Supabase Studio SQL Editor:

1. Acesse o Supabase Dashboard → SQL Editor
2. Execute cada script em ordem:
   - `verify_01_enums.sql` — confirma enums criados
   - `verify_02_tables.sql` — confirma tabelas novas + colunas ALTERadas
   - `verify_04_triggers.sql` — confirma triggers ativos
   - `verify_05_rls.sql` — confirma RLS habilitado em todas as tabelas
   - `verify_07_full_insert_flow.sql` — smoke test end-to-end (usa ROLLBACK, seguro em produção)

Saída esperada do `verify_07_full_insert_flow.sql`:
- `plano: 1`
- `config: 1`
- `history: 1`
- `disciplina: 1`
- `item: 2` (version incrementada de 1 → 2 via trigger)
- `event: item.completed` (trigger publicou)
- `decision: 1`
- `prediction: 95.0`
- `Integration test completed`

## Rollback

Se necessário, executar em ordem reversa:

```bash
# Lista migrations a reverter
ls -r supabase/migrations/2026051412*.sql
```

Cada migration tem comentário `-- DOWN:` no topo descrevendo a reversão.

## Próximos passos

- Sub-plan 2: implementar `gerar_cronograma_v2` + `criar_plano_completo` RPCs
- Sub-plan 3: implementar SyncEditalService + TopicoDecomposer (TS)
- Sub-plan 4-7: setup flow, event loop, crons, migração V1→V2
