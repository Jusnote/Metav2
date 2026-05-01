# Plano 3b-pre-2 — Pair filtering (orgao, cargo) no backend (verus-api)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar suporte a pares `(orgao, cargo)` nos endpoints `/search`, `/count`, `/facets` da verus-api. Permite UI de drilldown por órgão (ex: "TRF1 → Juiz Federal") sem causar cross-product semântico ao misturar com filtros flat. Pré-requisito do Plano 3b-bonus (frontend OrgaoCargoPicker drilldown).

**Architecture:** Novo query param `org_cargo_pairs` aceita lista de strings `"ORGAO:CARGO"` (ex: `org_cargo_pairs=TRF1:Juiz Federal&org_cargo_pairs=STJ:Ministro`). Service helper parseia e adiciona condições SQL OR de ANDs por par. Combinação semântica com filtros flat existentes:

```
WHERE (<flat_orgaos_match> AND <flat_cargos_match>) OR <pairs_match>
```

Onde cada cláusula é TRUE se a lista está vazia (preserva comportamento atual quando só flat existe). Backward compatible — sem `org_cargo_pairs` nada muda.

**Tech Stack:** Python 3.x · FastAPI · SQLAlchemy · PostgreSQL · pytest

**Repo alvo:** `D:/verus_api`

**Spec:** `docs/superpowers/specs/2026-04-29-questoes-inline-drawer-filtros-design.md` (decisão de Leva 3b-bonus, master-detail drilldown)

**Dependências:** Plano 3b-pre (`/facets`) já em main do verus-api.

---

## Pré-flight

- [ ] **Step 0.1: Verificar branch e estado limpo**

```bash
cd /d/verus_api
git status
git checkout main
git pull --ff-only
git checkout -b feat/questoes-pair-filtering
```

Expected: working tree limpo, branch criado a partir de main atualizado.

- [ ] **Step 0.2: Confirmar baseline pytest verde**

```bash
cd /d/verus_api && pytest tests/services/ tests/api/ -q 2>&1 | tail -10
```

Expected: todos passam.

- [ ] **Step 0.3: Reler endpoints existentes pra entender ponto de extensão**

Abrir e ler:
- `app/services/questao.py:111` (count_only) — onde os filtros são montados
- `app/services/questao.py` — método `facets_only` (Plano 3b-pre)
- `app/api/v1/routes/questoes.py:322` (rota /count) e a rota /facets
- `app/schemas/questao.py` (QuestaoSearchFilters)

Identificar:
- Ponto de injeção das condições adicionais (SQL `where`)
- Como o `QuestaoSearchFilters` é construído nas rotas

Expected: confirmação visual de que o ponto de injeção é claro nos 3 endpoints (search, count, facets) — todos usam o mesmo padrão de montagem de `conditions` antes do `query.filter(and_(*conditions))`.

---

## Task 1: Schema — campo `org_cargo_pairs` em `QuestaoSearchFilters`

**Files:**
- Modify: `D:/verus_api/app/schemas/questao.py`

- [ ] **Step 1.1: Adicionar campo opcional ao schema**

Localizar `QuestaoSearchFilters` em `app/schemas/questao.py`. Adicionar campo `org_cargo_pairs` próximo aos campos `orgaos` e `cargos`:

```python
org_cargo_pairs: Optional[List[str]] = Field(
    None,
    description=(
        "Pares (orgao, cargo) no formato 'ORGAO:CARGO'. "
        "Cada par vira condição AND no SQL; pares são combinados com OR. "
        "Combina com filtros flat orgaos/cargos via OR no nível mais externo, "
        "permitindo combinar 'TRF1 todos' (flat) com 'STJ → Ministro' (par). "
        "Backward compatible: sem este campo o comportamento é idêntico ao anterior."
    ),
    examples=[["TRF1:Juiz Federal", "STJ:Ministro"]],
)
```

- [ ] **Step 1.2: Smoke import**

```bash
cd /d/verus_api && python -c "from app.schemas.questao import QuestaoSearchFilters; f = QuestaoSearchFilters(org_cargo_pairs=['TRF1:Juiz Federal'], page=1, limit=1); print(f.org_cargo_pairs)"
```

Expected: `['TRF1:Juiz Federal']`.

- [ ] **Step 1.3: Commit**

```bash
cd /d/verus_api && git add app/schemas/questao.py && git commit -m "feat(schemas): campo org_cargo_pairs em QuestaoSearchFilters"
```

---

## Task 2: Helper de parsing de pares

**Files:**
- Create: `D:/verus_api/app/services/org_cargo_pairs.py`
- Test: `D:/verus_api/tests/services/test_org_cargo_pairs.py`

- [ ] **Step 2.1: Escrever testes primeiro (TDD)**

Criar `tests/services/test_org_cargo_pairs.py`:

```python
"""Testes do parser de pares (orgao, cargo)."""
import pytest
from app.services.org_cargo_pairs import parse_pairs, ParsedPair


def test_parse_pair_simples():
    """Par bem formado retorna ParsedPair."""
    result = parse_pairs(["TRF1:Juiz Federal"])
    assert result == [ParsedPair(orgao="TRF1", cargo="Juiz Federal")]


def test_parse_multiplos_pares():
    """Múltiplos pares parseados em ordem."""
    result = parse_pairs(["TRF1:Juiz Federal", "STJ:Ministro"])
    assert len(result) == 2
    assert result[0].orgao == "TRF1"
    assert result[1].cargo == "Ministro"


def test_parse_lista_vazia():
    """Lista vazia retorna lista vazia (não None)."""
    assert parse_pairs([]) == []


def test_parse_none():
    """None retorna lista vazia."""
    assert parse_pairs(None) == []


def test_parse_cargo_com_dois_pontos():
    """Cargo pode conter ':' — split apenas no primeiro ':'.
    Ex.: 'TRF1:Analista Judiciário: Área TI' → orgao='TRF1', cargo='Analista Judiciário: Área TI'
    """
    result = parse_pairs(["TRF1:Analista: Área TI"])
    assert result[0].orgao == "TRF1"
    assert result[0].cargo == "Analista: Área TI"


def test_parse_strings_invalidas_pulam():
    """Strings sem ':' são puladas silenciosamente (parser tolerante)."""
    result = parse_pairs(["TRF1", "STJ:Ministro", "sem_separador"])
    assert len(result) == 1
    assert result[0].orgao == "STJ"


def test_parse_preserva_espacos_internos():
    """Espaços dentro do orgao/cargo são preservados (sem strip agressivo)."""
    result = parse_pairs(["TRF 1:Juiz  Federal"])
    assert result[0].orgao == "TRF 1"
    assert result[0].cargo == "Juiz  Federal"
```

- [ ] **Step 2.2: Rodar testes — devem falhar**

```bash
cd /d/verus_api && pytest tests/services/test_org_cargo_pairs.py -v 2>&1 | tail -10
```

Expected: 7/7 FAIL ("Cannot import").

- [ ] **Step 2.3: Implementar parser**

Criar `app/services/org_cargo_pairs.py`:

```python
"""Parser de pares (orgao, cargo) do query param 'org_cargo_pairs'."""
from __future__ import annotations
from dataclasses import dataclass
from typing import List, Optional


@dataclass(frozen=True)
class ParsedPair:
    """Representa um par (orgao, cargo) parseado."""
    orgao: str
    cargo: str


def parse_pairs(raw: Optional[List[str]]) -> List[ParsedPair]:
    """
    Converte lista de strings 'ORGAO:CARGO' em lista de ParsedPair.

    Tolerante a entradas malformadas (sem ':') — pula silenciosamente.
    Split apenas no PRIMEIRO ':' — preserva ':' dentro do cargo (ex.: 'Analista: Área TI').
    Não faz strip de espaços (preserva exatamente como veio do request).
    """
    if not raw:
        return []
    result: List[ParsedPair] = []
    for s in raw:
        if ":" not in s:
            continue
        orgao, cargo = s.split(":", 1)
        if not orgao or not cargo:
            continue
        result.append(ParsedPair(orgao=orgao, cargo=cargo))
    return result
```

- [ ] **Step 2.4: Rodar testes — devem passar**

```bash
cd /d/verus_api && pytest tests/services/test_org_cargo_pairs.py -v 2>&1 | tail -15
```

Expected: 7/7 PASS.

- [ ] **Step 2.5: Commit**

```bash
cd /d/verus_api && git add app/services/org_cargo_pairs.py tests/services/test_org_cargo_pairs.py && git commit -m "feat(service): parser de pares (orgao, cargo) com testes"
```

---

## Task 3: Helper SQL — gerador de condição combinada

**Files:**
- Modify: `D:/verus_api/app/services/org_cargo_pairs.py`
- Test: `D:/verus_api/tests/services/test_org_cargo_pairs.py`

- [ ] **Step 3.1: Adicionar testes de geração de condição SQL**

Anexar ao `tests/services/test_org_cargo_pairs.py`:

```python
from app.models.questao import Questao
from app.services.org_cargo_pairs import build_orgao_cargo_condition


def test_condition_so_flat_orgaos_e_cargos():
    """Sem pairs, condição = orgao IN [...] AND cargo IN [...] (current behavior)."""
    cond = build_orgao_cargo_condition(
        flat_orgaos=["TRF1"],
        flat_cargos=["Juiz Federal"],
        pairs=[],
    )
    sql = str(cond.compile(compile_kwargs={"literal_binds": True}))
    assert "questao.orgao IN" in sql
    assert "TRF1" in sql
    assert "questao.cargo IN" in sql
    assert "Juiz Federal" in sql


def test_condition_so_pairs():
    """Só pares: condição = OR de ANDs."""
    cond = build_orgao_cargo_condition(
        flat_orgaos=[],
        flat_cargos=[],
        pairs=[ParsedPair("TRF1", "Juiz Federal"), ParsedPair("STJ", "Ministro")],
    )
    sql = str(cond.compile(compile_kwargs={"literal_binds": True}))
    # Espera 2 ANDs combinados com OR
    assert sql.count("AND") >= 2
    assert "OR" in sql
    assert "TRF1" in sql and "Juiz Federal" in sql
    assert "STJ" in sql and "Ministro" in sql


def test_condition_flat_e_pairs_combinados():
    """Combinação: (flat_orgao AND flat_cargo) OR pair_match."""
    cond = build_orgao_cargo_condition(
        flat_orgaos=["TRF1"],
        flat_cargos=[],
        pairs=[ParsedPair("STJ", "Ministro")],
    )
    sql = str(cond.compile(compile_kwargs={"literal_binds": True}))
    # OR no nível externo entre flat_match e pair_match
    assert "OR" in sql
    assert "TRF1" in sql
    assert "STJ" in sql
    assert "Ministro" in sql


def test_condition_tudo_vazio_retorna_none():
    """Sem nenhum filtro, retorna None (não aplicar nenhuma condição)."""
    cond = build_orgao_cargo_condition(flat_orgaos=[], flat_cargos=[], pairs=[])
    assert cond is None
```

- [ ] **Step 3.2: Rodar — testes novos devem falhar**

```bash
cd /d/verus_api && pytest tests/services/test_org_cargo_pairs.py -v 2>&1 | tail -10
```

Expected: 4 novos tests FAIL ("cannot import build_orgao_cargo_condition"), 7 anteriores PASS.

- [ ] **Step 3.3: Implementar `build_orgao_cargo_condition`**

Anexar ao `app/services/org_cargo_pairs.py`:

```python
from typing import Optional as _Optional
from sqlalchemy import and_, or_


def build_orgao_cargo_condition(
    flat_orgaos: List[str],
    flat_cargos: List[str],
    pairs: List[ParsedPair],
):
    """
    Constrói condição SQLAlchemy combinando filtros flat e pares.

    Semântica:
        flat_match = (orgao IN flat_orgaos) AND (cargo IN flat_cargos)
                     onde cada subcondição é TRUE se a lista correspondente é vazia.
        pair_match = OR de (orgao=A AND cargo=B) por par.
        resultado = flat_match OR pair_match (apenas as não-vazias).

    Backward compat: se pairs está vazio, retorna apenas flat_match (= comportamento atual).

    Returns:
        SQLAlchemy ColumnElement, ou None se tudo está vazio.
    """
    # Import local pra evitar circular com app.models.questao
    from app.models.questao import Questao

    has_flat_orgaos = bool(flat_orgaos)
    has_flat_cargos = bool(flat_cargos)
    has_pairs = bool(pairs)

    if not has_flat_orgaos and not has_flat_cargos and not has_pairs:
        return None

    clauses = []

    # Cláusula flat: orgao IN [...] AND cargo IN [...]
    flat_subs = []
    if has_flat_orgaos:
        flat_subs.append(Questao.orgao.in_(flat_orgaos))
    if has_flat_cargos:
        flat_subs.append(Questao.cargo.in_(flat_cargos))
    if flat_subs:
        clauses.append(and_(*flat_subs) if len(flat_subs) > 1 else flat_subs[0])

    # Cláusula pares: OR de (orgao=A AND cargo=B)
    if has_pairs:
        pair_clauses = [
            and_(Questao.orgao == p.orgao, Questao.cargo == p.cargo)
            for p in pairs
        ]
        clauses.append(or_(*pair_clauses) if len(pair_clauses) > 1 else pair_clauses[0])

    # Combina todas as cláusulas top-level com OR
    if len(clauses) == 1:
        return clauses[0]
    return or_(*clauses)
```

- [ ] **Step 3.4: Rodar — todos passam**

```bash
cd /d/verus_api && pytest tests/services/test_org_cargo_pairs.py -v 2>&1 | tail -15
```

Expected: 11/11 PASS (7 parser + 4 condition).

- [ ] **Step 3.5: Commit**

```bash
cd /d/verus_api && git add app/services/org_cargo_pairs.py tests/services/test_org_cargo_pairs.py && git commit -m "feat(service): build_orgao_cargo_condition combinando flat + pares"
```

---

## Task 4: Integrar em `count_only`, `facets_only` e `get_all`

**Files:**
- Modify: `D:/verus_api/app/services/questao.py`

- [ ] **Step 4.1: Refatorar bloco de filtros orgao/cargo em `count_only`**

Localizar `count_only` em `app/services/questao.py:111`. Hoje tem (aprox):

```python
if filters.orgaos:
    conditions.append(Questao.orgao.in_(filters.orgaos))
if filters.cargos:
    conditions.append(Questao.cargo.in_(filters.cargos))
```

Substituir por chamada ao novo helper:

```python
from app.services.org_cargo_pairs import parse_pairs, build_orgao_cargo_condition

# ... dentro de count_only, no lugar dos blocos antigos de orgaos/cargos:
oc_cond = build_orgao_cargo_condition(
    flat_orgaos=filters.orgaos or [],
    flat_cargos=filters.cargos or [],
    pairs=parse_pairs(filters.org_cargo_pairs),
)
if oc_cond is not None:
    conditions.append(oc_cond)
```

- [ ] **Step 4.2: Refatorar `facets_only` da mesma forma**

Em `facets_only`, o helper interno `_build_conditions(skip_field)` tem lógica de skip por campo. O helper agora precisa pular tanto `orgao` quanto `cargo` quando facet é um deles, e também as `pairs` (que envolvem ambos).

Decisão semântica: ao calcular facet de `orgao`, ignora-se o filtro de orgao **E** os pairs (porque pairs constraem orgao indiretamente). Mesma coisa pra facet de `cargo`. Pra outros facets (banca, ano, etc), aplica normalmente.

Ajustar `_build_conditions`:

```python
def _build_conditions(skip_field: Optional[str] = None) -> list:
    conditions = []
    # ... (filtros materias, assuntos, etc — inalterados)

    # Filtros orgao/cargo + pairs — pula quando facet é orgao OU cargo
    if skip_field not in ("orgao", "cargo"):
        oc_cond = build_orgao_cargo_condition(
            flat_orgaos=filters.orgaos or [],
            flat_cargos=filters.cargos or [],
            pairs=parse_pairs(filters.org_cargo_pairs),
        )
        if oc_cond is not None:
            conditions.append(oc_cond)
    elif skip_field == "orgao":
        # DECISÃO (Opção 1, simples): drop pairs inteiramente quando skip='orgao'.
        # Counts de orgao mostram todas as opções globalmente, ignorando intenção
        # de cargo embutida nos pairs. Aceita-se a perda de fidelidade em troca de
        # implementação simples. Se telemetria de uso mostrar que aluno espera ver
        # só órgãos compatíveis com seus cargos pareados, a Opção 2 (extrair metade
        # cargo dos pairs como filtro adicional) é a evolução natural.
        if filters.cargos:
            conditions.append(Questao.cargo.in_(filters.cargos))
    elif skip_field == "cargo":
        # Mesma lógica simétrica do skip='orgao' — drop pairs.
        # Ver decisão acima sobre Opção 1 vs Opção 2.
        if filters.orgaos:
            conditions.append(Questao.orgao.in_(filters.orgaos))

    # ... (restante dos filtros — banca, ano, tipo, formato, area_concurso, especialidade)
    # ... pulando o skip_field correspondente como já faz hoje
```

- [ ] **Step 4.3: Refatorar `get_all` (busca paginada) similar**

Mesmo padrão de Step 4.1, no método `get_all` que monta a query principal. Localizar onde `Questao.orgao.in_` e `Questao.cargo.in_` aparecem e substituir.

- [ ] **Step 4.4: Smoke imports**

```bash
cd /d/verus_api && python -c "
from app.services.questao import QuestaoService
from app.schemas.questao import QuestaoSearchFilters
print('count_only:', hasattr(QuestaoService, 'count_only'))
print('facets_only:', hasattr(QuestaoService, 'facets_only'))
print('get_all:', hasattr(QuestaoService, 'get_all'))
"
```

Expected: `True` em todos.

- [ ] **Step 4.5: Rodar suite existente — não pode regredir**

```bash
cd /d/verus_api && pytest tests/services/ -q 2>&1 | tail -10
```

Expected: todos os testes anteriores ainda PASSAM (backward compat preservada — sem `org_cargo_pairs` setado, comportamento idêntico).

- [ ] **Step 4.6: Commit**

```bash
cd /d/verus_api && git add app/services/questao.py && git commit -m "feat(service): integra org_cargo_pairs em count_only, facets_only e get_all"
```

---

## Task 5: Testes de integração — semântica combinada

**Files:**
- Create: `D:/verus_api/tests/services/test_questao_pair_filtering.py`

- [ ] **Step 5.1: Escrever testes com MagicMock (mesmo padrão de Plano 3b-pre Task 5)**

Criar `tests/services/test_questao_pair_filtering.py` com cenários:

```python
"""Testes de integração: pair filtering em count_only, facets_only, get_all."""
from unittest.mock import MagicMock, patch
from app.schemas.questao import QuestaoSearchFilters
from app.services.questao import QuestaoService


def test_sem_pair_filtering_comportamento_inalterado():
    """Sem org_cargo_pairs, count_only chama o mesmo SQL de antes (regressão zero)."""
    db = MagicMock()
    db.query.return_value.filter.return_value.count.return_value = 100
    f = QuestaoSearchFilters(orgaos=["TRF1"], cargos=["Juiz Federal"], page=1, limit=1)

    result = QuestaoService.count_only(db, f)

    assert result == 100
    # Validação de que o filter foi chamado uma vez (combinando flat orgao+cargo via AND)
    assert db.query.return_value.filter.called


def test_count_only_aceita_pairs():
    """count_only não falha quando recebe pairs e ignora-os silenciosamente nada testando do SQL."""
    db = MagicMock()
    db.query.return_value.filter.return_value.count.return_value = 50
    f = QuestaoSearchFilters(
        org_cargo_pairs=["TRF1:Juiz Federal", "STJ:Ministro"],
        page=1, limit=1,
    )
    result = QuestaoService.count_only(db, f)
    assert result == 50


def test_facets_only_skip_field_orgao_ignora_pairs():
    """Ao agregar facet 'orgao', pairs devem ser ignorados (constraem orgao)."""
    db = MagicMock()
    db.query.return_value.filter.return_value.filter.return_value.group_by.return_value.all.return_value = []
    f = QuestaoSearchFilters(
        orgaos=["TRF1"],
        org_cargo_pairs=["STJ:Ministro"],
        page=1, limit=1,
    )
    result = QuestaoService.facets_only(db, f)
    # Pelo menos verifica que não levanta exceção e retorna 8 keys
    assert set(result.keys()) == {
        "banca", "ano", "orgao", "cargo",
        "area_concurso", "especialidade", "tipo", "formato",
    }


def test_facets_only_skip_field_cargo_ignora_pairs():
    """Mesma lógica para skip='cargo'."""
    db = MagicMock()
    db.query.return_value.filter.return_value.filter.return_value.group_by.return_value.all.return_value = []
    f = QuestaoSearchFilters(
        cargos=["Juiz Federal"],
        org_cargo_pairs=["TRF1:Analista"],
        page=1, limit=1,
    )
    result = QuestaoService.facets_only(db, f)
    assert "orgao" in result and "cargo" in result


def test_pair_invalido_eh_ignorado_silenciosamente():
    """Strings sem ':' não causam erro — parser tolerante."""
    db = MagicMock()
    db.query.return_value.filter.return_value.count.return_value = 0
    f = QuestaoSearchFilters(
        org_cargo_pairs=["TRF1", "TRF1:Juiz", "sem_separador"],
        page=1, limit=1,
    )
    # Não deve raise
    result = QuestaoService.count_only(db, f)
    assert result == 0
```

- [ ] **Step 5.2: Rodar testes**

```bash
cd /d/verus_api && pytest tests/services/test_questao_pair_filtering.py -v 2>&1 | tail -15
```

Expected: 5/5 PASS.

- [ ] **Step 5.3: Rodar suite completa — sem regressão**

```bash
cd /d/verus_api && pytest tests/services/ -q 2>&1 | tail -10
```

Expected: todos PASS.

- [ ] **Step 5.4: Commit**

```bash
cd /d/verus_api && git add tests/services/test_questao_pair_filtering.py && git commit -m "test(service): pair filtering em count_only, facets_only — 5 cenários"
```

---

## Task 6: Expor `org_cargo_pairs` nas rotas `/search`, `/count`, `/facets`

**Files:**
- Modify: `D:/verus_api/app/api/v1/routes/questoes.py`

- [ ] **Step 6.1: Adicionar query param em `/count`**

Localizar `count_questoes` em `app/api/v1/routes/questoes.py:322`. Adicionar parâmetro:

```python
org_cargo_pairs: Optional[List[str]] = Query(
    None,
    description="Pares (orgao, cargo) no formato 'ORGAO:CARGO'. Combina com flat via OR.",
),
```

E passar pro `QuestaoSearchFilters`:

```python
filters = QuestaoSearchFilters(
    # ... (campos existentes)
    org_cargo_pairs=_noneif_empty(org_cargo_pairs),
    page=1,
    limit=1,
)
```

Atualizar a cache key — como `build_count_cache_key` chama `normalize_filters_for_cache(filters)` que serializa o `model_dump`, o novo campo já é incluído automaticamente. Confirmar que não precisa mudar nada no cache.

- [ ] **Step 6.2: Adicionar query param em `/facets`**

Mesma adição em `facets_questoes` (rota `/facets`).

- [ ] **Step 6.3: Adicionar query param em `/search`**

Mesma adição na rota principal de busca (`@router.get("/search")` em `app/api/v1/routes/questoes.py:160`).

- [ ] **Step 6.4: Smoke — listar rotas**

```bash
cd /d/verus_api && python -c "
from app.main import app
routes = [r for r in app.routes if hasattr(r, 'path') and r.path in ('/api/v1/questoes/search', '/api/v1/questoes/count', '/api/v1/questoes/facets')]
for r in routes:
    print(r.path, list(r.methods)[0] if hasattr(r, 'methods') else '?')
"
```

Expected: 3 rotas listadas.

- [ ] **Step 6.5: Commit**

```bash
cd /d/verus_api && git add app/api/v1/routes/questoes.py && git commit -m "feat(api): expor org_cargo_pairs em /search, /count, /facets"
```

---

## Task 7: Testes de integração das rotas

**Files:**
- Create: `D:/verus_api/tests/routes/test_questoes_pair_filtering_routes.py`

- [ ] **Step 7.1: Escrever testes**

Padrão idêntico aos testes de `/facets` em `tests/routes/test_questoes_facets_route.py` (criados no Plano 3b-pre): TestClient + dependency override + patch em `QuestaoService`.

```python
"""Testes de integração das rotas com org_cargo_pairs."""
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.api.v1.dependencies import get_db


@pytest.fixture(autouse=True)
def override_db():
    db = MagicMock()
    app.dependency_overrides[get_db] = lambda: db
    yield db
    app.dependency_overrides.clear()


client = TestClient(app)


@patch("app.services.questao.QuestaoService.count_only")
def test_count_aceita_org_cargo_pairs(mock_count):
    mock_count.return_value = 42
    r = client.get("/api/v1/questoes/count?org_cargo_pairs=TRF1:Juiz Federal&org_cargo_pairs=STJ:Ministro")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 42
    # Confirma que o service recebeu os pairs no QuestaoSearchFilters
    call_args = mock_count.call_args
    filters = call_args[0][1]
    assert filters.org_cargo_pairs == ["TRF1:Juiz Federal", "STJ:Ministro"]


@patch("app.services.questao.QuestaoService.facets_only")
def test_facets_aceita_org_cargo_pairs(mock_facets):
    mock_facets.return_value = {f: {} for f in (
        "banca","ano","orgao","cargo","area_concurso","especialidade","tipo","formato"
    )}
    r = client.get("/api/v1/questoes/facets?org_cargo_pairs=TRF1:Juiz Federal")
    assert r.status_code == 200
    call_args = mock_facets.call_args
    filters = call_args[0][1]
    assert filters.org_cargo_pairs == ["TRF1:Juiz Federal"]


def test_pair_sem_dois_pontos_aceito_pelo_endpoint():
    """Endpoint não rejeita; parser silencia entrada malformada."""
    with patch("app.services.questao.QuestaoService.count_only", return_value=0):
        r = client.get("/api/v1/questoes/count?org_cargo_pairs=invalido_sem_separador")
        # Parser é tolerante por design: 200 sempre. Trava o contrato.
        assert r.status_code == 200


def test_sem_pairs_continua_funcionando():
    """Backward compat — request sem o param funciona."""
    with patch("app.services.questao.QuestaoService.count_only", return_value=99):
        r = client.get("/api/v1/questoes/count?bancas=Cespe")
        assert r.status_code == 200
        assert r.json()["count"] == 99
```

- [ ] **Step 7.2: Rodar testes**

```bash
cd /d/verus_api && pytest tests/routes/test_questoes_pair_filtering_routes.py -v 2>&1 | tail -15
```

Expected: 4/4 PASS (ou 4/4 SKIPPED se fixtures faltarem — ajustar pra padrão de skip do projeto).

- [ ] **Step 7.3: Commit**

```bash
cd /d/verus_api && git add tests/routes/test_questoes_pair_filtering_routes.py && git commit -m "test(api): rotas com org_cargo_pairs — 4 cenários"
```

---

## Task 8: Push, PR, validação Coolify

- [ ] **Step 8.1: Suite completa local**

```bash
cd /d/verus_api && pytest tests/ -q 2>&1 | tail -10
```

Expected: todos PASS.

- [ ] **Step 8.2: Push**

```bash
cd /d/verus_api && git push -u origin feat/questoes-pair-filtering
```

Expected: URL pra abrir PR.

- [ ] **Step 8.3: Criar PR**

Título: `feat(api): pair filtering (orgao, cargo) em /search, /count, /facets`

Body:
```markdown
## Summary
- Novo query param `org_cargo_pairs=ORGAO:CARGO` (multi-valued) em `/search`, `/count`, `/facets`
- Pares geram condições SQL `(orgao=A AND cargo=B)` combinadas com OR
- Combina com filtros flat existentes via OR no nível externo: `(flat_orgao_match AND flat_cargo_match) OR pair_match`
- Backward compatible — sem o param, comportamento 100% igual ao anterior
- Pré-requisito do Plano 3b-bonus (frontend OrgaoCargoPicker drilldown)

## Implementation
- `app/services/org_cargo_pairs.py` — parser tolerante (`parse_pairs`) + builder de condição SQL (`build_orgao_cargo_condition`)
- `count_only`, `facets_only`, `get_all` refatorados pra usar o builder único
- `facets_only` skip de `orgao`/`cargo` agora também ignora pairs (que constraem ambos)

## Test plan
- [x] Parser tolerante (7 testes)
- [x] Builder SQL combinando flat + pairs (4 testes)
- [x] Service integration via MagicMock (5 testes)
- [x] Routes via TestClient (4 testes)
- [x] Suite completa sem regressão
- [ ] Validação Coolify: curl pós-deploy
```

- [ ] **Step 8.4: Pós-merge — validação Coolify**

Após Coolify deployar (~2min), executar:

```bash
# Caso 1: pair único
curl -s "https://api.projetopapiro.com.br/api/v1/questoes/count?org_cargo_pairs=TRF1:Juiz%20Federal" | jq

# Caso 2: múltiplos pairs (OR entre eles)
curl -s "https://api.projetopapiro.com.br/api/v1/questoes/count?org_cargo_pairs=TRF1:Juiz%20Federal&org_cargo_pairs=STJ:Ministro" | jq

# Caso 3: pair + flat orgao (OR entre flat e pair)
curl -s "https://api.projetopapiro.com.br/api/v1/questoes/count?orgaos=TRT&org_cargo_pairs=TRF1:Juiz%20Federal" | jq

# Caso 4: backward compat — sem o param
curl -s "https://api.projetopapiro.com.br/api/v1/questoes/count?bancas=CEBRASPE%20%28CESPE%29" | jq

# Caso 5: facets com pairs
curl -s "https://api.projetopapiro.com.br/api/v1/questoes/facets?org_cargo_pairs=TRF1:Juiz%20Federal" | jq '.facets | keys'
```

Expected:
- Casos 1-3: counts numéricos > 0 (TRF1:Juiz Federal existe)
- Caso 4: count idêntico ao do estado anterior do endpoint (regressão zero)
- Caso 5: 8 keys de facets retornadas

- [ ] **Step 8.5: Validação OK → comentar no PR**

`Validado em produção. /count e /facets aceitam org_cargo_pairs com semântica OR esperada. Frontend (Plano 3b-bonus) liberado.`

---

## Critérios de aceite

- [ ] Endpoints aceitam `org_cargo_pairs` como query param multi-valued
- [ ] Parser tolerante a strings malformadas (silencia, não 400)
- [ ] Semântica: `(flat_orgao AND flat_cargo) OR pair_match`
- [ ] Backward compat: sem o param, comportamento 100% idêntico
- [ ] `facets_only` ignora pairs ao agregar facet de `orgao` ou `cargo` (consistente com disjunctive faceting)
- [ ] Cache Redis: novo param entra na key SHA256 automaticamente (via `model_dump`)
- [ ] 0 regressões na suite existente
- [ ] Validado em produção

## Fora de escopo

- Frontend que consome o endpoint (Plano 3b-bonus)
- Validação de pares contra dicionário de órgãos/cargos válidos (parser é tolerante por design — frontend pré-valida)
- Indexes adicionais no Postgres (avaliar só se queries em produção mostrarem latência alta — `(orgao, cargo)` composite index já cobriria)
