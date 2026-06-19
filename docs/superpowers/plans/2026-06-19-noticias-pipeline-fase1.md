# Pipeline de Notícias — Fase 1 (Ingestão + Storage) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um worker Python autônomo que, de hora em hora, busca notícias de concurso do NewsData.io e do GNews.io, deduplica por URL e grava no schema `noticias.*` do Postgres de produção — sem UI, sem API, sem IA.

**Architecture:** Repo dedicado (`concursos-news`). Uma camada de *providers* normaliza cada API para um `NewsItem` canônico; o dedup colapsa por URL normalizada; o *repository* faz upsert idempotente (`ON CONFLICT DO NOTHING`); um scheduler in-process (APScheduler) dispara o ciclo com lock no Redis. Tudo síncrono — o volume é baixo (algumas centenas de linhas/hora).

**Tech Stack:** Python 3.12, httpx, SQLAlchemy 2.0 (core) + psycopg2, Alembic, APScheduler, redis-py, pydantic-settings, pytest + respx + testcontainers[postgres]. Deploy: Docker via Coolify no servidor 95.217.197.95.

**Spec:** `docs/superpowers/specs/2026-06-19-noticias-pipeline-fase1-design.md`

---

## Estrutura de arquivos (repo novo `concursos-news`)

```
concursos-news/
├─ pyproject.toml                      # deps + config de tooling
├─ Dockerfile                          # build do container
├─ .env.example                        # variáveis que o Coolify preenche
├─ alembic.ini
├─ README.md                           # inclui passo-a-passo de deploy no Coolify
├─ migrations/
│  ├─ env.py                           # alembic apontando p/ schema noticias
│  └─ versions/0001_create_noticias.py # cria schema + tabela noticias.itens
├─ src/concursos_news/
│  ├─ __init__.py
│  ├─ config.py                        # Settings (pydantic-settings)
│  ├─ models.py                        # dataclass NewsItem
│  ├─ providers/
│  │  ├─ __init__.py
│  │  ├─ base.py                       # Protocol Provider
│  │  ├─ normalize.py                  # normalize_url + parsers de data
│  │  ├─ newsdata.py                   # NewsDataProvider
│  │  └─ gnews.py                      # GNewsProvider
│  ├─ dedup.py                         # colapsa lote por normalized_url
│  ├─ repository.py                    # upsert_many em noticias.itens
│  └─ worker.py                        # run_cycle() + scheduler + lock Redis
└─ tests/
   ├─ conftest.py                      # fixture testcontainers Postgres
   ├─ fixtures/
   │  ├─ newsdata_sample.json
   │  └─ gnews_sample.json
   ├─ test_config.py
   ├─ test_normalize.py
   ├─ test_newsdata_provider.py
   ├─ test_gnews_provider.py
   ├─ test_dedup.py
   ├─ test_repository.py               # integração (Postgres real)
   └─ test_worker.py                   # integração (providers mockados + DB real)
```

**Responsabilidade de cada unidade:**
- `config.py` — única fonte de verdade das env vars (chaves, DSN, Redis, intervalo).
- `models.py` — o contrato `NewsItem` que desacopla providers do resto.
- `providers/normalize.py` — funções **puras** (URL e datas), o coração testável do dedup.
- `providers/newsdata.py` / `gnews.py` — sabem o formato de cada API; nada além disso sabe.
- `dedup.py` — colapsa duplicatas dentro de um lote (a constraint do banco é a 2ª linha de defesa).
- `repository.py` — única unidade que fala SQL.
- `worker.py` — orquestra o ciclo e o agendamento.

---

## Task 1: Bootstrap do repo e configuração

**Files:**
- Create: `pyproject.toml`, `src/concursos_news/__init__.py`, `src/concursos_news/config.py`
- Create: `.env.example`
- Test: `tests/test_config.py`

- [ ] **Step 1: Criar o repo e a estrutura base**

```bash
mkdir concursos-news && cd concursos-news
git init
mkdir -p src/concursos_news/providers tests/fixtures migrations/versions
touch src/concursos_news/__init__.py src/concursos_news/providers/__init__.py
```

- [ ] **Step 2: Escrever `pyproject.toml`**

```toml
[project]
name = "concursos-news"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "httpx>=0.27",
    "sqlalchemy>=2.0",
    "psycopg2-binary>=2.9",
    "alembic>=1.13",
    "apscheduler>=3.10",
    "redis>=5.0",
    "pydantic-settings>=2.2",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "respx>=0.21", "testcontainers[postgres]>=4.0"]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.pytest.ini_options]
pythonpath = ["src"]
testpaths = ["tests"]
```

- [ ] **Step 3: Escrever o teste de config (falha primeiro)**

```python
# tests/test_config.py
import os
from concursos_news.config import Settings


def test_settings_reads_env(monkeypatch):
    monkeypatch.setenv("NEWSDATA_KEY", "nd_key")
    monkeypatch.setenv("GNEWS_KEY", "gn_key")
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg2://u:p@h:5432/db")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    s = Settings()
    assert s.newsdata_key == "nd_key"
    assert s.gnews_key == "gn_key"
    assert s.ingest_interval_min == 60  # default


def test_settings_interval_override(monkeypatch):
    monkeypatch.setenv("NEWSDATA_KEY", "x")
    monkeypatch.setenv("GNEWS_KEY", "x")
    monkeypatch.setenv("DATABASE_URL", "x")
    monkeypatch.setenv("REDIS_URL", "x")
    monkeypatch.setenv("NOTICIAS_INGEST_INTERVAL_MIN", "30")
    assert Settings().ingest_interval_min == 30
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `pip install -e ".[dev]" && pytest tests/test_config.py -v`
Expected: FAIL — `ModuleNotFoundError: concursos_news.config`

- [ ] **Step 5: Implementar `config.py`**

```python
# src/concursos_news/config.py
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", populate_by_name=True)

    newsdata_key: str = Field(alias="NEWSDATA_KEY")
    gnews_key: str = Field(alias="GNEWS_KEY")
    database_url: str = Field(alias="DATABASE_URL")
    redis_url: str = Field(alias="REDIS_URL")

    query: str = Field(default="concurso edital", alias="NOTICIAS_QUERY")
    country: str = Field(default="br", alias="NOTICIAS_COUNTRY")
    lang: str = Field(default="pt", alias="NOTICIAS_LANG")
    ingest_interval_min: int = Field(default=60, alias="NOTICIAS_INGEST_INTERVAL_MIN")
```

- [ ] **Step 6: Rodar e ver passar**

Run: `pytest tests/test_config.py -v`
Expected: PASS (2 passed)

- [ ] **Step 7: Escrever `.env.example`**

```bash
# APIs de notícia
NEWSDATA_KEY=
GNEWS_KEY=
# Postgres de produção (schema noticias.*) — mesmo banco das questões
DATABASE_URL=postgresql+psycopg2://USER:PASS@HOST:5432/postgres
# Redis (lock de execução)
REDIS_URL=redis://HOST:6379/0
# opcionais
NOTICIAS_INGEST_INTERVAL_MIN=60
```

- [ ] **Step 8: Commit**

```bash
git add pyproject.toml .env.example src/concursos_news tests/test_config.py
git commit -m "feat: bootstrap repo + Settings de configuração"
```

---

## Task 2: Modelo canônico `NewsItem`

**Files:**
- Create: `src/concursos_news/models.py`
- Test: (coberto indiretamente pelos providers; sem teste isolado — é um dataclass puro)

- [ ] **Step 1: Implementar o dataclass**

```python
# src/concursos_news/models.py
from dataclasses import dataclass
from datetime import datetime


@dataclass
class NewsItem:
    provider: str               # 'newsdata' | 'gnews'
    source_name: str
    title: str
    url: str
    published_at: datetime      # timezone-aware (UTC)
    raw: dict
    external_id: str | None = None
    description: str | None = None
    image_url: str | None = None
    lang: str | None = None
    category: list[str] | None = None
    keywords: list[str] | None = None
```

- [ ] **Step 2: Commit**

```bash
git add src/concursos_news/models.py
git commit -m "feat: NewsItem (formato canônico)"
```

---

## Task 3: Normalização de URL (função pura, TDD)

**Files:**
- Create: `src/concursos_news/providers/normalize.py`
- Test: `tests/test_normalize.py`

- [ ] **Step 1: Escrever os testes (falham primeiro)**

```python
# tests/test_normalize.py
from concursos_news.providers.normalize import normalize_url, parse_dt
from datetime import timezone


def test_strips_utm_and_tracking():
    a = normalize_url("https://g1.com/noticia?utm_source=x&utm_medium=y&id=42")
    b = normalize_url("https://g1.com/noticia?id=42")
    assert a == b


def test_strips_fragment_and_trailing_slash():
    a = normalize_url("https://g1.com/noticia/#topo")
    b = normalize_url("https://g1.com/noticia")
    assert a == b


def test_lowercases_host_not_path():
    out = normalize_url("https://G1.COM.BR/Materia-X")
    assert out == "https://g1.com.br/Materia-X"


def test_same_story_two_sources_collapse():
    nd = normalize_url("http://www.odia.com.br/n/abc?utm_campaign=feed")
    gn = normalize_url("https://www.odia.com.br/n/abc")
    assert nd == gn  # http→https e utm removido


def test_keeps_meaningful_query():
    out = normalize_url("https://site.com/lista?page=3")
    assert "page=3" in out


def test_parse_dt_newsdata_format():
    dt = parse_dt("2026-06-18 23:30:07")
    assert dt.tzinfo == timezone.utc
    assert dt.year == 2026 and dt.hour == 23


def test_parse_dt_iso_z():
    dt = parse_dt("2026-06-18T23:30:07Z")
    assert dt.tzinfo == timezone.utc
    assert dt.day == 18
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pytest tests/test_normalize.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implementar `normalize.py`**

```python
# src/concursos_news/providers/normalize.py
from datetime import datetime, timezone
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

_TRACKING_PREFIXES = ("utm_",)
_TRACKING_KEYS = {"fbclid", "gclid", "ref", "ref_src", "igshid", "mc_cid", "mc_eid"}


def normalize_url(url: str) -> str:
    parts = urlsplit(url.strip())
    scheme = "https"  # força https p/ colapsar http/https da mesma matéria
    host = parts.netloc.lower()
    path = parts.path.rstrip("/") or "/"
    kept = [
        (k, v) for k, v in parse_qsl(parts.query, keep_blank_values=False)
        if not k.lower().startswith(_TRACKING_PREFIXES) and k.lower() not in _TRACKING_KEYS
    ]
    query = urlencode(sorted(kept))
    return urlunsplit((scheme, host, path, query, ""))


def parse_dt(value: str) -> datetime:
    """Aceita 'YYYY-MM-DD HH:MM:SS' (NewsData) e ISO-8601 com Z (GNews). Retorna UTC."""
    v = value.strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(v)
    except ValueError:
        dt = datetime.strptime(value.strip(), "%Y-%m-%d %H:%M:%S")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pytest tests/test_normalize.py -v`
Expected: PASS (7 passed)

- [ ] **Step 5: Commit**

```bash
git add src/concursos_news/providers/normalize.py tests/test_normalize.py
git commit -m "feat: normalize_url + parse_dt (funções puras, base do dedup)"
```

---

## Task 4: Provider NewsData — parsing (TDD com fixture real)

**Files:**
- Create: `tests/fixtures/newsdata_sample.json`
- Create: `src/concursos_news/providers/base.py`, `src/concursos_news/providers/newsdata.py`
- Test: `tests/test_newsdata_provider.py`

- [ ] **Step 1: Salvar fixture real** (capturada da API em 2026-06-19)

```json
// tests/fixtures/newsdata_sample.json
{
  "status": "success",
  "totalResults": 114,
  "results": [
    {
      "article_id": "abc123",
      "title": "Concurso Prefeitura de Cosmópolis SP abre vagas para 36 cargos",
      "link": "http://folha.qconcursos.com/n/concurso-prefeitura-de-cosmopolis-sp?utm_source=feed",
      "description": "Concurso de Cosmópolis SP oferece vagas imediatas e cadastro reserva.",
      "pubDate": "2026-06-18 23:30:07",
      "pubDateTZ": "UTC",
      "image_url": "https://image.qconcursos.com/x.jpg",
      "source_id": "folhaqconcursos",
      "source_name": "Folha Dirigida",
      "language": "portuguese",
      "country": ["brazil"],
      "category": ["business", "top"],
      "keywords": ["concurso", "edital"]
    },
    {
      "article_id": "def456",
      "title": "Concurso TJ PR tem banca organizadora predefinida",
      "link": "https://www.odia.com.br/n/tj-pr",
      "description": null,
      "pubDate": "2026-06-18 20:00:00",
      "source_id": "odia",
      "source_name": "O Dia",
      "language": "portuguese",
      "image_url": null,
      "category": ["top"],
      "keywords": null
    }
  ],
  "nextPage": "TOKEN123"
}
```

- [ ] **Step 2: Escrever os testes (falham primeiro)**

```python
# tests/test_newsdata_provider.py
import json
from pathlib import Path
from concursos_news.providers.newsdata import parse_newsdata

FIXTURE = json.loads((Path(__file__).parent / "fixtures/newsdata_sample.json").read_text())


def test_parses_all_results():
    items = parse_newsdata(FIXTURE)
    assert len(items) == 2


def test_maps_fields_correctly():
    item = parse_newsdata(FIXTURE)[0]
    assert item.provider == "newsdata"
    assert item.external_id == "abc123"
    assert item.source_name == "Folha Dirigida"
    assert item.url.startswith("http://folha.qconcursos.com")
    assert item.image_url == "https://image.qconcursos.com/x.jpg"
    assert item.category == ["business", "top"]
    assert item.keywords == ["concurso", "edital"]
    assert item.published_at.year == 2026


def test_handles_null_fields():
    item = parse_newsdata(FIXTURE)[1]
    assert item.description is None
    assert item.image_url is None
    assert item.keywords is None
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pytest tests/test_newsdata_provider.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 4: Implementar `base.py` e o parser**

```python
# src/concursos_news/providers/base.py
from typing import Protocol
from concursos_news.models import NewsItem


class Provider(Protocol):
    name: str
    def fetch(self) -> list[NewsItem]: ...
```

```python
# src/concursos_news/providers/newsdata.py
import httpx
from concursos_news.models import NewsItem
from concursos_news.providers.normalize import parse_dt

BASE_URL = "https://newsdata.io/api/1/latest"


def parse_newsdata(payload: dict) -> list[NewsItem]:
    items: list[NewsItem] = []
    for r in payload.get("results") or []:
        link = r.get("link")
        pub = r.get("pubDate")
        if not link or not pub:
            continue  # item malformado: descarta
        items.append(NewsItem(
            provider="newsdata",
            external_id=r.get("article_id"),
            source_name=r.get("source_name") or r.get("source_id") or "desconhecido",
            title=r.get("title") or "",
            url=link,
            description=r.get("description"),
            image_url=r.get("image_url"),
            published_at=parse_dt(pub),
            lang=r.get("language"),
            category=r.get("category"),
            keywords=r.get("keywords"),
            raw=r,
        ))
    return items


class NewsDataProvider:
    name = "newsdata"

    def __init__(self, api_key: str, query: str, country: str):
        self._key = api_key
        self._query = query
        self._country = country

    def fetch(self) -> list[NewsItem]:
        params = {"apikey": self._key, "q": self._query, "country": self._country}
        resp = httpx.get(BASE_URL, params=params, timeout=30)
        resp.raise_for_status()
        return parse_newsdata(resp.json())
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pytest tests/test_newsdata_provider.py -v`
Expected: PASS (3 passed)

- [ ] **Step 6: Commit**

```bash
git add src/concursos_news/providers/base.py src/concursos_news/providers/newsdata.py tests/test_newsdata_provider.py tests/fixtures/newsdata_sample.json
git commit -m "feat: NewsDataProvider + parser (fixture real)"
```

---

## Task 5: Provider GNews — parsing (TDD com fixture real)

**Files:**
- Create: `tests/fixtures/gnews_sample.json`
- Create: `src/concursos_news/providers/gnews.py`
- Test: `tests/test_gnews_provider.py`

- [ ] **Step 1: Salvar fixture real** (capturada em 2026-06-19)

```json
// tests/fixtures/gnews_sample.json
{
  "totalArticles": 7422,
  "articles": [
    {
      "id": "g-1",
      "title": "Concurso da Polícia Civil ganha nova previsão para edital",
      "description": "Veja quando sai o edital.",
      "content": "texto completo truncado...",
      "url": "https://atarde.com.br/concurso-pc?utm_medium=rss",
      "image": "https://atarde.com.br/img.jpg",
      "publishedAt": "2026-06-18T12:00:00Z",
      "lang": "pt",
      "source": {"name": "A Tarde", "url": "https://atarde.com.br"}
    },
    {
      "id": "g-2",
      "title": "Governo do RN publica edital do concurso da Polícia Penal",
      "description": "260 vagas.",
      "url": "https://tribunadonorte.com.br/pp-rn",
      "image": null,
      "publishedAt": "2026-06-18T09:30:00Z",
      "lang": "pt",
      "source": {"name": "Tribuna Do Norte", "url": "https://tribunadonorte.com.br"}
    }
  ]
}
```

- [ ] **Step 2: Escrever os testes (falham primeiro)**

```python
# tests/test_gnews_provider.py
import json
from pathlib import Path
from concursos_news.providers.gnews import parse_gnews

FIXTURE = json.loads((Path(__file__).parent / "fixtures/gnews_sample.json").read_text())


def test_parses_all_articles():
    assert len(parse_gnews(FIXTURE)) == 2


def test_maps_fields_correctly():
    item = parse_gnews(FIXTURE)[0]
    assert item.provider == "gnews"
    assert item.external_id == "g-1"
    assert item.source_name == "A Tarde"
    assert item.url.startswith("https://atarde.com.br")
    assert item.image_url == "https://atarde.com.br/img.jpg"
    assert item.category is None  # GNews não fornece
    assert item.keywords is None
    assert item.published_at.hour == 12


def test_handles_null_image():
    assert parse_gnews(FIXTURE)[1].image_url is None
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pytest tests/test_gnews_provider.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 4: Implementar `gnews.py`**

```python
# src/concursos_news/providers/gnews.py
import httpx
from concursos_news.models import NewsItem
from concursos_news.providers.normalize import parse_dt

BASE_URL = "https://gnews.io/api/v4/search"


def parse_gnews(payload: dict) -> list[NewsItem]:
    items: list[NewsItem] = []
    for a in payload.get("articles") or []:
        url = a.get("url")
        pub = a.get("publishedAt")
        if not url or not pub:
            continue
        source = a.get("source") or {}
        items.append(NewsItem(
            provider="gnews",
            external_id=a.get("id"),
            source_name=source.get("name") or "desconhecido",
            title=a.get("title") or "",
            url=url,
            description=a.get("description"),
            image_url=a.get("image"),
            published_at=parse_dt(pub),
            lang=a.get("lang"),
            category=None,
            keywords=None,
            raw=a,
        ))
    return items


class GNewsProvider:
    name = "gnews"

    def __init__(self, api_key: str, query: str, lang: str, country: str):
        self._key = api_key
        self._query = query
        self._lang = lang
        self._country = country

    def fetch(self) -> list[NewsItem]:
        params = {
            "apikey": self._key, "q": self._query,
            "lang": self._lang, "country": self._country, "max": 10,
        }
        resp = httpx.get(BASE_URL, params=params, timeout=30)
        resp.raise_for_status()
        return parse_gnews(resp.json())
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pytest tests/test_gnews_provider.py -v`
Expected: PASS (3 passed)

- [ ] **Step 6: Commit**

```bash
git add src/concursos_news/providers/gnews.py tests/test_gnews_provider.py tests/fixtures/gnews_sample.json
git commit -m "feat: GNewsProvider + parser (fixture real)"
```

---

## Task 6: Dedup de lote (TDD)

**Files:**
- Create: `src/concursos_news/dedup.py`
- Test: `tests/test_dedup.py`

- [ ] **Step 1: Escrever os testes (falham primeiro)**

```python
# tests/test_dedup.py
from datetime import datetime, timezone
from concursos_news.models import NewsItem
from concursos_news.dedup import dedup_batch


def _item(url, provider="newsdata"):
    return NewsItem(provider=provider, source_name="x", title="t", url=url,
                    published_at=datetime(2026, 6, 18, tzinfo=timezone.utc), raw={})


def test_collapses_same_story_from_two_providers():
    batch = [
        _item("http://www.odia.com.br/n/abc?utm_source=feed", "newsdata"),
        _item("https://www.odia.com.br/n/abc", "gnews"),
    ]
    out = dedup_batch(batch)
    assert len(out) == 1


def test_keeps_distinct_urls():
    batch = [_item("https://a.com/1"), _item("https://a.com/2")]
    assert len(dedup_batch(batch)) == 2


def test_attaches_normalized_url():
    out = dedup_batch([_item("https://a.com/1/#x")])
    assert out[0].normalized_url == "https://a.com/1"
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pytest tests/test_dedup.py -v`
Expected: FAIL — `ModuleNotFoundError` e `AttributeError: normalized_url`

- [ ] **Step 3: Adicionar campo ao modelo e implementar dedup**

Primeiro, adicionar `normalized_url` ao `NewsItem` em `src/concursos_news/models.py` (campo opcional, preenchido pelo dedup):

```python
    normalized_url: str | None = None
```

Depois criar o dedup:

```python
# src/concursos_news/dedup.py
from concursos_news.models import NewsItem
from concursos_news.providers.normalize import normalize_url


def dedup_batch(items: list[NewsItem]) -> list[NewsItem]:
    """Preenche normalized_url e mantém só a 1ª ocorrência de cada URL normalizada."""
    seen: set[str] = set()
    out: list[NewsItem] = []
    for it in items:
        nu = normalize_url(it.url)
        it.normalized_url = nu
        if nu in seen:
            continue
        seen.add(nu)
        out.append(it)
    return out
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pytest tests/test_dedup.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add src/concursos_news/dedup.py src/concursos_news/models.py tests/test_dedup.py
git commit -m "feat: dedup_batch por URL normalizada"
```

---

## Task 7: Migração Alembic — schema `noticias.itens`

**Files:**
- Create: `alembic.ini`, `migrations/env.py`, `migrations/versions/0001_create_noticias.py`

- [ ] **Step 1: Escrever `alembic.ini`** (mínimo)

```ini
# alembic.ini
[alembic]
script_location = migrations
sqlalchemy.url =

[loggers]
keys = root
[handlers]
keys = console
[formatters]
keys = generic
[logger_root]
level = WARN
handlers = console
[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic
[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
```

- [ ] **Step 2: Escrever `migrations/env.py`** (lê DSN da env, sem autogenerate)

```python
# migrations/env.py
import os
from alembic import context
from sqlalchemy import create_engine

config = context.config
DB_URL = os.environ["DATABASE_URL"]


def run_migrations_online():
    engine = create_engine(DB_URL)
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            version_table="alembic_version",
            version_table_schema="noticias",
        )
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
```

- [ ] **Step 3: Escrever a migração `0001_create_noticias.py`**

```python
# migrations/versions/0001_create_noticias.py
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE SCHEMA IF NOT EXISTS noticias")
    op.execute("""
        CREATE TABLE noticias.itens (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            provider        text        NOT NULL,
            external_id     text,
            source_name     text        NOT NULL,
            title           text        NOT NULL,
            description     text,
            url             text        NOT NULL,
            normalized_url  text        NOT NULL,
            image_url       text,
            published_at    timestamptz NOT NULL,
            lang            text,
            category        text[],
            keywords        text[],
            raw             jsonb       NOT NULL,
            status          text        NOT NULL DEFAULT 'pending',
            fetched_at      timestamptz NOT NULL DEFAULT now(),
            created_at      timestamptz NOT NULL DEFAULT now(),
            updated_at      timestamptz NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE UNIQUE INDEX uq_itens_normalized_url ON noticias.itens (normalized_url)")
    op.execute("CREATE INDEX ix_itens_published_at ON noticias.itens (published_at DESC)")
    op.execute("CREATE INDEX ix_itens_status ON noticias.itens (status)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS noticias.itens")
    op.execute("DROP SCHEMA IF EXISTS noticias CASCADE")
```

Nota: `version_table_schema="noticias"` exige que o schema exista antes do Alembic gravar a versão. A própria migração cria o schema na 1ª linha do `upgrade()`, e o Alembic cria a `alembic_version` no schema após o `begin_transaction`. Se o Alembic reclamar que o schema não existe ao registrar a versão, criar o schema manualmente uma vez: `psql -c "CREATE SCHEMA IF NOT EXISTS noticias"` (documentar isso no README de deploy).

- [ ] **Step 4: Commit**

```bash
git add alembic.ini migrations
git commit -m "feat: migração alembic do schema noticias.itens"
```

---

## Task 8: Repository — upsert idempotente (integração com Postgres real)

**Files:**
- Create: `tests/conftest.py`
- Create: `src/concursos_news/repository.py`
- Test: `tests/test_repository.py`

- [ ] **Step 1: Escrever a fixture de Postgres (`conftest.py`)** — sobe um Postgres efêmero e roda a migração

```python
# tests/conftest.py
import os
import subprocess
import pytest
from sqlalchemy import create_engine, text
from testcontainers.postgres import PostgresContainer


@pytest.fixture(scope="session")
def db_engine():
    with PostgresContainer("pgvector/pgvector:pg17") as pg:
        url = pg.get_connection_url()  # postgresql+psycopg2://...
        os.environ["DATABASE_URL"] = url
        engine = create_engine(url)
        # o schema precisa existir antes do alembic gravar a alembic_version nele
        with engine.begin() as c:
            c.execute(text("CREATE SCHEMA IF NOT EXISTS noticias"))
        # roda a migração via alembic
        subprocess.run(["alembic", "upgrade", "head"], check=True,
                       env={**os.environ, "DATABASE_URL": url})
        yield engine
```

- [ ] **Step 2: Escrever os testes (falham primeiro)**

```python
# tests/test_repository.py
from datetime import datetime, timezone
from sqlalchemy import text
from concursos_news.models import NewsItem
from concursos_news.repository import upsert_many


def _item(url, nu=None):
    it = NewsItem(provider="newsdata", source_name="Folha", title="t", url=url,
                  published_at=datetime(2026, 6, 18, tzinfo=timezone.utc),
                  raw={"k": "v"}, category=["top"], keywords=["concurso"])
    it.normalized_url = nu or url
    return it


def _count(engine):
    with engine.connect() as c:
        return c.execute(text("SELECT count(*) FROM noticias.itens")).scalar()


def test_inserts_new_items(db_engine):
    stats = upsert_many(db_engine, [_item("https://a.com/1"), _item("https://a.com/2")])
    assert stats.inserted == 2
    assert _count(db_engine) == 2


def test_idempotent_on_normalized_url(db_engine):
    before = _count(db_engine)
    stats = upsert_many(db_engine, [_item("https://a.com/1")])  # já existe
    assert stats.inserted == 0
    assert stats.skipped == 1
    assert _count(db_engine) == before


def test_persists_arrays_and_jsonb(db_engine):
    upsert_many(db_engine, [_item("https://a.com/3")])
    with db_engine.connect() as c:
        row = c.execute(text(
            "SELECT category, keywords, raw, status FROM noticias.itens "
            "WHERE normalized_url='https://a.com/3'"
        )).one()
    assert row.category == ["top"]
    assert row.keywords == ["concurso"]
    assert row.raw == {"k": "v"}
    assert row.status == "pending"
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pytest tests/test_repository.py -v`
Expected: FAIL — `ModuleNotFoundError: concursos_news.repository`

- [ ] **Step 4: Implementar `repository.py`**

```python
# src/concursos_news/repository.py
from dataclasses import dataclass
from sqlalchemy import Table, Column, MetaData, text
from sqlalchemy.dialects.postgresql import insert, JSONB, ARRAY, UUID, TIMESTAMP
from sqlalchemy import String
from concursos_news.models import NewsItem

_meta = MetaData(schema="noticias")
itens = Table(
    "itens", _meta,
    Column("provider", String), Column("external_id", String),
    Column("source_name", String), Column("title", String),
    Column("description", String), Column("url", String),
    Column("normalized_url", String), Column("image_url", String),
    Column("published_at", TIMESTAMP(timezone=True)), Column("lang", String),
    Column("category", ARRAY(String)), Column("keywords", ARRAY(String)),
    Column("raw", JSONB),
)


@dataclass
class InsertStats:
    inserted: int = 0
    skipped: int = 0


def _row(it: NewsItem) -> dict:
    return {
        "provider": it.provider, "external_id": it.external_id,
        "source_name": it.source_name, "title": it.title,
        "description": it.description, "url": it.url,
        "normalized_url": it.normalized_url, "image_url": it.image_url,
        "published_at": it.published_at, "lang": it.lang,
        "category": it.category, "keywords": it.keywords, "raw": it.raw,
    }


def upsert_many(engine, items: list[NewsItem]) -> InsertStats:
    stats = InsertStats()
    with engine.begin() as conn:
        for it in items:
            stmt = insert(itens).values(**_row(it)).on_conflict_do_nothing(
                index_elements=["normalized_url"]
            )
            result = conn.execute(stmt)
            if result.rowcount and result.rowcount > 0:
                stats.inserted += 1
            else:
                stats.skipped += 1
    return stats
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pytest tests/test_repository.py -v`
Expected: PASS (3 passed). Requer Docker rodando (testcontainers).

- [ ] **Step 6: Commit**

```bash
git add tests/conftest.py src/concursos_news/repository.py tests/test_repository.py
git commit -m "feat: repository.upsert_many idempotente (teste de integração)"
```

---

## Task 9: Worker — ciclo de ingestão (integração: providers mockados + DB real)

**Files:**
- Create: `src/concursos_news/worker.py`
- Test: `tests/test_worker.py`

- [ ] **Step 1: Escrever os testes (falham primeiro)**

```python
# tests/test_worker.py
from datetime import datetime, timezone
from sqlalchemy import text
from concursos_news.models import NewsItem
from concursos_news.worker import run_cycle


class FakeProvider:
    def __init__(self, name, items=None, boom=False):
        self.name = name
        self._items = items or []
        self._boom = boom

    def fetch(self):
        if self._boom:
            raise RuntimeError("API caiu")
        return list(self._items)


def _item(url, provider="newsdata"):
    return NewsItem(provider=provider, source_name="x", title="t", url=url,
                    published_at=datetime(2026, 6, 18, tzinfo=timezone.utc), raw={})


def _count(engine):
    with engine.connect() as c:
        return c.execute(text("SELECT count(*) FROM noticias.itens")).scalar()


def test_cycle_ingests_from_all_providers(db_engine):
    with db_engine.begin() as c:
        c.execute(text("TRUNCATE noticias.itens"))
    providers = [
        FakeProvider("newsdata", [_item("https://w.com/a"), _item("https://w.com/b")]),
        FakeProvider("gnews", [_item("https://w.com/c", "gnews")]),
    ]
    stats = run_cycle(db_engine, providers)
    assert _count(db_engine) == 3
    assert stats["newsdata"].inserted == 2
    assert stats["gnews"].inserted == 1


def test_one_provider_failing_does_not_block_other(db_engine):
    with db_engine.begin() as c:
        c.execute(text("TRUNCATE noticias.itens"))
    providers = [
        FakeProvider("newsdata", boom=True),
        FakeProvider("gnews", [_item("https://w.com/d", "gnews")]),
    ]
    stats = run_cycle(db_engine, providers)
    assert _count(db_engine) == 1          # gnews entrou
    assert "newsdata" not in stats          # falhou, não contabiliza


def test_cycle_is_idempotent(db_engine):
    with db_engine.begin() as c:
        c.execute(text("TRUNCATE noticias.itens"))
    providers = [FakeProvider("newsdata", [_item("https://w.com/e")])]
    run_cycle(db_engine, providers)
    run_cycle(db_engine, providers)         # roda 2x
    assert _count(db_engine) == 1           # sem duplicata
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pytest tests/test_worker.py -v`
Expected: FAIL — `ModuleNotFoundError: concursos_news.worker`

- [ ] **Step 3: Implementar `worker.py` (parte do ciclo)**

```python
# src/concursos_news/worker.py
import logging
from concursos_news.dedup import dedup_batch
from concursos_news.repository import upsert_many, InsertStats

log = logging.getLogger("concursos_news")


def run_cycle(engine, providers) -> dict[str, InsertStats]:
    """Busca de cada provider (isolando falhas), deduplica e faz upsert. Retorna stats por provider que teve sucesso."""
    results: dict[str, InsertStats] = {}
    for p in providers:
        try:
            items = p.fetch()
        except Exception as exc:  # isolamento por provider
            log.error("provider %s falhou: %s", p.name, exc)
            continue
        deduped = dedup_batch(items)
        stats = upsert_many(engine, deduped)
        results[p.name] = stats
        log.info("provider=%s buscados=%d novos=%d ignorados=%d",
                 p.name, len(items), stats.inserted, stats.skipped)
    return results
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pytest tests/test_worker.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add src/concursos_news/worker.py tests/test_worker.py
git commit -m "feat: run_cycle (isolamento por provider + idempotência)"
```

---

## Task 10: Scheduler + lock Redis + entrypoint

**Files:**
- Modify: `src/concursos_news/worker.py` (adicionar `main()` e o agendamento)
- Test: `tests/test_worker.py` (adicionar teste do lock)

- [ ] **Step 1: Escrever o teste do lock (falha primeiro)**

```python
# adicionar em tests/test_worker.py
import fakeredis
from concursos_news.worker import acquire_lock


def test_lock_prevents_overlap():
    r = fakeredis.FakeStrictRedis()
    assert acquire_lock(r, ttl=60) is True      # 1º pega
    assert acquire_lock(r, ttl=60) is False     # 2º não pega (lock ativo)
```

Adicionar `fakeredis` às deps de dev em `pyproject.toml` (`dev = [..., "fakeredis>=2.0"]`) e reinstalar: `pip install -e ".[dev]"`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pytest tests/test_worker.py::test_lock_prevents_overlap -v`
Expected: FAIL — `ImportError: cannot import name 'acquire_lock'`

- [ ] **Step 3: Implementar lock + scheduler + main em `worker.py`**

```python
# adicionar em src/concursos_news/worker.py
import time
from apscheduler.schedulers.blocking import BlockingScheduler
from sqlalchemy import create_engine
import redis as redis_lib
from concursos_news.config import Settings
from concursos_news.providers.newsdata import NewsDataProvider
from concursos_news.providers.gnews import GNewsProvider

_LOCK_KEY = "noticias:ingest:lock"


def acquire_lock(client, ttl: int) -> bool:
    """SET NX EX — retorna True se conseguiu o lock."""
    return bool(client.set(_LOCK_KEY, str(time.time()), nx=True, ex=ttl))


def build_providers(s: Settings):
    return [
        NewsDataProvider(s.newsdata_key, s.query, s.country),
        GNewsProvider(s.gnews_key, s.query, s.lang, s.country),
    ]


def tick(engine, redis_client, providers, interval_min: int):
    if not acquire_lock(redis_client, ttl=interval_min * 60 - 5):
        log.warning("ciclo anterior ainda rodando; pulando")
        return
    run_cycle(engine, providers)


def main():
    logging.basicConfig(level=logging.INFO)
    s = Settings()
    engine = create_engine(s.database_url)
    redis_client = redis_lib.from_url(s.redis_url)
    providers = build_providers(s)

    log.info("rodando ciclo inicial…")
    tick(engine, redis_client, providers, s.ingest_interval_min)

    scheduler = BlockingScheduler(timezone="UTC")
    scheduler.add_job(tick, "interval", minutes=s.ingest_interval_min,
                      args=[engine, redis_client, providers, s.ingest_interval_min])
    log.info("scheduler iniciado (intervalo=%dmin)", s.ingest_interval_min)
    scheduler.start()


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pytest tests/test_worker.py -v`
Expected: PASS (todos)

- [ ] **Step 5: Commit**

```bash
git add src/concursos_news/worker.py tests/test_worker.py pyproject.toml
git commit -m "feat: scheduler APScheduler + lock Redis + entrypoint main()"
```

---

## Task 11: Provider fetch via HTTP (teste com respx)

**Files:**
- Test: `tests/test_newsdata_provider.py`, `tests/test_gnews_provider.py` (adicionar testes de `.fetch()`)

- [ ] **Step 1: Adicionar teste de fetch mockado do NewsData**

```python
# adicionar em tests/test_newsdata_provider.py
import respx, httpx
from concursos_news.providers.newsdata import NewsDataProvider, BASE_URL


@respx.mock
def test_fetch_calls_api_and_parses():
    respx.get(BASE_URL).mock(return_value=httpx.Response(200, json=FIXTURE))
    items = NewsDataProvider("k", "concurso edital", "br").fetch()
    assert len(items) == 2
    assert items[0].provider == "newsdata"


@respx.mock
def test_fetch_raises_on_http_error():
    respx.get(BASE_URL).mock(return_value=httpx.Response(429))
    try:
        NewsDataProvider("k", "q", "br").fetch()
        assert False, "deveria ter levantado"
    except httpx.HTTPStatusError:
        pass
```

- [ ] **Step 2: Adicionar teste de fetch mockado do GNews**

```python
# adicionar em tests/test_gnews_provider.py
import respx, httpx
from concursos_news.providers.gnews import GNewsProvider, BASE_URL


@respx.mock
def test_fetch_calls_api_and_parses():
    respx.get(BASE_URL).mock(return_value=httpx.Response(200, json=FIXTURE))
    items = GNewsProvider("k", "concurso edital", "pt", "br").fetch()
    assert len(items) == 2
    assert items[0].provider == "gnews"
```

- [ ] **Step 3: Rodar e ver passar** (a implementação de `.fetch()` já existe das Tasks 4/5)

Run: `pytest tests/test_newsdata_provider.py tests/test_gnews_provider.py -v`
Expected: PASS (todos)

- [ ] **Step 4: Commit**

```bash
git add tests/test_newsdata_provider.py tests/test_gnews_provider.py
git commit -m "test: fetch HTTP dos providers (respx)"
```

---

## Task 12: Dockerfile, README de deploy e smoke test final

**Files:**
- Create: `Dockerfile`, `README.md`

- [ ] **Step 1: Escrever o `Dockerfile`**

```dockerfile
# Dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .
COPY . .
# roda migração e depois o worker
CMD ["sh", "-c", "alembic upgrade head && python -m concursos_news.worker"]
```

- [ ] **Step 2: Escrever o `README.md`** com o passo-a-passo de deploy no Coolify

```markdown
# concursos-news

Worker de ingestão de notícias de concurso (NewsData.io + GNews.io → schema `noticias.*`).

## Rodar local
```bash
pip install -e ".[dev]"
cp .env.example .env   # preencher chaves + DATABASE_URL + REDIS_URL
pytest                 # requer Docker (testcontainers)
python -m concursos_news.worker
```

## Deploy no Coolify (servidor 95.217.197.95)
1. **Pré-requisito (1x):** no Postgres de produção, criar o schema:
   `psql "$DATABASE_URL" -c "CREATE SCHEMA IF NOT EXISTS noticias"`
2. Coolify → projeto do verus-api → **+ New → Application** → apontar pro repo `concursos-news`.
3. Build pack: **Dockerfile** (raiz do repo).
4. **Environment variables:**
   - `NEWSDATA_KEY`, `GNEWS_KEY`
   - `DATABASE_URL` = mesmo Postgres das questões (container `u40kcogk...`, db `postgres`), formato `postgresql+psycopg2://user:pass@host:5432/postgres`
   - `REDIS_URL` = Redis existente no 95
   - (opcional) `NOTICIAS_INGEST_INTERVAL_MIN`
5. Marcar como serviço **sempre ligado** (long-running). Deploy.
6. Verificar logs: deve aparecer `scheduler iniciado` e, a cada hora, `provider=... novos=N`.

## Verificação
```sql
SELECT provider, count(*) FROM noticias.itens GROUP BY provider;
SELECT title, source_name, published_at FROM noticias.itens ORDER BY published_at DESC LIMIT 10;
```
```

- [ ] **Step 3: Rodar a suíte completa**

Run: `pytest -v`
Expected: PASS em todos os arquivos (config, normalize, providers, dedup, repository, worker). Requer Docker.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile README.md
git commit -m "feat: Dockerfile + README de deploy no Coolify"
```

---

## Notas de execução

- **Docker é necessário** para os testes de integração (testcontainers sobe um Postgres pg17 efêmero). Se a máquina de execução não tiver Docker, as Tasks 8 e 9 falham no ambiente — rodar essas num host com Docker.
- **Não commitar `.env`** — só `.env.example`. Adicionar `.env` ao `.gitignore` no Step 1 da Task 1 (`echo ".env" >> .gitignore`).
- **Ordem dos commits** segue a ordem das tasks; cada task fecha com um commit verde.
- **Fora de escopo** (Fases 2-4): enriquecimento IA, match com questões/editais, páginas SEO, feed in-app. Não implementar aqui.
