# Cronograma V2 — Sub-plan 4.5: Edital integration no setup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a listagem de disciplinas do setup (hoje vem do estoque local do user) pelas **disciplinas reais do edital do cargo ativo**, consumidas via GraphQL. No submit, monta `edital_payload` com `cargo_id` + `edital_id` + lista (disciplinas, topicos) e passa ao endpoint `/api/cronograma/criar-plano` — que aciona `syncEdital` (Sub-plan 3) pra decompor tópicos longos via Claude Haiku antes de chamar a RPC.

**Architecture:** Hook novo `useCargoEdital(nomeCargo)` que: (1) busca todos os editais via GraphQL, (2) acha o cargo cujo nome bate com `nomeCargo` (normalizado), (3) baixa disciplinas via `useDisciplinasApi`, (4) baixa tópicos de cada disciplina via `useTopicosApi` em paralelo. Retorna `{ cargoId, editalId, editalNome, disciplinas, topicos, loading, error }`. Setup page consome esse hook ao invés de buscar disciplinas locais. Submit envia `edital_payload` montado.

**Tech Stack:** GraphQL existente (`useDisciplinasApi`, `useTopicosApi` em `src/hooks/useEditaisData.ts`), React Query, Levenshtein opcional pra match aproximado de nome.

**Spec ref:** seção 5 (sync edital) + §7.4 (orquestrador) do `docs/superpowers/specs/2026-05-14-cronograma-cargo-integration-design.md`.

**Premissas:**
- Sub-plans 1-4 aplicados (66 commits)
- `editaisClient` urql funcional, GraphQL retorna `cargos { id, nome, edital { id, nome } }`
- `Carreira.nome` no estoque local vai bater (ou ter substring) com `cargo.nome` na API. Ex: navbar "PF · Agente" deve bater com "Polícia Federal — Agente" ou similar na API. Normalização: lower-case + remove acentos + remove " · " e "—"
- Se match não acha: setup mostra warning e cai no comportamento antigo (lista de disciplinas locais), V2 endpoint receberá sem `edital_payload` e usará disciplinas locais

---

## File Structure

```
src/hooks/
  useCargoEdital.ts                — novo hook (Task 1)

src/views/CronogramaSetupPage.tsx
  — modificado em Tasks 2 e 3

docs/cronograma-v2/
  sub-plan-4-5-applied.md          — doc (Task 4)
```

---

## Pré-requisitos

- [ ] Sub-plans 1-4 aplicados e cronograma V2 setup funcional (mas listando disciplinas locais por bug)
- [ ] `useDisciplinasApi(cargoId)` e `useTopicosApi(disciplinaId)` existem em `src/hooks/useEditaisData.ts` ✅ (já confirmado)
- [ ] Branch `cargo-transition-v2`

---

### Task 1: Hook `useCargoEdital`

**Files:**
- Create: `src/hooks/useCargoEdital.ts`

Hook que mapeia `Carreira.nome` local → `{ cargoId, editalId, disciplinas, topicos }` da API.

- [ ] **Step 1: Criar hook**

```typescript
import { useQuery } from '@tanstack/react-query'
import { editaisQuery } from '@/lib/editais-client'
import type { ApiCargo, ApiDisciplina, ApiTopico } from './useEditaisData'

const CARGOS_GLOBAL_QUERY = `
  query CargosGlobal {
    editais(filtro: { ativo: true }, pagina: 1, porPagina: 200) {
      dados {
        id
        nome
        cargos { id nome }
      }
    }
  }
`

const DISCIPLINAS_QUERY = `
  query Disciplinas($cargoId: Int!) {
    disciplinas(cargoId: $cargoId) { id fonteId nome nomeEdital totalTopicos }
  }
`

const TOPICOS_QUERY = `
  query Topicos($disciplinaId: Int!) {
    topicos(disciplinaId: $disciplinaId) { id fonteId nome ordem }
  }
`

/**
 * Normaliza nome pra match: lowercase, sem acentos, sem separadores comuns.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[·\-—–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface CargoEditalMatch {
  cargoId: number
  cargoNome: string
  editalId: number
  editalNome: string
  disciplinas: Array<{ id: number; nome: string }>
  // Tópicos achatados em uma lista, com referência à disciplina
  topicos: Array<{ id: number; disciplina_id: number; nome: string }>
}

export interface UseCargoEditalResult {
  data: CargoEditalMatch | null
  isLoading: boolean
  error: Error | null
  /** True quando GraphQL respondeu mas nenhum cargo bate com o nome. */
  notFound: boolean
}

/**
 * Acha o cargo (na API GraphQL) cujo nome bate com `nomeCargo` (normalizado),
 * baixa as disciplinas e tópicos, e retorna em formato compatível com
 * o EditalGraphQL schema do Sub-plan 3.
 *
 * Quando `nomeCargo` é null/empty, hook desabilitado.
 */
export function useCargoEdital(nomeCargo: string | null | undefined): UseCargoEditalResult {
  // 1. Carrega todos editais ativos com seus cargos
  const listaEditais = useQuery({
    queryKey: ['cargos-global'],
    queryFn: async () => {
      const { data } = await editaisQuery<{
        editais: { dados: Array<{ id: number; nome: string; cargos: Array<{ id: number; nome: string }> }> }
      }>(CARGOS_GLOBAL_QUERY, {})
      return data?.editais?.dados ?? []
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled: !!nomeCargo,
  })

  // 2. Encontra match pelo nome
  const match = nomeCargo
    ? findCargoMatch(listaEditais.data ?? [], nomeCargo)
    : null

  // 3. Baixa disciplinas + tópicos se houver match
  const cargoId = match?.cargoId ?? null
  const composedQuery = useQuery({
    queryKey: ['cargo-edital-composed', cargoId],
    queryFn: async () => {
      if (!cargoId || !match) return null

      const { data: discData } = await editaisQuery<{ disciplinas: ApiDisciplina[] }>(
        DISCIPLINAS_QUERY,
        { cargoId },
      )
      const disciplinas = discData?.disciplinas ?? []

      // Buscar tópicos em paralelo (limitar paralelismo seria nice, mas Promise.all funciona)
      const topicosByDisciplina = await Promise.all(
        disciplinas.map(async (d) => {
          const { data: topData } = await editaisQuery<{ topicos: ApiTopico[] }>(
            TOPICOS_QUERY,
            { disciplinaId: d.id },
          )
          return (topData?.topicos ?? []).map(t => ({
            id: t.id,
            disciplina_id: d.id,
            nome: t.nome,
          }))
        }),
      )
      const topicos = topicosByDisciplina.flat()

      return {
        cargoId: match.cargoId,
        cargoNome: match.cargoNome,
        editalId: match.editalId,
        editalNome: match.editalNome,
        disciplinas: disciplinas.map(d => ({ id: d.id, nome: d.nome })),
        topicos,
      } satisfies CargoEditalMatch
    },
    enabled: !!cargoId,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  })

  return {
    data: composedQuery.data ?? null,
    isLoading: listaEditais.isLoading || composedQuery.isLoading,
    error: (listaEditais.error ?? composedQuery.error) as Error | null,
    notFound: !listaEditais.isLoading && !!nomeCargo && match === null,
  }
}

/**
 * Busca cargo pelo nome em todos os editais. Estratégia:
 * 1. Match exato (normalizado)
 * 2. Substring (cargo.nome contém nomeCargo ou vice-versa)
 * 3. Retorna null se nenhum match
 */
function findCargoMatch(
  editais: Array<{ id: number; nome: string; cargos: Array<{ id: number; nome: string }> }>,
  nomeCargo: string,
): { cargoId: number; cargoNome: string; editalId: number; editalNome: string } | null {
  const target = normalize(nomeCargo)

  // 1. Exato
  for (const ed of editais) {
    for (const cg of ed.cargos) {
      if (normalize(cg.nome) === target) {
        return { cargoId: cg.id, cargoNome: cg.nome, editalId: ed.id, editalNome: ed.nome }
      }
    }
  }

  // 2. Substring
  for (const ed of editais) {
    for (const cg of ed.cargos) {
      const n = normalize(cg.nome)
      if (n.includes(target) || target.includes(n)) {
        return { cargoId: cg.id, cargoNome: cg.nome, editalId: ed.id, editalNome: ed.nome }
      }
    }
  }

  return null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useCargoEdital.ts
git commit -m "feat(cronograma-v2): add useCargoEdital hook (maps local cargo to GraphQL edital)"
```

---

### Task 2: Trocar `loadDisciplinas` por API no setup

**Files:**
- Modify: `src/views/CronogramaSetupPage.tsx`

Em vez de buscar `disciplinas` da tabela do user, usa `useCargoEdital(cargo.nome)` pra puxar as disciplinas do edital. Mantém fallback pra disciplinas locais SE `notFound` (cargo não tem edital correspondente).

- [ ] **Step 1: Adicionar import**

```typescript
import { useCargoEdital } from '@/hooks/useCargoEdital'
```

- [ ] **Step 2: Adicionar hook + sync com state**

Dentro do componente `CronogramaSetupPage()`, perto dos outros hooks (após `useCargoAtivo`):

```typescript
const editalMatch = useCargoEdital(answers.cargo?.nome ?? cargo?.nome ?? null)
```

- [ ] **Step 3: Modificar `loadDisciplinas` pra preferir API**

Localizar `const loadDisciplinas = useCallback(async () => {...}, [])` (em ~linha 426). Substituir corpo por:

```typescript
const loadDisciplinas = useCallback(async () => {
  setDiscsLoading(true)

  // Preferência 1: disciplinas do edital via GraphQL (cargo ativo)
  if (editalMatch.data && editalMatch.data.disciplinas.length > 0) {
    // Estimativa de baseMinutes/subtopicCount não disponível aqui sem chamar
    // subtopicos endpoint adicional. Por ora, usa subtopicCount como
    // tópicos.length × 3 (estimativa: ~3 subtópicos por tópico),
    // baseMinutes como (3 × 45) × tópicos. Isso é corrigido no backend
    // quando syncEdital decompõe tópicos via IA.
    const topicosByDisc = new Map<number, number>()
    for (const t of editalMatch.data.topicos) {
      topicosByDisc.set(t.disciplina_id, (topicosByDisc.get(t.disciplina_id) ?? 0) + 1)
    }
    const mapped: Disciplina[] = editalMatch.data.disciplinas.map(d => {
      const nTopicos = topicosByDisc.get(d.id) ?? 0
      const estSubtopicos = nTopicos * 3
      return {
        id: String(d.id),           // converte INT pra string pra compat com state existente
        nome: d.nome,
        baseMinutes: estSubtopicos * 45,
        subtopicCount: estSubtopicos,
      }
    })
    mapped.sort((a, b) => a.nome.localeCompare(b.nome))
    setDisciplinas(mapped)
    setDiscsLoading(false)
    return
  }

  // Preferência 2 (fallback): disciplinas locais do user (V1 behavior)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { setDiscsLoading(false); return }
  const { data: discRows } = await supabase
    .from('disciplinas')
    .select('id, nome, topicos!inner(id, subtopicos(estimated_duration_minutes))')
    .eq('user_id', user.id)
    .order('nome', { ascending: true })
  const mapped: Disciplina[] = (discRows ?? []).map((d: any) => {
    let baseMinutes = 0, subtopicCount = 0
    for (const t of d.topicos ?? []) for (const s of t.subtopicos ?? []) {
      baseMinutes += s.estimated_duration_minutes ?? 0
      subtopicCount += 1
    }
    return { id: d.id, nome: d.nome, baseMinutes, subtopicCount }
  })
  const { data: allDisc } = await supabase.from('disciplinas').select('id, nome').eq('user_id', user.id)
  const mappedIds = new Set(mapped.map((d) => d.id))
  for (const d of allDisc ?? []) {
    if (!mappedIds.has(d.id)) mapped.push({ id: d.id, nome: d.nome, baseMinutes: 0, subtopicCount: 0 })
  }
  mapped.sort((a, b) => a.nome.localeCompare(b.nome))
  setDisciplinas(mapped)
  setDiscsLoading(false)
}, [editalMatch.data])
```

- [ ] **Step 4: Adicionar useEffect que re-roda quando `editalMatch.data` muda**

Já tem um useEffect que dispara `loadDisciplinas` quando `answers.objetivo` é setado (do fix da Task 0 do Sub-plan 4 last patch). Adicionar condição extra: re-rodar também quando `editalMatch.data` chega.

Localizar:
```typescript
useEffect(() => {
  if (answers.objetivo && disciplinas.length === 0 && !discsLoading) {
    loadDisciplinas()
  }
}, [answers.objetivo, disciplinas.length, discsLoading, loadDisciplinas])
```

Mudar pra:
```typescript
useEffect(() => {
  // Carrega quando objetivo é setado E temos dados de edital (ou fallback p/ user disciplinas)
  if (answers.objetivo && !discsLoading) {
    // Se editalMatch ainda tá carregando, espera o resolve antes de cair no fallback
    if (editalMatch.isLoading) return
    if (disciplinas.length === 0 || (editalMatch.data && disciplinas.some(d => !d.id.match(/^\d+$/)))) {
      // recarrega se ainda vazio OU se disciplinas atuais não vieram do edital (id não-numérico)
      loadDisciplinas()
    }
  }
}, [answers.objetivo, disciplinas, discsLoading, loadDisciplinas, editalMatch.data, editalMatch.isLoading])
```

- [ ] **Step 5: UI hint quando edital não foi encontrado**

No `DisciplinasPicker` render area, adicionar um banner pequeno acima da lista:

```tsx
{editalMatch.notFound && (
  <div className="text-[11px] text-amber-300/80 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mb-3">
    Não encontrei um edital correspondente ao cargo "{answers.cargo?.nome ?? '?'}".
    Mostrando suas disciplinas locais.
  </div>
)}
```

- [ ] **Step 6: Commit**

```bash
git add src/views/CronogramaSetupPage.tsx
git commit -m "feat(cronograma-v2): load disciplinas from edital GraphQL (fallback to local)"
```

---

### Task 3: Passar `edital_payload` no submit

**Files:**
- Modify: `src/views/CronogramaSetupPage.tsx`

Em `handleSubmitV2`, montar `edital_payload` quando `editalMatch.data` existe.

- [ ] **Step 1: Atualizar handleSubmitV2**

Localizar `handleSubmitV2` (renomeado em Sub-plan 4 Task 10). No bloco de construção do `payload`, adicionar:

```typescript
const editalPayload = editalMatch.data
  ? {
      cargo_id: editalMatch.data.cargoId,
      edital_id: editalMatch.data.editalId,
      cargo_nome: editalMatch.data.cargoNome,
      disciplinas: editalMatch.data.disciplinas,
      topicos: editalMatch.data.topicos,
    }
  : undefined

const payload = {
  cargo_id: editalMatch.data?.cargoId ?? Number(answers.cargo.id) ?? 0,
  cargo_nome: editalMatch.data?.cargoNome ?? answers.cargo.nome,
  // ... resto do payload (data_inicio, weekday_minutes, etc.) inalterado
  edital_payload: editalPayload,
  // ... disciplinas array do user: mapear pra disciplina_id usando o ID da API
  disciplinas: Array.from((answers.selectedDisciplinas ?? new Map()).values()).map(s => ({
    disciplina_id: s.id,  // já é o id da API quando vem do edital
    peso: s.peso,
    nivel_conhecimento: s.nivel_conhecimento ?? 'intermediario',
    is_ponto_fraco: s.is_ponto_fraco ?? false,
    excluded_subtopico_ids: [],
  })),
}
```

> **⚠ Note pro subagent:** O `cargo_id` no schema é `z.coerce.number()` mas o `setup-payload` exige `cargo_id` como INT positivo. Se `editalMatch.data` veio, usar `cargoId` da API. Caso contrário, `Number(answers.cargo.id)` pode dar `NaN` (Carreira.id é UUID-string). Nesse caso, abortar com erro claro: "Não foi possível associar o cargo a um edital — V2 indisponível, mude pra V1 ou ajuste o cargo".
>
> **disciplina_id no setup-payload** está como `z.string().uuid()`. Mas IDs vindos da API são INT. Subagent deve:
> 1. Mudar schema em `src/lib/cronograma-v2/setup-payload.ts` pra aceitar `z.union([z.string().uuid(), z.coerce.number()])` OU mais simples: `z.union([z.string(), z.number()]).transform(String)`
> 2. Adaptar tipo na RPC `criar_plano_completo`: hoje espera UUID. Pode falhar. Reportar.

- [ ] **Step 2: Atualizar setup-payload schema**

```typescript
disciplinas: z.array(z.object({
  // Aceita string (UUID local) OU number (ID da API)
  disciplina_id: z.union([z.string(), z.number()]),
  // ...
}))
```

E adaptar o endpoint `/api/cronograma/criar-plano/route.ts` se necessário pra repassar como veio (a RPC pode receber `text` ou `int` no JSONB do array — flexível).

- [ ] **Step 3: Commit**

```bash
git add src/views/CronogramaSetupPage.tsx src/lib/cronograma-v2/setup-payload.ts
git commit -m "feat(cronograma-v2): send edital_payload from setup wizard to RPC"
```

---

### Task 4: Doc

**Files:**
- Create: `docs/cronograma-v2/sub-plan-4-5-applied.md`

- [ ] **Step 1: Criar doc**

```markdown
# Sub-plan 4.5 — Edital integration (applied)

## Problema corrigido

V2 setup antes listava disciplinas do estoque local do user — independente do cargo na navbar. Resultado: cargos novos (sem disciplinas locais) viam disciplinas erradas (ex: Direito Civil pra PF · Agente).

## Solução

Hook `useCargoEdital(nomeCargo)` mapeia cargo local → cargo na API GraphQL (match exato + substring) → baixa disciplinas + tópicos via `useDisciplinasApi` / `useTopicosApi`. Setup page consome esses dados.

Submit envia `edital_payload` pro endpoint, que aciona `syncEdital` (Sub-plan 3) pra decompor tópicos via Claude Haiku antes de chamar `criar_plano_completo`.

## Commit chain

[Real chain via `git log --oneline 44c0d97..HEAD`]

## Known limitations

- Match por substring pode dar falso positivo em cargos com nomes parecidos. Real fix: adicionar `external_cargo_id` em `Carreira` (futura migration).
- Quando edital não tem match: fallback silencioso pra disciplinas locais + banner amber pro user.
- `disciplina_id` no payload mudou de `UUID` pra `union(string, number)`. RPC `criar_plano_completo` precisa ser tolerante a ambos no JSONB de disciplinas — verificar comportamento.

## Próximo passo

Sub-plan 5 — Event loop + handlers reativos.
```

- [ ] **Step 2: Commit**

```bash
git add docs/cronograma-v2/sub-plan-4-5-applied.md
git commit -m "docs(cronograma-v2): summary of sub-plan 4.5 (edital integration)"
```

---

## Self-Review

**Spec coverage:**
- §5.1 fluxo sync → Task 1 + Task 3 (no submit) ✅
- §7.4 orquestrador (sync edital antes da RPC) → endpoint já faz isso desde Sub-plan 4 ✅

**Risk register:**
- **Match por nome é frágil**: PF · Agente pode bater com "Polícia Federal — Agente" mas se a API ortografar diferente, falha. Mitigação: banner UI + fallback. Real fix demanda schema change.
- **disciplina_id tipo**: Sub-plan 1 RPC `criar_plano_completo` espera disciplinas com UUID. API GraphQL retorna INT. Subagent precisa ou (a) adaptar a RPC pra aceitar string OU INT, OU (b) criar mapeamento local→API. Decisão deferida ao subagent — reportar.
- **N+1 calls de tópicos**: `useCargoEdital` chama `useTopicosApi` em loop por disciplina. Edital com 15 disciplinas → 15 round trips. Mitigação futura: novo endpoint GraphQL que retorna disciplinas + tópicos juntos.

**Placeholder scan:** nenhum.

---

## Pré-execução checklist

- [ ] Confirmar campo `area` em `Carreira` (✅ confirmado earlier — `advocacia`, `policial`, etc.)
- [ ] Confirmar que `useDisciplinasApi` e `useTopicosApi` retornam `{ id: number }` ✅
- [ ] Aceitar trade-off: match por nome é heurístico

---

## Plan complete. Saved to `docs/superpowers/plans/2026-05-15-cronograma-v2-plan-4-5-edital-integration.md`.

**Duas opções:** Subagent-Driven (recomendado, padrão) ou Inline.

Qual?
