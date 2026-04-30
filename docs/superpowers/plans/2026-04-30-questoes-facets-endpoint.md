# Plano 3b-pre — Endpoint de facets de questões (verus-api)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar `GET /api/v1/questoes/facets` na verus-api, retornando contagem agregada **contextual** (Algolia-style "disjunctive facets") por campo de filtro, com cache Redis. Pré-requisito do Plano 3b (pickers do drawer com counts em tempo real).

**Architecture:** Reusar `QuestaoSearchFilters` como contrato de query params (idêntico ao `/count`). Adicionar `QuestaoService.facets_only` que executa uma `GROUP BY` por campo facetado, aplicando todos os filtros **exceto** o do próprio campo (disjunctive faceting — permite expandir seleção dentro do mesmo campo). Cache Redis com TTL 30min, key SHA256 derivada dos filtros normalizados, prefixo `questoes:facets:`. Reusa singleton `get_redis()`.

**Tech Stack:** Python 3.x · FastAPI · SQLAlchemy · PostgreSQL · Redis · pytest

**Repo alvo:** `D:/verus_api`

**Spec:** `docs/superpowers/specs/2026-04-29-questoes-inline-drawer-filtros-design.md` (seção "Decisões resolvidas no brainstorm de Plan 3b")

---

## Pré-flight

- [ ] **Step 0.1: Verificar branch e estado limpo**

```bash
cd /d/verus_api
git status
git branch --show-current
```

Expected: working tree limpo. Branch atual = `main`.

- [ ] **Step 0.2: Criar branch novo**

```bash
git checkout -b feat/questoes-facets-endpoint
```

Expected: `Switched to a new branch 'feat/questoes-facets-endpoint'`

- [ ] **Step 0.3: Confirmar baseline pytest verde**

```bash
pytest tests/services/ tests/api/ -q
```

Expected: todos passam.

---

## Task 1: Schema `QuestaoFacetsResponse`

**Files:**
- Modify: `D:/verus_api/app/schemas/questao.py`

- [ ] **Step 1.1: Adicionar schema**

Localizar o bloco de `QuestaoCountResponse` em `app/schemas/questao.py` (criado no Plano 1) e adicionar imediatamente após:

```python
class QuestaoFacetsResponse(BaseModel):
    """Resposta da rota de facets em tempo real (Algolia-style disjunctive faceting)."""

    facets: dict[str, dict[str, int]] = Field(
        ...,
        description=(
            "Contagem agregada por campo. Chaves: banca, ano, orgao, cargo, "
            "area_concurso, especialidade, tipo, formato. "
            "Cada campo é Record<valor, count> contextual aos filtros aplicados, "
            "exceto o filtro do próprio campo (permite expandir seleção)."
        ),
    )
    took_ms: int = Field(..., description="Tempo de execução em ms (debug)")
    cached: bool = Field(..., description="Se a resposta veio do cache Redis")

    model_config = {
        "json_schema_extra": {
            "example": {
                "facets": {
                    "banca": {"Cespe": 1234567, "FCC": 234567, "FGV": 89012},
                    "ano": {"2024": 89012, "2023": 78901, "2022": 67890},
                    "orgao": {"TRF1": 12345, "STJ": 9876},
                    "cargo": {},
                    "area_concurso": {},
                    "especialidade": {},
                    "tipo": {"multipla_escolha": 234567, "certo_errado": 123456},
                    "formato": {"texto": 345678, "imagem": 12345},
                },
                "took_ms": 45,
                "cached": False,
            }
        }
    }
```

- [ ] **Step 1.2: Smoke import**

```bash
python -c "from app.schemas.questao import QuestaoFacetsResponse; print(QuestaoFacetsResponse(facets={'banca': {'Cespe': 10}}, took_ms=5, cached=False).model_dump())"
```

Expected: dict completo sem erro.

- [ ] **Step 1.3: Commit**

```bash
git add app/schemas/questao.py
git commit -m "feat(schemas): QuestaoFacetsResponse para endpoint de facets"
```

---

## Task 2: Cache helper `questao_facets_cache.py`

**Files:**
- Create: `D:/verus_api/app/services/questao_facets_cache.py`

- [ ] **Step 2.1: Escrever cache helper**

Criar `app/services/questao_facets_cache.py` espelhando `questao_count_cache.py`, mas com prefixo `questoes:facets:` e armazenando JSON (não int):

```python
"""Cache Redis para facets de questões — TTL 30min, fallback graceful."""
from __future__ import annotations
import hashlib
import json
import logging
from typing import Optional, List
from app.schemas.questao import QuestaoSearchFilters
from app.services.taxonomia_cache import get_redis
from app.services.questao_count_cache import normalize_filters_for_cache

logger = logging.getLogger(__name__)

FACETS_CACHE_TTL_SECONDS = 1800


def build_facets_cache_key(
    filters: QuestaoSearchFilters,
    node_ids: Optional[List[int]] = None,
    include_outros: bool = False,
) -> str:
    """Chave determinística baseada nos filtros normalizados + node params. Reusa normalize do count."""
    body = normalize_filters_for_cache(filters)
    if node_ids:
        body["_node_ids"] = sorted(node_ids)
    if include_outros:
        body["_include_outros"] = True
    blob = json.dumps(body, sort_keys=True, ensure_ascii=False)
    h = hashlib.sha256(blob.encode()).hexdigest()[:16]
    return f"questoes:facets:{h}"


def get_cached_facets(key: str) -> Optional[dict]:
    """Retorna dict de facets do cache, ou None se miss / Redis off."""
    r = get_redis()
    if r is None:
        return None
    try:
        cached = r.get(key)
        if cached is not None:
            return json.loads(cached)
    except Exception as e:
        logger.warning(f"Redis GET (facets) falhou para {key}: {e}")
    return None


def set_cached_facets(key: str, facets: dict, ttl: int = FACETS_CACHE_TTL_SECONDS) -> None:
    """Salva facets como JSON no cache. Falha silenciosa."""
    r = get_redis()
    if r is None:
        return
    try:
        r.setex(key, ttl, json.dumps(facets, ensure_ascii=False))
    except Exception as e:
        logger.warning(f"Redis SETEX (facets) falhou para {key}: {e}")
```

- [ ] **Step 2.2: Smoke import**

```bash
python -c "from app.services.questao_facets_cache import build_facets_cache_key, get_cached_facets, set_cached_facets; print('ok')"
```

Expected: `ok`

- [ ] **Step 2.3: Commit**

```bash
git add app/services/questao_facets_cache.py
git commit -m "feat(cache): cache helper para facets de questões"
```

---

## Task 3: Teste unitário do cache key (TDD)

**Files:**
- Create: `D:/verus_api/tests/services/test_questao_facets_cache.py`

- [ ] **Step 3.1: Escrever teste de chave determinística**

```python
"""Testes do cache helper de facets — chave determinística, normalização."""
from app.schemas.questao import QuestaoSearchFilters
from app.services.questao_facets_cache import build_facets_cache_key


def test_key_deterministic_independente_da_ordem():
    """Mesmos filtros em ordens diferentes geram a mesma chave."""
    f1 = QuestaoSearchFilters(bancas=["Cespe", "FCC"], anos=[2024, 2023], page=1, limit=1)
    f2 = QuestaoSearchFilters(bancas=["FCC", "Cespe"], anos=[2023, 2024], page=1, limit=1)
    assert build_facets_cache_key(f1) == build_facets_cache_key(f2)


def test_key_ignora_page_e_limit():
    """Mudanças em page/limit não afetam a chave (irrelevante pra facets)."""
    f1 = QuestaoSearchFilters(bancas=["Cespe"], page=1, limit=1)
    f2 = QuestaoSearchFilters(bancas=["Cespe"], page=99, limit=999)
    assert build_facets_cache_key(f1) == build_facets_cache_key(f2)


def test_key_diferencia_filtros_diferentes():
    """Filtros distintos geram chaves distintas."""
    f1 = QuestaoSearchFilters(bancas=["Cespe"], page=1, limit=1)
    f2 = QuestaoSearchFilters(bancas=["FCC"], page=1, limit=1)
    assert build_facets_cache_key(f1) != build_facets_cache_key(f2)


def test_key_inclui_node_ids():
    """node_ids alteram a chave."""
    f = QuestaoSearchFilters(page=1, limit=1)
    k1 = build_facets_cache_key(f)
    k2 = build_facets_cache_key(f, node_ids=[10, 20])
    assert k1 != k2


def test_key_inclui_include_outros():
    """include_outros altera a chave."""
    f = QuestaoSearchFilters(page=1, limit=1)
    k1 = build_facets_cache_key(f)
    k2 = build_facets_cache_key(f, include_outros=True)
    assert k1 != k2


def test_key_prefixo_questoes_facets():
    """Chave tem prefixo 'questoes:facets:' para isolar do cache de count."""
    f = QuestaoSearchFilters(page=1, limit=1)
    assert build_facets_cache_key(f).startswith("questoes:facets:")
```

- [ ] **Step 3.2: Rodar testes (devem passar — helper já existe)**

```bash
pytest tests/services/test_questao_facets_cache.py -v
```

Expected: 6/6 PASS.

- [ ] **Step 3.3: Commit**

```bash
git add tests/services/test_questao_facets_cache.py
git commit -m "test: cache helper de facets — chave determinística"
```

---

## Task 4: Service `QuestaoService.facets_only` (disjunctive faceting)

**Files:**
- Modify: `D:/verus_api/app/services/questao.py`

- [ ] **Step 4.1: Adicionar método facets_only após count_only**

Localizar `count_only` em `app/services/questao.py:111` e adicionar logo após (antes de `create`):

```python
    @staticmethod
    def facets_only(
        db: Session,
        filters: QuestaoSearchFilters,
        node_ids: Optional[List[int]] = None,
        include_outros: bool = False,
    ) -> dict[str, dict[str, int]]:
        """
        Retorna contagem agregada por campo de filtro (Algolia-style disjunctive facets).

        Para cada campo facetado, executa uma GROUP BY aplicando TODOS os filtros
        EXCETO o filtro do próprio campo. Isso permite o usuário expandir a seleção
        dentro do mesmo campo (ex.: ver counts de outras bancas mesmo com Cespe selecionada).

        Campos facetados: banca, ano, orgao, cargo, area_concurso, especialidade, tipo, formato.
        NÃO inclui materia/assunto (vêm do dicionário/taxonomia).
        """
        from sqlalchemy import func

        # Mapa campo facetado → coluna do model
        facet_columns = {
            "banca": Questao.banca,
            "ano": Questao.ano,
            "orgao": Questao.orgao,
            "cargo": Questao.cargo,
            "area_concurso": Questao.area_concurso,
            "especialidade": Questao.especialidade,
            "tipo": Questao.tipo,
            "formato": Questao.formato,
        }

        # Mapa campo → atributo do filters object (mesmo nome plural)
        facet_filter_attrs = {
            "banca": "bancas",
            "ano": "anos",
            "orgao": "orgaos",
            "cargo": "cargos",
            "area_concurso": "areas_concurso",
            "especialidade": "especialidades",
            "tipo": "tipos",
            "formato": "formatos",
        }

        def _build_conditions(skip_field: Optional[str] = None) -> list:
            """Constrói lista de filtros, opcionalmente pulando o filtro de skip_field."""
            conditions = []

            if filters.materias:
                conditions.append(Questao.materia.in_(filters.materias))
            if filters.assuntos:
                conditions.append(Questao.assunto.in_(filters.assuntos))

            for facet, attr in facet_filter_attrs.items():
                if facet == skip_field:
                    continue
                value = getattr(filters, attr, None)
                if value:
                    conditions.append(facet_columns[facet].in_(value))

            if filters.concurso_id:
                conditions.append(Questao.concurso_id == filters.concurso_id)
            if filters.anulada is not None:
                conditions.append(Questao.anulada == filters.anulada)
            if filters.desatualizada is not None:
                conditions.append(Questao.desatualizada == filters.desatualizada)
            if filters.tem_comentario is not None:
                conditions.append(Questao.tem_comentario == filters.tem_comentario)

            if node_ids is not None or include_outros:
                node_clauses = []
                if node_ids:
                    node_clauses.append(Questao.taxonomia_node_id.in_(node_ids))
                if include_outros:
                    node_clauses.append(
                        and_(Questao.taxonomia_node_id.is_(None), Questao.assunto.isnot(None))
                    )
                if node_clauses:
                    conditions.append(or_(*node_clauses))

            return conditions

        result: dict[str, dict[str, int]] = {}

        for facet, column in facet_columns.items():
            conds = _build_conditions(skip_field=facet)
            q = db.query(column, func.count(Questao.id))
            if conds:
                q = q.filter(and_(*conds))
            q = q.filter(column.isnot(None)).group_by(column)
            result[facet] = {str(value): int(count) for value, count in q.all() if value is not None}

        return result
```

- [ ] **Step 4.2: Smoke import**

```bash
python -c "from app.services.questao import QuestaoService; print(hasattr(QuestaoService, 'facets_only'))"
```

Expected: `True`

- [ ] **Step 4.3: Commit**

```bash
git add app/services/questao.py
git commit -m "feat(service): QuestaoService.facets_only — disjunctive faceting"
```

---

## Task 5: Teste unitário do facets_only (TDD com fixture)

**Files:**
- Create: `D:/verus_api/tests/services/test_questao_facets_service.py`

- [ ] **Step 5.1: Escrever testes de comportamento**

```python
"""Testes do facets_only — disjunctive faceting, filtros aplicados corretamente."""
import pytest
from app.schemas.questao import QuestaoSearchFilters
from app.services.questao import QuestaoService
from app.models.questao import Questao


@pytest.fixture
def seed_questoes(db_session):
    """Seeds 6 questões cobrindo combos de banca/ano/tipo."""
    items = [
        Questao(materia="Direito Adm", banca="Cespe", ano=2024, orgao="TRF1", cargo="Juiz",
                area_concurso="Federal", especialidade=None, tipo="multipla_escolha", formato="texto"),
        Questao(materia="Direito Adm", banca="Cespe", ano=2023, orgao="STJ", cargo="Analista",
                area_concurso="Federal", especialidade=None, tipo="certo_errado", formato="texto"),
        Questao(materia="Direito Adm", banca="FCC", ano=2024, orgao="TRT", cargo="Tecnico",
                area_concurso="Trabalhista", especialidade=None, tipo="multipla_escolha", formato="texto"),
        Questao(materia="Direito Civil", banca="FCC", ano=2023, orgao="TRT", cargo="Analista",
                area_concurso="Trabalhista", especialidade=None, tipo="multipla_escolha", formato="imagem"),
        Questao(materia="Direito Civil", banca="FGV", ano=2022, orgao="TJ", cargo="Juiz",
                area_concurso="Estadual", especialidade=None, tipo="discursiva", formato="texto"),
        Questao(materia="Direito Civil", banca="FGV", ano=2022, orgao="TJ", cargo="Promotor",
                area_concurso="Estadual", especialidade=None, tipo="multipla_escolha", formato="texto"),
    ]
    for q in items:
        db_session.add(q)
    db_session.commit()
    return items


def test_facets_sem_filtros_retorna_todos_valores(db_session, seed_questoes):
    """Sem filtros, cada campo retorna todos os valores distintos com counts corretos."""
    f = QuestaoSearchFilters(page=1, limit=1)
    result = QuestaoService.facets_only(db_session, f)

    assert result["banca"] == {"Cespe": 2, "FCC": 2, "FGV": 2}
    assert result["ano"] == {"2024": 2, "2023": 2, "2022": 2}
    assert result["tipo"] == {"multipla_escolha": 4, "certo_errado": 1, "discursiva": 1}


def test_facets_disjunctive_mostra_outros_valores_do_mesmo_campo(db_session, seed_questoes):
    """Com banca=Cespe selecionada, facet 'banca' ainda mostra FCC e FGV (pra expandir)."""
    f = QuestaoSearchFilters(bancas=["Cespe"], page=1, limit=1)
    result = QuestaoService.facets_only(db_session, f)

    # banca: ignora filtro de banca → mostra todas
    assert result["banca"] == {"Cespe": 2, "FCC": 2, "FGV": 2}
    # ano: aplica filtro de banca=Cespe → só anos com Cespe
    assert result["ano"] == {"2024": 1, "2023": 1}


def test_facets_aplica_outros_filtros_em_campo_facetado(db_session, seed_questoes):
    """Com materia=Direito Adm, facet 'banca' só conta questões dessa matéria."""
    f = QuestaoSearchFilters(materias=["Direito Adm"], page=1, limit=1)
    result = QuestaoService.facets_only(db_session, f)

    assert result["banca"] == {"Cespe": 2, "FCC": 1}


def test_facets_combinacao_de_filtros(db_session, seed_questoes):
    """materia + ano filtram juntos, mas facet 'ano' continua mostrando todos os anos da materia."""
    f = QuestaoSearchFilters(materias=["Direito Civil"], anos=[2022], page=1, limit=1)
    result = QuestaoService.facets_only(db_session, f)

    # ano: ignora filtro de ano → mostra anos da materia=Civil
    assert result["ano"] == {"2023": 1, "2022": 2}
    # banca: aplica materia + ano → só FGV em 2022 Civil
    assert result["banca"] == {"FGV": 2}


def test_facets_ignora_valores_null(db_session, seed_questoes):
    """Campo especialidade é todo NULL no seed → retorna {}."""
    f = QuestaoSearchFilters(page=1, limit=1)
    result = QuestaoService.facets_only(db_session, f)
    assert result["especialidade"] == {}


def test_facets_retorna_todos_8_campos(db_session, seed_questoes):
    """Resposta sempre tem as 8 chaves esperadas."""
    f = QuestaoSearchFilters(page=1, limit=1)
    result = QuestaoService.facets_only(db_session, f)
    expected = {"banca", "ano", "orgao", "cargo", "area_concurso", "especialidade", "tipo", "formato"}
    assert set(result.keys()) == expected
```

- [ ] **Step 5.2: Rodar testes (devem passar — service existe)**

```bash
pytest tests/services/test_questao_facets_service.py -v
```

Expected: 6/6 PASS.

> **Se falhar por fixture `db_session` inexistente:** verificar `tests/conftest.py` no repo. Se não houver fixture de DB, copiar padrão de `tests/services/test_questao_count_service.py` (criado no Plano 1) ou marcar testes como `@pytest.mark.skip(reason="requer DB local")` e validar via Coolify (ver Task 8).

- [ ] **Step 5.3: Commit**

```bash
git add tests/services/test_questao_facets_service.py
git commit -m "test(service): facets_only — disjunctive faceting, 6 cenários"
```

---

## Task 6: Rota `GET /api/v1/questoes/facets`

**Files:**
- Modify: `D:/verus_api/app/api/v1/routes/questoes.py`

- [ ] **Step 6.1: Importar dependências do facets**

Localizar imports no topo de `questoes.py` (linha ~37) e adicionar após o import de `questao_count_cache`:

```python
from app.services.questao_facets_cache import (
    build_facets_cache_key,
    get_cached_facets,
    set_cached_facets,
)
```

E adicionar `QuestaoFacetsResponse` ao import de schemas (mesma linha onde está `QuestaoCountResponse`).

- [ ] **Step 6.2: Adicionar rota após /count**

Localizar fim de `count_questoes` em `questoes.py:405` e adicionar após (antes de `/images/migration-status`):

```python
@router.get("/facets", response_model=QuestaoFacetsResponse)
@limiter.limit("60/minute")
def facets_questoes(
    request: Request,
    materias: Optional[List[str]] = Query(None),
    assuntos: Optional[List[str]] = Query(None),
    bancas: Optional[List[str]] = Query(None),
    orgaos: Optional[List[str]] = Query(None),
    cargos: Optional[List[str]] = Query(None),
    anos: Optional[List[int]] = Query(None),
    concurso_id: Optional[int] = Query(None),
    areas_concurso: Optional[List[str]] = Query(None),
    especialidades: Optional[List[str]] = Query(None),
    tipos: Optional[List[str]] = Query(None),
    formatos: Optional[List[str]] = Query(None),
    anulada: Optional[bool] = Query(None),
    desatualizada: Optional[bool] = Query(None),
    tem_comentario: Optional[bool] = Query(None),
    node: Optional[List[str]] = Query(None, description="Filtro por nó(s) da taxonomia: integer ID ou 'outros'"),
    db: Session = Depends(get_db),
):
    """
    Retorna contagem agregada (Algolia-style disjunctive facets) por campo.

    Para cada campo facetado (banca, ano, orgao, cargo, area_concurso, especialidade,
    tipo, formato), aplica todos os filtros EXCETO o do próprio campo, permitindo
    expandir seleção sem perder visibilidade dos demais valores.

    NÃO inclui facets de `materia` nem `assunto` (vêm do dicionário/taxonomia).

    Cache Redis com TTL 30min, key SHA256 dos filtros normalizados.
    Aceita os mesmos filtros que `/count`.
    """
    start = time.perf_counter()

    def _noneif_empty(v):
        return None if (v is None or v == []) else v

    filters = QuestaoSearchFilters(
        materias=_noneif_empty(materias),
        assuntos=_noneif_empty(assuntos),
        bancas=_noneif_empty(bancas),
        orgaos=_noneif_empty(orgaos),
        cargos=_noneif_empty(cargos),
        anos=_noneif_empty(anos),
        concurso_id=concurso_id,
        areas_concurso=_noneif_empty(areas_concurso),
        especialidades=_noneif_empty(especialidades),
        tipos=_noneif_empty(tipos),
        formatos=_noneif_empty(formatos),
        anulada=anulada,
        desatualizada=desatualizada,
        tem_comentario=tem_comentario,
        page=1,
        limit=1,
    )

    # Resolver filtro de nós da taxonomia (mesma lógica de /count)
    node_ids: Optional[List[int]] = None
    include_outros: bool = False
    if node:
        from app.services import taxonomia_repository as repo
        node_ids = []
        for n in node:
            if n == "outros":
                include_outros = True
            else:
                try:
                    root = int(n)
                except ValueError:
                    raise HTTPException(status_code=400, detail=f"Parâmetro node inválido: {n!r} (esperado inteiro ou 'outros')")
                node_ids.extend(repo.descendant_ids(db, root))
        node_ids = list(dict.fromkeys(node_ids)) if node_ids else None

    # Cache lookup
    cache_key = build_facets_cache_key(filters, node_ids=node_ids, include_outros=include_outros)
    cached = get_cached_facets(cache_key)

    if cached is not None:
        took_ms = int((time.perf_counter() - start) * 1000)
        return QuestaoFacetsResponse(facets=cached, took_ms=took_ms, cached=True)

    # Cache miss → computa e armazena
    facets = QuestaoService.facets_only(db, filters, node_ids=node_ids, include_outros=include_outros)
    set_cached_facets(cache_key, facets)

    took_ms = int((time.perf_counter() - start) * 1000)
    return QuestaoFacetsResponse(facets=facets, took_ms=took_ms, cached=False)
```

- [ ] **Step 6.3: Smoke do app FastAPI**

```bash
python -c "from app.main import app; print([r.path for r in app.routes if 'facets' in r.path])"
```

Expected: lista contendo `/api/v1/questoes/facets`.

- [ ] **Step 6.4: Commit**

```bash
git add app/api/v1/routes/questoes.py
git commit -m "feat(api): GET /api/v1/questoes/facets com cache Redis"
```

---

## Task 7: Teste de integração da rota

**Files:**
- Create: `D:/verus_api/tests/api/test_questoes_facets_route.py`

- [ ] **Step 7.1: Escrever teste de rota com TestClient**

```python
"""Teste de integração da rota /api/v1/questoes/facets."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_facets_endpoint_responde_200(seed_questoes):
    """Rota retorna 200 com payload válido."""
    r = client.get("/api/v1/questoes/facets")
    assert r.status_code == 200
    body = r.json()
    assert "facets" in body
    assert "took_ms" in body
    assert "cached" in body
    assert isinstance(body["facets"], dict)


def test_facets_endpoint_filtra_por_banca(seed_questoes):
    """Filtro de banca afeta facet de ano (mas não o próprio facet de banca)."""
    r = client.get("/api/v1/questoes/facets?bancas=Cespe")
    assert r.status_code == 200
    body = r.json()
    # banca: disjunctive — mostra todas
    assert "Cespe" in body["facets"]["banca"]
    assert "FCC" in body["facets"]["banca"]
    # ano: filtrado por Cespe
    assert "2022" not in body["facets"]["ano"]  # não há Cespe em 2022


def test_facets_endpoint_cache_hit(seed_questoes):
    """Segunda chamada com mesmos filtros vem do cache."""
    r1 = client.get("/api/v1/questoes/facets?bancas=Cespe")
    r2 = client.get("/api/v1/questoes/facets?bancas=Cespe")
    assert r1.json()["cached"] is False
    assert r2.json()["cached"] is True
    assert r1.json()["facets"] == r2.json()["facets"]


def test_facets_endpoint_node_invalido_400(seed_questoes):
    """node não-inteiro e não-'outros' retorna 400."""
    r = client.get("/api/v1/questoes/facets?node=banana")
    assert r.status_code == 400
```

- [ ] **Step 7.2: Rodar testes**

```bash
pytest tests/api/test_questoes_facets_route.py -v
```

Expected: 4/4 PASS (ou skip se DB/Redis indisponível localmente — validar em Coolify na Task 8).

- [ ] **Step 7.3: Commit**

```bash
git add tests/api/test_questoes_facets_route.py
git commit -m "test(api): integração da rota /questoes/facets"
```

---

## Task 8: Push, PR, validação em Coolify

- [ ] **Step 8.1: Push branch**

```bash
git push -u origin feat/questoes-facets-endpoint
```

Expected: URL para abrir PR.

- [ ] **Step 8.2: Criar PR**

Título: `feat(api): /api/v1/questoes/facets — disjunctive faceting com cache Redis`

Body:
```markdown
## Summary
- Novo endpoint `GET /api/v1/questoes/facets` retorna counts agregados por campo (banca, ano, órgão, cargo, area_concurso, especialidade, tipo, formato)
- Disjunctive faceting (Algolia-style): cada campo aplica todos os filtros EXCETO o próprio
- Cache Redis 30min, key SHA256 com prefixo `questoes:facets:`
- Pré-requisito do Plano 3b (pickers do drawer com counts)

## Test plan
- [ ] Cache key determinística (6 testes)
- [ ] facets_only correto (6 testes — disjunctive, combinações, NULL)
- [ ] Rota responde 200 + filtros + cache hit + node inválido (4 testes)
- [ ] Validação produção: curl em api.projetopapiro.com.br pós-deploy
```

- [ ] **Step 8.3: Após merge, validar em Coolify**

Esperar deploy automático (~2min após merge), depois:

```bash
# Total geral (sem filtros)
curl -s "https://api.projetopapiro.com.br/api/v1/questoes/facets" | jq '.facets | keys'
```

Expected: `["ano","area_concurso","banca","cargo","especialidade","formato","orgao","tipo"]`

```bash
# Cache miss + counts contextual
curl -s "https://api.projetopapiro.com.br/api/v1/questoes/facets?bancas=Cespe" | jq '{cached, took_ms, banca_keys: (.facets.banca | keys)}'
```

Expected: `cached: false`, `took_ms` > 0, `banca_keys` inclui "Cespe" e outras (disjunctive).

```bash
# Cache hit (segunda chamada)
curl -s "https://api.projetopapiro.com.br/api/v1/questoes/facets?bancas=Cespe" | jq '{cached, took_ms}'
```

Expected: `cached: true`, `took_ms` < 10ms.

- [ ] **Step 8.4: Validação OK → marcar Plano 3b como desbloqueado**

Criar comentário no PR: `Validado em produção. /facets responde com cache Redis funcionando. Frontend (Plano 3b) liberado.`

---

## Critérios de aceite

- [ ] Endpoint `/api/v1/questoes/facets` responde 200 com payload `{facets, took_ms, cached}`
- [ ] Os 8 campos sempre presentes em `facets`, mesmo que vazios
- [ ] Disjunctive faceting funciona: filtro de banca não afeta facet de banca, mas afeta os outros
- [ ] Cache Redis com TTL 30min, prefixo `questoes:facets:` (isolado do `/count`)
- [ ] Não inclui `materia` nem `assunto` (decisão de spec)
- [ ] Rate limit: 60/minute (metade do `/count` — query mais cara)
- [ ] Validado em produção via curl

## Fora de escopo

- Facets de `materia` e `assunto` (vêm de `useFiltrosDicionario` e `useTaxonomia`)
- Invalidação de cache em ingestão (TTL natural cobre — mesma decisão do `/count`)
- Frontend que consome o endpoint (Plano 3b)
