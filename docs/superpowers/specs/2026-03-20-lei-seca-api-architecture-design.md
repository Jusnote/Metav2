# Lei Seca v2 — API Architecture Design

**Date:** 2026-03-20
**Status:** Approved
**Scope:** New architecture for the lei seca system — dedicated GraphQL API, mass extraction pipeline, React-based rendering without TipTap

## Problem Statement

The current lei seca system converts law data through 3 unnecessary format transformations (GraphQL JSON → PlateElement[] → plate_content in Supabase → TipTap/ProseMirror), using ~900 lines of mapping code, inflating JSON storage 3x, and risking data loss at each conversion step. The JusBrasil GraphQL API already returns perfectly structured data (type, description, hierarchy) that can be rendered directly.

## Architecture Overview

```
JusBrasil GraphQL API
        ↓ fetch (3 headers: Content-Type, User-Agent, Origin)
Scripts CLI (Node.js)
  extract-index.js → leis/_index.json (59k entries)
  extract-lei.js   → leis/{id}/raw.json
  process.js       → leis/{id}/processed.json
  upload.js        → PostgreSQL + Typesense
        ↓
┌─────────────────────────────────────────┐
│         Hetzner Server (Verus-api)       │
│  AMD Ryzen 7 3700X • 64GB RAM • 906GB   │
│                                          │
│  ┌──────────────┐  ┌──────────────┐     │
│  │  PostgreSQL   │  │  Typesense   │     │
│  │  (source of   │→ │  (instant    │     │
│  │   truth)      │  │   search)    │     │
│  └──────────────┘  └──────────────┘     │
│         ↑                                │
│  ┌──────────────────────────┐           │
│  │  API GraphQL              │           │
│  │  Fastify + Mercurius      │           │
│  └──────────────────────────┘           │
│         Coolify • same server            │
└─────────────────────────────────────────┘
        ↓ JSON puro
┌─────────────────────────────────────────┐
│  Frontend (Metav2 - Next.js)             │
│  React puro + getSelection() for grifos │
│  TipTap leve ONLY for user notes         │
│                                          │
│  Supabase: auth, grifos, notas,         │
│  flashcards, cadernos (user data)        │
└─────────────────────────────────────────┘
```

## Key Design Decisions

### 1. API GraphQL works without browser

Confirmed via curl testing: the JusBrasil `/web-docview/graphql` endpoint responds to direct HTTP requests with 3 headers (Content-Type, User-Agent with real browser string, Origin). No cookies, no authentication needed. 100 parallel requests tested without rate limiting.

### 2. Store JSON pre-processed (Option B)

Each dispositivo stores:
- `raw_description` — original from API, never modified (audit trail)
- `texto` — clean text, HTML stripped, annotations removed
- `anotacoes[]` — extracted legislative annotations as structured array
- `links[]` — cross-reference links extracted from HTML `<a>` tags

The `raw.json` files on disk serve as absolute backup.

### 3. React rendering without TipTap

Law text is rendered with plain React components. The `Dispositivo` component reads `tipo` and `texto` directly from the API response. No editor framework needed for reading. TipTap is used only for user note editing (not law text).

### 4. Typesense for search (same pattern as questions API)

PostgreSQL is the source of truth. Typesense is synced for instant search with typo tolerance, facets (tipo, nivel, data), and highlight. Same infrastructure already running on the server for the questions API. Future path to semantic search via Voyage-4-large embeddings.

### 5. Supabase for user data only

Auth, grifos (highlights), user annotations, flashcards, and cadernos stay in Supabase with real-time sync. Law data is public/shared and lives in the dedicated API. Clean separation enables future monetization of the law API as a standalone product.

### 6. Epigrafes and penas (criminal law)

NAO_IDENTIFICADO items are classified by position:
- Before ARTIGO, short text → EPIGRAFE ("Homicidio simples")
- After ARTIGO, starts with "Pena -" → PENA
- Before PARAGRAFO, short text → EPIGRAFE of qualifier ("Homicidio qualificado")
- Subtitle of structural item → SUBTITULO

These are linked to their parent dispositivo as fields (`epigrafe`, `pena`), and also stored as separate dispositivos to maintain sequential order.

## Database Schema (PostgreSQL)

```sql
CREATE TABLE leis (
  id TEXT PRIMARY KEY,              -- "lei-10406-2002"
  titulo TEXT NOT NULL,
  ementa TEXT,
  tipo TEXT NOT NULL,               -- LEI, DECRETO, DECRETO_LEI, MP...
  nivel TEXT NOT NULL DEFAULT 'FEDERAL',
  data DATE,
  status TEXT DEFAULT 'ATIVO',
  hierarquia JSONB NOT NULL,        -- structural tree
  raw_metadata JSONB,
  doc_id INT,                       -- JusBrasil docId (for re-extraction)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('portuguese', coalesce(titulo,'') || ' ' || coalesce(ementa,''))
  ) STORED
);

CREATE TABLE dispositivos (
  id BIGINT PRIMARY KEY,            -- codeInt64 from API (stable)
  lei_id TEXT NOT NULL REFERENCES leis(id),
  tipo TEXT NOT NULL,               -- ARTIGO, PARAGRAFO, INCISO, ALINEA, PENA,
                                    -- EPIGRAFE, SUBTITULO, PARTE, LIVRO, TITULO,
                                    -- CAPITULO, SECAO, SUBSECAO, EMENTA, PREAMBULO
  numero TEXT,
  texto TEXT NOT NULL,
  raw_description TEXT NOT NULL,
  epigrafe TEXT,
  pena TEXT,
  anotacoes JSONB,                  -- [{tipo, lei, texto}]
  links JSONB,                      -- [{href, titulo, textoAncora, leiId}]
  revogado BOOLEAN DEFAULT false,
  posicao INT NOT NULL,             -- original array index (guarantees order)
  path TEXT,                        -- "parte-especial/titulo-1/cap-1"
  created_at TIMESTAMPTZ DEFAULT now(),
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('portuguese', coalesce(texto,'') || ' ' || coalesce(epigrafe,''))
  ) STORED
);

-- Base indexes
CREATE INDEX idx_disp_lei ON dispositivos(lei_id);
CREATE INDEX idx_disp_tipo ON dispositivos(tipo);
CREATE INDEX idx_disp_path ON dispositivos(path);
CREATE INDEX idx_disp_search ON dispositivos USING GIN(search_vector);
CREATE INDEX idx_lei_search ON leis USING GIN(search_vector);
CREATE INDEX idx_lei_tipo ON leis(tipo);
CREATE INDEX idx_lei_nivel ON leis(nivel);

-- Unique constraint (prevents duplicate imports)
CREATE UNIQUE INDEX idx_disp_unique ON dispositivos(lei_id, posicao);

-- Partial index for non-revoked items (95% of queries)
CREATE INDEX idx_disp_vigentes ON dispositivos(lei_id, posicao)
  WHERE revogado = false;
```

## GraphQL Schema

```graphql
type Query {
  leis(
    nivel: Nivel
    tipo: String
    status: Status
    offset: Int
    limit: Int
  ): LeisConnection!

  lei(id: String!): Lei

  dispositivos(
    leiId: String!
    path: String
    tipos: [TipoDispositivo!]
    incluirRevogados: Boolean
    offset: Int
    limit: Int
  ): DispositivosConnection!

  busca(
    termo: String!
    nivel: Nivel
    tipo: String
    leiId: String
    limit: Int
  ): BuscaResult!
}

type Lei {
  id: String!
  titulo: String!
  ementa: String
  tipo: String!
  nivel: String!
  data: String
  status: String!
  hierarquia: [HierarquiaNode!]!
  stats: LeiStats!
}

type HierarquiaNode {
  tipo: String!
  descricao: String!
  subtitulo: String
  path: String!
  filhos: [HierarquiaNode!]!
}

type Dispositivo {
  id: ID!
  tipo: TipoDispositivo!
  numero: String
  texto: String!
  epigrafe: String
  pena: String
  anotacoes: [Anotacao!]
  links: [ReferenciaCruzada!]
  revogado: Boolean!
  path: String!
  posicao: Int!
}

type Anotacao {
  tipo: String!
  lei: String
  texto: String
}

type ReferenciaCruzada {
  href: String!
  titulo: String!
  textoAncora: String!
  leiId: String
}

type BuscaResult {
  total: Int!
  hits: [BuscaHit!]!
}

type BuscaHit {
  dispositivo: Dispositivo!
  lei: Lei!
  highlight: String!
  score: Float!
}

type LeiStats {
  totalDispositivos: Int!
  totalArtigos: Int!
  totalRevogados: Int!
}

enum TipoDispositivo {
  ARTIGO PARAGRAFO INCISO ALINEA
  PENA EPIGRAFE SUBTITULO
  PARTE LIVRO TITULO CAPITULO SECAO SUBSECAO
  EMENTA PREAMBULO
}

enum Nivel { FEDERAL ESTADUAL MUNICIPAL }
enum Status { ATIVO REVOGADO }
```

## Extraction Pipeline

### Script 1: extract-index.js

Fetches the list of all law IDs from JusBrasil's main GraphQL API (`/graphql`, `searchHaystack`). Segments queries by type+date to work around the 500-result deep paging limit. Output: `leis/_index.json` with `{ docId, titulo, tipo, data, status }` for each law.

**Controls:** `--level FEDERAL|ESTADUAL|MUNICIPAL`

### Script 2: extract-lei.js

Extracts a single law's complete data given a docId. Uses `/web-docview/graphql` to fetch metadata (`documentByNumericID`) and law items (`lawItems`) in batches of 500. Builds the structural hierarchy with subtitle lookahead. Output: `leis/{id}/raw.json` containing `{ document, allItems, structural, stats }`.

**Controls:** `--docId 91577` (single), `--all --resume` (batch from _index.json), `--parallel 5`, `--delay 200`

### Script 3: process.js

Reads `raw.json`, processes each item:
1. Classify NAO_IDENTIFICADO → EPIGRAFE, PENA, SUBTITULO, ANOTACAO, etc.
2. Extract inline HTML links → `links[]` array + clean text
3. Separate legislative annotations → `anotacoes[]` array + clean text
4. Link epigrafe/pena to parent dispositivo by position
5. Generate slug, path, numero

Output: `leis/{id}/processed.json` with lei metadata + dispositivos array + flagged items for manual review.

**Controls:** `--input ./leis/`, `--lei lei-10406-2002`, `--force`

### Script 4: upload.js

Uploads processed data to PostgreSQL and Typesense. Uses `ON CONFLICT (lei_id, posicao) DO UPDATE` for safe re-imports. Syncs Typesense collection with dispositivo data for instant search.

**Controls:** `--input ./leis/`, `--pg postgresql://...`, `--typesense http://...`, `--dry-run`, `--batch-size 500`

### Execution flow

```bash
# 1. Index all federal laws (~5 min)
node extract-index.js --level FEDERAL

# 2. Extract priority laws first, then batch
node extract-lei.js --docId 91577   # Codigo Civil
node extract-lei.js --docId 91614   # Codigo Penal
node extract-lei.js --all --resume  # rest (~15h local, ~10h Hetzner)

# 3. Process
node process.js --input ./leis/

# 4. Review flagged items in VS Code

# 5. Upload (dry-run first)
node upload.js --input ./leis/ --dry-run
node upload.js --input ./leis/ --pg postgresql://...
```

Scripts run on local machine (VS Code terminal) or Hetzner server — same code, same output.

## Frontend Rendering

### Component tree

```
LeiSecaPage
├── LeiSecaSidebar            ← existing component, visual unchanged
│   ├── LeiSelector           ← dropdown (unchanged)
│   ├── HierarquiaTree        ← fed by API hierarquia field
│   └── BuscaInterna          ← new: search within current lei
│
├── LeiConteudo               ← main reading area
│   ├── DispositivoList       ← virtualized (react-window)
│   │   └── Dispositivo       ← per-item component
│   │       ├── Epigrafe      ← bold, highlighted
│   │       ├── Texto         ← clean text + clickable links
│   │       ├── Pena          ← italic, differentiated
│   │       └── AnotacaoTooltip ← hover (hidden in lei seca mode)
│   └── ScrollSpy             ← updates sidebar position
│
└── PainelAnotacao            ← right panel
    ├── GrifosList            ← user highlights (Supabase)
    └── NotaEditor            ← TipTap lite (user notes only)
```

### Grifos with getSelection()

1. User selects text in the law
2. `onMouseUp` → `window.getSelection()`
3. Capture: selected text, start/end offset, dispositivo (via `data-posicao`)
4. Show popover: "Grifar" | "Anotar" | "Criar Flashcard"
5. Save to Supabase: `{ lei_id, posicao, start, end, cor, nota }`
6. Re-render with `<mark>` on highlighted ranges

### Data sources

- **API GraphQL (Hetzner):** lei metadata, hierarquia, dispositivos, busca
- **Supabase:** auth, user grifos, user notes, flashcards, cadernos

Frontend makes 2 calls on page load: API for law data, Supabase for user data. Merges on client.

### Styling by tipo

| Tipo | Style |
|------|-------|
| PARTE, LIVRO, TITULO | centered, uppercase, bold, large |
| CAPITULO, SECAO | centered, bold |
| SUBTITULO | centered, italic |
| EPIGRAFE | bold, margin-top |
| ARTIGO | margin-left 0, "Art. X" bold |
| PARAGRAFO | margin-left 1, "§" bold |
| INCISO | margin-left 2, "I -" bold |
| ALINEA | margin-left 3, "a)" bold |
| PENA | italic, muted color |
| ANOTACAO | gray, italic, hidden in lei seca mode |

## Server Infrastructure

- **Server:** Hetzner Auction HEL1-DC4, AMD Ryzen 7 3700X (8c/16t), 64GB RAM, 906GB RAID
- **Current usage:** 2.6GB RAM, 14GB disk (4% / 2%)
- **Estimated additional usage:** ~8GB RAM, ~15GB disk (for 60k laws)
- **Deployment:** Coolify, same server as questions API
- **Services:** API GraphQL (new container), PostgreSQL (new database, existing instance), Typesense (existing instance, new collection)

## Future Iterations (not in scope)

These features can be added incrementally without architectural changes:
1. Cross-law reference navigation (using `links[]` data)
2. Dispositivo version toggle (revoked vs current, using `revogado` field)
3. Enhanced in-law search (Ctrl+F with scroll bar highlights)
4. "Lei Seca" mode toggle (hide annotations)
5. Cross-device grifo sync (Supabase real-time)
6. Auto-export grifos as flashcards
7. Semantic search via Voyage-4-large embeddings in Typesense

## Tech Stack Summary

| Component | Technology |
|-----------|-----------|
| API Server | Node.js + Fastify + Mercurius |
| Database | PostgreSQL 16 |
| Search | Typesense (existing instance) |
| Frontend | React (Next.js / Metav2) |
| User notes editor | TipTap (lightweight) |
| User data | Supabase (auth, grifos, notes, flashcards) |
| Deployment | Coolify on Hetzner dedicated server |
| Extraction | Node.js CLI scripts (local or server) |
