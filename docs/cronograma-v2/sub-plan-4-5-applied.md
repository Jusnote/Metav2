# Sub-plan 4.5 — Edital integration (applied)

## Problema corrigido

V2 setup listava disciplinas do estoque local do user — independente do cargo na navbar.
Resultado: cargos novos (sem disciplinas locais) viam disciplinas erradas (ex: Direito Civil pra PF · Agente).

## Solução

Hook `useCargoEdital(nomeCargo)` mapeia cargo local → cargo na API GraphQL (match exato + substring)
→ baixa disciplinas + tópicos via `editaisQuery`. Setup page consome esses dados como preferência 1,
com fallback para disciplinas locais quando o cargo não tem correspondência na API.

Submit agora envia `edital_payload` pro endpoint, que aciona `syncEdital` (Sub-plan 3) pra decompor
tópicos via Claude Haiku antes de chamar `criar_plano_completo`.

## Commit chain

```
9bf75e3 docs(cronograma-v2): write sub-plan 4.5 (edital integration)
140833c feat(cronograma-v2): add useCargoEdital hook (maps local cargo nome to GraphQL edital)
b0a22f9 feat(cronograma-v2): load disciplinas from edital GraphQL, fallback to local on notFound
f9c9b8f feat(cronograma-v2): send edital_payload in submit; relax disciplina_id schema to string|number
```

## Arquivos criados / modificados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useCargoEdital.ts` | Novo hook — match cargo + fetch disciplinas/tópicos via GraphQL |
| `src/views/CronogramaSetupPage.tsx` | Import do hook, loadDisciplinas refatorado, useEffect atualizado, banner amber, handleSubmitV2 com edital_payload |
| `src/lib/cronograma-v2/setup-payload.ts` | `disciplina_id` relaxado para `union(string, number)` |

## Trade-off escolhido: Option A

`disciplinas[].disciplina_id` no payload mantém o tipo string (UUID local OU numeric string da API).
`edital_payload` é enviado sempre que há match GraphQL → `syncEdital` roda e cacheia a decomposição.

A RPC `criar_plano_completo` pode rejeitar `disciplina_id` não-UUID quando os IDs vêm da API
(ex: `"42"` em vez de um UUID). Isso é um risco aceito — se a RPC falhar, o erro aparece no
submit com mensagem clara. Fix real requer migration na RPC para aceitar `text` além de `uuid`.

## Known limitations

- **Match por nome é heurístico**: "PF · Agente" → normalizado → substring match. Falso positivo
  possível em cargos com nomes parecidos. Fix real: adicionar `external_cargo_id` em `Carreira`.
- **disciplina_id tipo**: RPC `criar_plano_completo` faz `(v_d->>'disciplina_id')::UUID`. IDs da API
  são INT → string numeric → falha no cast. Reportado como known issue; não modificado aqui.
- **N+1 de cargos**: `useCargoEdital` busca editais list (1 call) + cargos por edital em paralelo
  (N calls). Edital com 20 editais = 21 round trips. Mitigação futura: GraphQL endpoint que retorna
  `editais { cargos }` em uma query só.
- **Fallback silencioso**: quando edital não tem match, disciplinas locais são usadas com banner amber.
  O user precisa perceber o banner pra saber que está no fallback.

## Próximo passo

Sub-plan 5 — Event loop + handlers reativos.
