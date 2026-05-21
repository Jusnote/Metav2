# PAPIRO — Tela do Aluno (V1)

**Status:** spec aprovada após brainstorm
**Data:** 2026-05-20
**Autor:** Aldemir + Claude
**Branch:** `v3-mentoria`
**Projeto Supabase:** `xmtleqquivcukwgdexhc`
**Spec irmão (banco + importador):** [`2026-05-20-papiro-schema-import-design.md`](./2026-05-20-papiro-schema-import-design.md)

---

## 1. Contexto e motivação

A spec irmã definiu e implementou o **schema `papiro.*`** e o **importador de taxonomia** — hoje há 22 temas de Informática → Redes e Internet carregados e queryáveis via PostgREST com `supabase.schema('papiro').from(...)`. Validado por `scripts/papiro/test-read.ts` (etapa anon = 401, etapa autenticada = 22 temas em ordem).

Esta spec define o **outro lado**: a interface que o **aluno** usa pra consumir a taxonomia — navegar pela hierarquia (Disciplina → Macro_area → Tema) e ler resumos.

### Por que separar admin de aluno

O PAPIRO terá duas frentes:

- **Aluno (esta spec)** — consumo: ler resumos, navegar a trilha. Acesso público pra autenticados via RLS já em vigor.
- **Admin (fase futura)** — produção: criar/editar/publicar resumos. Acesso restrito, escrita só via service_role hoje, com UI dedicada na próxima fase.

Construir aluno primeiro valida o caminho ponta-a-ponta (taxonomia → schema → tela). Pra "acender" o primeiro resumo nesta V1, basta um `INSERT` manual em `papiro.resumo` com `status='publicado'` (que vai virar UPSERT script ou tela admin depois).

### O que o aluno vê na V1

- **`/estudar`** — índice global de disciplinas (Disponíveis / Em produção).
- **`/estudar/:disciplinaSlug`** — macro_areas dessa disciplina.
- **`/estudar/:disciplinaSlug/:macroAreaTail`** — trilha de temas (a linha vertical com nodos).
- **`/estudar/:disciplinaSlug/:macroAreaTail/:temaTail`** — leitor do tema (ou preview "em breve" se sem resumo publicado).

Hoje, com 22 temas e 0 resumos publicados, a tela nasce inteira em "em breve". À medida que resumos vão sendo publicados (manual ou via futuro editor admin), os nodos verdes "acendem".

---

## 2. Decisões consolidadas

Rastro do brainstorm (14 decisões + refinamentos):

| # | Decisão | Escolha |
|---|---|---|
| 1 | Escopo V1 | Lista + leitor + status visual + prereqs visíveis (sem progresso, sem busca) |
| 2 | Rotas | Hierarquia de 4 níveis: `/estudar` → `/estudar/:disciplinaSlug` → `/estudar/:disciplinaSlug/:macroAreaTail` → `/estudar/:disciplinaSlug/:macroAreaTail/:temaTail` |
| 3 | Estados visuais | 2 — `disponível` (verde sage) e `em breve` (vazado); RLS bloqueia `revisao` do aluno |
| 4 | Layout `/estudar` | Página própria com seções "Disponíveis" + "Em produção" derivadas dos dados |
| 5 | Layout `/estudar/:disciplina` | Mesmo padrão, listando macro_areas dessa disciplina |
| 6 | Layout da trilha | Trilha v4 — branco minimalista, número fora do círculo, linha conectora 1px, prereqs como "apoia‑se em *X*" |
| 7 | Layout do leitor | Focal — breadcrumb topo, prev/next rodapé, **sem sidebar** |
| 8 | Viewer Plate | Reusa `src/v3/components/resumos/ResumoLeitor.tsx` (readOnly, 36 linhas, estável apesar do re-design v3 das páginas) |
| 9 | Estado "em breve" | Preview pedagógico rico — objetivo + conceitos + prereqs; **sem fontes** (essas só pro admin) |
| 10 | Dados expostos ao aluno | `nome`, `descricao_breve`, `objetivo_pedagogico`, `conceitos_principais`, `ordem_curricular`, `tempo_estudo_min`, `tema_prereq` |
| 11 | Dados ocultos do aluno | `mapeamento_paginas`, `profundidade_estrat/gran` |
| 12 | Mobile lista | Responsivo simples — mesmo chrome, padding reduzido |
| 13 | Mobile leitor | Focal full-screen **apenas em mobile** (via `position: fixed` + media query, sem mexer no `isStudyMode` global) |
| 14 | Entrada no AppTopNav | Item próprio "Estudar" no main nav (posição 2, depois de Início; `IconBook2`) |
| 15 | Tipos | Typegen automático (`supabase gen types --schema=papiro`) para tabelas; tipos derivados (composições) manuais em `lib/papiro/types.ts` |
| 16 | Queries | React Query + `supabase.schema('papiro').from(...)`; aggregação **client-side** (sem views novas no DB) pra V1; staleTime 5 min |
| 17 | Hooks | 4 hooks separados (1 por nível), cache independente |
| 18 | Rotas inválidas | Redirect pra `/estudar` (sem página 404 dedicada na V1) |

---

## 3. Arquitetura

### 3.1 Layout de arquivos

```
src/
├─ views/papiro/
│   ├─ PapiroIndexPage.tsx           (/estudar)
│   ├─ PapiroDisciplinaPage.tsx      (/estudar/:disciplinaSlug)
│   ├─ PapiroTrilhaPage.tsx          (/estudar/:disciplinaSlug/:macroAreaTail)
│   └─ PapiroLeitorPage.tsx          (/estudar/:disciplinaSlug/:macroAreaTail/:temaTail)
├─ components/papiro/
│   ├─ DisciplinaCard.tsx            (card em /estudar)
│   ├─ MacroAreaCard.tsx             (card em /estudar/:disciplina)
│   ├─ TrilhaHeader.tsx              (header stats + progress + sub)
│   ├─ TrilhaItem.tsx                (1 row da trilha: número, nodo, card)
│   ├─ TemaSemResumoPreview.tsx      (preview rico do estado "em breve")
│   ├─ LeitorTopbar.tsx              (× sair + "Tema N de M"; visível só em mobile)
│   └─ LeitorNavRodape.tsx           (prev/next com label e nome do tema)
├─ hooks/papiro/
│   ├─ usePapiroDisciplinas.ts
│   ├─ usePapiroDisciplina.ts
│   ├─ usePapiroTrilha.ts
│   └─ usePapiroTema.ts
├─ lib/papiro/
│   ├─ slug.ts                       (build/parse de slugs + URL helpers)
│   ├─ slug.test.ts                  (vitest)
│   └─ types.ts                      (tipos derivados manuais; re-exporta gerados)
└─ types/
    └─ database.papiro.ts            (gerado por `supabase gen types --schema=papiro`)
```

### 3.2 Rotas (`src/App.tsx`)

Declaradas manualmente seguindo o padrão atual, dentro do `<Route path="/" element={<AppContent />}>`:

```tsx
<Route path="estudar" element={<PrivateRoute><PapiroIndexPage /></PrivateRoute>} />
<Route path="estudar/:disciplinaSlug" element={<PrivateRoute><PapiroDisciplinaPage /></PrivateRoute>} />
<Route path="estudar/:disciplinaSlug/:macroAreaTail" element={<PrivateRoute><PapiroTrilhaPage /></PrivateRoute>} />
<Route path="estudar/:disciplinaSlug/:macroAreaTail/:temaTail" element={<PrivateRoute><PapiroLeitorPage /></PrivateRoute>} />
```

### 3.3 `lib/papiro/slug.ts`

Funções puras testáveis, sem dependência de React/router:

```ts
// URL params → slug_hierarquico do DB (concat com pontos)
buildMacroAreaSlug(disciplinaSlug: string, macroAreaTail: string): string;
buildTemaSlug(disciplinaSlug: string, macroAreaTail: string, temaTail: string): string;

// slug do DB → URL params (split por '.')
parseMacroAreaSlug(slug: string): { disciplinaSlug: string; macroAreaTail: string };
parseTemaSlug(slug: string): { disciplinaSlug: string; macroAreaTail: string; temaTail: string };

// slug do DB → href para <Link>
disciplinaUrl(disciplinaSlug: string): string;          // → "/estudar/informatica"
macroAreaUrl(macroAreaSlug: string): string;            // → "/estudar/informatica/redes_internet"
temaUrl(temaSlugHierarquico: string): string;           // → "/estudar/informatica/redes_internet/fundamentos_redes"

// Validações (joga erro se slug não casar com /^[a-z0-9_.]+$/ ou não tiver segmentos esperados)
validateSlug(slug: string): void;
```

Cobertura de testes (`slug.test.ts`): slug normal, com underscore, com inválidos (espaço/maiúscula/acento → throw), URLs roundtrip, etc.

---

## 4. Componentes por tela

### 4.1 `PapiroIndexPage` (`/estudar`)

```tsx
function PapiroIndexPage() {
  const { data, isLoading, error } = usePapiroDisciplinas();
  if (isLoading) return <SkeletonDisciplinas />;
  if (error || !data) return <ErrorState />;
  const { disponiveis, emProducao } = data;
  return (
    <PageContainer>
      <Header kicker="Papiro" title="Estudar" sub="Trilhas curadas..." />
      <Section title="Disponíveis" count={disponiveis.length}>
        {disponiveis.map(d => <DisciplinaCard key={d.id} disciplina={d} />)}
      </Section>
      {emProducao.length > 0 && (
        <Section title="Em produção" count={emProducao.length}>
          {emProducao.map(d => <DisciplinaCard key={d.id} disciplina={d} coming />)}
        </Section>
      )}
    </PageContainer>
  );
}
```

### 4.2 `PapiroDisciplinaPage` (`/estudar/:disciplinaSlug`)

```tsx
function PapiroDisciplinaPage() {
  const { disciplinaSlug } = useParams();
  const { data, isLoading } = usePapiroDisciplina(disciplinaSlug);
  if (isLoading) return <SkeletonDisciplina />;
  if (!data) return <Navigate to="/estudar" replace />;
  return (
    <PageContainer>
      <Breadcrumb path={[{ href: '/estudar', label: 'Estudar' }]} />
      <Header kicker="Disciplina" title={data.nome} sub="Áreas de estudo..." />
      <Section title="Disponíveis" count={data.macroAreasDisponiveis.length}>
        {data.macroAreasDisponiveis.map(m => <MacroAreaCard key={m.id} macroArea={m} />)}
      </Section>
      {data.macroAreasEmProducao.length > 0 && (
        <Section title="Em produção" count={data.macroAreasEmProducao.length}>
          {data.macroAreasEmProducao.map(m => <MacroAreaCard key={m.id} macroArea={m} coming />)}
        </Section>
      )}
    </PageContainer>
  );
}
```

### 4.3 `PapiroTrilhaPage` (`/estudar/:disciplinaSlug/:macroAreaTail`)

```tsx
function PapiroTrilhaPage() {
  const { disciplinaSlug, macroAreaTail } = useParams();
  const slug = buildMacroAreaSlug(disciplinaSlug, macroAreaTail);
  const { data, isLoading } = usePapiroTrilha(slug);
  if (isLoading) return <SkeletonTrilha />;
  if (!data) return <Navigate to={`/estudar/${disciplinaSlug}`} replace />;
  return (
    <PageContainer>
      <Breadcrumb path={[
        { href: '/estudar', label: 'Estudar' },
        { href: `/estudar/${disciplinaSlug}`, label: data.disciplinaNome },
      ]} />
      <TrilhaHeader
        kicker={data.disciplinaNome}
        title={data.nome}
        sub="22 temas · trilha curada..."
        stats={data.stats}
      />
      <ol className="papiro-trilha">
        {data.temas.map(t => <TrilhaItem key={t.id} tema={t} />)}
      </ol>
    </PageContainer>
  );
}
```

`<TrilhaItem>` renderiza o layout v4: número discreto, círculo (verde com ✓ se disponível, vazado se em breve), card com título + meta row (status pill + `tempo_estudo_min` + prereqs como "apoia‑se em *Fundamentos*").

### 4.4 `PapiroLeitorPage` (`/estudar/:disciplinaSlug/:macroAreaTail/:temaTail`)

```tsx
function PapiroLeitorPage() {
  const { disciplinaSlug, macroAreaTail, temaTail } = useParams();
  const slug = buildTemaSlug(disciplinaSlug, macroAreaTail, temaTail);
  const { data, isLoading } = usePapiroTema(slug);

  if (isLoading) return <SkeletonLeitor />;
  if (!data) return <Navigate to={`/estudar/${disciplinaSlug}/${macroAreaTail}`} replace />;

  const { tema, resumo, prev, next, prereqs, indice } = data;
  const temResumoPublicado = resumo !== null;

  return (
    <article className="papiro-leitor">
      <LeitorTopbar  /* visível só em mobile via CSS */
        onExit={`/estudar/${disciplinaSlug}/${macroAreaTail}`}
        indice={indice}
      />
      <Breadcrumb path={[
        { href: '/estudar', label: 'Estudar' },
        { href: `/estudar/${disciplinaSlug}`, label: data.disciplinaNome },
        { href: `/estudar/${disciplinaSlug}/${macroAreaTail}`, label: data.macroAreaNome },
      ]} />
      <h1>{tema.nome}</h1>
      <div className="meta">Tema {tema.ordem_curricular} · {tema.tempo_estudo_min} min</div>

      {prereqs.length > 0 && (
        <PrereqLine prereqs={prereqs} disciplinaSlug={disciplinaSlug} macroAreaTail={macroAreaTail} />
      )}

      {temResumoPublicado
        ? <ResumoLeitor conteudo={resumo.conteudo_plate} />
        : <TemaSemResumoPreview tema={tema} prereqs={prereqs} />}

      <LeitorNavRodape prev={prev} next={next} />
    </article>
  );
}
```

`<LeitorTopbar>` aplica `position: fixed; inset: 0; z-index: 50; background: #fff` via media query `(max-width: 768px)`. Em desktop fica `display: none`. Inclui também `body { overflow: hidden }` quando ativo (via classe condicional).

### 4.5 `<TemaSemResumoPreview>`

Componente separado pro estado "em breve" — preview pedagógico rico:
- Tag "em breve" (chip outline)
- Section "Apoia-se em" (links pros prereqs)
- Section "Objetivo" (`tema.objetivo_pedagogico`)
- Section "O que vai cobrir" (`tema.conceitos_principais` como chips)
- **NÃO inclui** `mapeamento_paginas` (decisão 11 — fontes só pro admin)

---

## 5. Hooks e queries

Todas usam React Query. `staleTime: 5 * 60 * 1000` (5 min). `supabase.schema('papiro').from(...)` consistente em todas.

### 5.1 `usePapiroDisciplinas()`

```ts
queryKey: ['papiro', 'disciplinas']
queryFn: nested select com disciplina + macro_area + tema + resumo
agregação client-side:
  - disponiveis: disciplinas com pelo menos 1 resumo publicado
  - emProducao: disciplinas com 0 resumos publicados
```

### 5.2 `usePapiroDisciplina(disciplinaSlug)`

```ts
queryKey: ['papiro', 'disciplina', disciplinaSlug]
queryFn: nested select disciplina + macro_area + tema + resumo, filtrado por slug
agregação client-side por macro_area: temas_count, tempo_total_min, temas_disponiveis_count
retorna { disciplina, macroAreasDisponiveis, macroAreasEmProducao }
```

### 5.3 `usePapiroTrilha(macroAreaSlug)`

```ts
queryKey: ['papiro', 'trilha', macroAreaSlug]
2 queries paralelas (React Query coordena):
  Q1: macro_area + disciplina + temas + resumos (1 ida)
  Q2: tema_prereq IN (temaIds) com nested prereq:tema!prereq_tema_id (1 ida)
cliente: monta temas[] com `status` + `prereqs[]` resolvido com nome
retorna { nome, disciplinaNome, stats, temas[] }
```

### 5.4 `usePapiroTema(temaSlug)`

```ts
queryKey: ['papiro', 'tema', temaSlug]
2 queries paralelas:
  Q1: tema + resumo (filtrado por status='publicado' pela RLS) + macro_area + disciplina + irmãos (pra prev/next)
  Q2: tema_prereq deste tema com nested prereq:tema!prereq_tema_id
cliente: calcula prev/next pela ordem_curricular dos irmãos
retorna { tema, resumo|null, prev|null, next|null, prereqs[], indice: { atual, total }, macroAreaNome, disciplinaNome }
```

**Nota sobre `resumo` embed:** PostgREST embed via FK retorna array vazio quando RLS bloqueia (status != 'publicado'). Cliente trata: `const temResumo = !!tema.resumo?.length;`. Não é erro — comportamento esperado.

---

## 6. Tipos TypeScript

### 6.1 Gerados (`src/types/database.papiro.ts`)

Gerado por:
```bash
node_modules/.bin/supabase gen types typescript \
  --project-id xmtleqquivcukwgdexhc \
  --schema papiro \
  > src/types/database.papiro.ts
```

Adicionado script ao `package.json`:
```json
"papiro:types": "supabase gen types typescript --project-id xmtleqquivcukwgdexhc --schema papiro > src/types/database.papiro.ts"
```

Convenção: **rodar `npm run papiro:types` após qualquer migration que toque `papiro.*`**. Documentado no `scripts/papiro/README.md`.

Cobre: `disciplina`, `macro_area`, `tema`, `tema_prereq`, `resumo`. Quando entrarem `modulo`, `questao_vinculo`, `progresso_aluno`, são pegos automaticamente.

### 6.2 Derivados (`src/lib/papiro/types.ts`)

Tipos manuais que compõem várias tabelas — re-exporta tipos brutos pra ergonomia:

```ts
import type { Database } from '@/types/database.papiro';

export type PapiroDisciplina = Database['papiro']['Tables']['disciplina']['Row'];
export type PapiroMacroArea = Database['papiro']['Tables']['macro_area']['Row'];
export type PapiroTema = Database['papiro']['Tables']['tema']['Row'];
export type PapiroResumo = Database['papiro']['Tables']['resumo']['Row'];
export type StatusResumo = 'rascunho' | 'revisao' | 'publicado';

// Composições (retornos dos hooks)
export interface PapiroTemaComStatus extends PapiroTema {
  temResumoPublicado: boolean;
}
export interface PapiroPrereqResolvido {
  slug_hierarquico: string;
  nome: string;
}
export interface PapiroTrilhaData {
  id: string;
  slug: string;
  nome: string;
  disciplinaSlug: string;
  disciplinaNome: string;
  stats: { temasTotal: number; tempoTotalMin: number; temasDisponiveis: number };
  temas: Array<PapiroTemaComStatus & { prereqs: PapiroPrereqResolvido[] }>;
}
export interface PapiroTemaData {
  tema: PapiroTema;
  resumo: PapiroResumo | null;
  prev: { slug_hierarquico: string; nome: string; ordem_curricular: number } | null;
  next: { slug_hierarquico: string; nome: string; ordem_curricular: number } | null;
  prereqs: PapiroPrereqResolvido[];
  indice: { atual: number; total: number };
  macroAreaNome: string;
  disciplinaNome: string;
  disciplinaSlug: string;
  macroAreaTail: string;
}
// ...etc
```

---

## 7. Integração no AppTopNav

Em `src/components/AppTopNav.tsx`, no array `mainNavigation`, adicionar como **2º item** (depois de Início):

```tsx
const mainNavigation: NavItem[] = [
  { label: "Início", href: "/", icon: <IconHome className="h-4 w-4" /> },
  { label: "Estudar", href: "/estudar", icon: <IconBook2 className="h-4 w-4" /> }, // ← novo
  { label: "Flashcards", href: "/flashcards", ... },
  // ... resto inalterado
];
```

- **Label**: "Estudar" (verbo, ação do aluno).
- **Ícone**: `IconBook2` do `@tabler/icons-react` (sem conflito com `IconNotebook` = Cadernos).
- **`isActive`** já trata `pathname.startsWith('/estudar')` corretamente (App.tsx:107-108).
- **Item legacy "Resumos"** (`/resumos-list` em `moreItems`) — **não tocar**. Continua funcionando até o admin PAPIRO entrar e decidirmos migração.

---

## 8. Mobile

### Lista (responsivo simples)

Mesmo design da trilha v4 com media queries:
- Padding lateral reduzido (~16px).
- Stats no header viram column em vez de row em telas estreitas.
- Card mantém estrutura.

### Leitor (focal full-screen, **apenas mobile**)

CSS-only via media query, **sem mexer em `isStudyMode`** em `App.tsx`:

```css
@media (max-width: 768px) {
  .papiro-leitor {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: #fff;
    overflow-y: auto;
  }
  /* trava scroll do body por trás */
  body.papiro-leitor-open { overflow: hidden; }
  .papiro-leitor-topbar { display: flex; } /* só nessa breakpoint */
}
@media (min-width: 769px) {
  .papiro-leitor-topbar { display: none; }
}
```

A classe `papiro-leitor-open` é aplicada/removida no `body` pelo `PapiroLeitorPage` (via `useEffect`) — só efetiva em mobile pelo CSS.

`<LeitorTopbar>` aparece só em mobile, contém:
- `× sair` → navega pra `/estudar/:disciplinaSlug/:macroAreaTail` (trilha)
- `Tema N de M` no centro (do `indice` retornado pelo hook)

Em desktop, leitor é página normal sob AppTopNav (não cobre).

Decisão consciente: focal **em desktop também** fica pra fase futura. Reaproveita o `isStudyMode` em `App.tsx:92` quando vier.

---

## 9. Verificação

### Testes unitários (vitest)

- `src/lib/papiro/slug.test.ts` — todos os helpers:
  - Slug normal (`buildTemaSlug('informatica', 'redes_internet', 'fundamentos_redes')` → `'informatica.redes_internet.fundamentos_redes'`)
  - Roundtrip (build → parse → mesmos params)
  - URL helpers (`temaUrl('informatica.redes_internet.fundamentos_redes')` → `'/estudar/informatica/redes_internet/fundamentos_redes'`)
  - Slug inválido (espaço, maiúscula, acento) → `validateSlug` joga
  - ~10 testes

### Smoke manual (após implementação)

1. **Build limpo**: `npm run build` passa sem erros TS após `npm run papiro:types`.
2. **Auth path**: `/estudar` sem login → redirect `/auth`. Com login → carrega.
3. **Hierarquia funciona**:
   - `/estudar` → "Informática" disponível, 0 em produção.
   - `/estudar/informatica` → "Redes e Internet" disponível, 0 em produção.
   - `/estudar/informatica/redes_internet` → 22 temas, todos "em breve".
   - `/estudar/informatica/redes_internet/fundamentos_redes` → preview pedagógico rico (objetivo + conceitos + prereqs); SEM mapeamento_paginas visível.
4. **Estado "disponível" (após `INSERT` manual em `papiro.resumo`)**:
   ```sql
   INSERT INTO papiro.resumo (tema_id, conteudo_plate, status)
   SELECT id, '[{"type":"p","children":[{"text":"teste"}]}]'::jsonb, 'publicado'
   FROM papiro.tema WHERE slug_hierarquico = 'informatica.redes_internet.fundamentos_redes';
   ```
   - Recarregar `/estudar/informatica/redes_internet` — nodo "Fundamentos" acende verde com ✓ e chip `▶ disponível`.
   - Abrir o tema — `<ResumoLeitor>` renderiza o Plate; preview pedagógico some.
   - Stats no header da trilha viram "1 disponível, 21 em breve".
5. **Rotas inválidas**: `/estudar/foo`, `/estudar/informatica/bar`, `/estudar/informatica/redes_internet/baz` → redirect respectivo (`/estudar`, `/estudar/informatica`, `/estudar/informatica/redes_internet`).
6. **Mobile (DevTools 375x812)**: trilha responsiva; leitor entra em modo focal (cobre AppTopNav, `× sair` no canto, `Tema N de M` no header). Body não scrolla atrás.
7. **Regressão**: `/cronograma`, `/lei-seca`, `/cadernos`, `/flashcards`, `/resumos-list` continuam funcionando. `coaching.*` intocado.

---

## 10. Fora de escopo (V1)

- **Editor admin PAPIRO** (criar/editar/publicar resumo) — próximo grande marco; brainstorm próprio.
- Tabelas `modulo`, `questao_vinculo`, `progresso_aluno` (não estão no piloto).
- Busca/filtro de temas.
- Modo focal **em desktop** (fica pra fase futura — `isStudyMode` em App.tsx tem caminho pronto pra estender).
- Visualização gráfica do grafo de pré-requisitos.
- Progresso/tracking do aluno (sem `progresso_aluno`).
- Múltiplas matérias (estrutura suporta, mas hoje só 1 carregada).
- Onboarding/tour da página `/estudar`.
- Integração com `coaching.*` (cronograma puxando resumo PAPIRO).
- E2E Playwright — esperar a tela assentar; agora seria testar algo que ainda vai ajustar.

---

## 11. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| `database.papiro.ts` desatualizar quando o schema mudar | `npm run papiro:types` obrigatório após cada migration em `papiro.*`. Documentado em `scripts/papiro/README.md`. |
| `ResumoLeitor` v3 ser refatorado de forma incompatível durante o re-design das páginas v3 | Viewer é puro (36 linhas, recebe `Value`); re-design v3 está nas **páginas**, não no viewer. Se quebrar, extrair pra `PapiroResumoViewer.tsx` próprio em ~5 min. |
| PostgREST embed retornar muitos dados quando crescer | Pra V1 (22 temas, 1 macro_area), zero impacto. Quando passar de ~50 temas por macro_area, considerar views materializadas. |
| Slug inválido vindo de futuro JSON do Arquiteto | Defesa em profundidade: validação no script importer + `validateSlug` no `lib/papiro/slug.ts`. |
| Mobile focal cobrir AppTopNav com `position: fixed` quebrar scroll do body | `body.papiro-leitor-open { overflow: hidden }` aplicado pelo `useEffect` no leitor; só efetiva via media query mobile. |
| Cache do React Query servir status antigo após publicar resumo | `staleTime: 5min`. Pra forçar após admin publicar (fase futura), `queryClient.invalidateQueries(['papiro'])`. |
| `coaching.resumos` × `papiro.resumo` confusão futura | Spec irmã documenta a divisão (`coaching` = "quando", `papiro` = "o que"). Sem mistura na V1. |
| **Risco de produto**: V1 nasce com 22 "em breve" — tela pode parecer "abandonada" em vez de "chegando" | Mitigado pelas decisões 9 (preview pedagógico rico — cada tema mostra objetivo + conceitos + prereqs, dá sensação de catálogo curado) + texto da trilha "a trilha cresce conforme novos resumos saem". Validar visualmente quando a tela estiver pronta — se ainda parecer abandonada, ajustar copy/visual antes do primeiro release. |

---

## 12. Como aplicar (após aprovação do spec)

A próxima fase é o **plano de implementação** (via skill `writing-plans`), que vai detalhar:

1. Rodar `npm run papiro:types` pra gerar `database.papiro.ts`.
2. Criar `src/lib/papiro/{slug.ts, slug.test.ts, types.ts}`.
3. Criar `src/hooks/papiro/{usePapiroDisciplinas, usePapiroDisciplina, usePapiroTrilha, usePapiroTema}.ts`.
4. Criar `src/components/papiro/*` (8 componentes).
5. Criar `src/views/papiro/{PapiroIndexPage, PapiroDisciplinaPage, PapiroTrilhaPage, PapiroLeitorPage}.tsx`.
6. Adicionar rotas em `src/App.tsx`.
7. Adicionar item "Estudar" em `src/components/AppTopNav.tsx`.
8. Adicionar script `papiro:types` em `package.json`.
9. Rodar `npm run build` pra validar TS.
10. Smoke manual segundo Seção 9.

Após smoke OK, commitar tudo em commit semântico (ex: `feat(papiro): tela do aluno V1 — hierarquia disciplina/macro_area/trilha/leitor`).

---

## 13. Próximas fases (fora deste spec)

- **Editor admin PAPIRO** — criar/editar/publicar `papiro.resumo` via Plate editor. Brainstorm próprio.
- **Tabelas extras**: `modulo`, `questao_vinculo` (com pgvector), `progresso_aluno`.
- **Modo focal em desktop** — estender `isStudyMode` em `App.tsx`.
- **Integração `papiro` ↔ `coaching.*`** — tabela-ponte `papiro.tema_subtopico_map` quando justificar.
- **Múltiplas matérias** — rodar o gerador da spec irmã (`scripts/papiro/generate-seed.ts`) com novos JSONs.
- **E2E Playwright** — quando a tela assentar.
- **Onboarding / tour** — se justificar pelo uso.
