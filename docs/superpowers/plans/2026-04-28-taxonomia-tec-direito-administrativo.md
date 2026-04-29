# Taxonomia TEC — Direito Administrativo (Leva 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filtro hierárquico de tópicos pra Direito Administrativo no app, baseado na árvore oficial do TEC, com sync automática via trigger Postgres e bucket "Outros" pras 3% órfãs.

**Architecture:** 4 camadas — Postgres (single source of truth) ↔ FastAPI ↔ React. Pipeline de import lê 3 JSONs (federal/estadual/municipal), faz diff vs DB, aplica em transação. Trigger BEFORE INSERT/UPDATE em `questoes` resolve `assunto → taxonomia_node_id` automaticamente.

**Tech Stack:** PostgreSQL 15 (recursive CTE, pl/pgsql trigger) + SQLAlchemy 2.0 + FastAPI + slowapi + Redis + Alembic; Next.js 15 + React 19 + TanStack Query + fuse.js + shadcn/ui

**Spec:** `docs/superpowers/specs/2026-04-28-taxonomia-tec-direito-administrativo-design.md`

**Repos:**
- Backend: `C:/Users/Home/Desktop/verus_api/`
- Frontend: `D:/meta novo/Metav2/`

**Branch única em ambos:** `feat/taxonomia-tec-dir-adm`

---

## Phase 0 — Setup

### Task 1: Criar branch + copiar JSONs capturados

**Files:**
- Create: `C:/Users/Home/Desktop/verus_api/data/taxonomia/direito-administrativo/federal.json`
- Create: `C:/Users/Home/Desktop/verus_api/data/taxonomia/direito-administrativo/estadual.json`
- Create: `C:/Users/Home/Desktop/verus_api/data/taxonomia/direito-administrativo/municipal.json`

- [ ] **Step 1: Criar branch `feat/taxonomia-tec-dir-adm` no verus_api**

```bash
cd C:/Users/Home/Desktop/verus_api
git checkout main
git pull
git checkout -b feat/taxonomia-tec-dir-adm
```

- [ ] **Step 2: Criar branch `feat/taxonomia-tec-dir-adm` no Metav2**

```bash
cd "D:/meta novo/Metav2"
git checkout main
git pull
git checkout -b feat/taxonomia-tec-dir-adm
```

- [ ] **Step 3: Criar diretório de dados**

```bash
mkdir -p "C:/Users/Home/Desktop/verus_api/data/taxonomia/direito-administrativo"
```

- [ ] **Step 4: Copiar os 3 JSONs**

```bash
cp "C:/Users/Home/3D Objects/tec-tree-dir-adm.json" \
   "C:/Users/Home/Desktop/verus_api/data/taxonomia/direito-administrativo/federal.json"

cp "C:/Users/Home/3D Objects/tec-tree-dir-adm-estadual.json" \
   "C:/Users/Home/Desktop/verus_api/data/taxonomia/direito-administrativo/estadual.json"

cp "C:/Users/Home/3D Objects/tec-tree-dir-adm-municipal.json" \
   "C:/Users/Home/Desktop/verus_api/data/taxonomia/direito-administrativo/municipal.json"
```

- [ ] **Step 5: Validar tamanhos**

Run:
```bash
ls -la "C:/Users/Home/Desktop/verus_api/data/taxonomia/direito-administrativo/"
```

Expected:
- `federal.json` ~8 KB
- `estadual.json` ~250-300 KB (558 nós)
- `municipal.json` ~5 KB

- [ ] **Step 6: Commit**

```bash
cd C:/Users/Home/Desktop/verus_api
git add data/taxonomia/direito-administrativo/
git commit -m "chore(taxonomia): JSONs TEC capturados (federal+estadual+municipal)"
```

---

## Phase 1 — DB Schema

### Task 2: Migration Alembic com schema completo

**Files:**
- Create: `C:/Users/Home/Desktop/verus_api/alembic/versions/20260428_0001_taxonomia_tec.py`

- [ ] **Step 1: Gerar arquivo de migration**

```bash
cd C:/Users/Home/Desktop/verus_api
alembic revision -m "taxonomia_tec_v1"
```

Renomeia o arquivo gerado pra `20260428_0001_taxonomia_tec.py`.

- [ ] **Step 2: Escrever upgrade()**

```python
"""taxonomia_tec_v1

Cria:
- Tabela taxonomia_nodes (com is_sintetico flag)
- Coluna questoes.taxonomia_node_id (FK ON DELETE SET NULL)
- Function resolve_taxonomia_node()
- Trigger trg_resolve_taxonomia BEFORE INSERT/UPDATE OF assunto, materia
- Indices necessarios

Revision ID: 20260428_0001
Revises: <previous>
Create Date: 2026-04-28
"""
from alembic import op
import sqlalchemy as sa

revision = '20260428_0001'
down_revision = '<PREVIOUS_REV>'  # <-- substituir pelo head atual
branch_labels = None
depends_on = None


def upgrade():
    # 1. Tabela taxonomia_nodes
    op.create_table(
        'taxonomia_nodes',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('id_externo', sa.Integer, unique=True, nullable=True),
        sa.Column('materia', sa.String(100), nullable=False),
        sa.Column('materia_slug', sa.String(50), nullable=False),
        sa.Column('fonte', sa.String(20), nullable=False),
        sa.Column('nome', sa.String(300), nullable=False),
        sa.Column('hierarquia', sa.String(20), nullable=True),
        sa.Column('nivel', sa.SmallInteger, nullable=False),
        sa.Column('parent_id', sa.Integer,
                  sa.ForeignKey('taxonomia_nodes.id', ondelete='RESTRICT'),
                  nullable=True),
        sa.Column('ordem', sa.SmallInteger, nullable=False, server_default='0'),
        sa.Column('is_sintetico', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True),
                  nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True),
                  nullable=False, server_default=sa.func.now()),
    )

    op.create_index('idx_tax_nodes_materia_slug',
                    'taxonomia_nodes', ['materia_slug'])
    op.create_index('idx_tax_nodes_materia_fonte',
                    'taxonomia_nodes', ['materia', 'fonte'])
    op.create_index('idx_tax_nodes_parent', 'taxonomia_nodes', ['parent_id'])
    op.create_index('idx_tax_nodes_nome', 'taxonomia_nodes', ['nome'])

    # 2. Coluna em questoes
    op.add_column('questoes',
                  sa.Column('taxonomia_node_id', sa.Integer,
                            sa.ForeignKey('taxonomia_nodes.id',
                                          ondelete='SET NULL'),
                            nullable=True))
    op.create_index('idx_questoes_tax_node',
                    'questoes', ['taxonomia_node_id'])

    # 3. Trigger function
    op.execute("""
        CREATE OR REPLACE FUNCTION resolve_taxonomia_node()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.assunto IS NULL OR NEW.assunto = '' THEN
                NEW.taxonomia_node_id := NULL;
            ELSE
                SELECT id INTO NEW.taxonomia_node_id
                FROM taxonomia_nodes
                WHERE nome = NEW.assunto
                  AND materia = NEW.materia
                  AND is_sintetico = FALSE
                LIMIT 1;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # 4. Trigger
    op.execute("""
        CREATE TRIGGER trg_resolve_taxonomia
            BEFORE INSERT OR UPDATE OF assunto, materia ON questoes
            FOR EACH ROW EXECUTE FUNCTION resolve_taxonomia_node();
    """)


def downgrade():
    op.execute("DROP TRIGGER IF EXISTS trg_resolve_taxonomia ON questoes;")
    op.execute("DROP FUNCTION IF EXISTS resolve_taxonomia_node();")
    op.drop_index('idx_questoes_tax_node', table_name='questoes')
    op.drop_column('questoes', 'taxonomia_node_id')
    op.drop_index('idx_tax_nodes_nome', table_name='taxonomia_nodes')
    op.drop_index('idx_tax_nodes_parent', table_name='taxonomia_nodes')
    op.drop_index('idx_tax_nodes_materia_fonte', table_name='taxonomia_nodes')
    op.drop_index('idx_tax_nodes_materia_slug', table_name='taxonomia_nodes')
    op.drop_table('taxonomia_nodes')
```

- [ ] **Step 3: Substituir `<PREVIOUS_REV>` pelo head atual**

Run:
```bash
cd C:/Users/Home/Desktop/verus_api
alembic heads
```

Pega o ID do revision retornado e cola em `down_revision`.

- [ ] **Step 4: Validar sintaxe (sem aplicar)**

Run:
```bash
alembic upgrade head --sql > /tmp/taxonomia_dryrun.sql
head -50 /tmp/taxonomia_dryrun.sql
```

Expected: SQL gerado começa com `CREATE TABLE taxonomia_nodes`.

- [ ] **Step 5: Commit**

```bash
git add alembic/versions/20260428_0001_taxonomia_tec.py
git commit -m "feat(taxonomia): migration v1 — tabela + trigger + coluna em questoes"
```

---

### Task 3: SQLAlchemy model

**Files:**
- Create: `C:/Users/Home/Desktop/verus_api/app/models/taxonomia.py`
- Modify: `C:/Users/Home/Desktop/verus_api/app/models/questao.py` — adicionar relação opcional

- [ ] **Step 1: Escrever teste do model**

Create `C:/Users/Home/Desktop/verus_api/tests/taxonomia/test_model.py`:
```python
import pytest
from app.models.taxonomia import TaxonomiaNode

def test_taxonomia_node_columns_present():
    cols = {c.name for c in TaxonomiaNode.__table__.columns}
    assert cols == {
        'id', 'id_externo', 'materia', 'materia_slug', 'fonte',
        'nome', 'hierarquia', 'nivel', 'parent_id', 'ordem',
        'is_sintetico', 'created_at', 'updated_at'
    }

def test_taxonomia_node_repr():
    n = TaxonomiaNode(id=1, nome='Atos Administrativos', hierarquia='03')
    assert 'Atos Administrativos' in repr(n)
    assert '03' in repr(n)
```

- [ ] **Step 2: Rodar teste — falha**

```bash
pytest tests/taxonomia/test_model.py -v
```
Expected: FAIL com `ImportError: cannot import name 'TaxonomiaNode'`.

- [ ] **Step 3: Implementar model**

Create `app/models/taxonomia.py`:
```python
from sqlalchemy import (
    Column, Integer, SmallInteger, String, Boolean,
    ForeignKey, TIMESTAMP, func
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class TaxonomiaNode(Base):
    __tablename__ = 'taxonomia_nodes'

    id = Column(Integer, primary_key=True)
    id_externo = Column(Integer, unique=True, nullable=True)
    materia = Column(String(100), nullable=False)
    materia_slug = Column(String(50), nullable=False)
    fonte = Column(String(20), nullable=False)
    nome = Column(String(300), nullable=False)
    hierarquia = Column(String(20), nullable=True)
    nivel = Column(SmallInteger, nullable=False)
    parent_id = Column(Integer, ForeignKey('taxonomia_nodes.id', ondelete='RESTRICT'), nullable=True)
    ordem = Column(SmallInteger, nullable=False, default=0)
    is_sintetico = Column(Boolean, nullable=False, default=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

    children = relationship(
        'TaxonomiaNode',
        backref='parent',
        remote_side='TaxonomiaNode.id',
        cascade='all',
    )

    def __repr__(self):
        h = self.hierarquia or '<sint>'
        return f'<TaxonomiaNode id={self.id} h={h} nome={self.nome[:40]!r}>'
```

- [ ] **Step 4: Adicionar coluna em `questao.py`**

Modify `app/models/questao.py`, adicionar no fim das colunas:
```python
    taxonomia_node_id = Column(
        Integer,
        ForeignKey('taxonomia_nodes.id', ondelete='SET NULL'),
        nullable=True,
        index=True,
    )
```

- [ ] **Step 5: Rodar teste — passa**

```bash
pytest tests/taxonomia/test_model.py -v
```
Expected: 2 PASS.

- [ ] **Step 6: Commit**

```bash
git add app/models/taxonomia.py app/models/questao.py tests/taxonomia/test_model.py
git commit -m "feat(taxonomia): SQLAlchemy model + coluna em questao.py"
```

---

### Task 4: Pydantic schemas

**Files:**
- Create: `C:/Users/Home/Desktop/verus_api/app/schemas/taxonomia.py`

- [ ] **Step 1: Escrever teste**

Create `tests/taxonomia/test_schemas.py`:
```python
from app.schemas.taxonomia import (
    NodeOut, TreeOut, MateriaOut, CountsRequest, QuestaoTaxonomiaInfo
)

def test_node_out_serializes_minimal():
    n = NodeOut(id=1, nome='Federal', is_sintetico=True, children=[])
    d = n.model_dump()
    assert d['id'] == 1
    assert d['nome'] == 'Federal'
    assert d['is_sintetico'] is True
    assert d['children'] == []

def test_node_out_with_children():
    child = NodeOut(id=2, nome='01. Origem', hierarquia='01', is_sintetico=False, children=[])
    parent = NodeOut(id=1, nome='Federal', is_sintetico=True, children=[child])
    d = parent.model_dump()
    assert d['children'][0]['nome'] == '01. Origem'
    assert d['children'][0]['hierarquia'] == '01'

def test_counts_request_filters_optional():
    r = CountsRequest()
    assert r.banca is None
    assert r.ano is None

def test_counts_request_with_filters():
    r = CountsRequest(banca=['CESPE'], ano=[2023], excluir_anuladas=True)
    assert r.banca == ['CESPE']
    assert r.ano == [2023]
```

- [ ] **Step 2: Rodar teste — falha**

```bash
pytest tests/taxonomia/test_schemas.py -v
```
Expected: FAIL `ImportError`.

- [ ] **Step 3: Implementar schemas**

Create `app/schemas/taxonomia.py`:
```python
from __future__ import annotations
from typing import Optional, Union, List
from pydantic import BaseModel, ConfigDict, Field


class NodeOut(BaseModel):
    """Nó da árvore (físico ou virtual)."""
    model_config = ConfigDict(from_attributes=True)

    id: Union[int, str]  # int pra nós físicos, 'outros' pro virtual
    nome: str
    hierarquia: Optional[str] = None
    is_sintetico: bool = False
    is_virtual: bool = False
    fonte: Optional[str] = None
    children: List["NodeOut"] = []


NodeOut.model_rebuild()


class TreeOut(BaseModel):
    materia: str
    fontes: List[str]
    tree: List[NodeOut]


class MateriaOut(BaseModel):
    slug: str
    nome: str
    fontes: List[str]
    total_nodes: int
    total_questoes_classificadas: int
    last_updated: Optional[str] = None


class CountsRequest(BaseModel):
    banca: Optional[List[str]] = None
    ano: Optional[List[int]] = None
    tipo: Optional[List[str]] = None
    excluir_anuladas: bool = False
    excluir_desatualizadas: bool = False


class QuestaoTaxonomiaInfo(BaseModel):
    """Anexada em cada questão na resposta de /questoes/search."""
    node_id: Union[int, str, None]
    path: List[str] = []
    is_sintetico_root: Optional[str] = None  # 'Federal'/'Estadual'/'Municipal'
```

- [ ] **Step 4: Rodar teste — passa**

```bash
pytest tests/taxonomia/test_schemas.py -v
```
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add app/schemas/taxonomia.py tests/taxonomia/test_schemas.py
git commit -m "feat(taxonomia): Pydantic schemas (NodeOut, TreeOut, CountsRequest, etc.)"
```

---

### Task 5: [CHECKPOINT] Aldemir aplica migration + valida trigger

**Files:** none

- [ ] **Step 1: Backup do DB de prod (medida de segurança)**

```bash
cd C:/Users/Home/Desktop/verus_api
# Via tunel SSH ja aberto:
pg_dump "postgresql://USER:PASS@localhost:5433/postgres?sslmode=disable" \
    --schema-only \
    -t questoes \
    -t taxonomia_nodes 2>/dev/null \
    > /tmp/schema_pre_taxonomia.sql
```

Expected: arquivo SQL com `CREATE TABLE questoes`. (taxonomia_nodes ainda não existe).

- [ ] **Step 2: Aplicar migration em prod via tunel**

```bash
DATABASE_URL="postgresql://USER:PASS@localhost:5433/postgres?sslmode=disable" \
    alembic upgrade head
```

Expected: `Running upgrade ... -> 20260428_0001, taxonomia_tec_v1`.

- [ ] **Step 3: Smoke test do schema**

Run via psql ou script:
```sql
\d taxonomia_nodes
\d+ questoes
SELECT proname FROM pg_proc WHERE proname = 'resolve_taxonomia_node';
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_resolve_taxonomia';
```

Expected:
- `taxonomia_nodes` aparece com 13 colunas
- `questoes` tem `taxonomia_node_id` no fim
- Function e trigger existem

- [ ] **Step 4: Smoke test do trigger (transação rollback)**

Roda em psql:
```sql
BEGIN;

INSERT INTO taxonomia_nodes (materia, materia_slug, fonte, nome, nivel, is_sintetico)
VALUES ('Direito Administrativo', 'direito-administrativo', 'federal', 'TESTE FAKE', 1, FALSE)
RETURNING id;
-- Anota o ID retornado, ex: 1

INSERT INTO questoes (
    enunciado, alternativas, gabarito_correto, materia, assunto,
    tipo, formato, anulada, desatualizada
) VALUES (
    'teste enunciado', '[]'::jsonb, 1, 'Direito Administrativo', 'TESTE FAKE',
    'MULTIPLA_ESCOLHA', 'OBJETIVA', false, false
)
RETURNING id, taxonomia_node_id;
-- Expected: taxonomia_node_id = 1 (ID do TESTE FAKE)

ROLLBACK;
```

Expected: trigger populou `taxonomia_node_id` automaticamente. ROLLBACK garante zero dado persistido.

- [ ] **Step 5: Confirmar zero questões com taxonomia_node_id populado (ainda)**

```sql
SELECT COUNT(*) FROM questoes WHERE taxonomia_node_id IS NOT NULL;
```

Expected: 0 (backfill ocorre na Task 9).

---

## Phase 2 — Pipeline de import

### Task 6: Loader (Fase 1 — parse JSON + sintéticos)

**Files:**
- Create: `C:/Users/Home/Desktop/verus_api/scripts/_taxonomy_lib/__init__.py` (vazio)
- Create: `C:/Users/Home/Desktop/verus_api/scripts/_taxonomy_lib/loader.py`
- Create: `C:/Users/Home/Desktop/verus_api/tests/taxonomia/test_loader.py`

- [ ] **Step 1: Escrever teste do loader**

```python
# tests/taxonomia/test_loader.py
from scripts._taxonomy_lib.loader import load_tree_files, NodeIn

def test_load_single_file_no_synthetics(tmp_path):
    f = tmp_path / "federal.json"
    f.write_text('{"assuntos":[{"id":497,"nome":"Origem","hierarquia":"01"}]}', encoding='utf-8')
    nodes = load_tree_files([(str(f), "federal")], "Direito Administrativo", "direito-administrativo", add_synthetics=False)
    assert len(nodes) == 1
    assert nodes[0].id_externo == 497
    assert nodes[0].nome == "Origem"
    assert nodes[0].fonte == "federal"
    assert nodes[0].nivel == 1
    assert nodes[0].parent_index is None

def test_load_with_subtree(tmp_path):
    f = tmp_path / "federal.json"
    f.write_text(
        '{"assuntos":[{"id":498,"nome":"Regime","hierarquia":"02",'
        '"subTree":[{"id":6053,"nome":"Sub","hierarquia":"02.01"}]}]}',
        encoding='utf-8'
    )
    nodes = load_tree_files([(str(f), "federal")], "Direito Administrativo", "direito-administrativo", add_synthetics=False)
    assert len(nodes) == 2
    assert nodes[1].nivel == 2
    assert nodes[1].parent_index == 0  # parent é o node 0

def test_load_with_synthetics_3_files(tmp_path):
    fed = tmp_path / "federal.json"
    fed.write_text('{"assuntos":[{"id":497,"nome":"Federal A","hierarquia":"01"}]}', encoding='utf-8')
    est = tmp_path / "estadual.json"
    est.write_text('{"assuntos":[{"id":1000,"nome":"Estadual A","hierarquia":"01"}]}', encoding='utf-8')
    mun = tmp_path / "municipal.json"
    mun.write_text('{"assuntos":[{"id":2000,"nome":"Municipal A","hierarquia":"01"}]}', encoding='utf-8')

    nodes = load_tree_files(
        [(str(fed),"federal"),(str(est),"estadual"),(str(mun),"municipal")],
        "Direito Administrativo", "direito-administrativo",
        add_synthetics=True,
    )
    # 3 sintéticos + 3 nós TEC L1 = 6 nós
    assert len(nodes) == 6
    sint = [n for n in nodes if n.is_sintetico]
    assert len(sint) == 3
    assert {s.fonte for s in sint} == {'sintetico'}
    assert {s.nome for s in sint} == {
        'Direito Administrativo Federal',
        'Direito Administrativo Estadual e do DF',
        'Direito Administrativo Municipal',
    }
    # Nós TEC têm parent_index apontando pro sintético da mesma fonte
    fed_node = next(n for n in nodes if n.id_externo == 497)
    sint_fed_idx = next(i for i, n in enumerate(nodes) if n.is_sintetico and n.nome.endswith('Federal'))
    assert fed_node.parent_index == sint_fed_idx
```

- [ ] **Step 2: Rodar teste — falha**

```bash
cd C:/Users/Home/Desktop/verus_api
pytest tests/taxonomia/test_loader.py -v
```
Expected: FAIL `ImportError`.

- [ ] **Step 3: Implementar loader**

Create `scripts/_taxonomy_lib/__init__.py` (vazio).

Create `scripts/_taxonomy_lib/loader.py`:
```python
"""Fase 1 — Carrega JSONs do TEC, gera lista flat de NodeIn ordenada
(pais antes de filhos), opcionalmente adiciona L1 sintéticos."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, List, Tuple
import json


SYNTHETIC_NAMES = {
    'federal': 'Direito Administrativo Federal',
    'estadual': 'Direito Administrativo Estadual e do DF',
    'municipal': 'Direito Administrativo Municipal',
}


@dataclass
class NodeIn:
    """Nó pré-DB. parent_index aponta posição na lista (não ID, que é gerado depois)."""
    id_externo: Optional[int]
    nome: str
    hierarquia: Optional[str]
    nivel: int
    fonte: str
    materia: str
    materia_slug: str
    parent_index: Optional[int]
    ordem: int
    is_sintetico: bool


def load_tree_files(
    files: List[Tuple[str, str]],  # [(path, fonte_label), ...]
    materia: str,
    materia_slug: str,
    add_synthetics: bool,
) -> List[NodeIn]:
    nodes: List[NodeIn] = []
    sint_index_by_fonte: dict[str, int] = {}

    if add_synthetics:
        for path_, fonte in files:
            sint_index_by_fonte[fonte] = len(nodes)
            nodes.append(NodeIn(
                id_externo=None,
                nome=SYNTHETIC_NAMES[fonte],
                hierarquia=None,
                nivel=0,
                fonte='sintetico',
                materia=materia,
                materia_slug=materia_slug,
                parent_index=None,
                ordem=len(sint_index_by_fonte),
                is_sintetico=True,
            ))

    for path_, fonte in files:
        with open(path_, encoding='utf-8') as f:
            data = json.load(f)
        sint_idx = sint_index_by_fonte.get(fonte) if add_synthetics else None
        for ordem, raw in enumerate(data['assuntos']):
            _walk(raw, nodes, materia, materia_slug, fonte, sint_idx, ordem)

    return nodes


def _walk(
    raw: dict,
    nodes: List[NodeIn],
    materia: str,
    materia_slug: str,
    fonte: str,
    parent_idx: Optional[int],
    ordem: int,
) -> None:
    nivel = (raw['hierarquia'] or '').count('.') + 1 if raw.get('hierarquia') else 1
    my_idx = len(nodes)
    nodes.append(NodeIn(
        id_externo=raw['id'],
        nome=raw['nome'],
        hierarquia=raw.get('hierarquia'),
        nivel=nivel,
        fonte=fonte,
        materia=materia,
        materia_slug=materia_slug,
        parent_index=parent_idx,
        ordem=ordem,
        is_sintetico=False,
    ))
    for sub_ordem, sub in enumerate(raw.get('subTree') or []):
        _walk(sub, nodes, materia, materia_slug, fonte, my_idx, sub_ordem)
```

- [ ] **Step 4: Rodar teste — passa**

```bash
pytest tests/taxonomia/test_loader.py -v
```
Expected: 3 PASS.

- [ ] **Step 5: Sanity check com dados reais**

```bash
python -c "
from scripts._taxonomy_lib.loader import load_tree_files
nodes = load_tree_files([
    ('data/taxonomia/direito-administrativo/federal.json','federal'),
    ('data/taxonomia/direito-administrativo/estadual.json','estadual'),
    ('data/taxonomia/direito-administrativo/municipal.json','municipal'),
], 'Direito Administrativo', 'direito-administrativo', add_synthetics=True)
print(f'Total: {len(nodes)}')
print(f'Sinteticos: {sum(1 for n in nodes if n.is_sintetico)}')
print(f'L1: {sum(1 for n in nodes if n.nivel == 1)}')
"
```

Expected: `Total: 851`, `Sinteticos: 3`, `L1: 56`.

- [ ] **Step 6: Commit**

```bash
git add scripts/_taxonomy_lib/ tests/taxonomia/test_loader.py
git commit -m "feat(taxonomia): pipeline Fase 1 — loader JSON + sintéticos"
```

---

### Task 7: Differ (Fase 2 — diff vs DB)

**Files:**
- Create: `scripts/_taxonomy_lib/differ.py`
- Create: `tests/taxonomia/test_differ.py`

- [ ] **Step 1: Escrever teste**

```python
# tests/taxonomia/test_differ.py
from scripts._taxonomy_lib.differ import compute_diff, DiffResult
from scripts._taxonomy_lib.loader import NodeIn

def make_node(id_externo, nome, hierarquia=None, parent_index=None, is_sintetico=False, fonte='federal'):
    return NodeIn(
        id_externo=id_externo, nome=nome, hierarquia=hierarquia,
        nivel=1, fonte=fonte, materia='X', materia_slug='x',
        parent_index=parent_index, ordem=0, is_sintetico=is_sintetico,
    )

def test_diff_added():
    db_state = []  # nada no DB
    new = [make_node(497, 'Origem', '01')]
    d = compute_diff(new, db_state)
    assert d.added == [0]  # index 0 da new list
    assert d.renamed == []
    assert d.deleted == []

def test_diff_renamed():
    db_state = [{'id': 100, 'id_externo': 497, 'nome': 'OrigemOLD', 'hierarquia': '01', 'parent_id': None}]
    new = [make_node(497, 'OrigemNEW', '01')]
    d = compute_diff(new, db_state)
    assert d.renamed == [(0, 100)]  # (new_index, db_id)
    assert d.added == []
    assert d.deleted == []

def test_diff_deleted():
    db_state = [{'id': 100, 'id_externo': 497, 'nome': 'Old', 'hierarquia': '01', 'parent_id': None}]
    new = []
    d = compute_diff(new, db_state)
    assert d.deleted == [100]
    assert d.added == []
    assert d.renamed == []

def test_diff_unchanged_zero_ops():
    db_state = [{'id': 100, 'id_externo': 497, 'nome': 'Origem', 'hierarquia': '01', 'parent_id': None}]
    new = [make_node(497, 'Origem', '01')]
    d = compute_diff(new, db_state)
    assert d.added == []
    assert d.renamed == []
    assert d.deleted == []
```

- [ ] **Step 2: Rodar teste — falha**

```bash
pytest tests/taxonomia/test_differ.py -v
```
Expected: FAIL ImportError.

- [ ] **Step 3: Implementar differ**

Create `scripts/_taxonomy_lib/differ.py`:
```python
"""Fase 2 — diff entre estado novo (lista NodeIn) e estado atual no DB."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Any
from .loader import NodeIn


@dataclass
class DiffResult:
    added: List[int] = field(default_factory=list)         # indices da new
    renamed: List[Tuple[int, int]] = field(default_factory=list)  # (new_idx, db_id)
    moved: List[Tuple[int, int]] = field(default_factory=list)    # (new_idx, db_id)
    deleted: List[int] = field(default_factory=list)       # db_ids
    unchanged: List[Tuple[int, int]] = field(default_factory=list)  # (new_idx, db_id)


def compute_diff(new: List[NodeIn], db_state: List[Dict[str, Any]]) -> DiffResult:
    """db_state é lista de dicts {id, id_externo, nome, hierarquia, parent_id, is_sintetico, fonte}.

    Sintéticos são tratados pelo nome (não têm id_externo).
    """
    result = DiffResult()
    # Lookup por id_externo (None pra sintéticos)
    db_by_idext = {row['id_externo']: row for row in db_state if row.get('id_externo') is not None}
    db_by_sint_name = {row['nome']: row for row in db_state if row.get('is_sintetico')}

    matched_db_ids = set()

    for idx, n in enumerate(new):
        if n.is_sintetico:
            db_row = db_by_sint_name.get(n.nome)
            if db_row is None:
                result.added.append(idx)
            else:
                matched_db_ids.add(db_row['id'])
                result.unchanged.append((idx, db_row['id']))
            continue

        db_row = db_by_idext.get(n.id_externo)
        if db_row is None:
            result.added.append(idx)
            continue

        matched_db_ids.add(db_row['id'])
        if db_row['nome'] != n.nome:
            result.renamed.append((idx, db_row['id']))
        else:
            result.unchanged.append((idx, db_row['id']))

    for row in db_state:
        if row['id'] not in matched_db_ids:
            result.deleted.append(row['id'])

    return result
```

- [ ] **Step 4: Rodar teste — passa**

```bash
pytest tests/taxonomia/test_differ.py -v
```
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/_taxonomy_lib/differ.py tests/taxonomia/test_differ.py
git commit -m "feat(taxonomia): pipeline Fase 2 — diff (added/renamed/moved/deleted)"
```

---

### Task 8: Applier (Fase 3 — apply transacional + backfill)

**Files:**
- Create: `scripts/_taxonomy_lib/applier.py`
- Create: `tests/taxonomia/test_applier.py`

- [ ] **Step 1: Escrever teste de integração**

```python
# tests/taxonomia/test_applier.py
import pytest
from sqlalchemy import text
from app.core.database import SessionLocal
from app.models.taxonomia import TaxonomiaNode
from scripts._taxonomy_lib.loader import NodeIn
from scripts._taxonomy_lib.applier import apply_diff
from scripts._taxonomy_lib.differ import compute_diff

@pytest.fixture
def session():
    s = SessionLocal()
    s.begin_nested()  # savepoint
    try:
        yield s
    finally:
        s.rollback()
        s.close()

def test_apply_inserts_new_nodes(session):
    new = [
        NodeIn(id_externo=None, nome='Sint Federal', hierarquia=None, nivel=0,
               fonte='sintetico', materia='Test Materia', materia_slug='test',
               parent_index=None, ordem=0, is_sintetico=True),
        NodeIn(id_externo=99001, nome='No A', hierarquia='01', nivel=1,
               fonte='federal', materia='Test Materia', materia_slug='test',
               parent_index=0, ordem=0, is_sintetico=False),
    ]
    diff = compute_diff(new, [])
    apply_diff(session, new, diff, materia_slug='test')
    rows = session.query(TaxonomiaNode).filter_by(materia_slug='test').all()
    assert len(rows) == 2
    by_name = {r.nome: r for r in rows}
    assert by_name['No A'].parent_id == by_name['Sint Federal'].id
```

- [ ] **Step 2: Rodar teste — falha**

```bash
pytest tests/taxonomia/test_applier.py -v
```
Expected: FAIL `ImportError`.

- [ ] **Step 3: Implementar applier**

Create `scripts/_taxonomy_lib/applier.py`:
```python
"""Fase 3 — aplica DiffResult no DB em transação atômica.

Inclui backfill de questoes.taxonomia_node_id após updates de árvore.
Trigger é desabilitado durante backfill por performance.
"""
from __future__ import annotations
from typing import List
from sqlalchemy import text
from sqlalchemy.orm import Session
from .loader import NodeIn
from .differ import DiffResult
from app.models.taxonomia import TaxonomiaNode


def apply_diff(
    session: Session,
    new: List[NodeIn],
    diff: DiffResult,
    materia_slug: str,
    backfill_materia: str | None = None,
) -> None:
    """Aplica diff em ordem segura: deletes (folhas primeiro) → inserts → updates.

    Se backfill_materia for fornecido, faz UPDATE em questoes.taxonomia_node_id
    pra todas as questões da matéria com trigger desabilitado.
    """
    # Mapa: index na new list → ID criado no DB (preenchido conforme INSERTa)
    new_idx_to_db_id: dict[int, int] = {}
    # Pra renamed/unchanged, já temos o mapping
    for new_idx, db_id in diff.renamed + diff.unchanged:
        new_idx_to_db_id[new_idx] = db_id

    # 1. DELETES — folhas primeiro
    if diff.deleted:
        for db_id in diff.deleted:
            session.execute(
                text("DELETE FROM taxonomia_nodes WHERE id = :id AND parent_id IS NULL"),
                {"id": db_id}
            )
            session.execute(
                text("DELETE FROM taxonomia_nodes WHERE id = :id"),
                {"id": db_id}
            )

    # 2. INSERTS — em ordem topológica (pais primeiro)
    for new_idx in diff.added:
        n = new[new_idx]
        parent_db_id = (
            new_idx_to_db_id.get(n.parent_index)
            if n.parent_index is not None else None
        )
        node = TaxonomiaNode(
            id_externo=n.id_externo,
            materia=n.materia,
            materia_slug=n.materia_slug,
            fonte=n.fonte,
            nome=n.nome,
            hierarquia=n.hierarquia,
            nivel=n.nivel,
            parent_id=parent_db_id,
            ordem=n.ordem,
            is_sintetico=n.is_sintetico,
        )
        session.add(node)
        session.flush()
        new_idx_to_db_id[new_idx] = node.id

    # 3. RENAMES — UPDATE nome
    for new_idx, db_id in diff.renamed:
        n = new[new_idx]
        session.execute(
            text("""
                UPDATE taxonomia_nodes
                SET nome = :nome, hierarquia = :h, ordem = :o, updated_at = NOW()
                WHERE id = :id
            """),
            {"nome": n.nome, "h": n.hierarquia, "o": n.ordem, "id": db_id}
        )

    session.flush()

    # 4. BACKFILL — popula questoes.taxonomia_node_id
    if backfill_materia is not None:
        # Desabilita trigger pra performance
        session.execute(text("ALTER TABLE questoes DISABLE TRIGGER trg_resolve_taxonomia"))
        session.execute(text("""
            UPDATE questoes q
            SET taxonomia_node_id = n.id
            FROM taxonomia_nodes n
            WHERE q.materia = :materia
              AND q.assunto = n.nome
              AND n.materia = q.materia
              AND n.is_sintetico = FALSE
              AND (q.taxonomia_node_id IS NULL OR q.taxonomia_node_id != n.id)
        """), {"materia": backfill_materia})
        session.execute(text("ALTER TABLE questoes ENABLE TRIGGER trg_resolve_taxonomia"))
```

- [ ] **Step 4: Rodar teste — passa**

```bash
pytest tests/taxonomia/test_applier.py -v
```
Expected: 1 PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/_taxonomy_lib/applier.py tests/taxonomia/test_applier.py
git commit -m "feat(taxonomia): pipeline Fase 3 — applier transacional + backfill"
```

---

### Task 9: CLI script `import_taxonomia.py`

**Files:**
- Create: `scripts/import_taxonomia.py`

- [ ] **Step 1: Implementar CLI**

```python
"""CLI de import da taxonomia TEC.

Uso:
    python scripts/import_taxonomia.py \\
        --materia "Direito Administrativo" \\
        --slug direito-administrativo \\
        --files data/taxonomia/direito-administrativo/federal.json:federal \\
                data/taxonomia/direito-administrativo/estadual.json:estadual \\
                data/taxonomia/direito-administrativo/municipal.json:municipal \\
        [--dry-run]
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.core.database import SessionLocal
from app.models.taxonomia import TaxonomiaNode
from scripts._taxonomy_lib.loader import load_tree_files
from scripts._taxonomy_lib.differ import compute_diff
from scripts._taxonomy_lib.applier import apply_diff


def fmt_diff(diff, new) -> str:
    lines = [
        f"  + {len(diff.added):>4} adicionados",
        f"  ~ {len(diff.renamed):>4} renomeados",
        f"  → {len(diff.moved):>4} movidos",
        f"  - {len(diff.deleted):>4} deletados",
        f"  = {len(diff.unchanged):>4} inalterados",
    ]
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--materia', required=True)
    ap.add_argument('--slug', required=True)
    ap.add_argument('--files', nargs='+', required=True,
                    help='path:fonte (ex: federal.json:federal)')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--force', action='store_true',
                    help='Permite DELETE de nós com questões apontando')
    args = ap.parse_args()

    files = []
    for spec in args.files:
        path, fonte = spec.rsplit(':', 1)
        files.append((path, fonte))

    add_synthetics = len(files) >= 2

    print(f"==> Carregando {len(files)} arquivo(s) — sintéticos: {add_synthetics}")
    new_nodes = load_tree_files(files, args.materia, args.slug, add_synthetics)
    print(f"    {len(new_nodes)} nós no JSON novo")

    session = SessionLocal()
    try:
        db_rows = session.query(TaxonomiaNode).filter_by(materia_slug=args.slug).all()
        db_state = [{
            'id': r.id, 'id_externo': r.id_externo, 'nome': r.nome,
            'hierarquia': r.hierarquia, 'parent_id': r.parent_id,
            'is_sintetico': r.is_sintetico, 'fonte': r.fonte,
        } for r in db_rows]

        print(f"==> Estado atual no DB: {len(db_state)} nós")
        diff = compute_diff(new_nodes, db_state)
        print(f"==> DIFF SUMMARY:\n{fmt_diff(diff, new_nodes)}")

        if diff.deleted and not args.force:
            qs_apontando = session.execute(text("""
                SELECT COUNT(*) FROM questoes
                WHERE taxonomia_node_id = ANY(:ids)
            """), {"ids": diff.deleted}).scalar()
            if qs_apontando and qs_apontando > 0:
                print(f"\n  [ERRO] {qs_apontando} questoes apontam pra nos a serem deletados.")
                print(f"         Use --force pra prosseguir (questoes virao para 'Outros').")
                return 2

        if args.dry_run:
            print("\n==> --dry-run: nenhuma alteração feita.")
            return 0

        print("==> Aplicando transação...")
        with session.begin():
            apply_diff(session, new_nodes, diff,
                       materia_slug=args.slug,
                       backfill_materia=args.materia)
        print("==> COMMIT OK")

        cnt = session.execute(text("""
            SELECT COUNT(*) FROM questoes
            WHERE materia = :m AND taxonomia_node_id IS NOT NULL
        """), {"m": args.materia}).scalar()
        print(f"==> Questões com taxonomia_node_id populado: {cnt}")
        return 0
    finally:
        session.close()


if __name__ == '__main__':
    sys.exit(main())
```

- [ ] **Step 2: Dry-run pra confirmar diff**

```bash
cd C:/Users/Home/Desktop/verus_api
python scripts/import_taxonomia.py \
    --materia "Direito Administrativo" \
    --slug direito-administrativo \
    --files \
        data/taxonomia/direito-administrativo/federal.json:federal \
        data/taxonomia/direito-administrativo/estadual.json:estadual \
        data/taxonomia/direito-administrativo/municipal.json:municipal \
    --dry-run
```

Expected:
- `851 nós no JSON novo`
- `Estado atual no DB: 0 nós`
- `+ 851 adicionados, 0 outros`
- `--dry-run: nenhuma alteração feita.`

- [ ] **Step 3: Commit**

```bash
git add scripts/import_taxonomia.py
git commit -m "feat(taxonomia): CLI script import_taxonomia.py"
```

---

### Task 10: [CHECKPOINT] Aldemir roda import + valida

**Files:** none

- [ ] **Step 1: Rodar import real (sem --dry-run)**

```bash
cd C:/Users/Home/Desktop/verus_api
DATABASE_URL="postgresql://USER:PASS@localhost:5433/postgres?sslmode=disable" \
python scripts/import_taxonomia.py \
    --materia "Direito Administrativo" \
    --slug direito-administrativo \
    --files \
        data/taxonomia/direito-administrativo/federal.json:federal \
        data/taxonomia/direito-administrativo/estadual.json:estadual \
        data/taxonomia/direito-administrativo/municipal.json:municipal
```

Expected:
- `+ 851 adicionados`
- `Questões com taxonomia_node_id populado: ~113810` (97% das 117.243 com assunto)

- [ ] **Step 2: Validar via SQL**

```sql
SELECT COUNT(*) FROM taxonomia_nodes WHERE materia_slug = 'direito-administrativo';
-- Expected: 851

SELECT fonte, COUNT(*) FROM taxonomia_nodes
WHERE materia_slug = 'direito-administrativo'
GROUP BY fonte;
-- Expected: federal=271, estadual=558, municipal=19, sintetico=3

SELECT COUNT(*) FROM questoes
WHERE materia = 'Direito Administrativo' AND taxonomia_node_id IS NOT NULL;
-- Expected: ~113810

SELECT COUNT(*) FROM questoes
WHERE materia = 'Direito Administrativo'
  AND assunto IS NOT NULL
  AND taxonomia_node_id IS NULL;
-- Expected: ~3433 (órfãs do bucket "Outros")
```

- [ ] **Step 3: Re-rodar import (idempotência)**

Run o mesmo comando da step 1 de novo.
Expected: `+ 0 adicionados, ~ 0 renomeados, = 851 inalterados`. Termina em <1s.

---

## Phase 3 — Backend API

### Task 11: Repository (CRUD + recursive CTE)

**Files:**
- Create: `app/services/taxonomia_repository.py`
- Create: `tests/taxonomia/test_repository.py`

- [ ] **Step 1: Escrever teste**

```python
# tests/taxonomia/test_repository.py
from app.services.taxonomia_repository import (
    list_materias, get_tree_for_materia, count_orphans, descendant_ids
)
from app.core.database import SessionLocal

def test_list_materias_includes_dir_adm():
    session = SessionLocal()
    try:
        result = list_materias(session)
        slugs = [m['slug'] for m in result]
        assert 'direito-administrativo' in slugs
    finally:
        session.close()

def test_get_tree_returns_4_root_groups():
    session = SessionLocal()
    try:
        tree = get_tree_for_materia(session, 'direito-administrativo')
        # 3 sintéticos físicos + 1 virtual "Outros"
        assert len(tree) == 4
        assert any(n['is_virtual'] for n in tree)
    finally:
        session.close()

def test_descendant_ids_includes_self():
    session = SessionLocal()
    try:
        # pega um L1 sintético qualquer
        descs = descendant_ids(session, root_node_id=1)  # ajustar pelo ID real
        assert 1 in descs
        assert len(descs) > 1  # tem filhos
    finally:
        session.close()
```

- [ ] **Step 2: Implementar repository**

Create `app/services/taxonomia_repository.py`:
```python
"""Camada de acesso à taxonomia. Funções puras + sessão SQLAlchemy."""
from __future__ import annotations
from typing import List, Dict, Any, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session


def list_materias(session: Session) -> List[Dict[str, Any]]:
    """Lista matérias que têm taxonomia (>= 1 nó na taxonomia_nodes)."""
    rows = session.execute(text("""
        SELECT
            n.materia_slug AS slug,
            n.materia AS nome,
            ARRAY_AGG(DISTINCT n.fonte) FILTER (WHERE n.fonte != 'sintetico') AS fontes,
            COUNT(*) AS total_nodes,
            MAX(n.updated_at) AS last_updated,
            (SELECT COUNT(*) FROM questoes q
             WHERE q.materia = n.materia AND q.taxonomia_node_id IS NOT NULL) AS total_classificadas
        FROM taxonomia_nodes n
        GROUP BY n.materia_slug, n.materia
        ORDER BY n.materia
    """)).fetchall()
    return [{
        'slug': r.slug,
        'nome': r.nome,
        'fontes': list(r.fontes or []),
        'total_nodes': r.total_nodes,
        'total_questoes_classificadas': r.total_classificadas or 0,
        'last_updated': r.last_updated.isoformat() if r.last_updated else None,
    } for r in rows]


def get_tree_for_materia(session: Session, materia_slug: str) -> List[Dict[str, Any]]:
    """Retorna árvore aninhada (recursive CTE + nesting Python).

    Inclui o nó virtual 'Outros' no fim quando há órfãs.
    """
    rows = session.execute(text("""
        SELECT id, id_externo, nome, hierarquia, nivel, parent_id,
               fonte, is_sintetico, ordem
        FROM taxonomia_nodes
        WHERE materia_slug = :slug
        ORDER BY nivel, ordem, nome
    """), {"slug": materia_slug}).fetchall()

    if not rows:
        return []

    by_id: Dict[int, Dict[str, Any]] = {}
    roots: List[Dict[str, Any]] = []
    for r in rows:
        node = {
            'id': r.id,
            'nome': r.nome,
            'hierarquia': r.hierarquia,
            'is_sintetico': r.is_sintetico,
            'is_virtual': False,
            'fonte': r.fonte,
            'children': [],
        }
        by_id[r.id] = node
        if r.parent_id is None:
            roots.append(node)
        else:
            parent = by_id.get(r.parent_id)
            if parent:
                parent['children'].append(node)

    # Adiciona nó virtual "Outros" se houver órfãs (precisa do nome da matéria)
    materia = session.execute(text(
        "SELECT materia FROM taxonomia_nodes WHERE materia_slug = :slug LIMIT 1"
    ), {"slug": materia_slug}).scalar()

    orphans = count_orphans(session, materia)
    if orphans > 0:
        roots.append({
            'id': 'outros',
            'nome': 'Outros / Sem classificação',
            'hierarquia': None,
            'is_sintetico': True,
            'is_virtual': True,
            'fonte': 'virtual',
            'children': [],
        })

    return roots


def count_orphans(session: Session, materia: str) -> int:
    return session.execute(text("""
        SELECT COUNT(*) FROM questoes
        WHERE materia = :m
          AND assunto IS NOT NULL
          AND taxonomia_node_id IS NULL
    """), {"m": materia}).scalar() or 0


def descendant_ids(session: Session, root_node_id: int) -> List[int]:
    """Retorna IDs do root + todos descendentes (recursive CTE)."""
    rows = session.execute(text("""
        WITH RECURSIVE tree AS (
            SELECT id FROM taxonomia_nodes WHERE id = :root
            UNION ALL
            SELECT n.id FROM taxonomia_nodes n
            INNER JOIN tree t ON n.parent_id = t.id
        )
        SELECT id FROM tree LIMIT 5000
    """), {"root": root_node_id}).fetchall()
    return [r.id for r in rows]


def get_etag_for_materia(session: Session, materia_slug: str) -> str:
    """Hash do MAX(updated_at) — muda só com import."""
    import hashlib
    ts = session.execute(text("""
        SELECT MAX(updated_at)::text FROM taxonomia_nodes WHERE materia_slug = :s
    """), {"s": materia_slug}).scalar() or ''
    return hashlib.sha256(ts.encode()).hexdigest()[:16]
```

- [ ] **Step 3: Rodar teste — passa**

```bash
pytest tests/taxonomia/test_repository.py -v
```
Expected: 3 PASS.

- [ ] **Step 4: Commit**

```bash
git add app/services/taxonomia_repository.py tests/taxonomia/test_repository.py
git commit -m "feat(taxonomia): repository (recursive CTE + ETag helper)"
```

---

### Task 12: Cache helper (Redis + ETag)

**Files:**
- Create: `app/services/taxonomia_cache.py`
- Create: `tests/taxonomia/test_cache.py`

- [ ] **Step 1: Escrever teste**

```python
# tests/taxonomia/test_cache.py
from app.services.taxonomia_cache import counts_cache_key, get_or_compute

def test_counts_cache_key_stable():
    body1 = {'banca': ['CESPE'], 'ano': [2023]}
    body2 = {'ano': [2023], 'banca': ['CESPE']}
    assert counts_cache_key('dir-adm', body1) == counts_cache_key('dir-adm', body2)

def test_counts_cache_key_differs_for_diff_filters():
    body1 = {'banca': ['CESPE']}
    body2 = {'banca': ['FCC']}
    assert counts_cache_key('dir-adm', body1) != counts_cache_key('dir-adm', body2)
```

- [ ] **Step 2: Implementar**

Create `app/services/taxonomia_cache.py`:
```python
"""Wrapper Redis com fallback degradado se Redis estiver indisponível."""
from __future__ import annotations
import hashlib
import json
from typing import Optional, Callable, Any
import redis
from app.config import settings


_redis_client: Optional[redis.Redis] = None


def get_redis() -> Optional[redis.Redis]:
    """Singleton lazy. Retorna None se Redis falhou — caller deve degradar."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        _redis_client = redis.Redis.from_url(settings.REDIS_URL, socket_timeout=2.0, decode_responses=True)
        _redis_client.ping()
        return _redis_client
    except Exception:
        _redis_client = None
        return None


def counts_cache_key(materia_slug: str, body: dict) -> str:
    blob = json.dumps(body, sort_keys=True, ensure_ascii=False)
    h = hashlib.sha256(blob.encode()).hexdigest()[:16]
    return f"counts:{materia_slug}:{h}"


def get_or_compute(key: str, ttl: int, compute: Callable[[], Any]) -> Any:
    r = get_redis()
    if r is not None:
        try:
            cached = r.get(key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass
    val = compute()
    if r is not None:
        try:
            r.setex(key, ttl, json.dumps(val, ensure_ascii=False))
        except Exception:
            pass
    return val
```

- [ ] **Step 3: Rodar teste — passa**

```bash
pytest tests/taxonomia/test_cache.py -v
```
Expected: 2 PASS.

- [ ] **Step 4: Commit**

```bash
git add app/services/taxonomia_cache.py tests/taxonomia/test_cache.py
git commit -m "feat(taxonomia): cache helper Redis com fallback degradado"
```

---

### Task 13: Endpoints `/taxonomia/materias` e `/taxonomia/{slug}`

**Files:**
- Create: `app/api/v1/routes/taxonomia.py`
- Modify: `app/api/v1/__init__.py` ou onde routers são registrados

- [ ] **Step 1: Implementar endpoints**

Create `app/api/v1/routes/taxonomia.py`:
```python
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.taxonomia import TreeOut, MateriaOut, NodeOut, CountsRequest
from app.services import taxonomia_repository as repo
from app.services.taxonomia_cache import counts_cache_key, get_or_compute
from sqlalchemy import text


router = APIRouter(prefix="/taxonomia", tags=["taxonomia"])


@router.get("/materias", response_model=list[MateriaOut])
def list_materias(db: Session = Depends(get_db)):
    return repo.list_materias(db)


@router.get("/{materia_slug}", response_model=TreeOut)
def get_tree(materia_slug: str, request: Request, response: Response,
             db: Session = Depends(get_db)):
    etag = repo.get_etag_for_materia(db, materia_slug)
    if request.headers.get("if-none-match") == etag:
        response.status_code = status.HTTP_304_NOT_MODIFIED
        return None
    response.headers["etag"] = etag

    tree = repo.get_tree_for_materia(db, materia_slug)
    if not tree:
        raise HTTPException(404, f"Matéria '{materia_slug}' não tem taxonomia")

    materia = db.execute(text(
        "SELECT materia FROM taxonomia_nodes WHERE materia_slug = :s LIMIT 1"
    ), {"s": materia_slug}).scalar()

    fontes = sorted({n['fonte'] for n in _flat(tree) if n.get('fonte') and n['fonte'] != 'sintetico'})

    return {
        "materia": materia,
        "fontes": fontes,
        "tree": tree,
    }


def _flat(nodes):
    for n in nodes:
        yield n
        yield from _flat(n.get('children', []))
```

- [ ] **Step 2: Registrar router**

Modify wherever `app.include_router(...)` is called. Add:
```python
from app.api.v1.routes.taxonomia import router as taxonomia_router
app.include_router(taxonomia_router, prefix="/api/v1")
```

- [ ] **Step 3: Smoke test manual**

Run o servidor:
```bash
uvicorn app.main:app --reload
```

Em outro terminal:
```bash
curl http://localhost:8000/api/v1/taxonomia/materias | jq .
curl -i http://localhost:8000/api/v1/taxonomia/direito-administrativo | head -30
```

Expected:
- `/materias` retorna lista com `direito-administrativo`
- `/direito-administrativo` retorna `{materia: "Direito Administrativo", fontes: [...], tree: [...]}` com 4 raízes (3 sint + 1 virtual)
- Header `etag` presente

- [ ] **Step 4: Testar 304**

```bash
ETAG=$(curl -sI http://localhost:8000/api/v1/taxonomia/direito-administrativo | grep -i etag | cut -d' ' -f2 | tr -d '\r')
curl -i -H "If-None-Match: $ETAG" http://localhost:8000/api/v1/taxonomia/direito-administrativo
```

Expected: `HTTP/1.1 304 Not Modified`

- [ ] **Step 5: Commit**

```bash
git add app/api/v1/routes/taxonomia.py app/api/v1/__init__.py
git commit -m "feat(taxonomia): endpoints GET /taxonomia/materias e /{slug}"
```

---

### Task 14: Endpoint `POST /taxonomia/{slug}/counts`

**Files:**
- Modify: `app/api/v1/routes/taxonomia.py`

- [ ] **Step 1: Adicionar endpoint counts**

Append em `app/api/v1/routes/taxonomia.py`:
```python
@router.post("/{materia_slug}/counts")
def post_counts(materia_slug: str, body: CountsRequest, db: Session = Depends(get_db)):
    cache_key = counts_cache_key(materia_slug, body.model_dump())

    def compute():
        clauses = ["materia = :materia"]
        params = {"materia": _slug_to_materia(db, materia_slug)}
        if body.banca:
            clauses.append("banca = ANY(:banca)")
            params["banca"] = body.banca
        if body.ano:
            clauses.append("ano = ANY(:ano)")
            params["ano"] = body.ano
        if body.tipo:
            clauses.append("tipo = ANY(:tipo)")
            params["tipo"] = body.tipo
        if body.excluir_anuladas:
            clauses.append("anulada = FALSE")
        if body.excluir_desatualizadas:
            clauses.append("desatualizada = FALSE")

        # Aggregar counts por nó (próprio + descendentes via recursive CTE)
        sql = f"""
            WITH RECURSIVE tree AS (
                SELECT id, parent_id FROM taxonomia_nodes WHERE materia_slug = :slug
            ), descendants AS (
                SELECT t1.id AS root_id, t1.id AS desc_id FROM tree t1
                UNION ALL
                SELECT d.root_id, t2.id FROM descendants d
                JOIN tree t2 ON t2.parent_id = d.desc_id
            ),
            qcounts AS (
                SELECT taxonomia_node_id, COUNT(*) AS n
                FROM questoes
                WHERE {' AND '.join(clauses)}
                  AND taxonomia_node_id IS NOT NULL
                GROUP BY taxonomia_node_id
            )
            SELECT d.root_id, COALESCE(SUM(q.n), 0) AS total
            FROM descendants d
            LEFT JOIN qcounts q ON q.taxonomia_node_id = d.desc_id
            GROUP BY d.root_id
        """
        params["slug"] = materia_slug
        rows = db.execute(text(sql), params).fetchall()
        result = {str(r.root_id): r.total for r in rows}

        # Adiciona "outros" (órfãs)
        outros_sql = f"""
            SELECT COUNT(*) FROM questoes
            WHERE {' AND '.join(clauses)}
              AND taxonomia_node_id IS NULL
              AND assunto IS NOT NULL
        """
        outros = db.execute(text(outros_sql), params).scalar() or 0
        if outros > 0:
            result['outros'] = outros
        return result

    return get_or_compute(cache_key, ttl=300, compute=compute)


def _slug_to_materia(db: Session, slug: str) -> str:
    materia = db.execute(text(
        "SELECT materia FROM taxonomia_nodes WHERE materia_slug = :s LIMIT 1"
    ), {"s": slug}).scalar()
    if not materia:
        raise HTTPException(404, f"Slug '{slug}' não encontrado")
    return materia
```

- [ ] **Step 2: Smoke test**

```bash
curl -X POST http://localhost:8000/api/v1/taxonomia/direito-administrativo/counts \
    -H "Content-Type: application/json" \
    -d '{"banca":["CEBRASPE (CESPE)"]}' | jq 'length'
```

Expected: número >= 100 (counts pra ~850 nós + bucket outros).

- [ ] **Step 3: Validar cache hit**

Roda 2× — segundo deve ser quase instantâneo (<10ms).

- [ ] **Step 4: Commit**

```bash
git add app/api/v1/routes/taxonomia.py
git commit -m "feat(taxonomia): endpoint POST /taxonomia/{slug}/counts (Redis cache 5min)"
```

---

### Task 15: Extender `GET /questoes/search` com `?node=`

**Files:**
- Modify: `app/api/v1/routes/questoes.py` (path exato pode variar)

- [ ] **Step 1: Adicionar lógica de filtro por node**

Em `routes/questoes.py`, na função `search_questoes` (ou equivalente), adicionar:

```python
from typing import Optional, List
from fastapi import Query
from sqlalchemy import text
from app.services import taxonomia_repository as repo


@router.get("/search")
def search_questoes(
    request: Request,
    materia: Optional[List[str]] = Query(None),
    banca: Optional[List[str]] = Query(None),
    ano: Optional[List[int]] = Query(None),
    node: Optional[List[str]] = Query(None),  # NOVO — pode ser int ou 'outros'
    # ... outros params existentes
    db: Session = Depends(get_db),
):
    # ... lógica existente ...

    # Filtro por node
    if node:
        node_ids: List[int] = []
        include_outros = False
        for n in node:
            if n == 'outros':
                include_outros = True
            else:
                try:
                    root = int(n)
                except ValueError:
                    raise HTTPException(400, f"node inválido: {n!r}")
                node_ids.extend(repo.descendant_ids(db, root))

        node_clauses = []
        if node_ids:
            node_clauses.append("taxonomia_node_id = ANY(:node_ids)")
        if include_outros:
            node_clauses.append("(taxonomia_node_id IS NULL AND assunto IS NOT NULL)")
        if node_clauses:
            clauses.append(f"({' OR '.join(node_clauses)})")
            params['node_ids'] = node_ids

    # ... resto da query ...
```

- [ ] **Step 2: Anexar info `taxonomia` no payload da questão**

Na construção da resposta de cada questão, adicionar:
```python
def _enrich_taxonomia(q, db):
    """Adiciona campo 'taxonomia' à questão se taxonomia_node_id estiver setado."""
    if q.taxonomia_node_id is None:
        return None
    rows = db.execute(text("""
        WITH RECURSIVE path AS (
            SELECT id, nome, parent_id, fonte, is_sintetico
            FROM taxonomia_nodes WHERE id = :id
            UNION ALL
            SELECT n.id, n.nome, n.parent_id, n.fonte, n.is_sintetico
            FROM taxonomia_nodes n
            JOIN path p ON p.parent_id = n.id
        )
        SELECT nome, fonte, is_sintetico FROM path
    """), {"id": q.taxonomia_node_id}).fetchall()
    if not rows:
        return None
    rev = list(reversed(rows))
    return {
        'node_id': q.taxonomia_node_id,
        'path': [r.nome for r in rev],
        'is_sintetico_root': rev[0].nome.replace('Direito Administrativo ', '') if rev[0].is_sintetico else None,
    }
```

E em cada questão da resposta:
```python
questao_dict['taxonomia'] = _enrich_taxonomia(q, db)
```

- [ ] **Step 3: Smoke test**

Pega um node_id real:
```sql
SELECT id, nome FROM taxonomia_nodes
WHERE materia_slug = 'direito-administrativo' AND nome LIKE 'Atos Administrativos'
LIMIT 1;
```

Anota o ID, ex: 100.

```bash
curl "http://localhost:8000/api/v1/questoes/search?materia=Direito+Administrativo&node=100" | jq '.total, .questoes[0].taxonomia'
```

Expected: `total > 0`, primeira questão com campo `taxonomia: {node_id: 100, path: [...]}`.

- [ ] **Step 4: Testar bucket "outros"**

```bash
curl "http://localhost:8000/api/v1/questoes/search?materia=Direito+Administrativo&node=outros" | jq '.total'
```

Expected: ~3433.

- [ ] **Step 5: Commit**

```bash
git add app/api/v1/routes/questoes.py
git commit -m "feat(questoes): extender /search com ?node= (filtro hierárquico + bucket outros)"
```

---

## Phase 4 — Frontend

### Task 16: `useMaterias` hook

**Files:**
- Create: `D:/meta novo/Metav2/src/hooks/useMaterias.ts`

- [ ] **Step 1: Implementar hook**

```typescript
import { useQuery } from '@tanstack/react-query';

export type Materia = {
  slug: string;
  nome: string;
  fontes: string[];
  total_nodes: number;
  total_questoes_classificadas: number;
  last_updated: string | null;
};

export function useMaterias() {
  return useQuery<Materia[]>({
    queryKey: ['materias-taxonomia'],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/taxonomia/materias`);
      if (!res.ok) throw new Error('Falha ao carregar matérias');
      return res.json();
    },
    staleTime: 60 * 60 * 1000, // 1h
  });
}

export function useMateriaBySlug(slug: string | undefined) {
  const { data } = useMaterias();
  return data?.find(m => m.slug === slug);
}
```

- [ ] **Step 2: Commit**

```bash
cd "D:/meta novo/Metav2"
git add src/hooks/useMaterias.ts
git commit -m "feat(taxonomia): hook useMaterias"
```

---

### Task 17: `useTaxonomia` hook

**Files:**
- Create: `src/hooks/useTaxonomia.ts`

- [ ] **Step 1: Implementar**

```typescript
import { useQuery } from '@tanstack/react-query';

export type TaxonomiaNode = {
  id: number | string;  // string='outros'
  nome: string;
  hierarquia: string | null;
  is_sintetico: boolean;
  is_virtual: boolean;
  fonte: string | null;
  children: TaxonomiaNode[];
};

export type TaxonomiaTree = {
  materia: string;
  fontes: string[];
  tree: TaxonomiaNode[];
};

export function useTaxonomia(slug: string | null) {
  return useQuery<TaxonomiaTree>({
    queryKey: ['taxonomia-tree', slug],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/taxonomia/${slug}`);
      if (!res.ok) throw new Error('Falha ao carregar árvore');
      return res.json();
    },
    enabled: !!slug,
    staleTime: 60 * 60 * 1000,
  });
}

export function flattenTree(nodes: TaxonomiaNode[]): TaxonomiaNode[] {
  const out: TaxonomiaNode[] = [];
  for (const n of nodes) {
    out.push(n);
    if (n.children?.length) out.push(...flattenTree(n.children));
  }
  return out;
}

export function descendantIds(node: TaxonomiaNode): (number | string)[] {
  const ids: (number | string)[] = [node.id];
  for (const c of node.children || []) ids.push(...descendantIds(c));
  return ids;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useTaxonomia.ts
git commit -m "feat(taxonomia): hook useTaxonomia + flattenTree + descendantIds"
```

---

### Task 18: `useTaxonomiaCounts` hook (com prefetch)

**Files:**
- Create: `src/hooks/useTaxonomiaCounts.ts`

- [ ] **Step 1: Implementar**

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export type CountsBody = {
  banca?: string[];
  ano?: number[];
  tipo?: string[];
  excluir_anuladas?: boolean;
  excluir_desatualizadas?: boolean;
};

const stableKey = (body: CountsBody) => JSON.stringify(body, Object.keys(body).sort());

async function fetchCounts(slug: string, body: CountsBody): Promise<Record<string, number>> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/taxonomia/${slug}/counts`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error('Falha ao buscar counts');
  return res.json();
}

export function useTaxonomiaCounts(slug: string | null, body: CountsBody, enabled: boolean) {
  const key = body && stableKey(body);
  return useQuery<Record<string, number>>({
    queryKey: ['taxonomia-counts', slug, key],
    queryFn: () => fetchCounts(slug!, body),
    enabled: enabled && !!slug,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTaxonomiaCountsPrefetch(slug: string | null, body: CountsBody, enabled: boolean) {
  const qc = useQueryClient();
  const key = body && stableKey(body);
  useEffect(() => {
    if (!enabled || !slug) return;
    qc.prefetchQuery({
      queryKey: ['taxonomia-counts', slug, key],
      queryFn: () => fetchCounts(slug, body),
      staleTime: 5 * 60 * 1000,
    });
  }, [qc, slug, key, enabled, body]);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useTaxonomiaCounts.ts
git commit -m "feat(taxonomia): hook useTaxonomiaCounts + prefetch effect"
```

---

### Task 19: `useTaxonomiaRecentes` (localStorage)

**Files:**
- Create: `src/hooks/useTaxonomiaRecentes.ts`

- [ ] **Step 1: Implementar**

```typescript
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'taxonomia_recentes_v1';
const MAX = 20;

type Recente = { nodeId: number | string; nome: string; ts: number };

function safeRead(): Recente[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function safeWrite(items: Recente[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    // localStorage cheio, evict
    safeWrite(items.slice(0, Math.floor(MAX / 2)));
  }
}

export function useTaxonomiaRecentes() {
  const [items, setItems] = useState<Recente[]>(safeRead);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(safeRead());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const push = useCallback((r: Omit<Recente, 'ts'>) => {
    setItems(prev => {
      const dedup = prev.filter(x => x.nodeId !== r.nodeId);
      const next = [{ ...r, ts: Date.now() }, ...dedup].slice(0, MAX);
      safeWrite(next);
      return next;
    });
  }, []);

  return { items: items.slice(0, 5), push };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useTaxonomiaRecentes.ts
git commit -m "feat(taxonomia): hook useTaxonomiaRecentes (localStorage, top 5)"
```

---

### Task 20: `useNodeChipResolver`

**Files:**
- Create: `src/hooks/useNodeChipResolver.ts`

- [ ] **Step 1: Implementar**

```typescript
import { useTaxonomia, flattenTree, TaxonomiaNode } from './useTaxonomia';
import { useMemo } from 'react';

export type NodeInfo = {
  nome: string;
  path: string[];
  isVirtual: boolean;
};

export function useNodeChipResolver(slug: string | null) {
  const { data } = useTaxonomia(slug);

  return useMemo(() => {
    if (!data) return (id: number | string) => null as NodeInfo | null;

    // Constrói mapa id → path
    const pathMap = new Map<number | string, string[]>();
    const walk = (nodes: TaxonomiaNode[], parentPath: string[]) => {
      for (const n of nodes) {
        const path = [...parentPath, n.nome];
        pathMap.set(n.id, path);
        if (n.children) walk(n.children, path);
      }
    };
    walk(data.tree, []);

    return (id: number | string): NodeInfo | null => {
      const path = pathMap.get(id);
      if (!path) return null;
      const nodes = flattenTree(data.tree);
      const node = nodes.find(n => n.id === id);
      return {
        nome: path[path.length - 1],
        path,
        isVirtual: !!node?.is_virtual,
      };
    };
  }, [data]);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useNodeChipResolver.ts
git commit -m "feat(taxonomia): hook useNodeChipResolver (path lookup pra chips)"
```

---

### Task 21: Adicionar `nodeIds` em `QuestoesContext` + serialize em `useQuestoesV2`

**Files:**
- Modify: `src/contexts/QuestoesContext.tsx`
- Modify: `src/hooks/useQuestoesV2.ts`

- [ ] **Step 1: Escrever teste explícito do bug do GRAN**

Create `src/hooks/__tests__/useQuestoesV2.serialize.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { buildSearchURL } from '../useQuestoesV2';

describe('buildSearchURL', () => {
  it('serializa nodeIds como múltiplos ?node=', () => {
    const url = buildSearchURL({
      materias: ['Direito Administrativo'],
      nodeIds: [101, 102, 'outros'],
    } as any);
    expect(url).toContain('node=101');
    expect(url).toContain('node=102');
    expect(url).toContain('node=outros');
  });

  it('omite ?node= quando nodeIds está vazio', () => {
    const url = buildSearchURL({ materias: ['Direito Administrativo'], nodeIds: [] } as any);
    expect(url).not.toContain('node=');
  });
});
```

- [ ] **Step 2: Modificar `QuestoesContext.tsx`**

Adicionar em `QuestoesFilters` type:
```typescript
type QuestoesFilters = {
  // ... campos existentes ...
  nodeIds: (number | 'outros')[];
};
```

E inicializar em qualquer estado padrão com `nodeIds: []`.

Adicionar setter:
```typescript
setNodeIds: (ids: (number | 'outros')[]) => void;
```

- [ ] **Step 3: Modificar `useQuestoesV2.ts` — função `buildSearchURL` exportada**

Procura a função que monta a URL (`fetchQuestoes` ou similar). Refatora:
```typescript
export function buildSearchURL(params: { filters: QuestoesFilters }): string {
  const sp = new URLSearchParams();
  // ... outros params existentes ...
  if (params.filters.nodeIds?.length) {
    params.filters.nodeIds.forEach(v => sp.append('node', String(v)));
  }
  return `${process.env.NEXT_PUBLIC_API_URL}/api/v1/questoes/search?${sp}`;
}
```

E `fetchQuestoes` deve usar essa função:
```typescript
async function fetchQuestoes(params: { filters: QuestoesFilters }) {
  const url = buildSearchURL(params);
  const res = await fetch(url);
  // ...
}
```

- [ ] **Step 4: Rodar teste — passa**

```bash
npm test -- useQuestoesV2.serialize
```
Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/contexts/QuestoesContext.tsx src/hooks/useQuestoesV2.ts \
        src/hooks/__tests__/useQuestoesV2.serialize.test.ts
git commit -m "feat(questoes): adicionar nodeIds em context + serializar como ?node= na URL"
```

---

### Task 22: `TaxonomiaTreePicker` (componente) — parte 1: estrutura + render básico

**Files:**
- Create: `src/components/questoes/TaxonomiaTreePicker.tsx`

- [ ] **Step 1: Implementar render básico (sem search/recentes ainda)**

```typescript
"use client";
import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useTaxonomia, TaxonomiaNode } from '@/hooks/useTaxonomia';
import { useTaxonomiaCounts, CountsBody } from '@/hooks/useTaxonomiaCounts';

type Props = {
  materiaSlug: string;
  selectedIds: (number | 'outros')[];
  onToggle: (id: number | 'outros') => void;
  countsBody: CountsBody;
};

export function TaxonomiaTreePicker({ materiaSlug, selectedIds, onToggle, countsBody }: Props) {
  const { data, isLoading } = useTaxonomia(materiaSlug);
  const { data: counts } = useTaxonomiaCounts(
    materiaSlug, countsBody,
    Object.keys(countsBody).length > 0
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Federal expandido por default
    return new Set();
  });

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Carregando...</div>;
  if (!data) return null;

  return (
    <div className="max-h-[500px] overflow-y-auto p-2">
      {data.tree.map(node => (
        <NodeRow
          key={node.id}
          node={node}
          depth={0}
          expanded={expandedIds}
          onToggleExpand={(id) => setExpandedIds(prev => {
            const next = new Set(prev);
            const k = String(id);
            if (next.has(k)) next.delete(k); else next.add(k);
            return next;
          })}
          selectedIds={selectedIds}
          onSelect={onToggle}
          counts={counts}
        />
      ))}
    </div>
  );
}

type NodeRowProps = {
  node: TaxonomiaNode;
  depth: number;
  expanded: Set<string>;
  onToggleExpand: (id: number | string) => void;
  selectedIds: (number | 'outros')[];
  onSelect: (id: number | 'outros') => void;
  counts?: Record<string, number>;
};

function NodeRow({ node, depth, expanded, onToggleExpand, selectedIds, onSelect, counts }: NodeRowProps) {
  const hasChildren = node.children?.length > 0;
  const isExpanded = expanded.has(String(node.id)) || (node.is_sintetico && node.fonte === 'sintetico' && depth === 0 && node.nome.endsWith('Federal'));
  const isSelected = selectedIds.includes(node.id as any);
  const count = counts?.[String(node.id)];

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer text-sm`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button onClick={() => onToggleExpand(node.id)} aria-label="Expandir" className="shrink-0">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-[14px]" />
        )}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(node.id as any)}
          onClick={e => e.stopPropagation()}
        />
        <span className={`flex-1 truncate ${node.is_sintetico ? 'font-medium' : ''}`}
              title={node.nome}>
          {node.is_sintetico ? '📁 ' : ''}{node.nome}
        </span>
        {count !== undefined && (
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {count.toLocaleString('pt-BR')}
          </span>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <NodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              selectedIds={selectedIds}
              onSelect={onSelect}
              counts={counts}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/questoes/TaxonomiaTreePicker.tsx
git commit -m "feat(taxonomia): TaxonomiaTreePicker — render hierárquico + counts"
```

---

### Task 23: `TaxonomiaTreePicker` parte 2 — search com fuse.js

**Files:**
- Modify: `src/components/questoes/TaxonomiaTreePicker.tsx`

- [ ] **Step 1: Verificar que `fuse.js` está instalado**

```bash
cd "D:/meta novo/Metav2"
npm list fuse.js || npm install fuse.js
```

- [ ] **Step 2: Adicionar search no topo do componente**

Modify `TaxonomiaTreePicker.tsx`. Adiciona import:
```typescript
import Fuse from 'fuse.js';
import { Search } from 'lucide-react';
import { flattenTree } from '@/hooks/useTaxonomia';
```

E no início do componente, antes do return:
```typescript
const [query, setQuery] = useState('');

const fuse = useMemo(() => {
  if (!data) return null;
  const items = flattenTree(data.tree)
    .filter(n => !n.is_sintetico && !n.is_virtual);
  return new Fuse(items, {
    keys: ['nome', 'hierarquia'],
    threshold: 0.3,
    minMatchCharLength: 2,
  });
}, [data]);

const matchedIds = useMemo(() => {
  if (!fuse || !query.trim()) return null;
  const results = fuse.search(query);
  return new Set(results.map(r => r.item.id));
}, [fuse, query]);

// expande automaticamente os ancestrais dos matches
const autoExpandedIds = useMemo(() => {
  if (!matchedIds || !data) return new Set<string>();
  const set = new Set<string>();
  const findAncestors = (nodes: TaxonomiaNode[], targetId: number | string, ancestors: (number|string)[]): boolean => {
    for (const n of nodes) {
      if (n.id === targetId) {
        ancestors.forEach(a => set.add(String(a)));
        return true;
      }
      if (n.children && findAncestors(n.children, targetId, [...ancestors, n.id])) return true;
    }
    return false;
  };
  matchedIds.forEach(id => findAncestors(data.tree, id, []));
  return set;
}, [matchedIds, data]);

const effectiveExpanded = useMemo(() =>
  new Set([...expandedIds, ...autoExpandedIds]),
  [expandedIds, autoExpandedIds]);
```

E o JSX antes da árvore:
```tsx
<div className="px-2 pb-2">
  <div className="relative">
    <Search size={14} className="absolute left-2 top-2 text-muted-foreground" />
    <input
      type="search"
      placeholder="Buscar tópico..."
      value={query}
      onChange={e => setQuery(e.target.value)}
      className="w-full pl-7 pr-2 py-1.5 text-sm border rounded"
    />
  </div>
</div>
```

E passa `effectiveExpanded` (em vez de `expandedIds`) e adiciona prop `matchedIds` no NodeRow pra estilizar matches (opcional).

- [ ] **Step 3: Smoke test no dev server**

```bash
npm run dev
```

Manual: buscar "Atos" deve filtrar e expandir paths.

- [ ] **Step 4: Commit**

```bash
git add src/components/questoes/TaxonomiaTreePicker.tsx
git commit -m "feat(taxonomia): TreePicker — search com fuse.js (auto-expande ancestrais)"
```

---

### Task 24: `TaxonomiaTreePicker` parte 3 — recentes + "esconder zeros"

**Files:**
- Modify: `src/components/questoes/TaxonomiaTreePicker.tsx`

- [ ] **Step 1: Adicionar Recentes section**

Importar:
```typescript
import { useTaxonomiaRecentes } from '@/hooks/useTaxonomiaRecentes';
```

Dentro do componente:
```typescript
const { items: recentes, push: pushRecente } = useTaxonomiaRecentes();
const [hideZeros, setHideZeros] = useState(true);

const handleSelect = (id: number | 'outros') => {
  onToggle(id);
  // adiciona aos recentes
  if (data) {
    const node = flattenTree(data.tree).find(n => n.id === id);
    if (node) pushRecente({ nodeId: id, nome: node.nome });
  }
};
```

E renderiza Recentes acima da árvore:
```tsx
{recentes.length > 0 && !query && (
  <div className="px-2 pb-2 border-b">
    <div className="text-xs text-muted-foreground mb-1">Recentes:</div>
    {recentes.map(r => (
      <div
        key={String(r.nodeId)}
        className="text-xs py-0.5 cursor-pointer hover:underline"
        onClick={() => handleSelect(r.nodeId)}
      >
        • {r.nome}
      </div>
    ))}
  </div>
)}
```

E toggle "esconder zeros" no header:
```tsx
<div className="px-2 pb-2 flex items-center justify-between text-xs">
  <span>{data.tree.length} grupos</span>
  <label className="flex items-center gap-1 cursor-pointer">
    <input type="checkbox" checked={hideZeros} onChange={e => setHideZeros(e.target.checked)} />
    Esconder vazios
  </label>
</div>
```

E filtra na render:
```typescript
const shouldShow = (node: TaxonomiaNode): boolean => {
  if (!hideZeros || !counts) return true;
  if (matchedIds && matchedIds.has(node.id)) return true;
  // tem filhos com count?
  const total = sumDescendantCounts(node, counts);
  return total > 0;
};

function sumDescendantCounts(node: TaxonomiaNode, counts: Record<string, number>): number {
  return counts[String(node.id)] ?? 0;
}
```

E em NodeRow, filtra children:
```tsx
{hasChildren && isExpanded && (
  <div>
    {node.children.filter(shouldShow).map(child => (
      <NodeRow ... />
    ))}
  </div>
)}
```

E na lista raiz:
```tsx
{data.tree.filter(shouldShow).map(node => ...)}
```

- [ ] **Step 2: Trocar `onToggle` no parent pra `handleSelect`**

```tsx
selectedIds={selectedIds}
onSelect={handleSelect}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/questoes/TaxonomiaTreePicker.tsx
git commit -m "feat(taxonomia): TreePicker — recentes + toggle esconder zeros"
```

---

### Task 25: Integração em `QuestoesFilterPopover`

**Files:**
- Modify: `src/components/questoes/QuestoesFilterPopover.tsx`

- [ ] **Step 1: Detectar matéria com taxonomia e renderizar Picker**

Importa:
```typescript
import { useMaterias } from '@/hooks/useMaterias';
import { TaxonomiaTreePicker } from './TaxonomiaTreePicker';
```

Substituir o conteúdo da pill "Assuntos" (achar onde está):
```typescript
const { data: materias } = useMaterias();
const materiaSelecionada = filters.materias[0];
const materiaSlug = materias?.find(m => m.nome === materiaSelecionada)?.slug;
const hasTaxonomia = !!materiaSlug;

// dentro do popover de "Assuntos":
{hasTaxonomia ? (
  <TaxonomiaTreePicker
    materiaSlug={materiaSlug!}
    selectedIds={filters.nodeIds}
    onToggle={(id) => {
      const next = filters.nodeIds.includes(id)
        ? filters.nodeIds.filter(x => x !== id)
        : [...filters.nodeIds, id];
      setFilter('nodeIds', next);
    }}
    countsBody={{
      banca: filters.bancas,
      ano: filters.anos,
      excluir_anuladas: filters.excluirAnuladas,
      excluir_desatualizadas: filters.excluirDesatualizadas,
    }}
  />
) : (
  <FlatListAssuntosLegacy /> /* componente existente */
)}
```

- [ ] **Step 2: Smoke test no dev server**

```bash
npm run dev
```

Manual:
1. Login → Questões
2. Selecionar "Direito Administrativo" → abrir Assuntos
3. ✓ TreePicker aparece (não FlatList)
4. Selecionar "Português" → abrir Assuntos
5. ✓ FlatList legacy aparece (Português não tem taxonomia)

- [ ] **Step 3: Commit**

```bash
git add src/components/questoes/QuestoesFilterPopover.tsx
git commit -m "feat(taxonomia): integrar TreePicker no popover quando matéria tem taxonomia"
```

---

### Task 26: Chips de tópico em `FilterChipsBidirectional`

**Files:**
- Modify: `src/components/questoes/FilterChipsBidirectional.tsx`

- [ ] **Step 1: Adicionar chips de tópico**

Importa:
```typescript
import { useNodeChipResolver } from '@/hooks/useNodeChipResolver';
import { useMateriaBySlug, useMaterias } from '@/hooks/useMaterias';
```

Dentro do componente:
```typescript
const { data: materias } = useMaterias();
const slug = materias?.find(m => m.nome === filters.materias[0])?.slug ?? null;
const resolver = useNodeChipResolver(slug);

// Chips de tópico
{filters.nodeIds.map(id => {
  const info = resolver(id);
  if (!info) return null;
  return (
    <Chip
      key={String(id)}
      label={info.nome}
      tooltip={info.path.join(' › ')}
      variant="taxonomia"
      onRemove={() => setFilter('nodeIds', filters.nodeIds.filter(x => x !== id))}
    />
  );
})}
```

(Adapta ao componente Chip real do projeto.)

- [ ] **Step 2: Smoke test**

Manual: marca um nó no picker → ✓ chip aparece com tooltip do path completo no hover.

- [ ] **Step 3: Commit**

```bash
git add src/components/questoes/FilterChipsBidirectional.tsx
git commit -m "feat(taxonomia): chips de tópico com tooltip de path completo"
```

---

## Phase 5 — Validação end-to-end

### Task 27: [CHECKPOINT] Aldemir percorre checklist e2e

**Files:** none

- [ ] **Step 1: Subir backend (em túnel ou prod) e frontend dev**

```bash
# Backend (verus_api)
cd C:/Users/Home/Desktop/verus_api
DATABASE_URL="postgresql://USER:PASS@localhost:5433/postgres" uvicorn app.main:app --reload

# Frontend (Metav2)
cd "D:/meta novo/Metav2"
npm run dev
```

- [ ] **Step 2: Percorrer checklist do spec**

Reproduzir literalmente o checklist da seção "Testing → End-to-end manual" do spec:

```
1. Login → Questões → "Direito Administrativo"
   ✓ Pill "Assuntos" abre TreePicker (não FlatList)

2. ✓ 4 grupos L0 visíveis: Federal (~137k), Estadual (~13k), Municipal (~463), Outros (~3.4k)
   ✓ Federal expandido, demais colapsados

3. Marca "03. Atos Administrativos"
   ✓ Chip aparece, URL ganha "?node=<id>", lista filtra
   ✓ Tooltip do chip: "Direito Administrativo Federal › Atos Administrativos"

4. Adiciona "11. Improbidade Administrativa"
   ✓ Segundo chip, lista vira OR dos dois

5. Filtro Banca = CESPE
   ✓ Counts no picker atualizam (pulse opcional)

6. Marca "Direito Administrativo Estadual"
   ✓ Filtra ~13k questões com assunto estadual

7. Marca "Outros / Sem classificação"
   ✓ Filtra 3.4k órfãs

8. Recarrega página
   ✓ Recentes persistem (localStorage)

9. Search "Atos Administrativos"
   ✓ Mostra "03. Atos Administrativos" + "Conceito de Atos Administrativos" + ...

10. Performance:
    ✓ Tree carrega em <300ms
    ✓ Counts atualizam em <500ms
    ✓ Filtro de questões responde em <800ms

11. Mobile DevTools (iPhone SE):
    ✓ Picker como bottom sheet
    ✓ Scroll funciona, search responde

12. Logout/login com filtros ativos
    ✓ URL ?node= é restaurada e filtra corretamente
```

- [ ] **Step 3: Se algum check falhar, abrir issue dedicada**

Não force a correção dentro deste plano — abre issue, decide prioridade. Esta é a defesa contra "muita questão nada haver" do GRAN.

- [ ] **Step 4: Quando tudo verde, mergear**

```bash
# verus_api
cd C:/Users/Home/Desktop/verus_api
git checkout main
git merge --no-ff feat/taxonomia-tec-dir-adm
git push origin main

# Metav2
cd "D:/meta novo/Metav2"
git checkout main
git merge --no-ff feat/taxonomia-tec-dir-adm
git push origin main
```

- [ ] **Step 5: Deploy**

- Coolify: trigger deploy automático ao push em main (ou manual via painel)
- Verifica logs por 5 min após deploy

- [ ] **Step 6: Smoke test pós-deploy em prod**

```bash
curl -I https://api.projetopapiro.com.br/api/v1/taxonomia/materias
curl https://api.projetopapiro.com.br/api/v1/taxonomia/direito-administrativo | jq '.tree | length'
curl -X POST https://api.projetopapiro.com.br/api/v1/taxonomia/direito-administrativo/counts \
    -d '{"banca":["CEBRASPE (CESPE)"]}' \
    -H "Content-Type: application/json" | jq 'length'
```

Expected: 200 / 4 raízes / count >= 100.
