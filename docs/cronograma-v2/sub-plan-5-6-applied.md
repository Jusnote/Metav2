# Sub-plan 5.6 — Hierarquia visual de subtópicos (applied)

## Problema corrigido

Schedule items mostravam nomes-megatopic como "Noções de organização administrativa - Centralização, descentralização, concentração e desconcentração" — feio, longo e inútil pra estudar.

## Solução

1. Schema enforça `nome.max(60)`. Contexto vai em `conceito_pai` (max 80).
2. IA prompt reforçado com exemplos CORRETOS e ERRADOS explícitos.
3. `conceito_pai` persistido em `subtopicos` table (nova coluna via migration).
4. Cronograma renderiza com hierarquia: contexto uppercase pequeno em cima + nome principal.
5. Curadoria mostra+edita `conceito_pai`; warning visual em nomes >60 chars.

## Commit chain

```
cc24e52 feat(cronograma-v2): banner counting subtopicos with nome > 60 chars
577ec70 feat(cronograma-v2): editable conceito_pai + length warning in SubtopicoRow
47ceb69 feat(cronograma-v2): persist + render conceito_pai hierarchically in schedule items
b6f0ff7 feat(cronograma-v2): add ScheduleItemTitle with hierarchical render (conceito_pai + nome)
609152a feat(cronograma-v2): enforce short subtopico names (max 60) + reinforce IA prompt with examples
994bcd3 docs(cronograma-v2): write sub-plan 5.6 (hierarquia visual)
```

## Divergência notada

`CronogramaSheet` não usa `useCronogramaWeek` diretamente — usa `useWeekTasks` como adapter.
`WeekTask` foi estendido com campo `conceitoPai: string | null` para bridgear o JOIN.

## Migration pendente

`supabase/migrations/20260516120000_subtopicos_conceito_pai.sql` — **aplicar manualmente no Studio**.

```sql
ALTER TABLE subtopicos ADD COLUMN IF NOT EXISTS conceito_pai TEXT;
```

## Known limitations

- Items antigos (criados antes do Sub-plan 5.6) não têm `conceito_pai` preenchido — vão renderizar só o nome. Pra refrescar: re-criar plano com cargo curado.
- IA pode ainda produzir nomes longos ocasionalmente — admin precisa revisar manual via banner na curadoria.

## Próximo passo

Sub-plan 6 — Event loop reativo (FSRS, week.completed, recalibração).
