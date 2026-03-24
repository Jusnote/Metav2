# Pipeline v2 — Design Spec

**Date:** 2026-03-24
**Status:** Approved
**Scope:** Fix critical pipeline issues, add parent-child relationships, harden for 1M+ laws

## Problem Statement

5-agent audit revealed 6 critical issues, 11 high/medium issues across the law data pipeline. Current pipeline works for 2 laws (CP + CC) but will break or produce corrupt data at scale (1M+ laws). Additionally, dispositivos are flat (no parent-child relationships), making structural queries impossible.

## Changes Overview

### Schema Changes (PostgreSQL ALTER TABLE)

```sql
-- 1. Parent-child relationships
ALTER TABLE dispositivos ADD COLUMN parent_id BIGINT REFERENCES dispositivos(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE dispositivos ADD COLUMN artigo_id BIGINT REFERENCES dispositivos(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE dispositivos ADD COLUMN depth INT DEFAULT 0;

CREATE INDEX idx_disp_parent ON dispositivos(parent_id);
CREATE INDEX idx_disp_artigo ON dispositivos(artigo_id);

-- 2. doc_id INT → BIGINT (IDs from 2024+ exceed INT32)
ALTER TABLE leis ALTER COLUMN doc_id TYPE BIGINT;

-- 3. search_vector with pt_unaccent (accent-insensitive search)
-- Ensure extension and config exist (idempotent):
CREATE EXTENSION IF NOT EXISTS unaccent;
DO $$ BEGIN
  CREATE TEXT SEARCH CONFIGURATION pt_unaccent (COPY = portuguese);
EXCEPTION WHEN unique_violation THEN NULL; END $$;
ALTER TEXT SEARCH CONFIGURATION pt_unaccent
  ALTER MAPPING FOR hword, hword_part, word WITH unaccent, portuguese_stem;

-- Update the generated columns:
ALTER TABLE leis DROP COLUMN search_vector;
ALTER TABLE leis ADD COLUMN search_vector TSVECTOR GENERATED ALWAYS AS (
  to_tsvector('pt_unaccent', coalesce(titulo,'') || ' ' || coalesce(apelido,'') || ' ' || coalesce(ementa,''))
) STORED;

ALTER TABLE dispositivos DROP COLUMN search_vector;
ALTER TABLE dispositivos ADD COLUMN search_vector TSVECTOR GENERATED ALWAYS AS (
  to_tsvector('pt_unaccent', coalesce(texto,'') || ' ' || coalesce(epigrafe,''))
) STORED;

-- NOTE: DROP+ADD generated column rewrites the entire table.
-- For 1M+ rows, plan for maintenance window or run during low-traffic.
-- Recreate GIN indexes (use CONCURRENTLY for production if table is live)
DROP INDEX IF EXISTS idx_disp_search;
DROP INDEX IF EXISTS idx_lei_search;
CREATE INDEX idx_disp_search ON dispositivos USING GIN(search_vector);
CREATE INDEX idx_lei_search ON leis USING GIN(search_vector);

-- 4. ON DELETE CASCADE
ALTER TABLE dispositivos DROP CONSTRAINT dispositivos_lei_id_fkey;
ALTER TABLE dispositivos ADD CONSTRAINT dispositivos_lei_id_fkey
  FOREIGN KEY (lei_id) REFERENCES leis(id) ON DELETE CASCADE;

-- 5. Composite index for common queries
DROP INDEX IF EXISTS idx_disp_tipo;
CREATE INDEX idx_disp_lei_tipo ON dispositivos(lei_id, tipo);

-- 6. published_date/updated_date TEXT → TIMESTAMPTZ (nice to have, not blocking)
-- ALTER TABLE leis ALTER COLUMN published_date TYPE TIMESTAMPTZ USING published_date::timestamptz;
-- ALTER TABLE leis ALTER COLUMN updated_date TYPE TIMESTAMPTZ USING updated_date::timestamptz;
-- Note: deferred — some values may not parse cleanly. Do after data audit.
```

### process.js Changes

#### 1. Parent-child calculation (stack-based)

After building the dispositivos array, compute parent_id, artigo_id, and depth using a stack:

```javascript
// Depth rules by tipo:
// PARTE/LIVRO/TITULO/CAPITULO/SECAO/SUBSECAO/SUBTITULO → structural, depth = -1 (not part of artigo tree)
// EMENTA/PREAMBULO → structural, depth = -1
// ARTIGO → depth 0, starts new artigo context
// EPIGRAFE → depth 0 (sibling to artigo, no parent)
// PARAGRAFO/CAPUT → depth 1, parent = current artigo
// INCISO → depth 2, parent = current paragrafo (or artigo if no paragrafo)
// ALINEA → depth 3, parent = current inciso (or paragrafo if no inciso)
// PENA → depth 1, parent = current artigo or paragrafo

const STRUCTURAL = new Set(['PARTE','LIVRO','TITULO','CAPITULO','SECAO','SUBSECAO','SUBTITULO','EMENTA','PREAMBULO']);

function computeParentChild(dispositivos) {
  let currentArtigo = null;    // id of current ARTIGO
  let currentParagrafo = null; // id of current PARAGRAFO
  let currentInciso = null;    // id of current INCISO

  for (const d of dispositivos) {
    if (STRUCTURAL.has(d.tipo) || d.tipo === 'EPIGRAFE') {
      d.parent_id = null;
      d.artigo_id = null;
      d.depth = -1;
      continue;
    }

    if (d.tipo === 'ARTIGO') {
      currentArtigo = d.id;
      currentParagrafo = null;
      currentInciso = null;
      d.parent_id = null;
      d.artigo_id = d.id;
      d.depth = 0;
    } else if (d.tipo === 'PARAGRAFO' || d.tipo === 'CAPUT') {
      currentParagrafo = d.id;
      currentInciso = null;
      d.parent_id = currentArtigo;
      d.artigo_id = currentArtigo;
      d.depth = 1;
    } else if (d.tipo === 'INCISO') {
      currentInciso = d.id;
      d.parent_id = currentParagrafo ?? currentArtigo;
      d.artigo_id = currentArtigo;
      d.depth = 2;
    } else if (d.tipo === 'ALINEA') {
      d.parent_id = currentInciso ?? currentParagrafo ?? currentArtigo;
      d.artigo_id = currentArtigo;
      d.depth = 3;
    } else if (d.tipo === 'PENA') {
      d.parent_id = currentParagrafo ?? currentArtigo;
      d.artigo_id = currentArtigo;
      d.depth = 1;
    } else {
      // NAO_IDENTIFICADO or other — attach to current artigo
      d.parent_id = currentArtigo;
      d.artigo_id = currentArtigo;
      d.depth = currentParagrafo ? 2 : 1;
    }
  }
}
```

This runs after all dispositivos are built, before writing processed.json.

#### 2. `<strike>` tag stripping

In the text cleaning step (after link extraction, before annotation separation):

```javascript
// Strip <strike>...</strike> blocks (old penalty text embedded with new)
cleanText = cleanText.replace(/<strike>[^<]*<\/strike>\s*/gi, '');
// Strip any remaining <strike> or </strike> tags
cleanText = cleanText.replace(/<\/?strike>/gi, '');
```

This is safe — `<strike>` is never legitimate content in law text.

#### 3. Improved `<a>` tag stripping

The existing link-extractor handles `<a>` tags, but some slip through. Add a final cleanup:

```javascript
// After link extraction, strip only known HTML tags (NOT blanket <[^>]+> which corrupts "X < Y" in technical laws)
const KNOWN_TAGS = /(<\/?(a|span|b|i|em|strong|strike|font|div|p|br|sup|sub|table|tr|td|th|thead|tbody)\b[^>]*>)/gi;
cleanText = cleanText.replace(KNOWN_TAGS, '');
// Clean stray > only at end of string (conservative)
cleanText = cleanText.replace(/\s*>\s*$/, '');
```

**Note:** The existing `link-extractor.js` line 102 also uses a blanket `/<[^>]*>/g` strip. This should be replaced with the same targeted approach during implementation. At 1M laws, blanket stripping WILL corrupt mathematical/comparative expressions like `se X < Y` in tax/technical laws.

#### 4. Date parsing safety

```javascript
// Before: new Date(doc.date).toISOString().split('T')[0]
// After:
let dataLei = null;
try {
  const d = new Date(doc.date);
  if (!isNaN(d.getTime())) dataLei = d.toISOString().split('T')[0];
} catch {}
```

#### 5. Annotation lei extraction improvement

Current regex only catches "Lei nº X". Add support for:
- "Lei nº 7.209, de 11.7.1984" (dot-separated number + day.month.year)
- "Decreto nº X", "Medida Provisória nº X", "Emenda Constitucional nº X", "Lei Complementar nº X"

```javascript
// In annotation-regex.js extractLeiRef():
const RE_LEI_REF = /(?:Lei|Decreto|Medida\s+Provis[oó]ria|Emenda\s+Constitucional|Lei\s+Complementar)\s+(?:n[oº]?\s*\.?\s*)(\d+[\.\d]*)\s*(?:[,/]\s*(?:de\s+)?)?(\d{4})?/i;
```

### upload.js Changes

#### 1. Transaction wrapping

```javascript
await pgClient.query('BEGIN');
try {
  // Upsert lei
  await pgClient.query(LEI_UPSERT_SQL, leiValues);

  // Delete stale dispositivos (reconciliation)
  const currentIds = dispositivos.map(d => d.id);
  await pgClient.query(
    'DELETE FROM dispositivos WHERE lei_id = $1 AND id != ALL($2::bigint[])',
    [leiId, currentIds]
  );

  // Batch insert dispositivos
  for (const batch of chunks(dispositivos, batchSize)) {
    await pgClient.query(buildBatchInsert(batch));
  }

  await pgClient.query('COMMIT');
} catch (err) {
  await pgClient.query('ROLLBACK');
  throw err;
}
```

#### 2. codeInt64 as string

Pass `id` as string to the pg driver (PostgreSQL parses strings for BIGINT columns):

```javascript
// Before: d.id (number — loses precision for >2^53)
// After: String(d.id) (string — pg driver handles BIGINT correctly)
// Also apply to lei.doc_id: String(lei.doc_id)
```

**ON CONFLICT clause:** The existing `ON CONFLICT (id) DO UPDATE SET` must include `parent_id`, `artigo_id`, `depth` in the SET list. Otherwise re-uploads won't update the new fields.

**Typesense:** The new fields (`parent_id`, `artigo_id`, `depth`) are structural, not searchable. No changes needed to the Typesense schema — it only indexes `texto`, `epigrafe`, `tipo` for full-text search.

#### 3. New columns in INSERT

Add `parent_id`, `artigo_id`, `depth` to the INSERT/UPSERT statement.

#### 4. Resume logic

```javascript
// Before uploading a lei, check meta.json
const meta = readMeta(leiDir);
if (meta?.uploaded && !opts.force) {
  console.log(`  [skip] Already uploaded: ${leiId}`);
  continue;
}
```

#### 5. Stale dispositivo cleanup

Already shown in the transaction wrapping above — `DELETE WHERE lei_id = $1 AND id != ALL($2)`.

### What NOT to change (risk of false positives at 1M scale)

| Issue | Decision | Reason |
|-------|----------|--------|
| Ordinal `§ X o` → `§ Xº` | **No change** in pipeline | "Art. 3 o" could be "Art. 3 o qual dispõe..." |
| OCR broken paragraphs | **Flag only**, no auto-fix | "P arágrafo" repair could break legitimate text |
| OCR broken incisos | **Flag only**, no auto-fix | "Il" could be a word, not Roman numeral II |
| Junk EPIGRAFE cleanup | **No change** | Heuristic to distinguish junk from legitimate short text is unreliable |
| Revocation notices (revoked=false) | **No change** | These are metadata items correctly excluded by classifier |
| Dash-only incisos → revogado | **No change** | Could false-positive on legitimate "I -" formatting |

### GraphQL API Changes (optional, can be done later)

Expose new fields in the Dispositivo type:

```graphql
type Dispositivo {
  # ... existing fields ...
  parentId: ID        # direct parent
  artigoId: ID        # root artigo
  depth: Int          # nesting level (0=artigo, 1=§/pena, 2=inciso, 3=alínea)
}
```

New query capability:

```graphql
# Get all children of an artigo
dispositivos(leiId: "decreto-lei-2848-1940", artigoId: "51262246") {
  nodes { ... }
}
```

### Execution Order

1. **Schema migration** — Run ALTER TABLE statements on Hetzner PostgreSQL
2. **Update process.js** — Add parent-child, <strike> strip, date safety, lei ref extraction
3. **Update upload.js** — Transaction, resume, stale cleanup, string IDs, new columns
4. **Test on CP** — Re-process + re-upload CP, validate all fields
5. **Test on CC** — Re-process + re-upload CC, validate
6. **Validate via API** — Query parent_id, artigo_id, depth, verify structure
7. **Process 1M+ laws** (separate cycle) — DROP indexes → bulk process → bulk upload → CREATE indexes

### Validation Criteria

After re-processing CP:

| Check | Expected |
|-------|----------|
| Every PARAGRAFO has parent_id pointing to ARTIGO | 100% (except first items before Art. 1) |
| Every INCISO has parent_id pointing to PARAGRAFO or ARTIGO | 100% |
| Every ALINEA has parent_id pointing to INCISO | 100% |
| Every non-structural item has artigo_id | 100% for laws with artigos; null for laws without artigo structure (decrees, portarias) |
| Zero `<strike>` tags in texto | 100% |
| Zero stray `<` or `>` in texto | 100% |
| search_vector uses pt_unaccent | Verified via `\d dispositivos` |
| Transaction rollback on simulated failure | Verified |
| Resume skips already-uploaded lei | Verified |
| Stats.revogados matches actual count | Verified |
