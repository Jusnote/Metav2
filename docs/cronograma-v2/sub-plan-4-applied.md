# Sub-plan 4 — Setup flow refactor (applied)

## Mudanças

- **Zod schema**: `src/lib/cronograma-v2/setup-payload.ts` — valida payload do endpoint
- **Endpoint**: `POST /api/cronograma/criar-plano` — orquestrador atômico (auth, flag check, rate limit, RPC)
- **Hook**: `useCriarPlano` — React Query mutation que posta no endpoint com Bearer token
- **3 novos step components**: `CargoStep`, `MaterialHorarioStep`, `ExtrasStep`
- **DisciplinaRow**: ganhou controles `nivel_conhecimento` (INI/INT/AVA chip) + `is_ponto_fraco` (max 3 global)
- **Draft persistence**: `useSetupDraftPersistence` — debounced 1s, TTL 7 dias
- **Feature flag gate**: `cronograma_v2_enabled` — V1 fallback automático quando flag off

## Commit chain

```
8034853 feat(cronograma-v2): add draft persistence (debounced + 7-day TTL)
c4837a1 feat(cronograma-v2): add ExtrasStep (simulados freq + redação toggle)
7fb804a feat(cronograma-v2): add MaterialHorarioStep (tipo material + horário preferido)
e940750 feat(cronograma-v2): add nivel + ponto_fraco controls per disciplina
f17ff4b feat(cronograma-v2): add CargoStep (skipped when navbar has active cargo)
ba40d33 feat(cronograma-v2): wire useCargoAtivo into setup page state
6dd64df feat(cronograma-v2): add useCriarPlano hook (React Query mutation)
e713a0e feat(cronograma-v2): add POST /api/cronograma/criar-plano orchestrator endpoint
278c7a1 feat(cronograma-v2): add Zod schema for criar-plano endpoint payload
```

## Como ativar V2 pro seu usuário

```sql
INSERT INTO feature_flags (flag_name, enabled, rollout_pct)
VALUES ('cronograma_v2_enabled', TRUE, 100)
ON CONFLICT (flag_name) DO UPDATE SET enabled=TRUE, rollout_pct=100;
```

Ou por allowlist específica (mais seguro para testes):

```sql
UPDATE feature_flags
SET enabled=TRUE, user_allowlist = ARRAY['<seu-user-uuid>'::UUID]
WHERE flag_name = 'cronograma_v2_enabled';
```

## Decisões técnicas notáveis

### Draft persistence: cargo_snapshot como blob temporário

O hook `useSetupDraftPersistence` usa a coluna `cargo_snapshot` (JSONB) de
`planos_estudo` como blob temporário para persistir o estado do wizard. A
estrutura `{ answers: <object>, draft_version: 1 }` distingue rascunhos de
wizard de dados reais de cargo_snapshot.

**Motivação**: evitar migration adicional neste sub-plan. O campo `draft_version: 1`
é verificado na restauração — se ausente, não restaura.

**Cleanup futuro**: adicionar coluna `wizard_state JSONB` à tabela
`planos_estudo` via migration e migrar a lógica de draft.

### Feature flag: V1 fallback automático

O componente expõe apenas um `handleSubmit` que delega para `handleSubmitV1`
(raw inserts) ou `handleSubmitV2` (via endpoint) conforme o resultado de
`is_feature_enabled`. Durante o load da flag (`v2Enabled === null`), usa V1
por segurança.

### Payload mix_ratio: percentual → fração

`computed.mix` está em percentual (0–100). O payload do endpoint espera
fração (0–1). A divisão `/100` é feita em `handleSubmitV2` antes de enviar.

## Known limitations

- Sugestões IA durante wizard (§7.3 da spec) **não implementadas** — deferido
- Mobile bottom-sheet layout (§7.7) **não testado** — pode quebrar em <768px
- `edital_payload` não é passado pelo wizard — RPC usa apenas disciplinas
  locais do user, sem decompor edital. Sub-plan 5 endereça isso.
- Draft restore carrega o estado de `answers` mas não restaura o step atual —
  user começa do passo 1 mesmo com dados restaurados (aceitável para MVP)

## Próximo passo

Sub-plan 5 — Event loop + handlers reativos (FSRS, item.completed, week.completed).
