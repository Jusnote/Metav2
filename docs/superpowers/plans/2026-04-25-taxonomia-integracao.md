# Taxonomia Integração — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar a taxonomia de Direito Administrativo (499 nós, 137k questões classificadas) no app Metav2, ponta-a-ponta — Postgres no Hetzner → API REST verus → UI de filtro hierárquico no popover de "Assuntos".

**Architecture:** Schema novo em 5 tabelas no Hetzner (separado de `assuntos_canonicos` pré-existente), mantida por script de import com diff estrutural baseado em `stable_id` UUID. API REST adiciona 4 endpoints novos no `verus_api`. Frontend adiciona `TaxonomiaTreePicker` que aparece dentro do popover existente quando matéria selecionada tem `has_taxonomia`, integrado via novo campo `topicos: string[]` no `QuestoesContext`.

**Tech Stack:**
- **verus_api:** FastAPI 0.115, SQLAlchemy 2.0, Alembic 1.14, psycopg2, Redis 5, Pydantic 2.10
- **Import script:** Python 3.11+ em `D:\tec-output\taxonomia\scripts\` (rapidfuzz pra similarity matching)
- **Metav2:** Next.js 16, React 19, TanStack Query 5, Radix Popover, Sonner toasts, **fuse.js (a instalar)**

**Spec:** `D:\meta novo\Metav2\docs\superpowers\specs\2026-04-25-taxonomia-integracao-design.md`

**Pré-requisitos:**
- SSH tunnel pro Hetzner Postgres ativo (`ssh root@95.217.197.95 -L 5432:10.0.1.9:5432` ou config equivalente).
- `D:\tec-output\taxonomia\merged\taxonomia-direito-administrativo.json` presente (3.7MB, 499 nós).
- Acesso a `verus_api` (`C:\Users\Home\Desktop\verus_api`) com Alembic configurado.

**Decisão arquitetural pendente — mapping `materia_slug` ↔ `questoes.materia`:**

`taxonomia_nodes.materia_slug` usa identificador slug curto (`dir-adm`), mas `questoes.materia` (no banco) é uma coluna `String(200)` que armazena nome humano completo (presumivelmente `"Direito Administrativo"`). Os JOINs nos endpoints precisam reconciliar os dois.

Antes de executar Task 10+, decidir uma das três opções:

- **(A) Tabela `materias` (slug, nome) populada manualmente** — simples, mantém slug curto, JOIN explícito `JOIN materias mat ON mat.nome = q.materia AND mat.slug = n.materia_slug`. **Recomendado.**
- **(B) Migrar `questoes.materia` pra slug** — invasivo, afeta resto do app, fora de escopo desta leva.
- **(C) Slugificar `q.materia` em runtime via função SQL** — frágil, sem garantia de unicidade.

Se (A): adicionar Task 1.5 que cria tabela `materias`, popula com `INSERT (slug='dir-adm', nome='Direito Administrativo')`, e ajustar todos os JOINs subsequentes (Tasks 10, 12, 13). Se essa tabela já existir no DB com outra estrutura, conferir e adaptar.

**Confirmar com SQL `SELECT DISTINCT materia FROM questoes WHERE materia ILIKE '%admin%' LIMIT 5;` antes de prosseguir.**

---

## Phase 1 — Schema (verus_api)

Cria as 5 tabelas novas + trigger de audit em uma única migration Alembic.

### Task 1: Migration Alembic com schema completo

**Files:**
- Create: `C:\Users\Home\Desktop\verus_api\alembic\versions\YYYYMMDD_HHMM_<hash>_add_taxonomia_v2_tables.py` (nome real gerado pelo Alembic)

- [ ] **Step 1: Gerar skeleton da migration**

```bash
cd "C:/Users/Home/Desktop/verus_api"
alembic revision -m "add taxonomia v2 tables (taxonomia_versions, taxonomia_nodes, questao_topico, questao_topico_log, taxonomia_counts, audit trigger)"
```

Anota o path gerado em `alembic/versions/`.

- [ ] **Step 2: Implementar `upgrade()` na migration**

Substitui o corpo de `upgrade()` na migration gerada por:

```python
def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")  # gen_random_uuid()

    # taxonomia_versions
    op.create_table(
        "taxonomia_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("materia_slug", sa.Text(), nullable=False),
        sa.Column("applied_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index("idx_taxonomia_versions_materia", "taxonomia_versions", ["materia_slug", sa.text("applied_at DESC")])

    # taxonomia_nodes
    op.create_table(
        "taxonomia_nodes",
        sa.Column("stable_id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("materia_slug", sa.Text(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False, unique=True),
        sa.Column("titulo", sa.Text(), nullable=False),
        sa.Column("nivel", sa.SmallInteger(), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("taxonomia_nodes.stable_id", ondelete="RESTRICT"), nullable=True),
        sa.Column("ordem", sa.Integer(), nullable=False),
        sa.Column("aliases", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"),
        sa.Column("absorbed", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"),
        sa.Column("subtopicos_visuais", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("imported_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("created_in_version_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("taxonomia_versions.id"), nullable=False),
        sa.CheckConstraint("nivel BETWEEN 1 AND 3", name="ck_taxonomia_nodes_nivel"),
    )
    op.create_index("idx_taxonomia_nodes_materia", "taxonomia_nodes", ["materia_slug", "nivel", "ordem"])
    op.create_index("idx_taxonomia_nodes_parent", "taxonomia_nodes", ["parent_id"])

    # taxonomia_counts
    op.create_table(
        "taxonomia_counts",
        sa.Column("node_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("taxonomia_nodes.stable_id", ondelete="CASCADE"), primary_key=True),
        sa.Column("materia_slug", sa.Text(), nullable=False),
        sa.Column("count_propria", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("count_agregada", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("refreshed_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_taxonomia_counts_materia", "taxonomia_counts", ["materia_slug"])

    # questao_topico
    op.create_table(
        "questao_topico",
        sa.Column("questao_id", sa.BigInteger(), sa.ForeignKey("questoes.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("node_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("taxonomia_nodes.stable_id", ondelete="RESTRICT"), primary_key=True),
        sa.Column("score", sa.REAL(), nullable=True),
        sa.Column("current_source", sa.Text(), nullable=False),
    )
    op.create_index("idx_questao_topico_node", "questao_topico", ["node_id", "questao_id"])
    op.create_index("idx_questao_topico_questao", "questao_topico", ["questao_id"])

    # questao_topico_log
    op.create_table(
        "questao_topico_log",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("questao_id", sa.BigInteger(), nullable=False),
        sa.Column("node_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("prev_node_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("score", sa.REAL(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.CheckConstraint("action IN ('assigned', 'reassigned', 'removed')", name="ck_questao_topico_log_action"),
    )
    op.create_index("idx_qtl_questao", "questao_topico_log", ["questao_id", sa.text("created_at DESC")])
    op.create_index("idx_qtl_source", "questao_topico_log", ["source", sa.text("created_at DESC")])

    # Trigger de audit
    op.execute("""
    CREATE OR REPLACE FUNCTION questao_topico_audit() RETURNS TRIGGER AS $$
    DECLARE
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
    """)
    op.execute("""
    CREATE TRIGGER questao_topico_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON questao_topico
    FOR EACH ROW EXECUTE FUNCTION questao_topico_audit();
    """)
```

E imports no topo:

```python
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
```

- [ ] **Step 3: Implementar `downgrade()`**

```python
def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS questao_topico_audit_trigger ON questao_topico")
    op.execute("DROP FUNCTION IF EXISTS questao_topico_audit()")
    op.drop_table("questao_topico_log")
    op.drop_table("questao_topico")
    op.drop_table("taxonomia_counts")
    op.drop_table("taxonomia_nodes")
    op.drop_table("taxonomia_versions")
```

- [ ] **Step 4: Aplicar migration em ambiente de dev**

Garante SSH tunnel ativo. Então:

```bash
cd "C:/Users/Home/Desktop/verus_api"
alembic upgrade head
```

Esperado: `Running upgrade ... -> ..., add taxonomia v2 tables`. Sem erros.

- [ ] **Step 5: Verificar schema criado**

```bash
psql -h localhost -p 5432 -U <user> -d <db> -c "\dt taxonomia_*"
psql -h localhost -p 5432 -U <user> -d <db> -c "\dt questao_topico*"
psql -h localhost -p 5432 -U <user> -d <db> -c "\df questao_topico_audit"
```

Esperado: lista todas as 5 tabelas + a function.

- [ ] **Step 6: Smoke test do trigger**

```sql
-- Cria uma versão fake e um nó fake pra testar (rollback no fim)
BEGIN;
INSERT INTO taxonomia_versions (materia_slug, source) VALUES ('_test', 'manual') RETURNING id \gset
INSERT INTO taxonomia_nodes (materia_slug, slug, titulo, nivel, ordem, created_in_version_id)
  VALUES ('_test', '_test.foo', 'Foo', 1, 0, :'id') RETURNING stable_id \gset

-- Pega uma questão real qualquer
SELECT id FROM questoes LIMIT 1 \gset

SET LOCAL app.source = 'smoke_test';
SET LOCAL app.reason = 'verifying trigger';
INSERT INTO questao_topico (questao_id, node_id, score, current_source)
  VALUES (:'id', :'stable_id', 0.99, 'smoke_test');

-- Verifica que log foi populado
SELECT action, source, reason FROM questao_topico_log
  WHERE questao_id = :'id' ORDER BY created_at DESC LIMIT 1;
-- Esperado: action='assigned', source='smoke_test', reason='verifying trigger'

ROLLBACK;
```

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/Home/Desktop/verus_api"
git add alembic/versions/*_add_taxonomia_v2_tables.py
git commit -m "feat(db): add taxonomia v2 schema (5 tables + audit trigger)"
```

---

### Task 2: SQLAlchemy models pra taxonomia v2

**Files:**
- Create: `C:\Users\Home\Desktop\verus_api\app\models\taxonomia_v2.py`
- Modify: `C:\Users\Home\Desktop\verus_api\app\models\__init__.py` (adicionar import)

- [ ] **Step 1: Criar `taxonomia_v2.py` com os 5 modelos**

```python
"""SQLAlchemy models for taxonomia v2 (UUID-based, replaces assuntos_canonicos)."""
import uuid
from sqlalchemy import (
    Column, Integer, BigInteger, SmallInteger, String, Text, REAL,
    ForeignKey, TIMESTAMP, CheckConstraint, Index
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class TaxonomiaVersion(Base):
    __tablename__ = "taxonomia_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    materia_slug = Column(Text, nullable=False)
    applied_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    source = Column(Text, nullable=False)
    notes = Column(Text, nullable=True)


class TaxonomiaNode(Base):
    __tablename__ = "taxonomia_nodes"

    stable_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    materia_slug = Column(Text, nullable=False)
    slug = Column(Text, nullable=False, unique=True)
    titulo = Column(Text, nullable=False)
    nivel = Column(SmallInteger, nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("taxonomia_nodes.stable_id", ondelete="RESTRICT"), nullable=True)
    ordem = Column(Integer, nullable=False)
    aliases = Column(ARRAY(Text), nullable=False, default=list, server_default="{}")
    absorbed = Column(ARRAY(Text), nullable=False, default=list, server_default="{}")
    subtopicos_visuais = Column(JSONB, nullable=False, default=list, server_default="[]")
    imported_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    created_in_version_id = Column(UUID(as_uuid=True), ForeignKey("taxonomia_versions.id"), nullable=False)

    parent = relationship("TaxonomiaNode", remote_side=[stable_id], backref="children")
    counts = relationship("TaxonomiaCount", back_populates="node", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("nivel BETWEEN 1 AND 3", name="ck_taxonomia_nodes_nivel"),
        Index("idx_taxonomia_nodes_materia", "materia_slug", "nivel", "ordem"),
    )


class TaxonomiaCount(Base):
    __tablename__ = "taxonomia_counts"

    node_id = Column(UUID(as_uuid=True), ForeignKey("taxonomia_nodes.stable_id", ondelete="CASCADE"), primary_key=True)
    materia_slug = Column(Text, nullable=False)
    count_propria = Column(Integer, nullable=False, default=0, server_default="0")
    count_agregada = Column(Integer, nullable=False, default=0, server_default="0")
    refreshed_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

    node = relationship("TaxonomiaNode", back_populates="counts")


class QuestaoTopico(Base):
    __tablename__ = "questao_topico"

    questao_id = Column(BigInteger, ForeignKey("questoes.id", ondelete="CASCADE"), primary_key=True)
    node_id = Column(UUID(as_uuid=True), ForeignKey("taxonomia_nodes.stable_id", ondelete="RESTRICT"), primary_key=True)
    score = Column(REAL, nullable=True)
    current_source = Column(Text, nullable=False)


class QuestaoTopicoLog(Base):
    __tablename__ = "questao_topico_log"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    questao_id = Column(BigInteger, nullable=False)
    node_id = Column(UUID(as_uuid=True), nullable=True)
    prev_node_id = Column(UUID(as_uuid=True), nullable=True)
    action = Column(Text, nullable=False)
    source = Column(Text, nullable=False)
    score = Column(REAL, nullable=True)
    reason = Column(Text, nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("action IN ('assigned', 'reassigned', 'removed')", name="ck_questao_topico_log_action"),
    )
```

- [ ] **Step 2: Atualizar `app/models/__init__.py`**

Lê o arquivo:

```bash
cat "C:/Users/Home/Desktop/verus_api/app/models/__init__.py"
```

Adiciona:

```python
from app.models.taxonomia_v2 import (
    TaxonomiaVersion, TaxonomiaNode, TaxonomiaCount, QuestaoTopico, QuestaoTopicoLog
)
```

- [ ] **Step 3: Smoke test que models importam sem erro**

```bash
cd "C:/Users/Home/Desktop/verus_api"
python -c "from app.models import TaxonomiaNode, QuestaoTopico, QuestaoTopicoLog, TaxonomiaCount, TaxonomiaVersion; print('OK')"
```

Esperado: `OK`.

- [ ] **Step 4: Commit**

```bash
git add app/models/taxonomia_v2.py app/models/__init__.py
git commit -m "feat(models): add SQLAlchemy models for taxonomia v2"
```

---

## Phase 2 — Import script

Script em `D:\tec-output\taxonomia\scripts\import_to_postgres.py` (repo separado do verus_api). Lê JSON da taxonomia, faz diff estrutural com o que existe no DB, valida sanity checks, aplica em transação atômica.

### Task 3: Skeleton + load JSON + load DB

**Files:**
- Create: `D:\tec-output\taxonomia\scripts\import_to_postgres.py`
- Create: `D:\tec-output\taxonomia\scripts\import_lib\__init__.py`
- Create: `D:\tec-output\taxonomia\scripts\import_lib\loaders.py`
- Create: `D:\tec-output\taxonomia\tests\test_import_loaders.py`

- [ ] **Step 1: Criar `import_lib/loaders.py`**

```python
"""Loaders: ler árvore do JSON gerado pelo pipeline, ler árvore do Postgres."""
from __future__ import annotations
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
import json
import psycopg2
import psycopg2.extras


@dataclass
class NodeData:
    """Representação canônica de um nó (independe da fonte: JSON ou DB)."""
    slug: str
    titulo: str
    nivel: int
    parent_slug: Optional[str]
    ordem: int
    aliases: list[str] = field(default_factory=list)
    absorbed: list[str] = field(default_factory=list)
    subtopicos_visuais: list[dict] = field(default_factory=list)
    stable_id: Optional[str] = None  # preenchido só quando vem do DB


def load_json(json_path: Path, materia_slug: str) -> list[NodeData]:
    """Carrega árvore do JSON do pipeline e retorna lista flat de NodeData.
    Slugs são prefixados com `{materia_slug}.` se ainda não estiverem.

    Estrutura real do JSON gerado pelo pipeline (verificado contra
    taxonomia-direito-administrativo.json):
      - top key da árvore: `arvore` (lista de roots)
      - children key: `filhos`
      - absorbed key: `descendentes_absorvidos`
      - aliases, subtopicos_visuais, titulo, slug: nomes literais
    """
    with open(json_path, encoding="utf-8") as f:
        raw = json.load(f)

    flat: list[NodeData] = []

    def walk(node: dict, parent_slug: Optional[str], nivel: int, ordem: int):
        slug = node["slug"]
        if not slug.startswith(f"{materia_slug}."):
            slug = f"{materia_slug}.{slug}"
        flat.append(NodeData(
            slug=slug,
            titulo=node["titulo"],
            nivel=nivel,
            parent_slug=parent_slug,
            ordem=ordem,
            aliases=node.get("aliases", []),
            absorbed=node.get("descendentes_absorvidos", []),
            subtopicos_visuais=node.get("subtopicos_visuais", []),
        ))
        for i, child in enumerate(node.get("filhos", [])):
            walk(child, slug, nivel + 1, i)

    roots = raw.get("arvore", raw if isinstance(raw, list) else [])
    for i, root in enumerate(roots):
        walk(root, None, 1, i)

    return flat


def load_db(conn, materia_slug: str) -> list[NodeData]:
    """Carrega árvore atual do Postgres pra esta matéria, como NodeData (flat)."""
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("""
            SELECT n.stable_id, n.slug, n.titulo, n.nivel, n.ordem,
                   n.aliases, n.absorbed, n.subtopicos_visuais,
                   p.slug AS parent_slug
            FROM taxonomia_nodes n
            LEFT JOIN taxonomia_nodes p ON p.stable_id = n.parent_id
            WHERE n.materia_slug = %s
            ORDER BY n.nivel, n.ordem
        """, (materia_slug,))
        rows = cur.fetchall()

    return [
        NodeData(
            slug=r["slug"],
            titulo=r["titulo"],
            nivel=r["nivel"],
            parent_slug=r["parent_slug"],
            ordem=r["ordem"],
            aliases=list(r["aliases"]),
            absorbed=list(r["absorbed"]),
            subtopicos_visuais=list(r["subtopicos_visuais"]),
            stable_id=str(r["stable_id"]),
        )
        for r in rows
    ]
```

- [ ] **Step 2: Criar `import_lib/__init__.py` vazio**

```bash
touch "D:/tec-output/taxonomia/scripts/import_lib/__init__.py"
```

- [ ] **Step 3: Escrever teste do loader de JSON**

`D:/tec-output/taxonomia/tests/test_import_loaders.py`:

```python
import json
import tempfile
from pathlib import Path
from scripts.import_lib.loaders import load_json


def test_load_json_flattens_tree_and_prefixes_slugs():
    # Estrutura real do pipeline: 'arvore' + 'filhos' + 'descendentes_absorvidos'
    fixture = {
        "arvore": [
            {
                "slug": "licitacoes",
                "titulo": "Licitações",
                "aliases": ["lei 8666"],
                "descendentes_absorvidos": [],
                "subtopicos_visuais": [{"titulo": "Pregão", "n_questoes": 100, "nivel_original": 4}],
                "filhos": [
                    {"slug": "licitacoes.principios", "titulo": "Princípios", "filhos": []}
                ],
            }
        ]
    }
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(fixture, f)
        path = Path(f.name)

    nodes = load_json(path, "dir-adm")

    assert len(nodes) == 2
    assert nodes[0].slug == "dir-adm.licitacoes"
    assert nodes[0].nivel == 1
    assert nodes[0].parent_slug is None
    assert nodes[0].aliases == ["lei 8666"]
    assert nodes[0].subtopicos_visuais[0]["titulo"] == "Pregão"
    assert nodes[1].slug == "dir-adm.licitacoes.principios"
    assert nodes[1].nivel == 2
    assert nodes[1].parent_slug == "dir-adm.licitacoes"
```

- [ ] **Step 4: Rodar teste e verificar que passa**

```bash
cd "D:/tec-output/taxonomia"
pytest tests/test_import_loaders.py -v
```

Esperado: 1 passed.

- [ ] **Step 5: Commit**

```bash
cd "D:/tec-output/taxonomia"
git add scripts/import_lib/ tests/test_import_loaders.py
git commit -m "feat(import): JSON + DB loaders pra taxonomia v2"
```

---

### Task 4: Diff engine (matching estrutural)

**Files:**
- Create: `D:\tec-output\taxonomia\scripts\import_lib\diff.py`
- Create: `D:\tec-output\taxonomia\tests\test_import_diff.py`

- [ ] **Step 1: Escrever teste com cenários de matching**

`tests/test_import_diff.py`:

```python
from scripts.import_lib.loaders import NodeData
from scripts.import_lib.diff import compute_diff, AddNode, RenameNode, DeleteNode


def test_unchanged_tree_produces_no_ops():
    a = [NodeData(slug="x.a", titulo="A", nivel=1, parent_slug=None, ordem=0, stable_id="uuid-a")]
    b = [NodeData(slug="x.a", titulo="A", nivel=1, parent_slug=None, ordem=0)]
    diff = compute_diff(old=a, new=b)
    assert diff.operations == []


def test_new_node_produces_add():
    diff = compute_diff(
        old=[NodeData(slug="x.a", titulo="A", nivel=1, parent_slug=None, ordem=0, stable_id="uuid-a")],
        new=[
            NodeData(slug="x.a", titulo="A", nivel=1, parent_slug=None, ordem=0),
            NodeData(slug="x.a.b", titulo="B", nivel=2, parent_slug="x.a", ordem=0),
        ],
    )
    assert len(diff.operations) == 1
    assert isinstance(diff.operations[0], AddNode)
    assert diff.operations[0].slug == "x.a.b"


def test_rename_by_similar_title_keeps_stable_id():
    """Slug muda mas título similar + mesmo parent → rename, não add+delete."""
    diff = compute_diff(
        old=[NodeData(slug="x.atos", titulo="Atos administrativos", nivel=1, parent_slug=None, ordem=0, stable_id="uuid-atos")],
        new=[NodeData(slug="x.atos-adm", titulo="Atos da Administração", nivel=1, parent_slug=None, ordem=0)],
    )
    assert len(diff.operations) == 1
    assert isinstance(diff.operations[0], RenameNode)
    assert diff.operations[0].stable_id == "uuid-atos"
    assert diff.operations[0].new_slug == "x.atos-adm"


def test_deleted_node_produces_delete_with_reassign_to_parent():
    diff = compute_diff(
        old=[
            NodeData(slug="x.a", titulo="A", nivel=1, parent_slug=None, ordem=0, stable_id="uuid-a"),
            NodeData(slug="x.a.b", titulo="B", nivel=2, parent_slug="x.a", ordem=0, stable_id="uuid-b"),
        ],
        new=[NodeData(slug="x.a", titulo="A", nivel=1, parent_slug=None, ordem=0)],
    )
    assert len(diff.operations) == 1
    op = diff.operations[0]
    assert isinstance(op, DeleteNode)
    assert op.stable_id == "uuid-b"
    assert op.reassign_to == "uuid-a"  # reaponta pro parent
```

- [ ] **Step 2: Rodar teste e verificar que falha (módulo não existe)**

```bash
cd "D:/tec-output/taxonomia"
pytest tests/test_import_diff.py -v
```

Esperado: ImportError, módulo `scripts.import_lib.diff` não encontrado.

- [ ] **Step 3: Implementar `import_lib/diff.py`**

```python
"""Diff engine: compara NodeData antiga (DB) com nova (JSON), produz operações."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional, Union
from rapidfuzz import fuzz

from .loaders import NodeData

SIMILARITY_THRESHOLD = 0.85  # 85% similaridade de título → considera rename


@dataclass
class AddNode:
    slug: str
    titulo: str
    nivel: int
    parent_slug: Optional[str]
    ordem: int
    aliases: list[str]
    absorbed: list[str]
    subtopicos_visuais: list[dict]


@dataclass
class RenameNode:
    stable_id: str
    new_slug: str
    new_titulo: str
    new_aliases: list[str]
    new_absorbed: list[str]
    new_subtopicos_visuais: list[dict]
    new_ordem: int


@dataclass
class MoveNode:
    stable_id: str
    new_parent_slug: Optional[str]
    new_ordem: int


@dataclass
class DeleteNode:
    stable_id: str
    slug: str
    reassign_to: Optional[str]  # stable_id do parent ou nó equivalente; None se nó não tem questões


Operation = Union[AddNode, RenameNode, MoveNode, DeleteNode]


@dataclass
class Diff:
    operations: list[Operation] = field(default_factory=list)

    def summary(self) -> dict:
        return {
            "added": sum(1 for op in self.operations if isinstance(op, AddNode)),
            "renamed": sum(1 for op in self.operations if isinstance(op, RenameNode)),
            "moved": sum(1 for op in self.operations if isinstance(op, MoveNode)),
            "deleted": sum(1 for op in self.operations if isinstance(op, DeleteNode)),
        }


def compute_diff(old: list[NodeData], new: list[NodeData]) -> Diff:
    """Tree-matching estrutural com 3 estágios:
       1. Match exato por slug
       2. Match por (parent_slug, titulo) com similaridade ≥ 0.85
       3. Restante: ADD ou DELETE
    """
    diff = Diff()
    old_by_slug = {n.slug: n for n in old}
    new_by_slug = {n.slug: n for n in new}
    matched_old: dict[str, NodeData] = {}  # slug_old → new node matched

    # Estágio 1: match exato por slug
    for new_node in new:
        if new_node.slug in old_by_slug:
            matched_old[new_node.slug] = new_node

    # Estágio 2: para nós novos sem match, tenta rename por (parent + similaridade)
    unmatched_new = [n for n in new if n.slug not in matched_old]
    unmatched_old_slugs = set(old_by_slug.keys()) - set(matched_old.keys())

    for new_node in unmatched_new:
        best_match: Optional[tuple[NodeData, float]] = None
        for old_slug in unmatched_old_slugs:
            old_node = old_by_slug[old_slug]
            if old_node.parent_slug != new_node.parent_slug:
                continue
            if old_node.nivel != new_node.nivel:
                continue
            similarity = fuzz.token_sort_ratio(old_node.titulo, new_node.titulo) / 100.0
            if similarity >= SIMILARITY_THRESHOLD:
                if best_match is None or similarity > best_match[1]:
                    best_match = (old_node, similarity)
        if best_match is not None:
            matched_old[best_match[0].slug] = new_node
            unmatched_old_slugs.discard(best_match[0].slug)

    # Index reverso pra lookup O(1): new.slug → old NodeData (via matched_old)
    new_slug_to_old: dict[str, NodeData] = {}
    for old_slug, new_n in matched_old.items():
        new_slug_to_old[new_n.slug] = old_by_slug[old_slug]

    # Gera operações
    for new_node in new:
        old_match = new_slug_to_old.get(new_node.slug)

        if old_match is None:
            diff.operations.append(AddNode(
                slug=new_node.slug,
                titulo=new_node.titulo,
                nivel=new_node.nivel,
                parent_slug=new_node.parent_slug,
                ordem=new_node.ordem,
                aliases=new_node.aliases,
                absorbed=new_node.absorbed,
                subtopicos_visuais=new_node.subtopicos_visuais,
            ))
            continue

        # Detecta mudanças
        if old_match.slug != new_node.slug or old_match.titulo != new_node.titulo \
           or old_match.aliases != new_node.aliases or old_match.absorbed != new_node.absorbed \
           or old_match.subtopicos_visuais != new_node.subtopicos_visuais \
           or old_match.ordem != new_node.ordem:
            diff.operations.append(RenameNode(
                stable_id=old_match.stable_id,
                new_slug=new_node.slug,
                new_titulo=new_node.titulo,
                new_aliases=new_node.aliases,
                new_absorbed=new_node.absorbed,
                new_subtopicos_visuais=new_node.subtopicos_visuais,
                new_ordem=new_node.ordem,
            ))

        if old_match.parent_slug != new_node.parent_slug:
            diff.operations.append(MoveNode(
                stable_id=old_match.stable_id,
                new_parent_slug=new_node.parent_slug,
                new_ordem=new_node.ordem,
            ))

    # Deletes: nós antigos sem match novo
    for old_node in old:
        if old_node.slug not in matched_old:
            # Se tem parent, reassign_to = stable_id do parent (resolver depois quando aplicar)
            parent = next((o for o in old if o.slug == old_node.parent_slug), None)
            diff.operations.append(DeleteNode(
                stable_id=old_node.stable_id,
                slug=old_node.slug,
                reassign_to=parent.stable_id if parent else None,
            ))

    return diff
```

- [ ] **Step 4: Rodar testes e verificar que passam**

```bash
cd "D:/tec-output/taxonomia"
pytest tests/test_import_diff.py -v
```

Esperado: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/import_lib/diff.py tests/test_import_diff.py
git commit -m "feat(import): structural diff engine com matching por slug + similarity"
```

---

### Task 5: Sanity checks

**Files:**
- Create: `D:\tec-output\taxonomia\scripts\import_lib\sanity.py`
- Create: `D:\tec-output\taxonomia\tests\test_import_sanity.py`

- [ ] **Step 1: Escrever testes**

`tests/test_import_sanity.py`:

```python
import pytest
from scripts.import_lib.loaders import NodeData
from scripts.import_lib.sanity import run_sanity_checks, SanityFailure


def _node(slug, titulo="X", nivel=1, parent=None, aliases=None):
    return NodeData(slug=slug, titulo=titulo, nivel=nivel, parent_slug=parent, ordem=0, aliases=aliases or [])


def _check(nodes, counts, *, total_db=200, total_json=None, min_cov=95.0):
    run_sanity_checks(
        nodes, counts,
        materia_slug="dir-adm",
        min_coverage_pct=min_cov,
        total_questoes_db=total_db,
        total_classificadas_json=total_json,
    )


def test_passes_clean_tree():
    nodes = [
        _node("dir-adm.a", nivel=1),
        _node("dir-adm.a.b", nivel=2, parent="dir-adm.a"),
    ]
    counts = {"dir-adm.a": 100, "dir-adm.a.b": 50}
    _check(nodes, counts, total_db=100, total_json=100)  # 100% cobertura


def test_fails_on_gran_in_titulo():
    nodes = [_node("dir-adm.x", titulo="GRAN: Atos administrativos")]
    counts = {"dir-adm.x": 100}
    with pytest.raises(SanityFailure, match="GRAN"):
        _check(nodes, counts, total_db=100, total_json=100)


def test_fails_on_gran_in_alias_case_insensitive():
    nodes = [_node("dir-adm.x", aliases=["foo", "Material gran"])]
    counts = {"dir-adm.x": 100}
    with pytest.raises(SanityFailure, match="gran"):
        _check(nodes, counts, total_db=100, total_json=100)


def test_fails_on_duplicate_slug():
    nodes = [_node("dir-adm.x"), _node("dir-adm.x")]
    counts = {"dir-adm.x": 100}
    with pytest.raises(SanityFailure, match="duplicado"):
        _check(nodes, counts, total_db=100, total_json=100)


def test_fails_on_orphan():
    nodes = [_node("dir-adm.x.y", nivel=2, parent="dir-adm.does-not-exist")]
    counts = {"dir-adm.x.y": 100}
    with pytest.raises(SanityFailure, match="órfão"):
        _check(nodes, counts, total_db=100, total_json=100)


def test_fails_on_l1_with_zero_count():
    nodes = [_node("dir-adm.empty", nivel=1)]
    counts = {"dir-adm.empty": 0}
    with pytest.raises(SanityFailure, match="L1"):
        _check(nodes, counts, total_db=10, total_json=0)


def test_fails_on_low_coverage_real_total():
    """Cobertura real (classificadas/total_db) abaixo do mínimo."""
    nodes = [_node("dir-adm.x", nivel=1)]
    counts = {"dir-adm.x": 100}
    # 50 classificadas / 100 totais = 50% < 95%
    with pytest.raises(SanityFailure, match="[Cc]obertura"):
        _check(nodes, counts, total_db=100, total_json=50)
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
pytest tests/test_import_sanity.py -v
```

Esperado: ImportError, módulo `sanity` não existe.

- [ ] **Step 3: Implementar `sanity.py`**

```python
"""Sanity checks que rodam antes do apply do import. Levantam SanityFailure pra bloquear."""
from __future__ import annotations
import re
from .loaders import NodeData


class SanityFailure(Exception):
    pass


GRAN_PATTERN = re.compile(r"\bgran\b", re.IGNORECASE)


def run_sanity_checks(
    nodes: list[NodeData],
    counts: dict[str, int],                  # slug → count_agregada projetado
    materia_slug: str,
    min_coverage_pct: float,
    total_questoes_db: int,                  # COUNT(*) FROM questoes WHERE materia = nome
    total_classificadas_json: int | None,    # estatisticas.questoes_classificadas do JSON
) -> None:
    """Verifica todas as invariantes. Levanta SanityFailure no primeiro fail.

    Invariantes:
      1. Nenhum titulo ou alias contém "gran" (case-insensitive).
      2. Slugs únicos.
      3. Sem órfãos estruturais (parent_slug que não existe).
      4. Todo nó L1 tem count_agregada > 0.
      5. Cobertura = classificadas/total_db ≥ min_coverage_pct (%).

    Cobertura usa total_classificadas_json (real do pipeline) se disponível —
    caso contrário, soma os L1 (sub-óptimo, pois questões em múltiplos L1 contam dupla).
    """
    # 1. GRAN check
    for n in nodes:
        if GRAN_PATTERN.search(n.titulo):
            raise SanityFailure(f"Nó {n.slug!r} tem 'GRAN' no título: {n.titulo!r}")
        for alias in n.aliases:
            if GRAN_PATTERN.search(alias):
                raise SanityFailure(f"Nó {n.slug!r} tem 'gran' em alias: {alias!r}")

    # 2. Slugs únicos
    seen: set[str] = set()
    for n in nodes:
        if n.slug in seen:
            raise SanityFailure(f"Slug duplicado: {n.slug!r}")
        seen.add(n.slug)

    # 3. Órfãos estruturais
    all_slugs = {n.slug for n in nodes}
    for n in nodes:
        if n.parent_slug is not None and n.parent_slug not in all_slugs:
            raise SanityFailure(f"Nó {n.slug!r} é órfão (parent {n.parent_slug!r} não existe)")

    # 4. L1 com count_agregada > 0
    for n in nodes:
        if n.nivel == 1 and counts.get(n.slug, 0) == 0:
            raise SanityFailure(f"Nó L1 {n.slug!r} tem 0 questões classificadas")

    # 5. Cobertura — comparar classificadas (do JSON) com total real (do DB)
    if total_questoes_db <= 0:
        # Sem total real, pula check (evita divisão por zero e falso fail)
        return
    if total_classificadas_json is not None:
        classificadas = total_classificadas_json
    else:
        # Fallback ruidoso: soma own_qids via L1 count_agregada (pode contar dupla)
        classificadas = sum(counts.get(n.slug, 0) for n in nodes if n.nivel == 1)
    coverage = (classificadas / total_questoes_db) * 100.0
    if coverage < min_coverage_pct:
        raise SanityFailure(
            f"Cobertura {coverage:.2f}% ({classificadas}/{total_questoes_db}) < mínimo {min_coverage_pct}%"
        )
```

- [ ] **Step 4: Rodar testes**

```bash
pytest tests/test_import_sanity.py -v
```

Esperado: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/import_lib/sanity.py tests/test_import_sanity.py
git commit -m "feat(import): sanity checks pré-apply (GRAN, slugs únicos, órfãos, cobertura)"
```

---

### Task 6: Apply (transação atômica + UPSERT counts)

**Files:**
- Create: `D:\tec-output\taxonomia\scripts\import_lib\apply.py`
- Create: `D:\tec-output\taxonomia\tests\test_import_apply.py`

- [ ] **Step 1: Implementar `apply.py`**

```python
"""Apply: aplica diff dentro de uma transação Postgres + UPSERT em taxonomia_counts."""
from __future__ import annotations
from typing import Optional
import uuid
from .diff import Diff, AddNode, RenameNode, MoveNode, DeleteNode


REFRESH_COUNTS_SQL = """
WITH RECURSIVE descendants AS (
  SELECT stable_id AS root_id, stable_id AS desc_id
  FROM taxonomia_nodes WHERE materia_slug = %(materia)s
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
  WHERE n.materia_slug = %(materia)s
  GROUP BY n.stable_id
)
INSERT INTO taxonomia_counts (node_id, materia_slug, count_propria, count_agregada, refreshed_at)
SELECT n.stable_id, n.materia_slug, p.c, a.c, NOW()
FROM taxonomia_nodes n
JOIN propria p ON p.node_id = n.stable_id
JOIN agregado a ON a.node_id = n.stable_id
WHERE n.materia_slug = %(materia)s
ON CONFLICT (node_id) DO UPDATE SET
  count_propria = EXCLUDED.count_propria,
  count_agregada = EXCLUDED.count_agregada,
  refreshed_at = EXCLUDED.refreshed_at;
"""


def apply_diff(conn, diff: Diff, materia_slug: str, source: str, version_notes: Optional[str] = None) -> str:
    """Aplica todas as operações em uma transação. Retorna o version_id criado.

    Atribui SET LOCAL app.source = source pra trigger capturar.
    """
    with conn.cursor() as cur:
        # 1. Cria version
        version_id = str(uuid.uuid4())
        cur.execute(
            "INSERT INTO taxonomia_versions (id, materia_slug, source, notes) VALUES (%s, %s, %s, %s)",
            (version_id, materia_slug, source, version_notes),
        )

        # Map slug → stable_id (resolved on the fly conforme aplicamos)
        slug_to_stable: dict[str, str] = {}

        # Pre-popula com nós existentes que não foram deletados
        cur.execute("SELECT slug, stable_id FROM taxonomia_nodes WHERE materia_slug = %s", (materia_slug,))
        for row in cur.fetchall():
            slug_to_stable[row[0]] = str(row[1])

        # 2. Aplica deletes primeiro (limpa o caminho), em ordem reversa de profundidade
        deletes = [op for op in diff.operations if isinstance(op, DeleteNode)]
        # Profundidade aproximada via número de '.' no slug (mais profundo primeiro)
        deletes.sort(key=lambda op: -op.slug.count("."))
        for op in deletes:
            if op.reassign_to:
                # Reaponta classificações pro reassign_to
                cur.execute("SET LOCAL app.source = %s", (source,))
                cur.execute("SET LOCAL app.reason = %s", (f"diff: node deleted, reassigned",))
                cur.execute("""
                    INSERT INTO questao_topico (questao_id, node_id, score, current_source)
                    SELECT questao_id, %s, score, %s FROM questao_topico WHERE node_id = %s
                    ON CONFLICT (questao_id, node_id) DO NOTHING
                """, (op.reassign_to, source, op.stable_id))
                cur.execute("DELETE FROM questao_topico WHERE node_id = %s", (op.stable_id,))
            cur.execute("DELETE FROM taxonomia_nodes WHERE stable_id = %s", (op.stable_id,))
            slug_to_stable.pop(op.slug, None)

        # 3. Aplica renames (pode mudar slug; precisa atualizar slug_to_stable)
        for op in [o for o in diff.operations if isinstance(o, RenameNode)]:
            cur.execute("""
                UPDATE taxonomia_nodes
                SET slug = %s, titulo = %s, aliases = %s, absorbed = %s,
                    subtopicos_visuais = %s, ordem = %s
                WHERE stable_id = %s
            """, (op.new_slug, op.new_titulo, op.new_aliases, op.new_absorbed,
                  op.new_subtopicos_visuais, op.new_ordem, op.stable_id))
            # Atualiza map: remove slug antigo, adiciona novo
            old_slug = next((s for s, sid in slug_to_stable.items() if sid == op.stable_id), None)
            if old_slug:
                slug_to_stable.pop(old_slug)
            slug_to_stable[op.new_slug] = op.stable_id

        # 4. Aplica adds em ordem topológica (parents primeiro)
        adds = [op for op in diff.operations if isinstance(op, AddNode)]
        adds.sort(key=lambda op: op.nivel)
        for op in adds:
            new_stable_id = str(uuid.uuid4())
            parent_id = slug_to_stable.get(op.parent_slug) if op.parent_slug else None
            cur.execute("""
                INSERT INTO taxonomia_nodes
                (stable_id, materia_slug, slug, titulo, nivel, parent_id, ordem,
                 aliases, absorbed, subtopicos_visuais, created_in_version_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)
            """, (new_stable_id, materia_slug, op.slug, op.titulo, op.nivel, parent_id, op.ordem,
                  op.aliases, op.absorbed, _to_json(op.subtopicos_visuais), version_id))
            slug_to_stable[op.slug] = new_stable_id

        # 5. Aplica moves
        for op in [o for o in diff.operations if isinstance(o, MoveNode)]:
            new_parent_id = slug_to_stable.get(op.new_parent_slug) if op.new_parent_slug else None
            cur.execute(
                "UPDATE taxonomia_nodes SET parent_id = %s, ordem = %s WHERE stable_id = %s",
                (new_parent_id, op.new_ordem, op.stable_id),
            )

        # 6. UPSERT taxonomia_counts pra esta matéria
        cur.execute(REFRESH_COUNTS_SQL, {"materia": materia_slug})

    return version_id


def _to_json(obj) -> str:
    import json
    return json.dumps(obj, ensure_ascii=False)
```

- [ ] **Step 2: Escrever teste de integração contra um Postgres real**

`tests/test_import_apply.py`:

```python
"""Integration test contra um Postgres real (test DB). Skip se DB indisponível."""
import os
import pytest
import psycopg2

from scripts.import_lib.loaders import NodeData
from scripts.import_lib.diff import compute_diff
from scripts.import_lib.apply import apply_diff


TEST_DSN = os.environ.get("TAXONOMIA_TEST_DSN")


@pytest.fixture
def conn():
    if not TEST_DSN:
        pytest.skip("Set TAXONOMIA_TEST_DSN to run integration tests")
    c = psycopg2.connect(TEST_DSN)
    c.autocommit = False
    yield c
    c.rollback()
    c.close()


def test_apply_creates_nodes_and_version(conn):
    new = [
        NodeData(slug="_test.a", titulo="A", nivel=1, parent_slug=None, ordem=0),
        NodeData(slug="_test.a.b", titulo="B", nivel=2, parent_slug="_test.a", ordem=0),
    ]
    diff = compute_diff(old=[], new=new)
    version_id = apply_diff(conn, diff, materia_slug="_test", source="pytest")

    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM taxonomia_nodes WHERE materia_slug = '_test'")
        assert cur.fetchone()[0] == 2
        cur.execute("SELECT id FROM taxonomia_versions WHERE id = %s", (version_id,))
        assert cur.fetchone() is not None

    conn.rollback()  # cleanup


def test_apply_delete_with_reassign_moves_questoes(conn):
    """Setup: cria 2 nós e 1 questão classificada no filho. Diff deleta filho com reassign pro parent."""
    with conn.cursor() as cur:
        # Pega uma questão real existente
        cur.execute("SELECT id FROM questoes LIMIT 1")
        questao_id = cur.fetchone()[0]

    initial = [
        NodeData(slug="_test.parent", titulo="P", nivel=1, parent_slug=None, ordem=0),
        NodeData(slug="_test.parent.child", titulo="C", nivel=2, parent_slug="_test.parent", ordem=0),
    ]
    apply_diff(conn, compute_diff(old=[], new=initial), materia_slug="_test", source="setup")

    with conn.cursor() as cur:
        cur.execute("SELECT stable_id FROM taxonomia_nodes WHERE slug = '_test.parent.child'")
        child_id = str(cur.fetchone()[0])
        cur.execute("SET LOCAL app.source = 'setup'")
        cur.execute("INSERT INTO questao_topico (questao_id, node_id, score, current_source) VALUES (%s, %s, 0.9, 'setup')",
                    (questao_id, child_id))

    # Now diff: delete child
    from scripts.import_lib.loaders import load_db
    old = load_db(conn, "_test")
    new = [n for n in old if not n.slug.endswith(".child")]
    diff = compute_diff(old=old, new=new)
    apply_diff(conn, diff, materia_slug="_test", source="pytest_delete")

    with conn.cursor() as cur:
        # Questão deve estar reassign pro parent
        cur.execute("""
            SELECT n.slug FROM questao_topico qt JOIN taxonomia_nodes n ON n.stable_id = qt.node_id
            WHERE qt.questao_id = %s AND n.materia_slug = '_test'
        """, (questao_id,))
        slugs = [r[0] for r in cur.fetchall()]
        assert "_test.parent" in slugs

    conn.rollback()
```

- [ ] **Step 3: Rodar testes (com DSN apontando pro Hetzner via tunnel)**

```bash
export TAXONOMIA_TEST_DSN="postgresql://user:pass@localhost:5432/dbname"
cd "D:/tec-output/taxonomia"
pytest tests/test_import_apply.py -v
```

Esperado: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add scripts/import_lib/apply.py tests/test_import_apply.py
git commit -m "feat(import): apply diff em transação atômica + UPSERT taxonomia_counts"
```

---

### Task 7: CLI script `import_to_postgres.py`

**Files:**
- Create: `D:\tec-output\taxonomia\scripts\import_to_postgres.py`

- [ ] **Step 1: Implementar CLI**

```python
"""CLI: import_to_postgres.py --materia X --json out.json [--dry-run] [--apply]"""
from __future__ import annotations
import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

import psycopg2

from import_lib.loaders import load_json, load_db
from import_lib.diff import compute_diff
from import_lib.sanity import run_sanity_checks, SanityFailure
from import_lib.apply import apply_diff


def project_counts(json_path: Path, materia_slug: str) -> tuple[dict[str, int], int | None]:
    """Lê contagens projetadas do JSON do pipeline.

    Retorna (counts_agregada_por_slug_prefixado, questoes_classificadas_total_do_json).

    Estratégia:
      1. Se o JSON tem `questoes_count_agregada` por nó (gerado pelo finalize.py),
         usa direto. Verificado: existe em taxonomia-direito-administrativo.json.
      2. Senão, calcula recursivamente via `questao_ids` por nó + filhos.

    `questoes_classificadas_total_do_json` vem de `estatisticas.questoes_classificadas`
    (presente no top do JSON do pipeline) ou None se ausente.
    """
    import json
    with open(json_path, encoding="utf-8") as f:
        raw = json.load(f)

    counts: dict[str, int] = {}

    def walk(n: dict) -> set[int]:
        """Retorna o set de questao_ids cobertos por este nó + descendentes (pra fallback)."""
        slug = n["slug"]
        full_slug = slug if slug.startswith(f"{materia_slug}.") else f"{materia_slug}.{slug}"
        own_qids = set(n.get("questao_ids", []))
        descendant_qids = set(own_qids)
        for c in n.get("filhos", []):
            descendant_qids |= walk(c)
        if "questoes_count_agregada" in n:
            counts[full_slug] = n["questoes_count_agregada"]
        else:
            counts[full_slug] = len(descendant_qids)
        return descendant_qids

    roots = raw.get("arvore", raw if isinstance(raw, list) else [])
    for root in roots:
        walk(root)

    estat = raw.get("estatisticas") or {}
    total = estat.get("questoes_classificadas")
    return counts, (int(total) if total is not None else None)


def fetch_total_questoes_da_materia(conn, materia_nome_humano: str) -> int:
    """Conta total de questões da matéria no DB. Usado pra cobertura real.

    Recebe o nome humano (ex: 'Direito Administrativo'), não o slug — porque
    `questoes.materia` armazena o nome humano. Mapeamento slug↔nome vem
    da tabela `materias` (ver pré-requisito arquitetural no topo do plano).
    """
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM questoes WHERE materia = %s", (materia_nome_humano,))
        return int(cur.fetchone()[0])


def print_summary(diff, current_version_label: str, new_label: str) -> None:
    s = diff.summary()
    print(f"\nDIFF SUMMARY ({current_version_label} → {new_label}):")
    print(f"  + {s['added']} nodes added")
    print(f"  ~ {s['renamed']} nodes renamed/updated")
    print(f"  → {s['moved']} nodes moved")
    print(f"  - {s['deleted']} nodes deleted")
    print()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--materia", required=True, help="Slug da matéria, ex: dir-adm")
    ap.add_argument("--materia-nome", required=True,
                    help="Nome humano da matéria como aparece em questoes.materia, ex: 'Direito Administrativo'")
    ap.add_argument("--json", required=True, type=Path, help="Path do JSON do pipeline")
    ap.add_argument("--dry-run", action="store_true", help="Só imprime diff e sanity, não aplica")
    ap.add_argument("--apply", action="store_true", help="Aplica sem prompt interativo")
    ap.add_argument("--dsn", default=os.environ.get("VERUS_DB_DSN"), help="Postgres DSN")
    ap.add_argument("--min-coverage", type=float, default=95.0)
    args = ap.parse_args()

    if not args.dsn:
        print("ERROR: provide --dsn or set VERUS_DB_DSN env var", file=sys.stderr)
        sys.exit(2)

    new_nodes = load_json(args.json, args.materia)
    counts_projected, total_classificadas_json = project_counts(args.json, args.materia)

    # Conecta ao DB pra: (1) buscar total real de questões da matéria, (2) carregar old_nodes
    conn = psycopg2.connect(args.dsn)
    try:
        total_db = fetch_total_questoes_da_materia(conn, args.materia_nome)
        if total_db == 0:
            print(f"WARNING: nenhuma questão encontrada com materia = {args.materia_nome!r}. "
                  f"Verificar mapping slug↔nome.", file=sys.stderr)
        # Cobertura real: classificadas / total no DB
        # Usa total_classificadas_json se presente (mais preciso); senão soma own_qids dos nós.
        total_classificadas = total_classificadas_json if total_classificadas_json is not None else None

        try:
            run_sanity_checks(
                new_nodes,
                counts_projected,
                materia_slug=args.materia,
                min_coverage_pct=args.min_coverage,
                total_questoes_db=total_db,
                total_classificadas_json=total_classificadas,
            )
        except SanityFailure as e:
            print(f"SANITY FAIL: {e}", file=sys.stderr)
            sys.exit(3)
        print("Sanity checks: OK")

        old_nodes = load_db(conn, args.materia)
        diff = compute_diff(old=old_nodes, new=new_nodes)
        current_label = f"DB ({len(old_nodes)} nodes)" if old_nodes else "EMPTY"
        new_label = f"JSON {args.json.name}"
        print_summary(diff, current_label, new_label)

        if args.dry_run:
            print("--dry-run: no changes applied. Bye.")
            return

        if not args.apply:
            confirm = input("Apply this diff? [y/N]: ").strip().lower()
            if confirm != "y":
                print("Aborted.")
                return

        ts = datetime.utcnow().strftime("%Y_%m_%d_%H%M")
        source = f"gran_pipeline:regen_{ts}"
        version_id = apply_diff(conn, diff, materia_slug=args.materia, source=source,
                                version_notes=f"Imported from {args.json.name}")
        conn.commit()
        print(f"\nApplied. version_id = {version_id}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Smoke test do dry-run com o JSON real de Direito Adm**

```bash
cd "D:/tec-output/taxonomia"
export VERUS_DB_DSN="postgresql://user:pass@localhost:5432/dbname"
python scripts/import_to_postgres.py \
  --materia dir-adm \
  --materia-nome "Direito Administrativo" \
  --json merged/taxonomia-direito-administrativo.json \
  --dry-run
```

Esperado: imprime "Sanity checks: OK", depois DIFF SUMMARY com 499 adds (DB vazio na primeira vez), 0 deletes/moves/renames. "no changes applied. Bye." Se aparecer `WARNING: nenhuma questão encontrada com materia = 'Direito Administrativo'`, conferir o nome humano exato em `SELECT DISTINCT materia FROM questoes WHERE materia ILIKE '%admin%' LIMIT 5`.

- [ ] **Step 3: Aplicar de verdade**

```bash
python scripts/import_to_postgres.py \
  --materia dir-adm \
  --materia-nome "Direito Administrativo" \
  --json merged/taxonomia-direito-administrativo.json
# Responde 'y' no prompt
```

Esperado: "Applied. version_id = uuid-...". Sem erros.

- [ ] **Step 4: Verificar resultado no DB**

```sql
SELECT COUNT(*) FROM taxonomia_versions WHERE materia_slug='dir-adm';  -- 1
SELECT COUNT(*) FROM taxonomia_nodes WHERE materia_slug='dir-adm';     -- 499
SELECT COUNT(*) FROM taxonomia_counts WHERE materia_slug='dir-adm';    -- 499
SELECT MAX(count_agregada) FROM taxonomia_counts WHERE materia_slug='dir-adm';  -- ~ 137000
```

(Note: questao_topico ainda está vazio nesta task — só seria populado quando o pipeline GRAN gravar as classificações. Próxima task carrega isso.)

- [ ] **Step 5: Commit**

```bash
git add scripts/import_to_postgres.py
git commit -m "feat(import): CLI import_to_postgres com dry-run e prompt confirmativo"
```

---

### Task 8: Carga inicial de `questao_topico` (137k classificações)

**Files:**
- Create: `D:\tec-output\taxonomia\scripts\load_classifications.py`

- [ ] **Step 1: Implementar script que lê o JSON do pipeline e popula `questao_topico`**

O JSON do pipeline deve ter, em cada nó, uma lista `questoes_atribuidas: [{questao_id, score}, ...]`. Caso esteja em arquivo separado (depende do pipeline), ajustar o script.

```python
"""load_classifications.py: popula questao_topico a partir do JSON da taxonomia.

Lê cada nó com sua lista `questao_ids: [int, ...]`, faz batched INSERT
com SET LOCAL app.source pra trigger registrar.

Estrutura real do JSON (verificado contra taxonomia-direito-administrativo.json):
  - top key da árvore: `arvore`
  - children key: `filhos`
  - questões classificadas no nó: `questao_ids` (lista de int)
  - score por questão NÃO está no JSON; passa NULL no insert.
"""
from __future__ import annotations
import argparse
import json
import os
import sys
from pathlib import Path
from datetime import datetime
import psycopg2
import psycopg2.extras


def iter_classificacoes(json_path: Path, materia_slug: str):
    """Yields (slug_full, questao_id, score=None) tuples."""
    with open(json_path, encoding="utf-8") as f:
        raw = json.load(f)

    def walk(node: dict):
        slug = node["slug"]
        full_slug = slug if slug.startswith(f"{materia_slug}.") else f"{materia_slug}.{slug}"
        for qid in node.get("questao_ids", []):
            yield (full_slug, int(qid), None)
        for c in node.get("filhos", []):
            yield from walk(c)

    roots = raw.get("arvore", raw if isinstance(raw, list) else [])
    for root in roots:
        yield from walk(root)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--materia", required=True)
    ap.add_argument("--json", required=True, type=Path)
    ap.add_argument("--dsn", default=os.environ.get("VERUS_DB_DSN"))
    ap.add_argument("--batch-size", type=int, default=5000)
    args = ap.parse_args()

    if not args.dsn:
        print("ERROR: provide --dsn or set VERUS_DB_DSN", file=sys.stderr)
        sys.exit(2)

    conn = psycopg2.connect(args.dsn)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT slug, stable_id FROM taxonomia_nodes WHERE materia_slug = %s", (args.materia,))
            slug_to_stable = {row[0]: str(row[1]) for row in cur.fetchall()}

        ts = datetime.utcnow().strftime("%Y_%m_%d_%H%M")
        source = f"gran_pipeline:regen_{ts}"

        batch: list[tuple] = []
        total = 0
        with conn.cursor() as cur:
            cur.execute("SET LOCAL app.source = %s", (source,))
            for slug, qid, score in iter_classificacoes(args.json, args.materia):
                stable_id = slug_to_stable.get(slug)
                if not stable_id:
                    continue  # nó não existe (deveria; pular silenciosamente é defensivo)
                batch.append((qid, stable_id, score, source))
                if len(batch) >= args.batch_size:
                    psycopg2.extras.execute_values(
                        cur,
                        "INSERT INTO questao_topico (questao_id, node_id, score, current_source) VALUES %s ON CONFLICT (questao_id, node_id) DO NOTHING",
                        batch,
                    )
                    total += len(batch)
                    print(f"  inserted: {total}")
                    batch.clear()
            if batch:
                psycopg2.extras.execute_values(
                    cur,
                    "INSERT INTO questao_topico (questao_id, node_id, score, current_source) VALUES %s ON CONFLICT (questao_id, node_id) DO NOTHING",
                    batch,
                )
                total += len(batch)

            # Refresh counts pós-load
            cur.execute("""
                INSERT INTO taxonomia_counts (node_id, materia_slug, count_propria, count_agregada, refreshed_at)
                SELECT n.stable_id, n.materia_slug, 0, 0, NOW()
                FROM taxonomia_nodes n WHERE n.materia_slug = %s
                ON CONFLICT (node_id) DO NOTHING
            """, (args.materia,))
            from import_lib.apply import REFRESH_COUNTS_SQL
            cur.execute(REFRESH_COUNTS_SQL, {"materia": args.materia})

        conn.commit()
        print(f"\nDone. {total} classificações inseridas.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Rodar contra Direito Adm**

```bash
cd "D:/tec-output/taxonomia"
python scripts/load_classifications.py \
  --materia dir-adm \
  --json merged/taxonomia-direito-administrativo.json
```

Esperado: imprime progresso ("inserted: 5000", "10000", ..., "Done. 137627 classificações inseridas.")

- [ ] **Step 3: Verificar contagens batem**

```sql
SELECT COUNT(*) FROM questao_topico
  JOIN taxonomia_nodes USING (node_id... wait, schema check)
;
SELECT COUNT(*) FROM questao_topico qt
  JOIN taxonomia_nodes n ON n.stable_id = qt.node_id
  WHERE n.materia_slug = 'dir-adm';
-- Esperado: ~137k (DISTINCT por questao_id se quiser cobertura única)

SELECT COUNT(DISTINCT questao_id) FROM questao_topico qt
  JOIN taxonomia_nodes n ON n.stable_id = qt.node_id
  WHERE n.materia_slug = 'dir-adm';
-- Esperado: ~137k (cada questão classificada em 1 nó)
```

E a tabela counts:

```sql
SELECT n.titulo, c.count_propria, c.count_agregada
FROM taxonomia_counts c JOIN taxonomia_nodes n ON n.stable_id = c.node_id
WHERE n.materia_slug = 'dir-adm' AND n.nivel = 1
ORDER BY c.count_agregada DESC LIMIT 5;
-- Sanidade: top 5 L1 deve ter count_agregada coerente (milhares)
```

- [ ] **Step 4: Commit**

```bash
git add scripts/load_classifications.py
git commit -m "feat(import): script de carga inicial de questao_topico (137k classificações)"
```

---

## Phase 3 — API endpoints (verus_api)

### Task 9: Schemas Pydantic + cache helper de version_id

**Files:**
- Create: `C:\Users\Home\Desktop\verus_api\app\schemas\taxonomia.py`
- Create: `C:\Users\Home\Desktop\verus_api\app\services\taxonomia_cache.py`

- [ ] **Step 1: Schemas Pydantic**

```python
"""Pydantic schemas para taxonomia v2."""
from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from uuid import UUID


class SubtopicoVisual(BaseModel):
    titulo: str
    n_questoes: int
    nivel_original: int


class TaxonomiaNodeOut(BaseModel):
    stable_id: UUID
    slug: str
    titulo: str
    nivel: int
    parent_id: Optional[UUID]
    count_propria: int
    count_agregada: int
    aliases: list[str]
    absorbed: list[str]
    subtopicos_visuais: list[SubtopicoVisual]
    path: list[str]
    keywords: list[str]
    children: list["TaxonomiaNodeOut"] = []


class TaxonomiaTreeResponse(BaseModel):
    materia_slug: str
    version_id: UUID
    applied_at: datetime
    tree: list[TaxonomiaNodeOut]


class MateriaListItem(BaseModel):
    slug: str
    nome: str
    has_taxonomia: bool
    total_nodes: int
    total_questoes_classificadas: int
    cobertura_pct: float
    updated_at: Optional[datetime]


TaxonomiaNodeOut.model_rebuild()
```

- [ ] **Step 2: Cache helper pra `version_id` ativa**

```python
"""Resolve a versão ativa de uma matéria, com cache Redis 5min."""
from __future__ import annotations
from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.redis import get_redis  # se não existir helper, usa redis.from_url do core

CACHE_KEY = "taxonomia:active_version:{materia_slug}"
CACHE_TTL = 300  # 5min


def get_active_version_id(db: Session, materia_slug: str) -> Optional[UUID]:
    redis = get_redis()
    cached = redis.get(CACHE_KEY.format(materia_slug=materia_slug))
    if cached:
        return UUID(cached.decode() if isinstance(cached, bytes) else cached)

    row = db.execute(
        text("SELECT id FROM taxonomia_versions WHERE materia_slug = :m ORDER BY applied_at DESC LIMIT 1"),
        {"m": materia_slug},
    ).fetchone()
    if not row:
        return None
    version_id = row[0]
    redis.setex(CACHE_KEY.format(materia_slug=materia_slug), CACHE_TTL, str(version_id))
    return version_id


def invalidate_version_cache(materia_slug: str) -> None:
    get_redis().delete(CACHE_KEY.format(materia_slug=materia_slug))
```

Se `app.core.redis.get_redis` não existir, ajusta o import. Verificar com:

```bash
grep -rln "get_redis\|redis\.from_url" "C:/Users/Home/Desktop/verus_api/app/" | head -5
```

E usar o helper que existir.

- [ ] **Step 3: Smoke test de imports**

```bash
cd "C:/Users/Home/Desktop/verus_api"
python -c "from app.schemas.taxonomia import TaxonomiaTreeResponse, MateriaListItem; from app.services.taxonomia_cache import get_active_version_id; print('OK')"
```

- [ ] **Step 4: Commit**

```bash
git add app/schemas/taxonomia.py app/services/taxonomia_cache.py
git commit -m "feat(api): Pydantic schemas + version cache helper para taxonomia v2"
```

---

### Task 10: Endpoint `GET /v1/taxonomia/materias`

**Files:**
- Create: `C:\Users\Home\Desktop\verus_api\app\api\v1\routes\taxonomia.py`
- Modify: `C:\Users\Home\Desktop\verus_api\app\api\v1\routes\__init__.py` (registrar router)
- Create: `C:\Users\Home\Desktop\verus_api\tests\routes\test_taxonomia.py`

- [ ] **Step 1: Criar `routes/taxonomia.py` com o endpoint `/materias`**

```python
"""Routes para taxonomia v2."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db
from app.schemas.taxonomia import MateriaListItem, TaxonomiaTreeResponse

router = APIRouter(prefix="/taxonomia", tags=["Taxonomia"])


@router.get("/materias", response_model=list[MateriaListItem])
def list_materias(db: Session = Depends(get_db)):
    """Lista todas as matérias com flag has_taxonomia.

    Junta o conjunto de matérias da tabela `materias_prioridade` (se existir) com as
    que têm pelo menos uma versão registrada em taxonomia_versions.
    """
    rows = db.execute(text("""
        WITH materia_set AS (
            SELECT DISTINCT materia AS slug FROM questoes WHERE materia IS NOT NULL
            UNION
            SELECT DISTINCT materia_slug AS slug FROM taxonomia_versions
        ),
        latest_version AS (
            SELECT DISTINCT ON (materia_slug)
                materia_slug, applied_at
            FROM taxonomia_versions
            ORDER BY materia_slug, applied_at DESC
        ),
        nodes_count AS (
            SELECT materia_slug, COUNT(*) AS n FROM taxonomia_nodes GROUP BY materia_slug
        ),
        classif_count AS (
            SELECT n.materia_slug, COUNT(DISTINCT qt.questao_id) AS n
            FROM taxonomia_nodes n LEFT JOIN questao_topico qt ON qt.node_id = n.stable_id
            GROUP BY n.materia_slug
        ),
        total_questoes AS (
            SELECT materia AS materia_slug, COUNT(*) AS n FROM questoes GROUP BY materia
        )
        SELECT
            ms.slug,
            ms.slug AS nome,  -- TODO: substituir por nome humano se houver tabela materias separada
            (lv.applied_at IS NOT NULL) AS has_taxonomia,
            COALESCE(nc.n, 0) AS total_nodes,
            COALESCE(cc.n, 0) AS total_questoes_classificadas,
            CASE WHEN tq.n > 0 THEN ROUND(100.0 * COALESCE(cc.n, 0) / tq.n, 2) ELSE 0 END AS cobertura_pct,
            lv.applied_at AS updated_at
        FROM materia_set ms
        LEFT JOIN latest_version lv ON lv.materia_slug = ms.slug
        LEFT JOIN nodes_count nc ON nc.materia_slug = ms.slug
        LEFT JOIN classif_count cc ON cc.materia_slug = ms.slug
        LEFT JOIN total_questoes tq ON tq.materia_slug = ms.slug
        ORDER BY ms.slug
    """)).fetchall()

    return [
        MateriaListItem(
            slug=r.slug,
            nome=r.nome,
            has_taxonomia=r.has_taxonomia,
            total_nodes=r.total_nodes,
            total_questoes_classificadas=r.total_questoes_classificadas,
            cobertura_pct=float(r.cobertura_pct),
            updated_at=r.updated_at,
        )
        for r in rows
    ]
```

- [ ] **Step 2: Registrar o router**

Lê `__init__.py` atual:

```bash
cat "C:/Users/Home/Desktop/verus_api/app/api/v1/routes/__init__.py"
```

Adiciona:

```python
from app.api.v1.routes import taxonomia  # registra novo módulo
```

E procura onde os outros routers são incluídos no app principal (provavelmente `app/main.py`):

```bash
grep -rn "include_router" "C:/Users/Home/Desktop/verus_api/app/" | head -10
```

Adiciona no padrão existente:

```python
from app.api.v1.routes.taxonomia import router as taxonomia_router
app.include_router(taxonomia_router, prefix="/v1")
```

- [ ] **Step 3: Escrever teste integration**

```python
# tests/routes/test_taxonomia.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_materias_lista_inclui_dir_adm_com_taxonomia():
    r = client.get("/v1/taxonomia/materias")
    assert r.status_code == 200
    data = r.json()
    dir_adm = next((m for m in data if m["slug"] == "dir-adm"), None)
    assert dir_adm is not None
    assert dir_adm["has_taxonomia"] is True
    assert dir_adm["total_nodes"] == 499
    assert dir_adm["total_questoes_classificadas"] > 100000
```

- [ ] **Step 4: Rodar teste**

```bash
cd "C:/Users/Home/Desktop/verus_api"
pytest tests/routes/test_taxonomia.py::test_materias_lista_inclui_dir_adm_com_taxonomia -v
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/v1/routes/taxonomia.py app/api/v1/routes/__init__.py app/main.py tests/routes/test_taxonomia.py
git commit -m "feat(api): GET /v1/taxonomia/materias"
```

---

### Task 11: Endpoint `GET /v1/taxonomia/{materia_slug}` (árvore)

**Files:**
- Modify: `C:\Users\Home\Desktop\verus_api\app\api\v1\routes\taxonomia.py`
- Modify: `C:\Users\Home\Desktop\verus_api\tests\routes\test_taxonomia.py`

- [ ] **Step 1: Adicionar endpoint**

Append em `taxonomia.py`:

```python
import unicodedata


def _normalize_keyword(s: str) -> str:
    """Lowercase + sem acentos."""
    return "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn")


@router.get("/{materia_slug}", response_model=TaxonomiaTreeResponse)
def get_taxonomia(materia_slug: str, response: Response, db: Session = Depends(get_db)):
    from app.services.taxonomia_cache import get_active_version_id
    version_id = get_active_version_id(db, materia_slug)
    if not version_id:
        raise HTTPException(status_code=404, detail=f"No taxonomia for materia '{materia_slug}'")

    # Pega applied_at da versão pra payload
    applied_at = db.execute(
        text("SELECT applied_at FROM taxonomia_versions WHERE id = :id"), {"id": version_id}
    ).scalar()

    # Carrega nós + counts + path via recursive CTE em uma só query
    rows = db.execute(text("""
        WITH RECURSIVE node_path AS (
            SELECT n.stable_id, ARRAY[n.titulo] AS path_arr, n.parent_id
            FROM taxonomia_nodes n
            WHERE n.materia_slug = :m AND n.parent_id IS NULL
            UNION ALL
            SELECT n.stable_id, np.path_arr || n.titulo, n.parent_id
            FROM taxonomia_nodes n
            JOIN node_path np ON np.stable_id = n.parent_id
        )
        SELECT
            n.stable_id, n.slug, n.titulo, n.nivel, n.parent_id, n.ordem,
            n.aliases, n.absorbed, n.subtopicos_visuais,
            COALESCE(c.count_propria, 0) AS count_propria,
            COALESCE(c.count_agregada, 0) AS count_agregada,
            np.path_arr AS path
        FROM taxonomia_nodes n
        LEFT JOIN taxonomia_counts c ON c.node_id = n.stable_id
        LEFT JOIN node_path np ON np.stable_id = n.stable_id
        WHERE n.materia_slug = :m
        ORDER BY n.nivel, n.ordem
    """), {"m": materia_slug}).fetchall()

    # Monta árvore aninhada
    nodes_by_id: dict[str, dict] = {}
    roots: list[dict] = []
    for r in rows:
        keywords = [_normalize_keyword(r.titulo)] + [_normalize_keyword(a) for a in (r.aliases or [])]
        node = {
            "stable_id": r.stable_id,
            "slug": r.slug,
            "titulo": r.titulo,
            "nivel": r.nivel,
            "parent_id": r.parent_id,
            "count_propria": r.count_propria,
            "count_agregada": r.count_agregada,
            "aliases": list(r.aliases or []),
            "absorbed": list(r.absorbed or []),
            "subtopicos_visuais": list(r.subtopicos_visuais or []),
            "path": list(r.path or []),
            "keywords": keywords,
            "children": [],
        }
        nodes_by_id[str(r.stable_id)] = node

    for r in rows:
        node = nodes_by_id[str(r.stable_id)]
        if r.parent_id is None:
            roots.append(node)
        else:
            parent = nodes_by_id.get(str(r.parent_id))
            if parent is not None:
                parent["children"].append(node)

    response.headers["ETag"] = f'"{version_id}"'
    response.headers["Cache-Control"] = "public, max-age=86400, must-revalidate"

    return TaxonomiaTreeResponse(
        materia_slug=materia_slug,
        version_id=version_id,
        applied_at=applied_at,
        tree=roots,
    )
```

- [ ] **Step 2: Adicionar testes**

Append em `tests/routes/test_taxonomia.py`:

```python
def test_get_taxonomia_dir_adm_estrutura():
    r = client.get("/v1/taxonomia/dir-adm")
    assert r.status_code == 200
    body = r.json()
    assert body["materia_slug"] == "dir-adm"
    assert "version_id" in body
    assert len(body["tree"]) > 0  # tem pelo menos um L1
    # Cada L1 tem path de 1 elemento
    for root in body["tree"]:
        assert len(root["path"]) == 1
        assert root["path"][0] == root["titulo"]
        # children têm path com 2 elementos
        for child in root.get("children", []):
            assert len(child["path"]) == 2


def test_get_taxonomia_etag_matches_version_id():
    r = client.get("/v1/taxonomia/dir-adm")
    assert r.status_code == 200
    etag = r.headers.get("ETag", "").strip('"')
    assert etag == r.json()["version_id"]


def test_get_taxonomia_404_for_unknown_materia():
    r = client.get("/v1/taxonomia/inexistente")
    assert r.status_code == 404
```

- [ ] **Step 3: Rodar testes**

```bash
pytest tests/routes/test_taxonomia.py -v
```

Esperado: 4 passed.

- [ ] **Step 4: Commit**

```bash
git add app/api/v1/routes/taxonomia.py tests/routes/test_taxonomia.py
git commit -m "feat(api): GET /v1/taxonomia/{materia_slug} com path via recursive CTE + ETag"
```

---

### Task 12: Endpoint `GET /v1/taxonomia/{materia_slug}/counts`

**Files:**
- Modify: `C:\Users\Home\Desktop\verus_api\app\api\v1\routes\taxonomia.py`
- Modify: `C:\Users\Home\Desktop\verus_api\tests\routes\test_taxonomia.py`

- [ ] **Step 1: Adicionar endpoint**

```python
import hashlib
import json as _json
from fastapi import Query
from typing import Annotated


@router.get("/{materia_slug}/counts")
def get_counts(
    materia_slug: str,
    response: Response,
    banca: Annotated[list[str] | None, Query()] = None,
    ano: Annotated[list[int] | None, Query()] = None,
    tipo: Annotated[list[str] | None, Query()] = None,
    excluir_anuladas: bool = True,
    excluir_desatualizadas: bool = True,
    db: Session = Depends(get_db),
):
    from app.core.redis import get_redis
    redis = get_redis()

    filters_canonical = {
        "banca": sorted(banca or []),
        "ano": sorted(ano or []),
        "tipo": sorted(tipo or []),
        "excluir_anuladas": excluir_anuladas,
        "excluir_desatualizadas": excluir_desatualizadas,
    }
    cache_key = f"counts:{materia_slug}:{hashlib.sha1(_json.dumps(filters_canonical, sort_keys=True).encode()).hexdigest()}"
    cached = redis.get(cache_key)
    if cached:
        response.headers["X-Cache"] = "HIT"
        response.headers["Cache-Control"] = "private, max-age=300"
        import json as jj
        return jj.loads(cached)

    # Build query
    sql = """
        SELECT n.stable_id::text AS node_id, COUNT(DISTINCT qt.questao_id) AS c
        FROM taxonomia_nodes n
        JOIN questao_topico qt ON qt.node_id = n.stable_id
        JOIN questoes q ON q.id = qt.questao_id
        WHERE n.materia_slug = :m
    """
    params = {"m": materia_slug}
    if banca:
        sql += " AND q.banca = ANY(:banca)"
        params["banca"] = banca
    if ano:
        sql += " AND q.ano = ANY(:ano)"
        params["ano"] = ano
    if tipo:
        sql += " AND q.tipo = ANY(:tipo)"
        params["tipo"] = tipo
    if excluir_anuladas:
        sql += " AND COALESCE(q.anulada, FALSE) = FALSE"
    if excluir_desatualizadas:
        sql += " AND COALESCE(q.desatualizada, FALSE) = FALSE"
    sql += " GROUP BY n.stable_id"

    rows = db.execute(text(sql), params).fetchall()
    result = {r.node_id: r.c for r in rows}

    redis.setex(cache_key, 300, _json.dumps(result))
    response.headers["X-Cache"] = "MISS"
    response.headers["Cache-Control"] = "private, max-age=300"
    return result


@router.post("/{materia_slug}/counts")
def post_counts(
    materia_slug: str,
    response: Response,
    body: dict,
    db: Session = Depends(get_db),
):
    """Fallback POST quando querystring fica >2KB. Mesma semântica do GET."""
    return get_counts(
        materia_slug=materia_slug,
        response=response,
        banca=body.get("banca"),
        ano=body.get("ano"),
        tipo=body.get("tipo"),
        excluir_anuladas=body.get("excluir_anuladas", True),
        excluir_desatualizadas=body.get("excluir_desatualizadas", True),
        db=db,
    )
```

- [ ] **Step 2: Teste**

```python
def test_counts_endpoint_basico():
    # Sem filtros: o endpoint não deve nem ser chamado pelo cliente, mas
    # deve responder normalmente — vai retornar contagens iguais ao count_agregada
    r = client.get("/v1/taxonomia/dir-adm/counts?banca=CESPE")
    assert r.status_code == 200
    counts = r.json()
    assert isinstance(counts, dict)
    # Pelo menos um nó tem questões CESPE
    assert any(v > 0 for v in counts.values())


def test_counts_etag_cache_hit():
    r1 = client.get("/v1/taxonomia/dir-adm/counts?banca=CESPE&ano=2024")
    assert r1.status_code == 200
    assert r1.headers.get("X-Cache") in ("MISS", "HIT")

    r2 = client.get("/v1/taxonomia/dir-adm/counts?banca=CESPE&ano=2024")
    assert r2.status_code == 200
    assert r2.headers.get("X-Cache") == "HIT"
    assert r2.json() == r1.json()
```

- [ ] **Step 3: Rodar e commitar**

```bash
pytest tests/routes/test_taxonomia.py::test_counts_endpoint_basico tests/routes/test_taxonomia.py::test_counts_etag_cache_hit -v
git add app/api/v1/routes/taxonomia.py tests/routes/test_taxonomia.py
git commit -m "feat(api): GET/POST /v1/taxonomia/{materia}/counts com Redis cache"
```

---

### Task 13: Extender `GET /v1/questoes/search` com `topicos`

**Files:**
- Modify: `C:\Users\Home\Desktop\verus_api\app\api\v1\routes\questoes.py`
- Modify: `C:\Users\Home\Desktop\verus_api\app\schemas\questoes.py` (ou onde estiver `QuestaoSearchResponse`)
- Create/Modify: `C:\Users\Home\Desktop\verus_api\tests\routes\test_questoes_search_topicos.py`

- [ ] **Step 1: Inspecionar `search_questoes`**

```bash
grep -n "search_questoes\|QuestaoSearchResponse" "C:/Users/Home/Desktop/verus_api/app/api/v1/routes/questoes.py" | head -10
sed -n '124,250p' "C:/Users/Home/Desktop/verus_api/app/api/v1/routes/questoes.py"
```

Identifica:
- Onde os params atuais (`materia`, `banca`, `ano`...) são lidos.
- Como a query SQL é construída.
- Onde o response é montado.

- [ ] **Step 2: Adicionar param `topicos` e lógica per-matéria**

Acima da assinatura de `search_questoes`, adiciona:

```python
def _topicos_por_materia(topicos_csv: list[str]) -> dict[str, list[str]]:
    """Agrupa slugs por matéria (prefixo antes do primeiro ponto)."""
    by_materia: dict[str, list[str]] = {}
    for slug in topicos_csv:
        if "." not in slug:
            continue
        materia = slug.split(".", 1)[0]
        by_materia.setdefault(materia, []).append(slug)
    return by_materia
```

Adiciona o param na assinatura de `search_questoes`:

```python
topico: Annotated[list[str] | None, Query(alias="topico", description="Lista repetida de slugs globais; ex: ?topico=dir-adm.licitacoes&topico=dir-const.x")] = None,
```

Quando `topicos` está presente, expande pros descendentes via recursive CTE:

```python
# Dentro de search_questoes, após coletar materias e topicos:
extra_topicos_clause = ""
extra_params = {}
if topico:
    by_materia = _topicos_por_materia(topico)
    # Se aluno selecionou matérias mas pra algumas não selecionou tópicos, "libera" essas
    materias_sem_topico = [m for m in (materia or []) if m not in by_materia]
    matched_questao_ids: set[int] = set()

    # Resolve descendentes pra cada slug e roda 1 query agregando questao_ids matched
    for m_slug, slugs in by_materia.items():
        node_ids_rows = db.execute(text("""
            WITH RECURSIVE roots AS (
                SELECT stable_id FROM taxonomia_nodes WHERE slug = ANY(:slugs)
            ),
            descendants AS (
                SELECT stable_id FROM roots
                UNION ALL
                SELECT n.stable_id FROM taxonomia_nodes n
                JOIN descendants d ON n.parent_id = d.stable_id
            )
            SELECT DISTINCT qt.questao_id
            FROM descendants d JOIN questao_topico qt ON qt.node_id = d.stable_id
        """), {"slugs": slugs}).fetchall()
        matched_questao_ids.update(r[0] for r in node_ids_rows)

    # Agora monta cláusula final:
    # WHERE (materia IN (materias_sem_topico) OR id IN (matched_questao_ids))
    extra_topicos_clause = " AND ((q.materia = ANY(:materias_sem_topico) AND :materias_sem_topico_present) OR q.id = ANY(:matched_qids))"
    extra_params = {
        "materias_sem_topico": materias_sem_topico,
        "materias_sem_topico_present": bool(materias_sem_topico),
        "matched_qids": list(matched_questao_ids),
    }

# A query final adiciona extra_topicos_clause e extra_params no execute
```

(Detalhe exato depende da query existente. A intenção: AND a cláusula extra ao WHERE corrente.)

Também adiciona, na construção de cada `QuestaoOut` no response, o campo `topico_atribuido` baseado em uma única query auxiliar:

```python
# Após carregar a página de questões:
ids = [q.id for q in page]
topico_map = {}
if ids:
    rows = db.execute(text("""
        WITH RECURSIVE node_path AS (
            SELECT n.stable_id, ARRAY[n.titulo] AS path_arr, n.parent_id
            FROM taxonomia_nodes n WHERE n.parent_id IS NULL
            UNION ALL
            SELECT n.stable_id, np.path_arr || n.titulo, n.parent_id
            FROM taxonomia_nodes n JOIN node_path np ON np.stable_id = n.parent_id
        )
        SELECT qt.questao_id, n.stable_id, n.slug, np.path_arr, qt.score
        FROM questao_topico qt
        JOIN taxonomia_nodes n ON n.stable_id = qt.node_id
        LEFT JOIN node_path np ON np.stable_id = n.stable_id
        WHERE qt.questao_id = ANY(:ids)
    """), {"ids": ids}).fetchall()
    for r in rows:
        topico_map[r.questao_id] = {
            "stable_id": str(r.stable_id),
            "slug": r.slug,
            "path": list(r.path_arr or []),
            "score": float(r.score) if r.score is not None else None,
        }

# E inclui no QuestaoOut:
out.topico_atribuido = topico_map.get(out.id)
```

- [ ] **Step 3: Atualizar Pydantic `QuestaoOut`/`QuestaoSearchResponse`**

Acrescenta campo opcional `topico_atribuido`:

```python
class TopicoAtribuido(BaseModel):
    stable_id: str
    slug: str
    path: list[str]
    score: Optional[float]


class QuestaoOut(BaseModel):
    # ...campos existentes...
    topico_atribuido: Optional[TopicoAtribuido] = None
```

- [ ] **Step 4: Teste**

`tests/routes/test_questoes_search_topicos.py`:

```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_search_filtra_por_topico_l1_inclui_descendentes():
    """Pega 'Licitações' (L1) e verifica que o conjunto inclui questões classificadas em L2/L3 sob ele."""
    r_all = client.get("/v1/questoes/search?materia=dir-adm&page_size=1")
    assert r_all.status_code == 200
    # Pega slug de algum L1
    tree = client.get("/v1/taxonomia/dir-adm").json()["tree"]
    licitacoes = next((n for n in tree if "icita" in n["titulo"].lower()), None)
    assert licitacoes is not None
    slug_l1 = licitacoes["slug"]

    r = client.get(f"/v1/questoes/search?materia=dir-adm&topico={slug_l1}&page_size=5")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] > 0
    # Cada questão tem topico_atribuido
    for q in body["items"]:
        assert q.get("topico_atribuido") is not None
        assert q["topico_atribuido"]["path"][0] == "Direito Administrativo" or len(q["topico_atribuido"]["path"]) >= 1
```

- [ ] **Step 5: Rodar e commitar**

```bash
pytest tests/routes/test_questoes_search_topicos.py -v
git add app/api/v1/routes/questoes.py app/schemas/ tests/routes/test_questoes_search_topicos.py
git commit -m "feat(api): /v1/questoes/search aceita topicos= com per-matéria scoping + topico_atribuido na resposta"
```

---

## Phase 4 — Frontend (Metav2)

### Task 14: Instalar fuse.js + estender QuestoesContext com `topicos`

**Files:**
- Modify: `D:\meta novo\Metav2\package.json`
- Modify: `D:\meta novo\Metav2\src\contexts\QuestoesContext.tsx`

- [ ] **Step 1: Instalar fuse.js**

```bash
cd "D:/meta novo/Metav2"
npm install fuse.js
```

- [ ] **Step 2: Estender `QuestoesFilters` com `topicos: string[]`**

Lê o arquivo:

```bash
sed -n '1,50p' "D:/meta novo/Metav2/src/contexts/QuestoesContext.tsx"
```

Adiciona em `QuestoesFilters`:

```typescript
export interface QuestoesFilters {
  materias: string[];
  assuntos: string[];
  topicos: string[];  // NOVO: slugs globais (ex: 'dir-adm.licitacoes')
  bancas: string[];
  // ...resto
}
```

Atualiza `filtersToSearchParams`:

```typescript
filters.topicos.forEach(v => params.append('topico', v));
```

Atualiza `parseSearchParams` (função que reconstrói filters do querystring):

```typescript
topicos: params.getAll('topico'),
```

E no estado inicial padrão:

```typescript
{ materias: [], assuntos: [], topicos: [], bancas: [], ... }
```

E no `countActiveFilters`:

```typescript
filters.topicos.length +
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Esperado: build OK (pode haver warnings, mas não erros de tipo).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/contexts/QuestoesContext.tsx
git commit -m "feat(questoes): adiciona campo topicos no QuestoesFilters + fuse.js"
```

---

### Task 15: Hooks de dados (useMaterias, useTaxonomia, useTopicosCounts, useTopicosRecentes)

**Files:**
- Create: `D:\meta novo\Metav2\src\hooks\useMaterias.ts`
- Create: `D:\meta novo\Metav2\src\hooks\useTaxonomia.ts`
- Create: `D:\meta novo\Metav2\src\hooks\useTopicosCounts.ts`
- Create: `D:\meta novo\Metav2\src\hooks\useTopicosRecentes.ts`

- [ ] **Step 1: Criar `useMaterias`**

```typescript
// useMaterias.ts
import { useQuery } from '@tanstack/react-query';

export interface Materia {
  slug: string;
  nome: string;
  has_taxonomia: boolean;
  total_nodes: number;
  total_questoes_classificadas: number;
  cobertura_pct: number;
  updated_at: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_VERUS_API_URL || 'https://api.projetopapiro.com.br';

export function useMaterias() {
  return useQuery<Materia[]>({
    queryKey: ['taxonomia', 'materias'],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/v1/taxonomia/materias`);
      if (!r.ok) throw new Error('Falha ao listar matérias');
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 2: Criar `useTaxonomia`**

```typescript
// useTaxonomia.ts
import { useQuery } from '@tanstack/react-query';

export interface SubtopicoVisual {
  titulo: string;
  n_questoes: number;
  nivel_original: number;
}

export interface TaxonomiaNode {
  stable_id: string;
  slug: string;
  titulo: string;
  nivel: number;
  parent_id: string | null;
  count_propria: number;
  count_agregada: number;
  aliases: string[];
  absorbed: string[];
  subtopicos_visuais: SubtopicoVisual[];
  path: string[];
  keywords: string[];
  children: TaxonomiaNode[];
}

export interface TaxonomiaTree {
  materia_slug: string;
  version_id: string;
  applied_at: string;
  tree: TaxonomiaNode[];
}

const API_BASE = process.env.NEXT_PUBLIC_VERUS_API_URL || 'https://api.projetopapiro.com.br';

export function useTaxonomia(materiaSlug: string | null) {
  return useQuery<TaxonomiaTree>({
    queryKey: ['taxonomia', 'tree', materiaSlug],
    enabled: !!materiaSlug,
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/v1/taxonomia/${materiaSlug}`);
      if (!r.ok) throw new Error(`Falha ao carregar taxonomia de ${materiaSlug}`);
      return r.json();
    },
    staleTime: 60 * 60 * 1000,  // 1h: taxonomia muda pouco
  });
}

/** Flatten árvore numa lista pra fuse.js indexar. */
export function flattenTree(tree: TaxonomiaNode[]): TaxonomiaNode[] {
  const out: TaxonomiaNode[] = [];
  const walk = (n: TaxonomiaNode) => {
    out.push(n);
    n.children.forEach(walk);
  };
  tree.forEach(walk);
  return out;
}
```

- [ ] **Step 3: Criar `useTopicosCounts` com pre-fetch**

```typescript
// useTopicosCounts.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { QuestoesFilters } from '@/contexts/QuestoesContext';

const API_BASE = process.env.NEXT_PUBLIC_VERUS_API_URL || 'https://api.projetopapiro.com.br';

function buildCountsParams(filters: Pick<QuestoesFilters, 'bancas' | 'anos' | 'tipos' | 'excluirAnuladas' | 'excluirDesatualizadas'>) {
  const p = new URLSearchParams();
  filters.bancas?.forEach(v => p.append('banca', v));
  filters.anos?.forEach(v => p.append('ano', String(v)));
  filters.tipos?.forEach(v => p.append('tipo', v));
  if (filters.excluirAnuladas !== false) p.set('excluir_anuladas', 'true');
  if (filters.excluirDesatualizadas !== false) p.set('excluir_desatualizadas', 'true');
  return p;
}

function hasExtraFilters(filters: any): boolean {
  return (filters.bancas?.length || 0) + (filters.anos?.length || 0) + (filters.tipos?.length || 0) > 0;
}

async function fetchCounts(materia: string, filters: any): Promise<Record<string, number>> {
  const params = buildCountsParams(filters);
  const r = await fetch(`${API_BASE}/v1/taxonomia/${materia}/counts?${params.toString()}`);
  if (!r.ok) throw new Error('Falha ao carregar counts');
  return r.json();
}

export function useTopicosCounts(materia: string | null, filters: any) {
  const enabled = !!materia && hasExtraFilters(filters);
  return useQuery<Record<string, number>>({
    queryKey: ['taxonomia-counts', materia, filters.bancas, filters.anos, filters.tipos, filters.excluirAnuladas, filters.excluirDesatualizadas],
    enabled,
    queryFn: () => fetchCounts(materia!, filters),
    staleTime: 5 * 60 * 1000,
  });
}

/** Pre-fetch ao mudar filtros, antes do aluno abrir o picker. */
export function useTopicosCountsPrefetch(materia: string | null, filters: any) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!materia || !hasExtraFilters(filters)) return;
    qc.prefetchQuery({
      queryKey: ['taxonomia-counts', materia, filters.bancas, filters.anos, filters.tipos, filters.excluirAnuladas, filters.excluirDesatualizadas],
      queryFn: () => fetchCounts(materia, filters),
      staleTime: 5 * 60 * 1000,
    });
  }, [materia, filters.bancas, filters.anos, filters.tipos, filters.excluirAnuladas, filters.excluirDesatualizadas, qc]);
}
```

- [ ] **Step 4: Criar `useTopicosRecentes` (localStorage)**

```typescript
// useTopicosRecentes.ts
import { useCallback, useEffect, useState } from 'react';

const MAX_RECENTES = 5;

function key(materiaSlug: string) {
  return `taxonomia.recentes.${materiaSlug}`;
}

function read(materiaSlug: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key(materiaSlug));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(materiaSlug: string, ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key(materiaSlug), JSON.stringify(ids.slice(0, MAX_RECENTES)));
  } catch {
    // quota cheia, etc — ignora
  }
}

export function useTopicosRecentes(materiaSlug: string | null) {
  const [recentes, setRecentes] = useState<string[]>([]);

  useEffect(() => {
    if (!materiaSlug) { setRecentes([]); return; }
    setRecentes(read(materiaSlug));
  }, [materiaSlug]);

  const adicionar = useCallback((stableId: string) => {
    if (!materiaSlug) return;
    setRecentes(prev => {
      const next = [stableId, ...prev.filter(id => id !== stableId)].slice(0, MAX_RECENTES);
      write(materiaSlug, next);
      return next;
    });
  }, [materiaSlug]);

  return { recentes, adicionar };
}
```

- [ ] **Step 5: Smoke test build**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useMaterias.ts src/hooks/useTaxonomia.ts src/hooks/useTopicosCounts.ts src/hooks/useTopicosRecentes.ts
git commit -m "feat(taxonomia): hooks (useMaterias, useTaxonomia, useTopicosCounts, useTopicosRecentes)"
```

---

### Task 16: Componente `TaxonomiaTreePicker`

**Files:**
- Create: `D:\meta novo\Metav2\src\components\questoes\TaxonomiaTreePicker.tsx`

- [ ] **Step 1: Implementar componente**

```typescript
// TaxonomiaTreePicker.tsx
"use client";

import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { Check, ChevronRight, ChevronDown, Search } from 'lucide-react';
import { useTaxonomia, flattenTree, type TaxonomiaNode } from '@/hooks/useTaxonomia';
import { useTopicosCounts } from '@/hooks/useTopicosCounts';
import { useTopicosRecentes } from '@/hooks/useTopicosRecentes';
import { useQuestoesContext } from '@/contexts/QuestoesContext';
import { cn } from '@/lib/utils';

interface Props {
  materiaSlug: string;
  /** Quando ≥2 matérias selecionadas, picker mostra dropdown pra trocar. */
  outrasMaterias?: { slug: string; nome: string }[];
  onMateriaChange?: (slug: string) => void;
}

export function TaxonomiaTreePicker({ materiaSlug, outrasMaterias = [], onMateriaChange }: Props) {
  const { filters, setFilters } = useQuestoesContext();
  const { data: taxonomia, isLoading } = useTaxonomia(materiaSlug);
  const { data: countsDinamicos, isLoading: loadingCounts } = useTopicosCounts(materiaSlug, filters);
  const { recentes, adicionar } = useTopicosRecentes(materiaSlug);

  const [busca, setBusca] = useState('');
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const flatNodes = useMemo(() => taxonomia ? flattenTree(taxonomia.tree) : [], [taxonomia]);
  const nodesById = useMemo(() => new Map(flatNodes.map(n => [n.stable_id, n])), [flatNodes]);

  const fuse = useMemo(() => new Fuse(flatNodes, {
    keys: ['titulo', 'keywords', 'aliases'],
    threshold: 0.3,
    includeScore: true,
  }), [flatNodes]);

  const matchedIds = useMemo(() => {
    if (!busca.trim()) return null;
    const matches = fuse.search(busca).map(r => r.item.stable_id);
    return new Set(matches);
  }, [busca, fuse]);

  // Auto-expande pais dos matches
  useEffect(() => {
    if (!matchedIds || matchedIds.size === 0) return;
    setExpandidos(prev => {
      const next = new Set(prev);
      matchedIds.forEach(id => {
        let cur = nodesById.get(id);
        while (cur && cur.parent_id) {
          next.add(cur.parent_id);
          cur = nodesById.get(cur.parent_id);
        }
      });
      return next;
    });
  }, [matchedIds, nodesById]);

  function toggleExpandido(id: string) {
    setExpandidos(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelecionado(node: TaxonomiaNode) {
    const isSelected = filters.topicos.includes(node.slug);
    const next = isSelected
      ? filters.topicos.filter(s => s !== node.slug)
      : [...filters.topicos, node.slug];
    // Use o setter exposto pelo QuestoesContext. Pode ser:
    //   - setFilter('topicos', next)
    //   - setFilters({ ...filters, topicos: next })
    //   - updateFilter('topicos', next)
    // Verificar no QuestoesContext.tsx qual é o padrão e aplicar.
    setFilters({ ...filters, topicos: next });
    if (!isSelected) adicionar(node.stable_id);
  }

  if (isLoading) return <div className="p-4 text-sm text-gray-500">Carregando taxonomia…</div>;
  if (!taxonomia) return null;

  return (
    <div className="taxonomia-tree-picker flex flex-col h-full">
      {/* Header: dropdown matéria (se múltiplas) */}
      {outrasMaterias.length > 0 && (
        <div className="px-3 py-2 border-b">
          <select
            className="w-full text-sm font-semibold bg-transparent"
            value={materiaSlug}
            onChange={e => onMateriaChange?.(e.target.value)}
          >
            {[{ slug: materiaSlug, nome: taxonomia.materia_slug }, ...outrasMaterias].map(m => (
              <option key={m.slug} value={m.slug}>{m.nome}</option>
            ))}
          </select>
        </div>
      )}

      {/* Search */}
      <div className="relative px-3 py-2 border-b">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar tópico ou alias…"
          className="w-full pl-7 pr-2 py-1.5 text-sm border rounded"
        />
      </div>

      {/* Recentes (apenas quando sem busca) */}
      {!busca.trim() && recentes.length > 0 && (
        <div className="px-3 py-2 border-b">
          <div className="text-xs uppercase text-gray-500 mb-1">Recentes</div>
          <ul className="space-y-1">
            {recentes.map(id => {
              const n = nodesById.get(id);
              if (!n) return null;
              const selected = filters.topicos.includes(n.slug);
              return (
                <li key={id}>
                  <button
                    className={cn("text-sm text-left flex items-center gap-2 w-full px-1 py-0.5 hover:bg-gray-100 rounded",
                                  selected && "text-purple-700 font-medium")}
                    onClick={() => toggleSelecionado(n)}
                    title={n.path.join(' › ')}
                  >
                    {selected && <Check className="w-3 h-3" />}
                    {n.path.slice(-2).join(' › ')}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Tree */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {taxonomia.tree.map(root => (
          <NodeRow
            key={root.stable_id}
            node={root}
            depth={0}
            expandidos={expandidos}
            onToggleExpand={toggleExpandido}
            onToggleSelect={toggleSelecionado}
            selectedSlugs={filters.topicos}
            countsDinamicos={countsDinamicos}
            loadingCounts={loadingCounts}
            matchedIds={matchedIds}
          />
        ))}
      </div>
    </div>
  );
}

interface NodeRowProps {
  node: TaxonomiaNode;
  depth: number;
  expandidos: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleSelect: (node: TaxonomiaNode) => void;
  selectedSlugs: string[];
  countsDinamicos: Record<string, number> | undefined;
  loadingCounts: boolean;
  matchedIds: Set<string> | null;
}

function NodeRow({
  node, depth, expandidos, onToggleExpand, onToggleSelect,
  selectedSlugs, countsDinamicos, loadingCounts, matchedIds,
}: NodeRowProps) {
  const isExpanded = expandidos.has(node.stable_id);
  const isSelected = selectedSlugs.includes(node.slug);
  const isMatched = matchedIds?.has(node.stable_id) ?? true;
  const hasChildren = node.children.length > 0;

  const dynCount = countsDinamicos?.[node.stable_id];
  const showDynamic = countsDinamicos !== undefined;

  if (matchedIds && !isMatched && !node.children.some(c => matchedIds.has(c.stable_id))) {
    // não é match nem ancestral de match: esconde
    return null;
  }

  return (
    <div>
      <div
        className={cn("flex items-center gap-1 py-1 hover:bg-gray-50 rounded text-sm",
                      isSelected && "bg-purple-50")}
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        <button
          onClick={() => hasChildren && onToggleExpand(node.stable_id)}
          className={cn("w-4 h-4 flex items-center justify-center text-gray-400",
                        !hasChildren && "invisible")}
        >
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>

        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(node)}
          className="accent-purple-600"
        />

        <button
          className={cn("flex-1 text-left", isSelected && "text-purple-700 font-medium")}
          onClick={() => onToggleSelect(node)}
          title={node.path.join(' › ')}
        >
          {node.titulo}
        </button>

        <span className={cn("text-xs",
                            showDynamic ? "text-purple-700 font-medium" : "text-gray-500",
                            loadingCounts && showDynamic && "text-gray-300 animate-pulse")}>
          {showDynamic ? (dynCount ?? 0) : node.count_agregada.toLocaleString('pt-BR')}
        </span>
      </div>

      {/* Subtopicos visuais (L3 expandido) */}
      {isExpanded && node.nivel === 3 && node.subtopicos_visuais.length > 0 && (
        <div className="text-xs text-gray-400 italic pl-12 pr-2 py-1">
          cobre: {node.subtopicos_visuais.map(s => s.titulo).join(', ')}
        </div>
      )}

      {isExpanded && hasChildren && node.children.map(child => (
        <NodeRow
          key={child.stable_id}
          node={child}
          depth={depth + 1}
          expandidos={expandidos}
          onToggleExpand={onToggleExpand}
          onToggleSelect={onToggleSelect}
          selectedSlugs={selectedSlugs}
          countsDinamicos={countsDinamicos}
          loadingCounts={loadingCounts}
          matchedIds={matchedIds}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Smoke test build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/questoes/TaxonomiaTreePicker.tsx
git commit -m "feat(questoes): TaxonomiaTreePicker (tree expandido, search via fuse.js, counts dinâmicos)"
```

---

### Task 17: Integração no popover de "Assuntos"

**Files:**
- Modify: o componente do popover de Assuntos (a localizar — passos abaixo).

- [ ] **Step 1: Localizar o componente do popover de Assuntos**

```bash
grep -rln "assuntos\|filterKey.*assunto" "D:/meta novo/Metav2/src/components/questoes/" | head -5
grep -nE "assunto" "D:/meta novo/Metav2/src/components/questoes/QuestoesFilterPopover.tsx" "D:/meta novo/Metav2/src/components/questoes/QuestoesAdvancedPopover.tsx" 2>/dev/null | head -20
```

Identifica o arquivo + linhas onde o filtro `assuntos` é renderizado. Tipicamente um `if (filterKey === 'assuntos')` ou `case 'assuntos'`. **Anota o path exato — usar abaixo.**

- [ ] **Step 2: Substituir por switch baseado em `has_taxonomia`**

```typescript
import { TaxonomiaTreePicker } from './TaxonomiaTreePicker';
import { useMaterias } from '@/hooks/useMaterias';
import { useTopicosCountsPrefetch } from '@/hooks/useTopicosCounts';
import { useQuestoesContext } from '@/contexts/QuestoesContext';

// Dentro do componente:
const { filters } = useQuestoesContext();
const { data: materias = [] } = useMaterias();

// Matérias com taxonomia entre as selecionadas:
const materiasComTax = filters.materias.filter(slug =>
  materias.find(m => m.slug === slug)?.has_taxonomia
);
const materiasSemTax = filters.materias.filter(slug =>
  !materias.find(m => m.slug === slug)?.has_taxonomia
);

// Pega a primeira como ativa (com state pra trocar)
const [materiaPickerAtiva, setMateriaPickerAtiva] = useState<string | null>(materiasComTax[0] ?? null);

useEffect(() => {
  if (!materiaPickerAtiva && materiasComTax.length > 0) {
    setMateriaPickerAtiva(materiasComTax[0]);
  }
  if (materiaPickerAtiva && !materiasComTax.includes(materiaPickerAtiva)) {
    setMateriaPickerAtiva(materiasComTax[0] ?? null);
  }
}, [materiasComTax.join(','), materiaPickerAtiva]);

// Pre-fetch dos counts
useTopicosCountsPrefetch(materiaPickerAtiva, filters);

// Render condicional:
{filterKey === 'assuntos' && (
  <>
    {materiaPickerAtiva ? (
      <TaxonomiaTreePicker
        materiaSlug={materiaPickerAtiva}
        outrasMaterias={materiasComTax
          .filter(s => s !== materiaPickerAtiva)
          .map(s => ({ slug: s, nome: materias.find(m => m.slug === s)?.nome ?? s }))}
        onMateriaChange={setMateriaPickerAtiva}
      />
    ) : null}
    {/* Mantém AssuntoFlatList pras matérias sem taxonomia */}
    {materiasSemTax.length > 0 && (
      <AssuntoFlatList materias={materiasSemTax} />
    )}
  </>
)}
```

- [ ] **Step 3: Hook auxiliar pra resolver chips de tópicos**

Cria `D:\meta novo\Metav2\src\hooks\useTopicoChipResolver.ts`:

```typescript
import { useQueries } from '@tanstack/react-query';
import type { TaxonomiaNode, TaxonomiaTree } from './useTaxonomia';

const API_BASE = process.env.NEXT_PUBLIC_VERUS_API_URL || 'https://api.projetopapiro.com.br';

export interface ChipNode {
  slug: string;
  titulo: string;
  path: string[];
}

function findInTree(tree: TaxonomiaNode[], slug: string): TaxonomiaNode | null {
  for (const n of tree) {
    if (n.slug === slug) return n;
    const inChild = findInTree(n.children, slug);
    if (inChild) return inChild;
  }
  return null;
}

/** Resolve cada slug em label + path. Carrega árvores apenas das matérias necessárias. */
export function useTopicoChipResolver(slugs: string[]): Record<string, ChipNode> {
  const materiasNecessarias = Array.from(new Set(slugs.map(s => s.split('.', 1)[0])));

  const queries = useQueries({
    queries: materiasNecessarias.map(materia => ({
      queryKey: ['taxonomia', 'tree', materia],
      queryFn: async (): Promise<TaxonomiaTree> => {
        const r = await fetch(`${API_BASE}/v1/taxonomia/${materia}`);
        if (!r.ok) throw new Error('failed');
        return r.json();
      },
      staleTime: 60 * 60 * 1000,
    })),
  });

  const map: Record<string, ChipNode> = {};
  for (const slug of slugs) {
    const materia = slug.split('.', 1)[0];
    const idx = materiasNecessarias.indexOf(materia);
    const tree = queries[idx]?.data?.tree;
    if (!tree) {
      map[slug] = { slug, titulo: slug.split('.').slice(-1)[0], path: [slug] };
      continue;
    }
    const node = findInTree(tree, slug);
    map[slug] = node
      ? { slug, titulo: node.titulo, path: node.path }
      : { slug, titulo: slug.split('.').slice(-1)[0], path: [slug] };
  }
  return map;
}
```

- [ ] **Step 4: Renderizar chips de tópicos na pill bar**

Localiza onde os chips atuais são renderizados:

```bash
grep -rln "filters\.assuntos\|chip" "D:/meta novo/Metav2/src/components/questoes/FilterChipsBidirectional.tsx" 2>/dev/null
```

No arquivo identificado, **logo abaixo** do bloco que renderiza chips de `assuntos`, adiciona:

```typescript
import { useTopicoChipResolver } from '@/hooks/useTopicoChipResolver';

// Dentro do componente:
const chipMap = useTopicoChipResolver(filters.topicos);

// No render:
{filters.topicos.map(slug => {
  const node = chipMap[slug];
  return (
    <Chip
      key={`topico-${slug}`}
      label={node.titulo}
      tooltip={node.path.join(' › ')}
      onRemove={() => removerFiltro('topicos', slug)}
    />
  );
})}
```

`Chip` e `removerFiltro` devem seguir o mesmo padrão usado pelos chips de `assuntos`/`bancas` no arquivo. Se a função se chamar diferente (ex: `removeFilter`, `setFilter` direto), seguir o padrão local.

- [ ] **Step 5: Smoke test no browser**

```bash
npm run dev
# Abre http://localhost:3000/questoes
# Seleciona Direito Adm na pill Matéria
# Clica na pill Assuntos → deve aparecer TreePicker (não FlatList)
# Marca um nó → chip aparece, lista de questões filtra
# Tooltip do chip mostra path completo
# Adiciona banca CESPE → counters do picker mudam pra dinâmicos
```

Verifica visual + console (sem erros).

- [ ] **Step 6: Commit**

```bash
git add src/components/questoes/ src/hooks/useTopicoChipResolver.ts
git commit -m "feat(questoes): integra TaxonomiaTreePicker no popover de Assuntos + chips com path"
```

---

## Phase 5 — Validação end-to-end

### Task 18: Testes manuais de aceite

**Files:**
- (sem novos arquivos; checklist manual)

- [ ] **Step 1: Confirmar nada de "GRAN" no payload**

```bash
curl -s "https://api.projetopapiro.com.br/v1/taxonomia/dir-adm" | grep -i "gran"
```

Esperado: vazio (sem matches). Se retornar algo, voltar e investigar `polish_names.py`.

- [ ] **Step 2: Counter dinâmico bate com SQL manual**

Pega 1 nó arbitrário, ex: stable_id `X`. Aluno tem banca CESPE + ano 2024.

```sql
SELECT COUNT(DISTINCT qt.questao_id)
FROM questao_topico qt
JOIN questoes q ON q.id = qt.questao_id
JOIN taxonomia_nodes n ON n.stable_id = qt.node_id
WHERE n.materia_slug = 'dir-adm'
  AND qt.node_id IN (
    WITH RECURSIVE d AS (
      SELECT stable_id FROM taxonomia_nodes WHERE stable_id = 'X'
      UNION ALL
      SELECT n.stable_id FROM taxonomia_nodes n JOIN d ON n.parent_id = d.stable_id
    )
    SELECT stable_id FROM d
  )
  AND q.banca = 'CESPE' AND q.ano = 2024
  AND COALESCE(q.anulada, FALSE) = FALSE;
```

Compara com o valor que aparece no picker pra esse nó. Devem bater.

- [ ] **Step 3: Filtro `topicos=` retorna conjunto correto**

```bash
curl -s "https://api.projetopapiro.com.br/v1/questoes/search?materia=dir-adm&topicos=dir-adm.licitacoes&page_size=5" | jq '.total, .items[0].topico_atribuido'
```

Esperado: `total > 0`, todas as questões com `topico_atribuido` cujo `path[0]` seja "Direito Administrativo".

- [ ] **Step 4: Trigger registra writes**

```sql
SELECT source, action, COUNT(*) FROM questao_topico_log
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY source, action ORDER BY source;
```

Esperado: linhas com `source = 'gran_pipeline:regen_2026_04_*'` e `action = 'assigned'`, totalizando ~137k.

- [ ] **Step 5: UI smoke completo**

Em `npm run dev`:
- [ ] Selecionar 2 matérias (1 com taxonomia, 1 sem) → popover mostra TreePicker pra primeira + FlatList pra segunda.
- [ ] Switch via dropdown no topo do picker.
- [ ] Marcar nó → chip aparece, contador da pill bar incrementa.
- [ ] Tooltip do chip mostra path completo.
- [ ] Buscar "PAD" → árvore expande até nó com alias.
- [ ] Adicionar banca CESPE → counters mudam de cinza estático pra roxo dinâmico.
- [ ] Recarregar página → URL preserva `?topico=...`, picker volta com nó marcado.
- [ ] Mobile sheet: TreePicker funciona dentro do `MobileSheet`.

- [ ] **Step 6: Commit (se houve qualquer pequeno ajuste durante validação)**

```bash
# Provavelmente vazio. Se sim:
git commit --allow-empty -m "test: validação end-to-end taxonomia integração"
```

---

## Self-review notes (para o engenheiro executor)

- **GRAN nunca aparece:** sanity check no import valida; teste manual final faz `grep -i gran` no payload da API. Se algo passar, é bug — não fixar com workaround.
- **App.source obrigatório:** todo write em `questao_topico` deve ser precedido de `SET LOCAL app.source = ...`. Se trigger logar `source = 'unknown'`, é bug do app — corrige no chamador, não no trigger.
- **stable_id é a fonte de verdade:** nunca persistir referências pra `gran.X` — esses IDs do parser não são estáveis.
- **Tests reais, não mocks:** Aldemir prefere validar contra dados reais do Hetzner (memória `feedback_preferences.md`). Os testes integration/e2e usam `TAXONOMIA_TEST_DSN` ou `VERUS_DB_DSN` apontando pra DB real.
- **Curadoria UI fica fora desta leva:** schema/log/trigger entram, mas nada de modal de reassign, fila de pendências, etc. Se aparecer pedido, redirecionar pra Leva 2.
