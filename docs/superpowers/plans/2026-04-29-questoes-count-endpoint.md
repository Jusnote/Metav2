# Plano 1 — Endpoint de count de questões (verus-api)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar `GET /api/v1/questoes/count` na verus-api, retornando contagem em tempo real para um conjunto de filtros, com cache Redis. Pré-requisito do Leva 2 (Inline Drawer de Filtros).

**Architecture:** Reusar `QuestaoSearchFilters` existente como contrato de query params. Adicionar `QuestaoService.count_only` (espelha a lógica de filtros de `QuestaoService.get_all` mas só executa `COUNT(*)` sem paginação/ordenação). Cache Redis com TTL 30min, key derivada do hash dos filtros normalizados. Reusa singleton `get_redis()` de `taxonomia_cache.py`.

**Tech Stack:** Python 3.x · FastAPI · SQLAlchemy · PostgreSQL · Redis · pytest

**Repo alvo:** `D:/verus_api`

**Spec:** `docs/superpowers/specs/2026-04-29-questoes-inline-drawer-filtros-design.md` (seção (4) Contagem em tempo real)

---

## Pré-flight

- [ ] **Step 0.1: Verificar branch e estado limpo do repo verus-api**

```bash
cd /d/verus_api
git status
git branch --show-current
```

Expected: working tree limpo. Branch atual = `main` (ou trocar pra `main` antes de começar).

- [ ] **Step 0.2: Criar branch novo**

```bash
git checkout -b feat/questoes-count-endpoint
```

Expected: `Switched to a new branch 'feat/questoes-count-endpoint'`

- [ ] **Step 0.3: Confirmar que pytest roda limpo na baseline**

```bash
pytest tests/services/ -q
```

Expected: todos passam (baseline verde antes de começar).

---

## Task 1: Schema `QuestaoCountResponse`

**Files:**
- Modify: `D:/verus_api/app/schemas/questao.py` (adicionar classe ao final, antes do último export)

- [ ] **Step 1.1: Adicionar schema de resposta**

Localizar o bloco de `QuestaoSearchResponse` em `app/schemas/questao.py:264` e adicionar imediatamente após:

```python
class QuestaoCountResponse(BaseModel):
    """Resposta da rota de count em tempo real (sem paginação)."""

    count: int = Field(..., description="Total de questões que atendem aos filtros")
    took_ms: int = Field(..., description="Tempo de execução do query em ms (debug)")
    cached: bool = Field(..., description="Se a resposta veio do cache Redis")

    model_config = {"json_schema_extra": {"example": {"count": 3886057, "took_ms": 12, "cached": True}}}
```

- [ ] **Step 1.2: Smoke import**

```bash
python -c "from app.schemas.questao import QuestaoCountResponse; print(QuestaoCountResponse(count=10, took_ms=5, cached=False).model_dump())"
```

Expected: `{'count': 10, 'took_ms': 5, 'cached': False}`

- [ ] **Step 1.3: Commit**

```bash
git add app/schemas/questao.py
git commit -m "feat(schemas): QuestaoCountResponse para endpoint de count"
```

---

## Task 2: Método `QuestaoService.count_only`

**Files:**
- Modify: `D:/verus_api/app/services/questao.py` (adicionar método à classe `QuestaoService`)
- Test: `D:/verus_api/tests/services/test_questao_count.py` (criar)

- [ ] **Step 2.1: Escrever teste falhando**

Criar `D:/verus_api/tests/services/test_questao_count.py`:

```python
"""Testa QuestaoService.count_only — contagem rápida sem paginação."""
from unittest.mock import MagicMock
import pytest
from app.schemas.questao import QuestaoSearchFilters
from app.services.questao import QuestaoService


def _mock_query(count_value: int):
    """Cria um mock de query que retorna count_value ao chamar .count()."""
    q = MagicMock()
    q.filter.return_value = q
    q.count.return_value = count_value
    return q


def test_count_only_sem_filtros_retorna_total():
    db = MagicMock()
    db.query.return_value = _mock_query(3886057)
    filters = QuestaoSearchFilters()

    result = QuestaoService.count_only(db, filters)

    assert result == 3886057


def test_count_only_aplica_filtro_bancas():
    db = MagicMock()
    q = _mock_query(1234)
    db.query.return_value = q
    filters = QuestaoSearchFilters(bancas=["CEBRASPE (CESPE)"])

    result = QuestaoService.count_only(db, filters)

    assert result == 1234
    # Garante que .filter() foi chamado (filtros aplicados)
    assert q.filter.called


def test_count_only_aceita_node_ids():
    db = MagicMock()
    q = _mock_query(42)
    db.query.return_value = q
    filters = QuestaoSearchFilters()

    result = QuestaoService.count_only(db, filters, node_ids=[10, 20, 30])

    assert result == 42
    assert q.filter.called


def test_count_only_aceita_include_outros():
    db = MagicMock()
    q = _mock_query(5)
    db.query.return_value = q
    filters = QuestaoSearchFilters()

    result = QuestaoService.count_only(db, filters, include_outros=True)

    assert result == 5


def test_count_only_nao_chama_offset_nem_limit():
    """count_only deve evitar paginação — só conta."""
    db = MagicMock()
    q = _mock_query(99)
    db.query.return_value = q
    filters = QuestaoSearchFilters(page=1, limit=20)

    QuestaoService.count_only(db, filters)

    q.offset.assert_not_called()
    q.limit.assert_not_called()
    q.all.assert_not_called()
```

- [ ] **Step 2.2: Rodar e confirmar que falha**

```bash
pytest tests/services/test_questao_count.py -v
```

Expected: `FAILED` ou `AttributeError: type object 'QuestaoService' has no attribute 'count_only'`

- [ ] **Step 2.3: Implementar método mínimo**

Em `D:/verus_api/app/services/questao.py`, adicionar após `get_all` (linha ~108) e antes de `create`:

```python
    @staticmethod
    def count_only(
        db: Session,
        filters: QuestaoSearchFilters,
        node_ids: Optional[List[int]] = None,
        include_outros: bool = False,
    ) -> int:
        """
        Retorna apenas a contagem de questões que atendem aos filtros.

        Espelha a lógica de filtragem de `get_all` mas evita paginação,
        ordenação e load das linhas — só executa COUNT(*).

        Args:
            node_ids: IDs de nós da taxonomia (OR entre eles)
            include_outros: Se True, inclui questões sem taxonomia_node_id mas com assunto
        """
        query = db.query(Questao)

        conditions = []

        if filters.materias:
            conditions.append(Questao.materia.in_(filters.materias))

        if filters.assuntos:
            conditions.append(Questao.assunto.in_(filters.assuntos))

        if filters.bancas:
            conditions.append(Questao.banca.in_(filters.bancas))

        if filters.orgaos:
            conditions.append(Questao.orgao.in_(filters.orgaos))

        if filters.cargos:
            conditions.append(Questao.cargo.in_(filters.cargos))

        if filters.anos:
            conditions.append(Questao.ano.in_(filters.anos))

        if filters.concurso_id:
            conditions.append(Questao.concurso_id == filters.concurso_id)

        if filters.areas_concurso:
            conditions.append(Questao.area_concurso.in_(filters.areas_concurso))

        if filters.especialidades:
            conditions.append(Questao.especialidade.in_(filters.especialidades))

        if filters.tipos:
            conditions.append(Questao.tipo.in_(filters.tipos))

        if filters.formatos:
            conditions.append(Questao.formato.in_(filters.formatos))

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

        if conditions:
            query = query.filter(and_(*conditions))

        return query.count()
```

- [ ] **Step 2.4: Rodar testes e confirmar que passam**

```bash
pytest tests/services/test_questao_count.py -v
```

Expected: 5 passed.

- [ ] **Step 2.5: Rodar suíte completa de services pra garantir não-regressão**

```bash
pytest tests/services/ -q
```

Expected: todos passam.

- [ ] **Step 2.6: Commit**

```bash
git add app/services/questao.py tests/services/test_questao_count.py
git commit -m "feat(service): QuestaoService.count_only para contagem rápida sem paginação"
```

---

## Task 3: Cache Redis para count

**Files:**
- Create: `D:/verus_api/app/services/questao_count_cache.py`
- Test: `D:/verus_api/tests/services/test_questao_count_cache.py`

- [ ] **Step 3.1: Escrever teste falhando**

Criar `D:/verus_api/tests/services/test_questao_count_cache.py`:

```python
"""Testa o cache Redis do count de questões."""
import pytest
from app.schemas.questao import QuestaoSearchFilters
from app.services.questao_count_cache import (
    build_count_cache_key,
    normalize_filters_for_cache,
)


def test_normalize_filters_ordena_listas():
    """Listas de filtros devem ser ordenadas pra dar a mesma chave independente da ordem."""
    f1 = QuestaoSearchFilters(bancas=["FGV", "CEBRASPE (CESPE)"], anos=[2024, 2022])
    f2 = QuestaoSearchFilters(bancas=["CEBRASPE (CESPE)", "FGV"], anos=[2022, 2024])

    n1 = normalize_filters_for_cache(f1)
    n2 = normalize_filters_for_cache(f2)

    assert n1 == n2


def test_normalize_filters_ignora_paginacao():
    """page e limit não devem influenciar o count — não entram no cache key."""
    f1 = QuestaoSearchFilters(bancas=["FGV"], page=1, limit=20)
    f2 = QuestaoSearchFilters(bancas=["FGV"], page=5, limit=100)

    n1 = normalize_filters_for_cache(f1)
    n2 = normalize_filters_for_cache(f2)

    assert n1 == n2
    assert "page" not in n1
    assert "limit" not in n1


def test_build_cache_key_inclui_node_e_outros():
    """node_ids e include_outros devem entrar na chave."""
    filters = QuestaoSearchFilters(bancas=["FGV"])

    k1 = build_count_cache_key(filters, node_ids=[10], include_outros=False)
    k2 = build_count_cache_key(filters, node_ids=[10], include_outros=True)
    k3 = build_count_cache_key(filters, node_ids=[20], include_outros=False)

    assert k1 != k2
    assert k1 != k3
    assert k1.startswith("questoes:count:")


def test_build_cache_key_estavel_para_mesmos_filtros():
    """Mesmos filtros devem dar a mesma chave (determinístico)."""
    filters = QuestaoSearchFilters(bancas=["FGV"], anos=[2024])

    k1 = build_count_cache_key(filters)
    k2 = build_count_cache_key(filters)

    assert k1 == k2


def test_build_cache_key_diferente_para_filtros_diferentes():
    f1 = QuestaoSearchFilters(bancas=["FGV"])
    f2 = QuestaoSearchFilters(bancas=["CEBRASPE (CESPE)"])

    k1 = build_count_cache_key(f1)
    k2 = build_count_cache_key(f2)

    assert k1 != k2
```

- [ ] **Step 3.2: Rodar e confirmar que falha**

```bash
pytest tests/services/test_questao_count_cache.py -v
```

Expected: `ImportError` ou `ModuleNotFoundError: No module named 'app.services.questao_count_cache'`

- [ ] **Step 3.3: Implementar módulo de cache**

Criar `D:/verus_api/app/services/questao_count_cache.py`:

```python
"""Cache Redis para count de questões — TTL 30min, fallback graceful."""
from __future__ import annotations
import hashlib
import json
import logging
from typing import Optional, List, Tuple
from app.schemas.questao import QuestaoSearchFilters
from app.services.taxonomia_cache import get_redis

logger = logging.getLogger(__name__)

# TTL de 30 minutos. Cache invalida-se sozinho — em ingestão grande, tolerar staleness curta.
COUNT_CACHE_TTL_SECONDS = 1800


def normalize_filters_for_cache(filters: QuestaoSearchFilters) -> dict:
    """
    Normaliza filtros para chave de cache estável:
    - Ordena listas (ordem de seleção não muda count)
    - Ignora page/limit (irrelevantes para count)
    - Remove campos None/vazios
    """
    raw = filters.model_dump(exclude={"page", "limit"}, exclude_none=True)
    normalized: dict = {}
    for key, value in raw.items():
        if value is None or value == [] or value == {}:
            continue
        if isinstance(value, list):
            normalized[key] = sorted(value, key=lambda x: (str(type(x)), x))
        else:
            normalized[key] = value
    return normalized


def build_count_cache_key(
    filters: QuestaoSearchFilters,
    node_ids: Optional[List[int]] = None,
    include_outros: bool = False,
) -> str:
    """Constrói chave de cache deterministica baseada nos filtros normalizados + node params."""
    body = normalize_filters_for_cache(filters)
    if node_ids:
        body["_node_ids"] = sorted(node_ids)
    if include_outros:
        body["_include_outros"] = True
    blob = json.dumps(body, sort_keys=True, ensure_ascii=False)
    h = hashlib.sha256(blob.encode()).hexdigest()[:16]
    return f"questoes:count:{h}"


def get_cached_count(key: str) -> Optional[int]:
    """Retorna count do cache, ou None se cache miss / Redis indisponível."""
    r = get_redis()
    if r is None:
        return None
    try:
        cached = r.get(key)
        if cached is not None:
            return int(cached)
    except Exception as e:
        logger.warning(f"Redis GET falhou para {key}: {e}")
    return None


def set_cached_count(key: str, count: int, ttl: int = COUNT_CACHE_TTL_SECONDS) -> None:
    """Salva count no cache com TTL. Falha de Redis é silenciosa (degrada)."""
    r = get_redis()
    if r is None:
        return
    try:
        r.setex(key, ttl, str(count))
    except Exception as e:
        logger.warning(f"Redis SETEX falhou para {key}: {e}")
```

- [ ] **Step 3.4: Rodar testes e confirmar que passam**

```bash
pytest tests/services/test_questao_count_cache.py -v
```

Expected: 5 passed.

- [ ] **Step 3.5: Commit**

```bash
git add app/services/questao_count_cache.py tests/services/test_questao_count_cache.py
git commit -m "feat(cache): cache Redis para count de questões com TTL 30min"
```

---

## Task 4: Endpoint `GET /count`

**Files:**
- Modify: `D:/verus_api/app/api/v1/routes/questoes.py` (adicionar route)

- [ ] **Step 4.1: Adicionar imports necessários ao topo do arquivo**

Em `D:/verus_api/app/api/v1/routes/questoes.py`, no bloco de imports de schemas (linha 16-34), adicionar `QuestaoCountResponse`:

```python
from app.schemas.questao import (
    QuestaoResponse,
    QuestaoResponseHTML,
    QuestaoDetailResponse,
    QuestaoSearchResponse,
    QuestaoSearchFilters,
    QuestaoCountResponse,  # NOVO
    QuestaoCreate,
    QuestaoUpdate,
    BuscaSemanticaRequest,
    RespostaRequest,
    RespostaResponse,
    StatsGlobaisAtualizadas,
    QuestaoMetadata,
    QuestaoConcurso,
    QuestaoCaracteristicas,
    QuestaoEstatisticas,
    Facets,
    FacetItem,
)
```

E adicionar import do cache:

```python
from app.services.questao_count_cache import (
    build_count_cache_key,
    get_cached_count,
    set_cached_count,
)
```

- [ ] **Step 4.2: Adicionar a route `/count`**

**IMPORTANTE:** A rota `/count` precisa ser declarada **antes** de `/{questao_id}` (linha 360) pra evitar que FastAPI interprete "count" como um id. Inserir imediatamente após o fim do `search_questoes` (após `return QuestaoSearchResponse(...)` na linha ~312) e antes de `@router.get("/images/migration-status"`).

```python
@router.get("/count", response_model=QuestaoCountResponse)
@limiter.limit("120/minute")
def count_questoes(
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
    Retorna apenas a contagem de questões que atendem aos filtros.

    Otimizado para chamadas em tempo real durante construção de filtros no frontend.
    Cache Redis com TTL 30min, key derivada do hash dos filtros normalizados.

    Aceita os mesmos filtros que `/search` (exceto paginação, sort, facets, html).
    """
    import time
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

    # Resolver filtro de nós da taxonomia (mesma lógica de /search)
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

    # Tenta cache Redis
    cache_key = build_count_cache_key(filters, node_ids=node_ids, include_outros=include_outros)
    cached = get_cached_count(cache_key)

    if cached is not None:
        took_ms = int((time.perf_counter() - start) * 1000)
        return QuestaoCountResponse(count=cached, took_ms=took_ms, cached=True)

    # Cache miss → calcula e armazena
    count = QuestaoService.count_only(db, filters, node_ids=node_ids, include_outros=include_outros)
    set_cached_count(cache_key, count)

    took_ms = int((time.perf_counter() - start) * 1000)
    return QuestaoCountResponse(count=count, took_ms=took_ms, cached=False)
```

- [ ] **Step 4.3: Smoke import do módulo**

```bash
python -c "from app.api.v1.routes.questoes import count_questoes; print('OK')"
```

Expected: `OK` (sem erros de import).

- [ ] **Step 4.4: Subir API local pra teste manual**

Em outro terminal (ou background):

```bash
cd /d/verus_api
uvicorn app.main:app --reload --port 8000
```

Expected: API sobe sem erros, `Application startup complete`.

- [ ] **Step 4.5: Curl smoke test — sem filtros (total)**

```bash
curl -s 'http://localhost:8000/api/v1/questoes/count' | python -m json.tool
```

Expected: JSON do tipo `{"count": <numero>, "took_ms": <int>, "cached": false}`. Count deve ser > 1 milhão.

- [ ] **Step 4.6: Curl com filtros — banca CESPE**

```bash
curl -s 'http://localhost:8000/api/v1/questoes/count?bancas=CEBRASPE%20(CESPE)' | python -m json.tool
```

Expected: count menor que o total, `cached: false` na primeira chamada.

- [ ] **Step 4.7: Curl repetir mesma query — verificar cache hit**

```bash
curl -s 'http://localhost:8000/api/v1/questoes/count?bancas=CEBRASPE%20(CESPE)' | python -m json.tool
```

Expected: mesmo count, `cached: true`, `took_ms` significativamente menor (<5ms).

- [ ] **Step 4.8: Curl com filtro inválido de node**

```bash
curl -s -o /dev/stderr -w "%{http_code}\n" 'http://localhost:8000/api/v1/questoes/count?node=lixo'
```

Expected: HTTP 400 + mensagem `"Parâmetro node inválido: 'lixo' (esperado inteiro ou 'outros')"`

- [ ] **Step 4.9: Curl com node taxonomia válido (Direito Adm tem nodes)**

Identificar um `taxonomia_node_id` válido:

```bash
psql "$DATABASE_URL" -c "SELECT id, nome FROM taxonomia_nodes WHERE parent_id IS NULL LIMIT 5;"
```

Pegar um id (ex: `1`) e testar:

```bash
curl -s 'http://localhost:8000/api/v1/questoes/count?node=1' | python -m json.tool
```

Expected: count > 0 se houver questões taxonomizadas; `cached: false` na primeira chamada.

- [ ] **Step 4.10: Verificar paridade com /search**

Comparar count do endpoint novo com `total` do `/search` pra um conjunto de filtros não trivial. Ex:

```bash
TOTAL_SEARCH=$(curl -s 'http://localhost:8000/api/v1/questoes/search?bancas=FGV&anos=2024&limit=1' | python -c "import sys,json;print(json.load(sys.stdin)['total'])")
TOTAL_COUNT=$(curl -s 'http://localhost:8000/api/v1/questoes/count?bancas=FGV&anos=2024' | python -c "import sys,json;print(json.load(sys.stdin)['count'])")
echo "search total: $TOTAL_SEARCH"
echo "count total:  $TOTAL_COUNT"
[[ "$TOTAL_SEARCH" == "$TOTAL_COUNT" ]] && echo "PARITY OK" || echo "MISMATCH"
```

Expected: `PARITY OK`.

- [ ] **Step 4.11: Parar API local**

Ctrl+C no terminal da API.

- [ ] **Step 4.12: Commit**

```bash
git add app/api/v1/routes/questoes.py
git commit -m "feat(api): GET /api/v1/questoes/count com cache Redis TTL 30min"
```

---

## Task 5: Documentação OpenAPI e CHANGELOG

**Files:**
- Verify: `D:/verus_api/app/main.py` (OpenAPI schema é gerado automaticamente, mas conferir título/descrição)
- Modify: `D:/verus_api/CHANGELOG.md` (se existir; senão, pular)

- [ ] **Step 5.1: Subir API e verificar OpenAPI docs**

```bash
uvicorn app.main:app --port 8000 &
sleep 2
curl -s http://localhost:8000/openapi.json | python -c "import sys,json;d=json.load(sys.stdin);paths=list(d['paths'].keys());print('\n'.join(p for p in paths if 'count' in p))"
```

Expected: lista contém `/api/v1/questoes/count`.

- [ ] **Step 5.2: Verificar Swagger UI manualmente**

Abrir `http://localhost:8000/docs` e confirmar que `/questoes/count` aparece com schema correto (parâmetros multi-valor, response `QuestaoCountResponse`).

- [ ] **Step 5.3: Parar API**

Matar processo background (`kill %1` ou Ctrl+C).

- [ ] **Step 5.4: Atualizar CHANGELOG (se aplicável)**

Verificar se existe `D:/verus_api/CHANGELOG.md`. Se sim, adicionar entrada:

```markdown
## [Unreleased]

### Added
- `GET /api/v1/questoes/count` — endpoint dedicado para contagem em tempo real, com cache Redis TTL 30min. Pré-requisito do Inline Drawer de Filtros (Metav2 Leva 2).
```

Se o arquivo não existir, pular este step.

- [ ] **Step 5.5: Commit final (se houve mudança no CHANGELOG)**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog do endpoint /questoes/count"
```

Se não houve mudança no CHANGELOG, pular este commit.

---

## Task 6: Push e PR

- [ ] **Step 6.1: Verificar suíte completa de tests**

```bash
pytest tests/ -q
```

Expected: todos passam (nenhuma regressão).

- [ ] **Step 6.2: Push do branch**

```bash
git push -u origin feat/questoes-count-endpoint
```

- [ ] **Step 6.3: Abrir PR**

```bash
gh pr create --title "feat(api): endpoint /questoes/count com cache Redis" --body "$(cat <<'EOF'
## Summary
- Adiciona `GET /api/v1/questoes/count` para contagem em tempo real
- Cache Redis com TTL 30min, key derivada de hash dos filtros normalizados
- Reusa pattern de `taxonomia_cache.py` (singleton lazy + degrade graceful)

## Pré-requisito
Spec: `Metav2/docs/superpowers/specs/2026-04-29-questoes-inline-drawer-filtros-design.md`

Bloqueador do Leva 2 (Inline Drawer de Filtros) — frontend não pode começar sem este endpoint.

## Test plan
- [x] Testes unitários do `count_only` (5 casos)
- [x] Testes unitários do cache (5 casos)
- [x] Curl smoke: sem filtros, banca, node, paridade com /search
- [x] Cache miss → hit verificado via `cached` flag e `took_ms`
- [x] Suite completa de tests passa

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: URL do PR retornada.

---

## Definition of done

- ✅ `GET /api/v1/questoes/count` existe e responde com JSON `{count, took_ms, cached}`
- ✅ Cache Redis com TTL 30min funciona (verificado via flag `cached`)
- ✅ Filtros multi-valor (bancas, anos, etc.) aceitos e aplicados
- ✅ Filtro `node=` da taxonomia funciona (incluindo `'outros'`)
- ✅ Erro 400 ao receber `node` inválido
- ✅ Paridade de count com endpoint `/search` (mesmo total para mesmos filtros)
- ✅ 10 testes unitários passando (5 service + 5 cache)
- ✅ Suite completa de tests verde (sem regressões)
- ✅ PR aberto pra revisão

## Decisões deliberadamente fora deste plano

- **Telemetria** — eventos de count load, cache hit rate. Adicionar quando tivermos infra de telemetria do app.
- **Invalidação ativa de cache** — ingestão de novas questões pode disparar `DEL questoes:count:*`. TTL 30min cobre staleness aceitável; invalidação ativa fica pra um futuro plano se precisar.
- **Endpoint dedicado de facets** — não está no escopo desta Leva. `/search?include_facets=true` continua atendendo onde for necessário.
- **Rate limit ajustado** — começamos com `120/minute` (debounce 300ms no frontend já protege). Ajustar baseado em telemetria real.
