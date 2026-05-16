# Cronograma V2 — Sub-plan 5.6: Hierarquia visual de subtópicos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Eliminar nomes-megatopic ("Noções de organização administrativa - Centralização, descentralização, concentração e desconcentração") nos blocos do cronograma. Subtópicos passam a ter `nome` curto (≤60 chars) + `conceito_pai` separado, e a UI renderiza com hierarquia visual (label uppercase pequeno em cima + título principal embaixo) ao invés de concatenar.

**Architecture:**
- **Schema tightening**: `subtopicoDecomposedSchema.nome.max(60)` (era 200)
- **IA prompt mais rígido**: system prompt explica regra + dá exemplos bons e ruins
- **`ScheduleItemTitle` component**: renderiza `conceito_pai` (uppercase 10px slate) + `nome` (título). Reusado em todas as telas que mostram schedule_item
- **Wire** em `CronogramaPage`/`CronogramaSheet`
- **Curadoria tree**: `SubtopicoRow` mostra `conceito_pai` em cinza + warning amber quando `nome > 60`
- Manualmente, admin pode editar tanto `nome` quanto `conceito_pai` direto na tree

**Tech Stack:** Zod, Tailwind, React. Sem mudanças de schema DB (campo `conceito_pai` já existe no JSONB).

**Spec ref:** §B do apêndice — exemplo "Licitações - Pregão" sempre foi a intenção; agora forçamos no schema + UI.

**Premissas:**
- Sub-plan 5.5 aplicado (10 commits — `20a1bff..790f827`)
- Schedule items hoje mostram `title` (do `schedule_items.title` que veio do `_ctx_subtopicos.nome` durante `gerar_cronograma_v2`)
- O campo `conceito_pai` está dentro de `edital_cache.decomposicao.by_topico[topicoId].subtopicos[i].conceito_pai` — mas NÃO está copiado pra `subtopicos.estimated_duration_minutes` nem `schedule_items.title`

---

## File Structure

```
src/lib/cronograma-v2/
  schemas.ts                              — MODIFICADO: nome max 60 (Task 1)
  topico-decomposer.ts                    — MODIFICADO: prompt rígido + exemplos (Task 1)

src/components/cronograma/
  ScheduleItemTitle.tsx                   — NOVO: render hierárquico (Task 2)

src/views/CronogramaPage.tsx              — MODIFICADO: usa ScheduleItemTitle (Task 3)
src/components/CronogramaSheet.tsx        — MODIFICADO: usa ScheduleItemTitle (Task 3)

src/components/moderation/curadoria/
  SubtopicoRow.tsx                        — MODIFICADO: edita conceito_pai + warning (Task 4)
  SubtopicoLengthWarning.tsx              — NOVO: pill de aviso (Task 5)

src/app/api/cronograma/criar-plano/route.ts  — MODIFICADO: hidratação propaga conceito_pai (Task 5)

docs/cronograma-v2/sub-plan-5-6-applied.md   — Task 6
```

---

## Pré-requisitos

- [ ] Sub-plans 5 e 5.5 aplicados
- [ ] `subtopicos` table tem a coluna `nome` (string) — schema atual permite ate `text` sem limit, OK
- [ ] schedule_items.title é string sem limit DB-side — OK

---

### Task 1: Schema rígido + IA prompt reforçado

**Files:**
- Modify: `src/lib/cronograma-v2/schemas.ts`
- Modify: `src/lib/cronograma-v2/topico-decomposer.ts`

- [ ] **Step 1: Tightening schema**

Localizar `subtopicoDecomposedSchema` e mudar `nome.max(200)` pra `nome.max(60)`. Adicionar mensagem clara:

```typescript
export const subtopicoDecomposedSchema = z.object({
  nome: z.string()
    .min(3)
    .max(60, 'Nome muito longo. Use 3-6 palavras. Coloque o contexto em conceito_pai.'),
  duracao_min: z.number().int().min(15).max(120),
  conceito_pai: z.string().min(1).max(80),
  origin: z.enum(['ai', 'manual']).default('ai'),
})
```

- [ ] **Step 2: System prompt rígido com exemplos**

Em `topico-decomposer.ts`, substituir SYSTEM_PROMPT por:

```typescript
const SYSTEM_PROMPT = `Você é um especialista em editais de concurso. Decomponha o texto bruto de um tópico do edital em subtópicos pequenos, atômicos e estudáveis isoladamente.

REGRA CRÍTICA — nome do subtópico:
- 3 a 6 palavras MÁXIMO. Apenas o conceito atômico em si.
- NUNCA inclua o contexto pai no nome — isso vai em "conceito_pai" separadamente.
- NUNCA use frases longas, listas, vírgulas ou "e" coordenando conceitos distintos.

Exemplos CORRETOS:
  nome: "Pregão", conceito_pai: "Licitações"
  nome: "Centralização", conceito_pai: "Organização administrativa"
  nome: "Princípio da legalidade", conceito_pai: "Princípios constitucionais"

Exemplos ERRADOS (não faça isso):
  nome: "Licitações - Pregão"                      ← já tem o pai colado
  nome: "Centralização e descentralização"         ← 2 conceitos distintos virariam 2 subtopicos
  nome: "Noções de organização administrativa"     ← longo demais e é o pai, não filho

Para cada subtópico produza:
1. nome: 3-6 palavras, sem contexto pai (3-60 chars)
2. duracao_min: 25-75 minutos (mais longo se denso)
3. conceito_pai: o tópico/agrupamento (1-80 chars)

No nível do tópico inteiro também produza:
- nome_curto: 2-6 palavras resumindo o tópico (3-60 chars)
- conceitos_pai: até 5 grupos conceituais identificados
- referencias_legais: leis/decretos/súmulas citados

Retorne APENAS JSON válido, sem prefácio. Schema:
{
  "nome_curto": string,
  "conceitos_pai": string[],
  "subtopicos": [
    { "nome": string, "duracao_min": number, "conceito_pai": string }
  ],
  "referencias_legais": string[]
}`
```

- [ ] **Step 3: Rodar tests pra confirmar que mudança de max não quebra existentes**

```bash
cd "D:/meta novo/Metav2" && npx vitest run src/lib/cronograma-v2/__tests__/
```

Se algum teste de schemas estiver passando nomes >60 chars, o subagent deve adaptar OS TESTES pra usar nomes válidos (não relaxar o schema).

- [ ] **Step 4: Commit**

```bash
git add src/lib/cronograma-v2/schemas.ts src/lib/cronograma-v2/topico-decomposer.ts src/lib/cronograma-v2/__tests__/
git commit -m "feat(cronograma-v2): enforce short subtopico names (max 60) + reinforce IA prompt with examples"
```

---

### Task 2: Componente `ScheduleItemTitle`

**Files:**
- Create: `src/components/cronograma/ScheduleItemTitle.tsx`

Componente que recebe `{ conceitoPai?, nome }` e renderiza com hierarquia.

- [ ] **Step 1: Criar componente**

```tsx
import { cn } from '@/lib/utils'

export interface ScheduleItemTitleProps {
  conceitoPai?: string | null
  nome: string
  /** Variante de tamanho. Default "default" pra cards normais. */
  size?: 'sm' | 'default' | 'lg'
  className?: string
}

const SIZES = {
  sm:      { parent: 'text-[9px]',  main: 'text-[13px]' },
  default: { parent: 'text-[10px]', main: 'text-sm'    },
  lg:      { parent: 'text-xs',     main: 'text-base'  },
}

export function ScheduleItemTitle({
  conceitoPai, nome, size = 'default', className,
}: ScheduleItemTitleProps) {
  const s = SIZES[size]
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      {conceitoPai && (
        <span className={cn(
          s.parent,
          'uppercase tracking-wider font-semibold text-slate-400',
        )}>
          {conceitoPai}
        </span>
      )}
      <span className={cn(s.main, 'font-medium text-slate-900 leading-snug')}>
        {nome}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cronograma/ScheduleItemTitle.tsx
git commit -m "feat(cronograma-v2): add ScheduleItemTitle with hierarchical render (conceito_pai + nome)"
```

---

### Task 3: Wire em CronogramaPage e CronogramaSheet + hidratação do conceito_pai

**Files:**
- Modify: `src/app/api/cronograma/criar-plano/route.ts`
- Modify: `src/views/CronogramaPage.tsx`
- Modify: `src/components/CronogramaSheet.tsx`

Pra renderizar `conceito_pai` no cronograma, precisa que ele esteja gravado no `schedule_items.title` OU em outro campo acessível. O `title` hoje vem só do `nome` do subtopico.

**Decisão**: persistir o `conceito_pai` no campo `subtopicos` table (existente, não-usado pra isso) ao hidratar. Aí o cronograma consulta `schedule_items` → JOIN `subtopicos` → pega ambos.

OU mais simples: gravar `title` como `"{conceito_pai}|{nome}"` (com separador `|` proibido em ambos) e parsear no front. Hacky.

**Melhor abordagem**: aproveitar que o `subtopicos.nome` já é gravado durante hidratação no endpoint. Adicionar uma coluna virtual: gravar `conceito_pai` num campo existente da tabela `subtopicos`. Se não tem campo livre, fazer fallback parseando o título.

Pragmático pra MVP: na hidratação (`/api/cronograma/criar-plano`), em vez de só gravar `nome`, gravar `nome` E também colocar `conceito_pai` na descrição/observação se houver, OU gravar `nome = nome` e separar via prop no front carregando da decomposição.

**Implementação escolhida**: setup `conceito_pai` é metadata, fica no JSONB de `cargo_snapshot` do plano (já é JSONB). Não é o lugar ideal mas evita migration nova.

Solução mais limpa: **adicionar coluna `conceito_pai TEXT` em `subtopicos`** via mini-migration. ~30s.

- [ ] **Step 1: Mini-migration**

Criar `supabase/migrations/20260516120000_subtopicos_conceito_pai.sql`:

```sql
-- UP: adiciona conceito_pai em subtopicos (rastreabilidade de hierarquia)
-- DOWN: ALTER TABLE subtopicos DROP COLUMN conceito_pai;
ALTER TABLE subtopicos ADD COLUMN IF NOT EXISTS conceito_pai TEXT;
COMMENT ON COLUMN subtopicos.conceito_pai IS
  'Grupo conceitual pai (de edital_cache.decomposicao). Usado pra renderizar hierarquia visual no cronograma.';
```

Aplicar manual no Studio (mesmo padrão das outras). Registrar no schema_migrations.

- [ ] **Step 2: Atualizar hidratação no endpoint**

Em `src/app/api/cronograma/criar-plano/route.ts`, na seção que faz `INSERT INTO subtopicos`, propagar `conceito_pai`:

```typescript
const toInsert = subtopicos
  .filter((s) => !existingNomes.has(s.nome))
  .map((s) => ({
    user_id: userId,
    topico_id: topicoLocalId,
    nome: s.nome,
    estimated_duration_minutes: s.estimated_duration_minutes,
    conceito_pai: s.conceito_pai ?? null,  // ⬅ novo
  }))
```

Adaptar o array `subtopicos`:
```typescript
const subtopicos = decomposed?.subtopicos.length
  ? decomposed.subtopicos.map((s) => ({
      nome: s.nome.slice(0, 60),
      estimated_duration_minutes: s.duracao_min ?? 45,
      conceito_pai: s.conceito_pai ?? null,  // ⬅ novo
    }))
  : [{ nome: apiTopico.nome.slice(0, 60), estimated_duration_minutes: 45, conceito_pai: null }]
```

- [ ] **Step 3: Propagação no `gerar_cronograma_v2` SQL**

Atual: o RPC pega o `nome` de `subtopicos` e grava em `schedule_items.title`. Pra ter `conceito_pai` no item, precisa também propagar.

Opção A (mais limpa): adicionar coluna `conceito_pai TEXT` em `schedule_items`. Migration adicional.

Opção B (sem migration): no front, JOIN `schedule_items.subtopico_id → subtopicos.conceito_pai`.

**Escolha B** pra evitar mais migration. Subagent: modificar a query que carrega items no front pra fazer o JOIN. Procurar onde `useCronogramaActivo` / `useCronogramaWeek` lê items.

- [ ] **Step 4: Modificar hooks de leitura do cronograma**

Localizar `src/hooks/useCronogramaWeek.ts` (ou similar). Onde faz `select` em `schedule_items`, adicionar:

```typescript
.select('*, subtopicos:subtopico_id(conceito_pai)')
```

E expor `conceito_pai` no shape retornado pra cada item.

- [ ] **Step 5: Wire `ScheduleItemTitle` no CronogramaPage + Sheet**

Procurar onde cada item de schedule_items é renderizado (`title` é mostrado). Substituir por:

```tsx
<ScheduleItemTitle
  conceitoPai={item.subtopicos?.conceito_pai}
  nome={item.title}
  size="default"
/>
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260516120000_subtopicos_conceito_pai.sql \
        src/app/api/cronograma/criar-plano/route.ts \
        src/hooks/useCronogramaWeek.ts \
        src/views/CronogramaPage.tsx \
        src/components/CronogramaSheet.tsx
git commit -m "feat(cronograma-v2): persist + render conceito_pai hierarchically in schedule items"
```

---

### Task 4: Curadoria mostra `conceito_pai` editável + warning de length

**Files:**
- Modify: `src/components/moderation/curadoria/SubtopicoRow.tsx`
- Create: `src/components/moderation/curadoria/SubtopicoLengthWarning.tsx`

Tree do admin precisa exibir e permitir editar `conceito_pai`. Plus warning visual quando `nome > 60`.

- [ ] **Step 1: SubtopicoLengthWarning component**

```tsx
import { AlertTriangle } from 'lucide-react'

export function SubtopicoLengthWarning({ length, max = 60 }: { length: number; max?: number }) {
  if (length <= max) return null
  return (
    <span
      title={`Nome muito longo (${length} chars, máx ${max}). Pode ficar truncado no cronograma.`}
      className="inline-flex items-center gap-0.5 text-[10px] text-amber-600"
    >
      <AlertTriangle className="h-3 w-3" />
      {length}/{max}
    </span>
  )
}
```

- [ ] **Step 2: Modificar SubtopicoRow pra incluir conceito_pai + warning**

Layout atualizado:
```tsx
<div className="py-1.5 px-3 hover:bg-slate-50 rounded-lg space-y-1">
  <div className="flex items-center gap-2">
    <OriginBadge origin={sub.origin ?? 'ai'} />
    <input
      type="text"
      value={sub.nome}
      disabled={readOnly}
      onChange={(e) => onChange({ ...sub, nome: e.target.value })}
      className="flex-1 text-sm bg-transparent border-none focus:outline-none focus:bg-white focus:px-2 focus:rounded disabled:cursor-not-allowed"
      maxLength={80}  // soft limit; schema enforce 60
    />
    <SubtopicoLengthWarning length={sub.nome.length} />
    <input
      type="number"
      value={sub.duracao_min}
      disabled={readOnly}
      min={15} max={120}
      onChange={(e) => onChange({ ...sub, duracao_min: Number(e.target.value) || 45 })}
      className="w-16 text-xs text-right bg-transparent border-none focus:outline-none focus:bg-white focus:rounded disabled:cursor-not-allowed"
    />
    <span className="text-[10px] text-slate-400">min</span>
    {!readOnly && (
      <button type="button" onClick={onDelete} className="text-slate-300 hover:text-rose-500" title="Remover">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    )}
  </div>
  <div className="flex items-center gap-1.5 pl-5">
    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">contexto</span>
    <input
      type="text"
      value={sub.conceito_pai}
      disabled={readOnly}
      placeholder="ex: Licitações"
      onChange={(e) => onChange({ ...sub, conceito_pai: e.target.value })}
      className="flex-1 text-[11px] text-slate-500 bg-transparent border-none focus:outline-none focus:bg-white focus:px-1.5 focus:rounded focus:text-slate-700 disabled:cursor-not-allowed"
      maxLength={80}
    />
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/moderation/curadoria/SubtopicoRow.tsx \
        src/components/moderation/curadoria/SubtopicoLengthWarning.tsx
git commit -m "feat(cronograma-v2): editable conceito_pai + length warning in SubtopicoRow"
```

---

### Task 5: Validação suave no autosave

**Files:**
- Modify: `src/components/moderation/curadoria/CuradoriaTreeMain.tsx`

Quando o autosave dispara, se tiver algum subtopico com `nome.length > 60`, mostra toast/banner amber no topo do main panel: "X subtópicos com nome muito longo — pode ficar truncado no cronograma."

- [ ] **Step 1: Adicionar contador derivado + banner**

```tsx
// Dentro do CuradoriaTreeMain, após decomp:
const longNamesCount = useMemo(() => {
  if (!decomp) return 0
  let count = 0
  for (const t of Object.values(decomp.by_topico)) {
    for (const s of t.subtopicos) {
      if (s.nome.length > 60) count++
    }
  }
  return count
}, [decomp])

// No JSX, logo após o header sticky:
{longNamesCount > 0 && (
  <div className="mx-6 mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900 flex items-center gap-2">
    <AlertTriangle className="h-4 w-4" />
    <span><strong>{longNamesCount}</strong> subtópicos com nome &gt; 60 chars — pode ficar truncado. Considere encurtar ou mover o contexto pra "Contexto".</span>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/moderation/curadoria/CuradoriaTreeMain.tsx
git commit -m "feat(cronograma-v2): banner counting subtopicos with nome > 60 chars"
```

---

### Task 6: Doc

**Files:**
- Create: `docs/cronograma-v2/sub-plan-5-6-applied.md`

- [ ] **Step 1: Doc**

```markdown
# Sub-plan 5.6 — Hierarquia visual de subtópicos (applied)

## Problema corrigido

Schedule items mostravam nomes-megatopic como "Noções de organização administrativa - Centralização, descentralização, concentração e desconcentração" — feio, longo e útil zero pra estudar.

## Solução

1. Schema enforça `nome.max(60)`. Contexto vai em `conceito_pai` (max 80).
2. IA prompt reforçado com exemplos corretos e errados.
3. `conceito_pai` persistido em `subtopicos` table (nova coluna).
4. Cronograma renderiza com hierarquia: contexto uppercase pequeno em cima + nome principal.
5. Curadoria mostra+edita `conceito_pai`; warning visual em nomes >60 chars.

## Commit chain

[`git log --oneline 790f827..HEAD`]

## Known limitations

- Items antigos (criados antes do Sub-plan 5.6) não têm `conceito_pai` preenchido — vão renderizar só o nome. Pra refrescar: re-criar plano com cargo curado.
- IA pode ainda produzir nomes longos ocasionalmente — admin precisa revisar manual.

## Próximo passo

Sub-plan 6 — Event loop reativo (FSRS, week.completed, recalibração).
```

- [ ] **Step 2: Commit**

```bash
git add docs/cronograma-v2/sub-plan-5-6-applied.md
git commit -m "docs(cronograma-v2): summary of sub-plan 5.6 (hierarquia visual)"
```

---

## Self-Review

**Cobertura:**
- ✅ Nome curto enforced (schema)
- ✅ IA prompt reforçado
- ✅ Render hierárquico no cronograma
- ✅ Curadoria mostra + edita conceito_pai
- ✅ Warning visual no admin
- ⚠️ Não cobre: regeneração automática de items legados (manual via re-curar + re-criar plano)

**Risk register:**
- Migration `subtopicos.conceito_pai` precisa ser aplicada manualmente no Studio (CLI db push não tá funcionando)
- Tests existentes podem quebrar com `nome.max(60)` se usavam strings longas como "Princípios fundamentais constitucionais aplicados ao direito administrativo brasileiro" — adaptar tests, não relaxar schema

**Type consistency:**
- `SubtopicoDecomposed.conceito_pai` já é obrigatório no schema desde Sub-plan 3 — bom
- `subtopicos.conceito_pai` (DB) é nullable pra retrocompat — bom

---

## Pré-execução checklist

- [ ] Sub-plans 1-5.5 aplicados
- [ ] Branch `cargo-transition-v2`
- [ ] Aplicar manualmente a migration `20260516120000_subtopicos_conceito_pai.sql` no Studio antes da Task 3 ser testada

---

## Plan complete. Saved to `docs/superpowers/plans/2026-05-15-cronograma-v2-plan-5-6-hierarquia-visual.md`.

**Duas opções:** Subagent-Driven (padrão) ou Inline.
