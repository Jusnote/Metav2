# Taxonomia Integração — Design

**Data:** 2026-04-25
**Escopo:** ponta-a-ponta (Postgres Hetzner → API verus → UI no Metav2), validado com Direito Administrativo (499 nós, 137.627 questões classificadas).

## Contexto

A taxonomia de Direito Adm está pronta como JSON local (`D:\tec-output\taxonomia\merged\taxonomia-direito-administrativo.json`, 3.7MB, 19 L1 / 212 L2 / 268 L3, 99.97% cobertura). Esta leva traz a taxonomia pra dentro do app: persiste no Postgres do Hetzner, expõe via API REST da verus, e substitui o filtro "Assuntos" flat (apenas pra Direito Adm; outras 106 matérias mantêm filtro flat até terem taxonomia própria).

**Out of scope (follow-ups dedicados):**
- UI de curadoria manual (admin/professor reassign) — Leva 2.
- Pipeline pras 106 matérias restantes — Leva 3+.
- Consumo da taxonomia pelo matching de edital — já contemplado no schema, mas integração é trabalho próprio (`project_matching_audit_2026_04_20.md`).

## Invariantes

1. **GRAN é interno.** Nenhum identificador, título ou mensagem visível pro aluno ou professor pode mencionar "GRAN" (mesma regra que TEC). Pipeline já garante via `polish_names.py`; import valida com regex case-insensitive `not contains 'gran'` em `titulo` e `aliases`.
2. **Slug global com prefixo de matéria** (ex: `dir-adm.responsabilidade-civil`). Evita colisão entre matérias e simplifica parsing de URL deep links.
3. **Identidade dos nós é `stable_id` UUID** persistido no primeiro import. Os IDs internos do parse (`gran.X`) **não são estáveis** entre regenerações; toda referência externa (`questao_topico`, URL, API) usa `stable_id` ou `slug`.
4. **Audit é obrigatório.** Toda alteração em `questao_topico` é capturada por trigger Postgres em `questao_topico_log`, sem dependência de disciplina do app.
5. **Coexistência híbrida.** Pill "Assuntos" detecta `materia.has_taxonomia` e renderiza `TreePicker` (taxonomia) ou `FlatList` (assunto livre). Mesma pill, sem duplicação.

## Schema

Novas tabelas no Postgres Hetzner (mesmo DB que `questoes`).

### `taxonomia_versions`

Identidade estável de cada regeneração da taxonomia. UUID como `version` evita colisão de timestamp e sobrevive a backups/restore.

```sql
CREATE TABLE taxonomia_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  materia_slug  TEXT NOT NULL,
  applied_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source        TEXT NOT NULL,                     -- 'gran_pipeline:regen_2026_04', 'manual', ...
  notes         TEXT
);

CREATE INDEX idx_taxonomia_versions_materia ON taxonomia_versions (materia_slug, applied_at DESC);
```

A "versão ativa" de uma matéria é a mais recente (`MAX(applied_at) WHERE materia_slug = X`). Não há versionamento ativo de leitura — toda query lê a versão mais recente. A tabela existe pra ETag estável, audit, e (futuro) rollback ad-hoc.

### `taxonomia_nodes`

Hot table com a árvore corrente.

```sql
CREATE TABLE taxonomia_nodes (
  stable_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  materia_slug   TEXT NOT NULL,                    -- 'dir-adm', 'dir-const', ...
  slug           TEXT NOT NULL,                    -- global, prefixado: 'dir-adm.responsabilidade-civil'
  titulo         TEXT NOT NULL,                    -- já polido, sem GRAN
  nivel          SMALLINT NOT NULL CHECK (nivel BETWEEN 1 AND 3),
  parent_id      UUID REFERENCES taxonomia_nodes(stable_id) ON DELETE RESTRICT,
  ordem          INT NOT NULL,                     -- ordenação dentro do parent
  aliases        TEXT[] NOT NULL DEFAULT '{}',     -- termos alternativos (alimentam fuse.js)
  absorbed       TEXT[] NOT NULL DEFAULT '{}',     -- títulos L4-L6 mesclados pra dentro
  subtopicos_visuais JSONB NOT NULL DEFAULT '[]',  -- [{titulo, n_questoes, nivel_original}]
  -- count_*: persistidos na tabela companheira `taxonomia_counts`, não aqui (ver abaixo)
  -- path NÃO está aqui: é derivado em runtime via recursive CTE pra evitar drift em renames
  imported_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_in_version_id UUID NOT NULL REFERENCES taxonomia_versions(id),  -- só set em AddNode (não atualizado em regen) — pra debug

  UNIQUE (slug)  -- slug é global e prefixado por matéria; materia_slug é redundância derivável
);

CREATE INDEX idx_taxonomia_nodes_materia ON taxonomia_nodes (materia_slug, nivel, ordem);
CREATE INDEX idx_taxonomia_nodes_parent ON taxonomia_nodes (parent_id);
```

### `questao_topico` (junction)

```sql
CREATE TABLE questao_topico (
  questao_id      BIGINT NOT NULL REFERENCES questoes(id) ON DELETE CASCADE,
  node_id         UUID NOT NULL REFERENCES taxonomia_nodes(stable_id) ON DELETE RESTRICT,
  score           REAL,                            -- confiança 0..1, NULL pra atribuição manual
  current_source  TEXT NOT NULL,                   -- 'gran_pipeline:regen_2026_04', 'admin:user_42', 'matching:edital_81', ...
  PRIMARY KEY (questao_id, node_id)
);

CREATE INDEX idx_questao_topico_node ON questao_topico (node_id, questao_id);  -- filtro por nó
CREATE INDEX idx_questao_topico_questao ON questao_topico (questao_id);         -- expansão por questão
```

### `taxonomia_counts` (tabela companheira mantida pelo import)

Contagens persistidas — usadas pelo endpoint `GET /v1/taxonomia/{materia_slug}` em `count_propria` e `count_agregada`. Tabela ao invés de view materializada porque refresh seletivo por matéria escala melhor (107 matérias futuras × ~100k questões cada inviabilizam REFRESH global a cada import).

```sql
CREATE TABLE taxonomia_counts (
  node_id         UUID PRIMARY KEY REFERENCES taxonomia_nodes(stable_id) ON DELETE CASCADE,
  materia_slug    TEXT NOT NULL,                   -- denormalizado pra refresh por matéria
  count_propria   INT NOT NULL DEFAULT 0,
  count_agregada  INT NOT NULL DEFAULT 0,
  refreshed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_taxonomia_counts_materia ON taxonomia_counts (materia_slug);
```

**Refresh policy:**
- Após cada `import_to_postgres.py` apply, dentro da mesma transação: UPSERT escopado **apenas pros nós da matéria importada** via recursive CTE local. Custo é O(nós da matéria) — segundos, não minutos. Detalhe abaixo.
- Job batch noturno (cron) refresca todas as matérias em paralelo, uma por uma. Cobre escritas via curadoria manual ou matching de edital quando entrarem.
- Drift é monitorado por job separado: query ad-hoc compara `taxonomia_counts.count_*` com um cálculo recursivo recomputado on-the-fly por matéria (job mais leve, roda 1×/dia). Alerta se diferença média por matéria > 1%.

**Refresh seletivo (snippet de referência, dentro do import):**

```sql
WITH RECURSIVE descendants AS (
  SELECT stable_id AS root_id, stable_id AS desc_id
  FROM taxonomia_nodes WHERE materia_slug = :materia
  UNION ALL
  SELECT d.root_id, n.stable_id
  FROM descendants d JOIN taxonomia_nodes n ON n.parent_id = d.desc_id
),
agregado AS (
  SELECT d.root_id AS node_id, COUNT(DISTINCT qt.questao_id) AS c
  FROM descendants d LEFT JOIN questao_topico qt ON qt.node_id = d.desc_id
  GROUP BY d.root_id
),
propria AS (
  SELECT n.stable_id AS node_id, COUNT(qt.questao_id) AS c
  FROM taxonomia_nodes n LEFT JOIN questao_topico qt ON qt.node_id = n.stable_id
  WHERE n.materia_slug = :materia
  GROUP BY n.stable_id
)
INSERT INTO taxonomia_counts (node_id, materia_slug, count_propria, count_agregada, refreshed_at)
SELECT n.stable_id, n.materia_slug, p.c, a.c, NOW()
FROM taxonomia_nodes n
JOIN propria p ON p.node_id = n.stable_id
JOIN agregado a ON a.node_id = n.stable_id
WHERE n.materia_slug = :materia
ON CONFLICT (node_id) DO UPDATE SET
  count_propria = EXCLUDED.count_propria,
  count_agregada = EXCLUDED.count_agregada,
  refreshed_at = EXCLUDED.refreshed_at;
```

Nesta leva, escrita em `questao_topico` só vem do import; drift esperado = zero.

### `questao_topico_log` (cold, imutável)

```sql
CREATE TABLE questao_topico_log (
  id              BIGSERIAL PRIMARY KEY,
  questao_id      BIGINT NOT NULL,
  node_id         UUID,                            -- pode ser NULL em DELETE
  prev_node_id    UUID,                            -- preenchido em reassignments
  action          TEXT NOT NULL CHECK (action IN ('assigned', 'reassigned', 'removed')),
  source          TEXT NOT NULL,
  score           REAL,
  reason          TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qtl_questao ON questao_topico_log (questao_id, created_at DESC);
CREATE INDEX idx_qtl_source ON questao_topico_log (source, created_at DESC);
```

### Trigger de audit

Garante que toda mudança em `questao_topico` seja logada — mesmo se o app esquecer.

```sql
CREATE OR REPLACE FUNCTION questao_topico_audit() RETURNS TRIGGER AS $$
DECLARE
  -- current_setting com missing_ok=TRUE retorna '' (não NULL) em algumas versões do Postgres.
  -- NULLIF converte string vazia em NULL pra COALESCE funcionar como esperado.
  v_source TEXT := COALESCE(NULLIF(current_setting('app.source', TRUE), ''), 'unknown');
  v_reason TEXT := NULLIF(current_setting('app.reason', TRUE), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO questao_topico_log (questao_id, node_id, action, source, score, reason)
    VALUES (NEW.questao_id, NEW.node_id, 'assigned', v_source, NEW.score, v_reason);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO questao_topico_log (questao_id, node_id, prev_node_id, action, source, score, reason)
    VALUES (NEW.questao_id, NEW.node_id, OLD.node_id, 'reassigned', v_source, NEW.score, v_reason);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO questao_topico_log (questao_id, prev_node_id, action, source, reason)
    VALUES (OLD.questao_id, OLD.node_id, 'removed', v_source, v_reason);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER questao_topico_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON questao_topico
FOR EACH ROW EXECUTE FUNCTION questao_topico_audit();
```

App, antes de qualquer write, faz:
```python
db.execute("SET LOCAL app.source = 'admin:user_42'")
db.execute("SET LOCAL app.reason = 'questão é sobre concorrência específica, não princípio geral'")
db.execute("UPDATE questao_topico SET node_id = :y WHERE questao_id = :q AND node_id = :x", ...)
```

## API (verus_api, FastAPI REST)

Quatro endpoints novos em `app/api/v1/routes/taxonomia.py` + extensão de `questoes.py`.

### `GET /v1/taxonomia/materias`

Lista de matérias com flag pra UI escolher TreePicker vs FlatList.

```json
[
  {
    "slug": "dir-adm",
    "nome": "Direito Administrativo",
    "has_taxonomia": true,
    "total_nodes": 499,
    "total_questoes_classificadas": 137627,
    "cobertura_pct": 99.97,
    "updated_at": "2026-04-25T12:00:00Z"
  },
  {
    "slug": "dir-const",
    "nome": "Direito Constitucional",
    "has_taxonomia": false,
    "total_nodes": 0,
    "total_questoes_classificadas": 0,
    "cobertura_pct": 0,
    "updated_at": null
  }
]
```

Cache: `Cache-Control: public, max-age=300, stale-while-revalidate=86400`. ETag.

### `GET /v1/taxonomia/{materia_slug}`

Árvore inteira de uma matéria, nested. Cliente carrega uma vez e faz tudo offline.

```json
{
  "materia_slug": "dir-adm",
  "version_id": "uuid-da-versao-ativa",
  "applied_at": "2026-04-25T12:00:00Z",
  "tree": [
    {
      "stable_id": "uuid-...",
      "slug": "dir-adm.licitacoes",
      "titulo": "Licitações",
      "nivel": 1,
      "parent_id": null,
      "count_propria": 12,         // vindo de taxonomia_counts (refrescada no import)
      "count_agregada": 4460,      // vindo de taxonomia_counts (refrescada no import)
      "aliases": ["lei 8666", "lei 14133", "modalidades"],
      "absorbed": [],
      "subtopicos_visuais": [
        {"titulo": "Pregão", "n_questoes": 380, "nivel_original": 4},
        {"titulo": "Leilão", "n_questoes": 142, "nivel_original": 4}
      ],
      "path": ["Direito Administrativo", "Licitações"],   // derivado em runtime via recursive CTE
      "keywords": ["licitacoes", "lei 8666", "lei 14133", "modalidades"],
      "children": [
        { "stable_id": "...", "slug": "dir-adm.licitacoes.principios", ... }
      ]
    }
  ]
}
```

`keywords` = título normalizado (lowercase, sem acentos) + aliases. Cliente passa direto pro fuse.js sem recalcular.

`path` é montado em runtime no servidor via recursive CTE — **não é coluna persistida** — pra evitar drift quando ancestrais são renomeados. Custo é barato (depth ≤ 3, total ≤ 500 nós por matéria).

`version_id` é o UUID da versão ativa, derivado em runtime: `SELECT id FROM taxonomia_versions WHERE materia_slug = :m ORDER BY applied_at DESC LIMIT 1` (cacheado em Redis 5min — versão muda raramente). Vira o ETag (`ETag: "uuid-da-versao-ativa"`).

Cache: ETag forte com `version_id`. `Cache-Control: public, max-age=86400, must-revalidate`. Tamanho típico ~80KB gzipped por matéria.

### `GET /v1/taxonomia/{materia_slug}/counts`

Contadores dinâmicos sob filtros ativos. **GET com querystring** (não POST) — filtros são idempotentes, payload sempre cabe (~200 chars típicos), e GET permite cache de browser/CDN além do Redis server-side.

**Request:**
```
GET /v1/taxonomia/dir-adm/counts?banca=CESPE&ano=2024&tipo=multipla&excluir_anuladas=1
```

**Response (mapa flat):**
```json
{
  "uuid-licitacoes": 220,
  "uuid-licitacoes-principios": 47,
  "uuid-licitacoes-modalidades": 173,
  ...
}
```

Implementação: `SELECT node_id, COUNT(*) FROM questao_topico qt JOIN questoes q ON q.id = qt.questao_id WHERE q.materia = :m AND q.banca = ANY(:b) AND ... GROUP BY node_id`. Cache server-side: Redis, key = `counts:{materia}:{hash_canonico(filtros)}`, TTL 300s. Cache de browser via `Cache-Control: private, max-age=300`.

Fallback se a querystring crescer >2KB (cenário improvável, ex: dezenas de bancas selecionadas): cliente troca pra `POST /v1/taxonomia/{materia_slug}/counts` com mesmo payload em JSON. Server aceita ambos. **Default sempre GET.**

Apenas chamado quando há ≥1 filtro além de `materia` (sem outros filtros, `count_agregada` da árvore = dinâmico).

### `GET /v1/questoes/search` (extensão do existente)

Novo param `topico=` aceita **lista repetida** de slugs (`?topico=dir-adm.licitacoes&topico=dir-const.direitos-fundamentais`), seguindo o padrão dos outros pills.

**Semântica multi-matéria + multi-tópico:**
```sql
WHERE materia IN (:materias)
  AND (
    (materia = 'dir-adm'   AND topico_em [...selecionados pra dir-adm...])
    OR (materia = 'dir-const' AND topico_em [...selecionados pra dir-const...])
    OR (materia = 'dir-civ'   AND TRUE)  -- sem tópicos selecionados → libera tudo
  )
  AND anulada = FALSE AND desatualizada = FALSE  -- I-29 do audit de matching
```

Server resolve cada slug → `stable_id` → expande pros descendentes (pra atender semântica "nó pai inclui filhos") → JOIN com `questao_topico`.

Cada questão na resposta ganha:
```json
{
  "id": 4521,
  "enunciado": "...",
  "alternativas": [...],
  "topico_atribuido": {
    "stable_id": "uuid-...",
    "slug": "dir-adm.licitacoes.principios.legalidade",
    "path": ["Direito Adm", "Licitações", "Princípios", "Legalidade"],
    "score": 0.78
  }
}
```

Permite ao aluno entender onde a questão está classificada e abrir report já com contexto.

## UI (Metav2)

### Onde

Toda a mudança visível ao aluno acontece dentro do popover existente da pill **"Assuntos"** (`src/components/questoes/QuestoesAdvancedPopover.tsx` ou `QuestoesFilterPopover.tsx`). A pill bar em si **não muda**.

Componente novo: `src/components/questoes/TaxonomiaTreePicker.tsx`. Componente atual de assunto flat (`AssuntoFlatList`) é mantido. Switch é feito por código.

**Integração com a arquitetura existente:**
- Estado de filtros vive em `src/contexts/QuestoesContext.tsx` (`QuestoesFilters` + draft/committed pattern).
- Adicionar campo novo: `topicos: string[]` (array de slugs globais como `dir-adm.licitacoes.principios`) ao lado de `assuntos`. Persiste no querystring via `filtersToSearchParams` extendido (`params.append('topico', slug)`).
- Counter `countActiveFilters` soma `filters.topicos.length`.
- TreePicker lê/escreve via `useQuestoesContext()` — mesmo padrão dos outros pickers já existentes.

```tsx
const { filters, setFilter } = useQuestoesContext();
const { data: materias } = useMaterias();
// materiaAtivaPicker = matéria selecionada no dropdown interno do picker
// (default: primeira matéria com taxonomia entre as filtradas; se nenhuma tem,
// renderiza FlatList da primeira matéria filtrada)
const materiaAtivaPicker = pickActiveMateria(filters.materias, materias);

return materias.find(m => m.slug === materiaAtivaPicker)?.has_taxonomia
  ? <TaxonomiaTreePicker materia={materiaAtivaPicker} />
  : <AssuntoFlatList materia={materiaAtivaPicker} />;
```

### Multi-matéria dentro do picker

Quando aluno tem múltiplas matérias selecionadas:
1. Topo do picker: dropdown "Pra qual matéria?" (se ≥2 matérias selecionadas).
2. Tree carrega da matéria escolhida no dropdown.
3. Aluno marca tópicos → chips aparecem na pill bar.
4. Switch matéria no dropdown → tree muda, **chips das outras matérias permanecem visíveis** (não somem).
5. Fecha popover → todos os chips de todas as matérias seguem na pill bar.

Estado do picker é por-matéria; estado dos chips é global.

### Layout do TreePicker

```
┌────────────────────────────────────────────┐
│ Direito Administrativo ▾   137.627 q       │  ← dropdown matéria + total
├────────────────────────────────────────────┤
│ 🔍 Buscar tópico ou alias…                 │  ← search client-side (fuse.js)
├────────────────────────────────────────────┤
│ ⏱ Recentes                                 │  ← localStorage, max 5 LRU
│   • Licitações > Princípios                │
│   • Atos administrativos                   │
├────────────────────────────────────────────┤
│ ▶ 1. Atos administrativos    8.4k          │  ← L1 colapsado
│ ▼ 2. Princípios da Adm.     11.2k          │  ← L1 expandido
│   ▶ 2.1 Legalidade            780          │  ← L2 colapsado
│   ▼ 2.2 Impessoalidade        920          │  ← L2 expandido
│       ☑ 2.2.1 Vedação a nepotismo  240    │  ← L3 marcado
│       ☐ 2.2.2 Concursos públicos   380    │
│         cobre: investidura, posse,         │  ← subtopicos_visuais (cinza)
│                vacância, exoneração        │
│   ▶ 2.3 Moralidade            340          │
│ ▶ 3. Licitações              4460          │
└────────────────────────────────────────────┘
```

**Detalhes:**
- Checkboxes em cada nível (multi-select OR).
- Contador à direita = `count_agregada` (estático) por padrão; **vira `count_dinamico` em destaque quando há filtros ativos** (banca, ano, etc.). Loading state: estático em cinza claro + spinner discreto, fade transition pro dinâmico (~150ms).
- **Semântica de marcação:** marcar L1 inclui todos os descendentes no filtro automaticamente (semântica do server, ver API). Visualmente, os descendentes mostram estado "herdado" (checkbox em meio-tom) sem precisar serem clicados individualmente. Aluno pode desmarcar um descendente específico — isso adiciona um chip "exceto X" (UX equivalente ao "não filtrar por este filho"). MVP: omitir o "exceto" e só permitir marcação positiva; descendentes herdados aparecem em meio-tom apenas como feedback.
- `subtopicos_visuais` aparece como texto cinza pequeno abaixo de L3 expandido — **não precisa expandir mais nada**, é informação free.
- Hover em qualquer nó → tooltip com `path` completo.
- Hover em chip selecionado → mesmo tooltip.

### Recentes

Persistência **client-only** em `localStorage`, key `taxonomia.recentes.{materia_slug}`, valor = lista de até 5 `stable_id`s em ordem LRU. Atualizado quando aluno marca um nó. Hook dedicado: `useTopicosRecentes(materia_slug)`. Sem persistência server-side nesta leva (decisão pode ser revisitada se vier sync multi-device).

### Search (client-side com fuse.js)

```ts
const fuse = new Fuse(allNodes, {
  keys: ['titulo', 'keywords', 'aliases'],  // keywords vem pronto do backend
  threshold: 0.3,
  includeScore: true
});
```

Resultado da busca **destaca o ramo da árvore** (auto-expande os pais dos matches; matches em destaque amber) ao invés de virar lista flat. Mantém a noção de hierarquia.

### Pre-fetch de counts

```ts
useEffect(() => {
  const filtrosExtra = filtrosSemMateria(filters);
  if (Object.keys(filtrosExtra).length > 0) {
    queryClient.prefetchQuery({
      queryKey: ['taxonomia-counts', materiaAtivaPicker, filtrosExtra],
      queryFn: () => fetchCounts(materiaAtivaPicker, filtrosExtra),  // GET com querystring
      staleTime: 5 * 60 * 1000,
    });
  }
}, [filters]);
```

Quando aluno muda banca/ano/etc., counts pra matéria ativa são pre-fetchados antes dele abrir o picker. Aluno raramente vê loading.

### URL deep linking

Param adicional na URL, **lista repetida** (não CSV) seguindo o padrão dos outros pills (`?banca=A&banca=B`):

```
?topico=dir-adm.licitacoes.principios&topico=dir-const.direitos-fundamentais
```

`URLSearchParams.append('topico', slug)` no front, `getAll('topico')` na hidratação. Slug global com prefixo já carrega a matéria implícita; pill bar pode reconstruir o estado completo a partir do querystring.

### Mobile

- TreePicker dentro do `MobileSheet` (compartilhado, já existe).
- Search bar sticky no topo, dropdown matéria abaixo, árvore scroll vertical.
- Drill-down opcional pra reduzir scroll: tap em L1 expande inline (não navega), igual desktop.
- Chips na pill bar continuam scrolláveis horizontalmente.

### Acessibilidade

- Tab: foca o search bar; Tab de novo: entra na árvore.
- ↑↓: navega nós visíveis.
- →: expande / entra no filho. ←: colapsa / volta ao pai.
- Espaço: marca/desmarca checkbox.
- Enter no resultado de busca: vai pro nó na árvore.
- ARIA: `role="tree"`, `aria-expanded`, `aria-checked`, `aria-level`, `aria-setsize`.

## Import + regeneração

Script novo: `D:\tec-output\taxonomia\scripts\import_to_postgres.py` (no repo do pipeline, não no Metav2/verus_api).

### Identidade estável

`stable_id` UUID por nó, gerado no primeiro import. Toda regeneração faz tree-matching estrutural pra reconciliar:
1. **Match por slug + parent_path:** mesmo slug e mesmo path → mesmo nó (id interno mudou, ignora).
2. **Match por similaridade:** slug diferente + mesmo parent + título com similaridade ≥ 0.85 (ratio Levenshtein ou rapidfuzz) → rename detectado.
3. **Sem match no novo JSON:** nó foi deletado/mesclado.
4. **Sem match no DB existente:** nó é novo.

### Operações do diff

```python
diff.operations = [
    AddNode(slug, titulo, parent_stable_id, ...),
    RenameNode(stable_id, new_slug, new_titulo),
    MoveNode(stable_id, new_parent_stable_id),
    MergeNode(source_stable_id, target_stable_id),  # questao_topico move pro target
    DeleteNode(stable_id, reassign_to=parent_stable_id),
]
```

`DeleteNode` com `reassign_to` é obrigatório se o nó tem questões classificadas — caso contrário a operação falha na validação.

### Fluxo

```bash
python scripts/import_to_postgres.py --materia dir-adm \
  --json D:/tec-output/taxonomia/merged/taxonomia-direito-administrativo.json \
  --dry-run
```

Saída esperada:

```
DIFF SUMMARY (dir-adm, currently @ 2026-04-25 → new JSON dated 2026-06-15):
  + 12 nodes added
  ~ 8 nodes renamed
  → 3 nodes moved (parent changed)
  ⊕ 5 nodes merged
  - 2 nodes deleted (reassigned to parent)
  ↻ 247 questoes will be reassigned

Sanity checks:
  cobertura ≥ 95%               ✓ (99.94%)
  slugs únicos                   ✓
  sem órfãos estruturais         ✓
  L1 com count_agregada > 0      ✓
  nenhum titulo/alias contém "gran" (ci)  ✓

Apply? [y/N]
```

Após `y`, transação única:
```python
with db.transaction():
    db.execute(f"SET LOCAL app.source = 'gran_pipeline:regen_{ts}'")
    for op in diff.operations:
        apply_operation(op)
    # Trigger captura tudo em questao_topico_log
```

### Sanity checks (bloqueiam apply)

1. **Cobertura mínima 95%** — se queda ≥ 5% em relação à versão anterior, fail.
2. **Slugs únicos** dentro de `materia_slug`.
3. **Sem órfãos estruturais** — todo `parent_id` resolve.
4. **L1 com `count_agregada > 0`** — L2/L3 podem estar vazios; L1 não.
5. **Sem "gran" em `titulo` ou `aliases`** — regex case-insensitive. Hard fail (invariante 1).

## Performance

- Tree fetch: 1 GET por sessão por matéria → ~80KB gzipped, ETag, ~50ms.
- Search no picker: client-side, instantâneo (5k strings em fuse.js).
- Counts dinâmicos: ~150-200ms server-side com índice composto, cacheado em Redis 5min.
- Filter de questões: índice `(node_id, questao_id)` já cobre o JOIN. Plano esperado: index scan em `questao_topico` pra cada `node_id` no WHERE, hash join com `questoes`.
- Postgres do Hetzner aguenta com folga (já é onde rodam as 137k consultas existentes).

## Testes

- **Backend:** integração contra o Postgres do Hetzner (não mock — `feedback_preferences.md` "testar com dados reais"). Fixtures: 1 matéria sintética com 5 nós, 50 questões.
- **Import script:** dry-run snapshot test — capturar saída do diff entre 2 JSONs reais (versão 1 e versão 2 sintéticas), comparar com expected.
- **Trigger:** test que insere/update/delete em `questao_topico` com `app.source` setado e confere que `questao_topico_log` recebe a linha correta.
- **Frontend:** smoke test do TreePicker com a árvore real de Direito Adm; validar search por alias ("PAD" → encontra "Processo Administrativo Disciplinar").
- **End-to-end:** aluno seleciona Direito Adm + nó "Licitações > Princípios > Legalidade" + banca CESPE 2024 → recebe questões corretas + counter dinâmico bate com count(*) manual.

## Migração / rollout

1. Criar tabelas (`taxonomia_versions`, `taxonomia_nodes`, `taxonomia_counts`, `questao_topico`, `questao_topico_log`) + trigger no Postgres (migration via Alembic em `verus_api/alembic/versions/`, padrão já em uso no repo).
2. Rodar import inicial de Direito Adm (não tem `stable_id` prévio, todos os nós são `AddNode`). UPSERT seletivo em `taxonomia_counts` acontece dentro da mesma transação do apply.
3. Subir endpoints novos em ambiente de dev.
4. Subir TreePicker atrás de feature flag `taxonomia_picker_enabled` (default `false`).
5. Smoke test interno.
6. Habilitar para Aldemir + 1-2 testers.
7. Rollout geral.

## Riscos & mitigações

| Risco | Mitigação |
|-------|-----------|
| Counts dinâmicos lentos sob alta carga | Redis cache + pre-fetch + índice composto. Se ainda lento, materializar view por matéria. |
| Aluno seleciona muitos tópicos → URL gigante | URL aceita slugs CSV; ~50 chars por slug × 10 tópicos = ~500 chars, longe do limite. Se passar de 30 tópicos selecionados, app oferece "Limpar todos". |
| Diff tool atribui rename errado (similaridade ≥ 0.85 falsa positiva) | Dry-run obrigatório com diff legível; admin revê antes de aplicar. |
| Nó deletado tem questões e admin esquece de prover `reassign_to` | Sanity check bloqueia apply, mostra lista de questões afetadas. |
| Pipeline regen produz cobertura abaixo de 95% silenciosamente | Sanity check bloqueia apply. |
| App esquece de setar `app.source` antes de write | Trigger loga com `source = 'unknown'`. Audit grátis de "writes sem origem clara" via `WHERE source = 'unknown'`. |
| `taxonomia_counts` divergem silenciosamente conforme escritas vão acontecendo fora do import (curadoria, matching) | Job diário recomputa via recursive CTE por matéria, compara com `taxonomia_counts` persistida; alerta se drift médio > 1%. Refresh seletivo no fim de cada import + cron noturno completo. |
| `path` recalculado por CTE pesa em árvores grandes | Limitar à profundidade declarada (≤ 3 nesta leva). Se virar gargalo no futuro, materializar `path` numa coluna gerada quando rename for raro. |

## Critérios de "pronto"

- [ ] Tabelas (`taxonomia_versions`, `taxonomia_nodes`, `taxonomia_counts`, `questao_topico`, `questao_topico_log`) + trigger criadas no Hetzner via Alembic. Trigger usa `NULLIF(current_setting(...), '')` pra tratar string vazia como NULL.
- [ ] Import de Direito Adm rodado: 1 linha em `taxonomia_versions`, 499 nós em `taxonomia_nodes` (com `created_in_version_id` apontando pra a versão), 499 linhas em `taxonomia_counts`, 137k+ linhas em `questao_topico`.
- [ ] 4 endpoints novos no verus_api respondem com payload correto, `path` derivado em runtime via recursive CTE, `version_id` resolvido por query em `taxonomia_versions` (cacheado em Redis 5min) no payload e no ETag.
- [ ] TreePicker renderiza árvore + search por alias funciona + counts vindos de `taxonomia_counts` consistentes com `COUNT(*)` ad-hoc no momento pós-import (drift = 0).
- [ ] Counts dinâmicos: aluno com banca=CESPE vê números corretos (validado manualmente em 3 nós), endpoint via GET com querystring, browser cache hit em refresh.
- [ ] Filtro de questões com `?topico=...&topico=...` (lista repetida) retorna o conjunto certo (validado contra SQL manual), com per-matéria scoping respeitado.
- [ ] Trigger registra todo write em `questao_topico_log` com source `gran_pipeline:regen_YYYY_MM`.
- [ ] Dry-run do import imprime diff legível e bloqueia apply em sanity check failure.
- [ ] Nenhum lugar visível ao aluno menciona "GRAN" (regex case-insensitive em `titulo` e `aliases` no import + grep no payload da API durante teste).
- [ ] Recentes persistem em `localStorage` por matéria, max 5 LRU.
- [ ] `topicos: string[]` integrado em `QuestoesContext`, contado em `countActiveFilters`, persistido na URL via `filtersToSearchParams`.
- [ ] Cobertura de testes: import script (diff snapshot test), trigger (insert/update/delete em `questao_topico` com `app.source` setado), endpoint de counts (GET com filtros), recursive CTE de path (3 níveis).
