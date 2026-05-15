# Sub-plan 2 — RPCs core (applied)

## Migrations aplicadas (9)

| Timestamp | Arquivo | Conteúdo |
|-----------|---------|----------|
| 20260515120000 | cronograma_v2_helpers.sql | aplicar_nivel/ponto_fraco/total_semanas/capacidade_dia |
| 20260515120100 | cronograma_v2_temp_tables_helper.sql | _v2_carrega_contexto procedure |
| 20260515120200 | cronograma_v2_gerar_skeleton.sql | gerar_cronograma_v2 v0 (validation) |
| 20260515120300 | cronograma_v2_gerar_blocks.sql | gerar_cronograma_v2 v1 (blocks) |
| 20260515120400 | cronograma_v2_gerar_distribuicao.sql | gerar_cronograma_v2 v2 (weekly distribution) |
| 20260515120500 | cronograma_v2_gerar_simulados_redacao.sql | gerar_cronograma_v2 v3 (simulados + redação) |
| 20260515120600 | cronograma_v2_gerar_bulk_insert.sql | gerar_cronograma_v2 v4 (insert + stats + log) |
| 20260515120700 | cronograma_v2_criar_plano_completo.sql | orquestrador atômico |
| 20260515120800 | (reservado pra prediction helper futuro) | — |

## Commit chain

```
8748fcc test(cronograma-v2): extend one-shot verify with sub-plan 2 functions
e52aacf chore(cronograma-v2): regen types + add RPC payload/result interfaces
e721b83 test(cronograma-v2): atomic test for criar_plano_completo (success + 2 error paths)
d5e88cd feat(cronograma-v2): add criar_plano_completo atomic orchestrator
c0e96fd test(cronograma-v2): basic end-to-end smoke for gerar_cronograma_v2
330738f feat(cronograma-v2): finalize gerar_cronograma_v2 with bulk insert and stats
0fc8319 feat(cronograma-v2): allocate simulados periodicos and redacao blocks
28a2870 feat(cronograma-v2): distribute blocks balanced across weeks (round-robin)
fb73a00 feat(cronograma-v2): generate logical blocks (teoria + questoes per subtopico)
0b5115f feat(cronograma-v2): scaffold gerar_cronograma_v2 (validation + context load)
b9e614a feat(cronograma-v2): add _v2_carrega_contexto procedure (TEMP tables factory)
437c250 feat(cronograma-v2): add capacidade_dia helper (feriados + weekday/weekend + exceptions)
0a2aee2 feat(cronograma-v2): add pure helper functions (nivel/ponto_fraco/semanas)
```

## Validação no Supabase Studio

1. Abrir SQL Editor
2. Colar `verify_all_oneshot.sql` (versão extendida da Sub-plan 2)
3. Esperar 32 rows (25 da Sub-plan 1 + 7 da Sub-plan 2) com result=PASS
4. Para testes E2E: colar `verify_09_gerar_basico.sql` e `verify_12_criar_plano_atomico.sql`

## Próximo passo

Sub-plan 3: `SyncEditalService` + `TopicoDecomposer` (TypeScript + Claude Haiku).
