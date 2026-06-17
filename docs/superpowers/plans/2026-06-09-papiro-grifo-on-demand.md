# Extrator de Grifo On-Demand ("Comentários do professor") — Plano

> **Para executores:** SUB-SKILL: usar `superpowers:subagent-driven-development` (recomendado) ou `executing-plans`. Passos com checkbox.

**Goal:** No `QuestionCard`, o botão "Comentários do professor" grifa os trechos errados/pegadinhas da questão (via Opus, on-demand + cache) e mostra um tooltip read-only ao passar o mouse.

**Arquitetura:** Cliente sempre chama `POST /api/ai/extract-grifos` → o servidor (service-role) faz cache-check em `question_grifos_cache` → hit devolve; miss chama `claude-opus-4-8` com o prompt validado, valida casamento literal, salva e devolve. Render num overlay **separado read-only** reusando a lib de âncora de `highlights/lib`.

**Stack:** Next.js 15 (App Router, `src/app/api/*/route.ts`), Supabase (service-role em `src/v3/lib/supabase/server.ts`), `@anthropic-ai/sdk` (já instalado).

**Decisões (aprovadas 2026-06-09):** (1) sempre via a rota; (2) cor/tooltip do grifo decididos em mock visual; (3) overlay separado read-only.

---

## Pré-requisitos / segredos
- `ANTHROPIC_API_KEY` em `.env.local` (server-only). **ROTACIONAR** a chave que vazou no chat. Nunca commitar.
- `SUPABASE_SERVICE_ROLE_KEY` já usado no projeto (ver `src/v3/lib/supabase/server.ts`).
- Prompt SYSTEM validado: `scripts/papiro/questoes-teste/pipeline/_grifo_test.py` (porta de entrada — copiar o texto, NÃO importar o .py).

---

## File Structure
- Create: `supabase/migrations/<ts>_question_grifos_cache.sql` — tabela de cache (rodada manual no painel SQL).
- Create: `src/server/grifos/extract-grifos.ts` — lib pura: prompt + chamada Opus + parse + **guard literal** + `local→target` + prefix/suffix. Testável sem rede (a chamada Opus injetável).
- Create: `src/server/grifos/grifos.types.ts` — tipos `GrifoRaw`, `Grifo` (resolvido p/ o front).
- Create: `src/app/api/ai/extract-grifos/route.ts` — cache-check (service-role) → lib → save → JSON.
- Create: `src/hooks/useQuestionGrifos.ts` — chama a rota, estados loading/erro/grifos, toggle.
- Create: `src/components/questoes/highlights/GrifoLayer.tsx` — overlay read-only (reusa `resolveAnchor`+`rangeRects`) + tooltip no hover.
- Create: `src/components/questoes/highlights/grifos.css` — estilo do grifo + tooltip (cor decidida no mock).
- Modify: `src/components/questoes/highlights/MarkableBlock.tsx` — prop opcional `grifos?: Grifo[]` → renderiza `<GrifoLayer>` junto do `HighlightLayer` (mesmo block ref).
- Modify: `src/components/QuestionCard.tsx` — botão no rodapé + tab `'grifo-professor'`, estado via `useQuestionGrifos`, passa `grifos` filtrados por target aos `MarkableBlock`.
- Test: `src/server/grifos/__tests__/extract-grifos.test.ts` — guard literal + mapeamento.

---

## Task 1: Migração — tabela de cache
**Files:** Create `supabase/migrations/<ts>_question_grifos_cache.sql`

- [ ] **Step 1: Escrever a migração**
```sql
create table if not exists public.question_grifos_cache (
  id             uuid primary key default gen_random_uuid(),
  question_id    bigint not null,
  model          text not null,
  prompt_version int  not null default 1,
  tipo_estrutura text,
  grifos         jsonb not null,         -- [{target,trecho,prefix,suffix,tipo_armadilha,tooltip}]
  created_at     timestamptz not null default now(),
  unique (question_id, model, prompt_version)
);
create index if not exists qgc_question_idx on public.question_grifos_cache (question_id);
alter table public.question_grifos_cache enable row level security;
-- sem policy de cliente: só o service-role (servidor) acessa.
```
- [ ] **Step 2:** Aldemir roda no painel SQL do Supabase (igual `question_highlights`). Confirmar "Success".

## Task 2: Lib de extração (pura, testável)
**Files:** Create `src/server/grifos/extract-grifos.ts`, `grifos.types.ts`; Test `__tests__/extract-grifos.test.ts`

- Porta o SYSTEM prompt de `_grifo_test.py` (3 regras de localização) como constante `GRIFO_SYSTEM` + `PROMPT_VERSION = 1`.
- `buildUserMsg({enunciado, alternativas, correta, banca, ano})` → string.
- `parseGrifos(rawText)` → `{tipo_estrutura, grifos: GrifoRaw[]}` (tira ```` ``` ````/`json`).
- `mapLocalToTarget(local)`: `/alternativa\s+([A-E])/i`→`alt:$1`; senão (`item ...`, `enunciado`)→`enunciado`.
- **Guard literal `validateGrifo(grifo, textByTarget)`:** normaliza espaços; confirma `trecho` ∈ texto do target. Descarta o que não casa.
- `computeContext(text, trecho)` → `{prefix, suffix}` (~32 ch antes/depois da 1ª ocorrência).
- `extractGrifos(question, callOpus)`: monta msg → `callOpus(system,user)` → parse → map+validate+context → devolve `Grifo[]` (só os que casam). `callOpus` injetável (testes passam um fake).
- [ ] Testes: guard rejeita trecho inexistente; `mapLocalToTarget` cobre alternativa/item/enunciado; `computeContext` corta certo. (Sem rede — `callOpus` fake.)

## Task 3: Rota server
**Files:** Create `src/app/api/ai/extract-grifos/route.ts`

- `POST` body: `{ questaoId:number, enunciado, alternativas:[{letter,text}], correta, banca?, ano? }`.
- service-role client (schema `public`) → `select ... where question_id=$ and model=$ and prompt_version=$`. Hit → `{grifos, cached:true}`.
- Miss → `extractGrifos(q, callOpus)` onde `callOpus` usa `@anthropic-ai/sdk` `messages.create({ model:'claude-opus-4-8', max_tokens:4000, system, messages })`. Sem `ANTHROPIC_API_KEY` → 401.
- Insert no cache (`question_id, model, prompt_version, tipo_estrutura, grifos`) → `{grifos, cached:false}`. Erros → 500 com msg curta.

## Task 4: Hook cliente
**Files:** Create `src/hooks/useQuestionGrifos.ts`

- `useQuestionGrifos(questaoId)` → `{ grifos, loading, error, fetch(payload), on, toggle }`.
- `fetch` faz `POST /api/ai/extract-grifos` 1x (memoiza por questaoId), guarda `grifos`. `toggle` liga/desliga o overlay sem refetch.

## Task 5: Render — GrifoLayer + tooltip (read-only)  [inclui mock visual]
**Files:** Create `GrifoLayer.tsx`, `grifos.css`

- [ ] **Mock visual primeiro:** montar no card real 2-3 opções de cor/tooltip do grifo → Aldemir escolhe.
- `GrifoLayer({ blockRef, grifos, target })`: filtra grifos do target; p/ cada um `resolveAnchor(block,{quote:trecho,prefix,suffix})` → `rangeRects` → pinta `.grifo-bg` (cor escolhida). `useLayoutEffect`+`ResizeObserver` (igual `HighlightLayer`).
- Hover num rect → tooltip read-only (Floating UI, reusa `HighlightPopover`) com `tipo_armadilha` (rótulo) + `tooltip` (explicação). Sem edição.

## Task 6: Wire no QuestionCard
**Files:** Modify `MarkableBlock.tsx`, `QuestionCard.tsx`

- `MarkableBlock`: prop `grifos?: Grifo[]` → renderiza `<GrifoLayer blockRef={ref} grifos={grifos} target={target} />` junto do `HighlightLayer`.
- `QuestionCard`: tab type ganha `'grifo-professor'`; botão no rodapé (label/ícone — curto, ex. "Professor"); `useQuestionGrifos`; ao abrir computa (spinner) e liga o overlay; passa `grifos.filter(target)` a cada `MarkableBlock` (enunciado + alternativas).

## Task 7: Validação end-to-end (dados reais)
- [ ] Testar nos 3 tipos validados na memória: item-based (id 171306), certo/errado (171908), MC (170432). Conferir: grifa no lugar certo, casa literal, tooltip com artigo correto, cache na 2ª abertura (instantâneo).

---

## Notas
- Opus é **inegociável** (memória: Qwen errou doutrina; auditoria não pega erro de conteúdo).
- `prompt_version` permite recomputar ao evoluir o prompt sem perder cache antigo.
- Não publicar chave/segredo no git (feedback do Aldemir). Testar com dados reais.
