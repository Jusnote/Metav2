# Lei Extraction Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 4 Node.js CLI scripts that extract 60k Brazilian federal laws from JusBrasil's GraphQL API, process them into clean structured data, and upload to PostgreSQL + Typesense on Hetzner.

**Architecture:** Standalone CLI scripts (no framework) using native `fetch()`. Each script reads/writes JSON files in an organized folder structure (`leis/{id}/raw.json`, `processed.json`). Scripts are composable — run one at a time or chain them. Resume-capable via file existence checks.

**Tech Stack:** Node.js 20+ (native fetch), PostgreSQL (pg driver), Typesense (typesense-js), commander (CLI args)

**Spec:** `docs/superpowers/specs/2026-03-20-lei-seca-api-architecture-design.md`

---

## File Structure

```
scripts/lei-pipeline/
  package.json              — dependencies: pg, typesense, commander
  extract-index.js          — Script 1: fetch all law IDs from JusBrasil
  extract-lei.js            — Script 2: extract single law's full data
  process.js                — Script 3: classify, clean, derive fields
  upload.js                 — Script 4: upload to PostgreSQL + Typesense
  lib/
    graphql-client.js       — shared fetch wrapper with headers + retry
    classifier.js           — NAO_IDENTIFICADO classification (port from TS)
    annotation-regex.js     — annotation extraction (port from TS)
    link-extractor.js       — HTML <a> tag extraction + cleanup
    slug-generator.js       — deterministic slug generation
    hierarchy-builder.js    — structural tree builder
  schema/
    create-tables.sql       — PostgreSQL DDL from spec
    typesense-schema.json   — Typesense collection definition from spec
```

Each `lib/` file has one responsibility. The existing TypeScript code in `src/lib/lei-*.ts` is the reference — we port the core logic to plain JS for the CLI scripts (no build step needed).

---

## Task 1: Project Setup + GraphQL Client

**Files:**
- Create: `scripts/lei-pipeline/package.json`
- Create: `scripts/lei-pipeline/lib/graphql-client.js`

- [ ] **Step 1: Initialize project**

```bash
cd "scripts/lei-pipeline"
npm init -y
npm install pg typesense commander
```

`package.json` should have `"type": "module"` for ESM imports.

- [ ] **Step 2: Write graphql-client.js**

```js
// scripts/lei-pipeline/lib/graphql-client.js
const GRAPHQL_URL = 'https://www.jusbrasil.com.br/web-docview/graphql';
const SEARCH_URL = 'https://www.jusbrasil.com.br/graphql';

const HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Origin': 'https://www.jusbrasil.com.br'
};

export async function queryDocView(query, variables = {}, operationName) {
  const body = { query, variables };
  if (operationName) body.operationName = operationName;

  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL: ${json.errors[0].message}`);
  return json.data;
}

export async function querySearch(query, variables = {}, operationName) {
  const body = { query, variables };
  if (operationName) body.operationName = operationName;

  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL: ${json.errors[0].message}`);
  return json.data;
}

export async function fetchWithRetry(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`  Retry ${i + 1}/${retries}: ${err.message}`);
      await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
}
```

- [ ] **Step 3: Test GraphQL client manually**

```bash
cd "scripts/lei-pipeline"
node -e "
import { queryDocView } from './lib/graphql-client.js';
const data = await queryDocView('{ root { document: documentByNumericID(artifact: \"LEGISLACAO\", docId: 91577) { title type status } } }');
console.log(data.root.document);
"
```

Expected: `{ title: 'LEI Nº 10.406...', type: 'LEI', status: 'ATIVO' }`

- [ ] **Step 4: Commit**

```bash
git add scripts/lei-pipeline/
git commit -m "feat(pipeline): init project + graphql client with retry"
```

---

## Task 2: extract-index.js — Fetch All Law IDs

**Files:**
- Create: `scripts/lei-pipeline/extract-index.js`

This script uses the main `/graphql` endpoint (`searchHaystack`) to list all laws by level. The deep paging limit is 500, so we segment queries by type+date.

- [ ] **Step 1: Write extract-index.js**

```js
// scripts/lei-pipeline/extract-index.js
import { querySearch, fetchWithRetry } from './lib/graphql-client.js';
import { program } from 'commander';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

program
  .option('--level <level>', 'FEDERAL, ESTADUAL, or MUNICIPAL', 'FEDERAL')
  .option('--output <dir>', 'Output directory', './leis')
  .parse();

const opts = program.opts();

// searchHaystack query for legislation listing
const SEARCH_QUERY = `
query SearchLeis($query: String!, $page: Int!, $pageSize: Int!, $filters: JSON) {
  searchHaystack(query: $query, page: $page, pageSize: $pageSize, filters: $filters) {
    totalCount
    results {
      document {
        ... on LegislationDocument {
          docId
          title
          type
          date
          status
        }
      }
    }
  }
}`;

// Note: The exact searchHaystack query structure may need adjustment
// based on the actual JusBrasil /graphql schema.
// The extract-index script should be tested against the real API
// and the query adapted if the schema differs.

async function fetchPage(level, page, pageSize = 500) {
  return fetchWithRetry(async () => {
    const data = await querySearch(SEARCH_QUERY, {
      query: '*',
      page,
      pageSize,
      filters: { level }
    }, 'SearchLeis');
    return data.searchHaystack;
  });
}

async function main() {
  const level = opts.level.toUpperCase();
  const outputDir = opts.output;

  mkdirSync(outputDir, { recursive: true });
  const indexPath = `${outputDir}/_index.json`;

  console.log(`Fetching ${level} legislation index...`);

  const allResults = [];
  let page = 1;
  let totalCount = null;

  while (true) {
    const result = await fetchPage(level, page);
    if (totalCount === null) {
      totalCount = result.totalCount;
      console.log(`  Total: ${totalCount} laws`);
    }

    const docs = result.results.map(r => r.document).filter(Boolean);
    if (docs.length === 0) break;

    allResults.push(...docs);
    console.log(`  Page ${page}: ${allResults.length}/${totalCount}`);

    if (allResults.length >= totalCount) break;
    page++;

    // Respect rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  const index = allResults.map(d => ({
    docId: d.docId,
    titulo: d.title,
    tipo: d.type,
    data: d.date,
    status: d.status
  }));

  writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`\nSaved ${index.length} entries to ${indexPath}`);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
```

**Important note:** The `/graphql` (search) endpoint's exact query schema needs to be discovered by testing against the real API. The `searchHaystack` query above is a starting template based on our prior knowledge. The implementor should:
1. Open a JusBrasil legislation page in Chrome
2. Use DevTools Network tab to capture the actual search/list queries
3. Adapt the query structure accordingly

If deep paging hits the 500 limit, segment by `type` (LEI, DECRETO, etc.) + date ranges to get complete results.

- [ ] **Step 2: Test with a small query first**

```bash
cd "scripts/lei-pipeline"
node extract-index.js --level FEDERAL --output ./leis
```

Verify `leis/_index.json` is created with entries containing `{ docId, titulo, tipo, data, status }`.

- [ ] **Step 3: Commit**

```bash
git add scripts/lei-pipeline/extract-index.js
git commit -m "feat(pipeline): extract-index.js — fetch all law IDs"
```

---

## Task 3: extract-lei.js — Extract Single Law

**Files:**
- Create: `scripts/lei-pipeline/extract-lei.js`

This is the core extractor. Port the logic from `scripts/lei-graphql-extractor.js` to a CLI script with parallel batch support.

- [ ] **Step 1: Write extract-lei.js**

```js
// scripts/lei-pipeline/extract-lei.js
import { queryDocView, fetchWithRetry } from './lib/graphql-client.js';
import { program } from 'commander';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

program
  .option('--docId <id>', 'Extract single law by docId')
  .option('--all', 'Extract all from _index.json')
  .option('--resume', 'Skip already extracted', true)
  .option('--parallel <n>', 'Parallel requests', '5')
  .option('--delay <ms>', 'Delay between batches', '200')
  .option('--input <dir>', 'Directory with _index.json', './leis')
  .option('--output <dir>', 'Output directory', './leis')
  .parse();

const opts = program.opts();

const META_QUERY = `{
  root {
    document: documentByNumericID(artifact: "LEGISLACAO", docId: DOC_ID) {
      title description url type date docId status keywords metadata
    }
  }
}`;

const ITEMS_QUERY = `query LawItems($docId: NumericID!, $lawItemsStartFrom: Int!, $lawItemsLimit: Int) {
  root {
    document: documentByNumericID(artifact: "LEGISLACAO", docId: $docId) {
      lawItems(start: $lawItemsStartFrom, end: $lawItemsLimit) {
        codeInt64 type description revoked
      }
    }
  }
}`;

const STRUCTURAL_TYPES = new Set([
  'PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO'
]);

function buildStructural(allItems) {
  const structural = [];
  for (const item of allItems) {
    if (!STRUCTURAL_TYPES.has(item.type)) continue;

    let subtitle = null;
    // Look ahead up to 5 items for subtitle
    const startIdx = item.index + 1;
    for (let offset = 0; offset < 5; offset++) {
      const candidate = allItems[startIdx + offset];
      if (!candidate) break;
      if (candidate.type !== 'NAO_IDENTIFICADO') break;
      if (candidate.description.startsWith('(')) continue; // skip annotations
      subtitle = candidate.description;
      break;
    }

    structural.push({
      codeInt64: item.codeInt64,
      type: item.type,
      description: item.description,
      revoked: item.revoked,
      index: item.index,
      subtitle
    });
  }
  return structural;
}

function generateLeiId(doc) {
  // "LEI Nº 10.406, DE 10 DE JANEIRO DE 2002" → "lei-10406-2002"
  const title = doc.title || '';
  const typeMatch = title.match(/^([\w-]+(?:\s+[\w-]+)?)\s+(?:N[ºo°]?\s*)?/i);
  const numMatch = title.match(/(\d+[\.\d]*)/);
  const yearMatch = title.match(/(\d{4})\s*$/);

  const tipo = (typeMatch ? typeMatch[1] : doc.type || 'lei').toLowerCase().replace(/\s+/g, '-');
  const num = numMatch ? numMatch[1].replace(/\./g, '') : doc.docId;
  const year = yearMatch ? yearMatch[1] : '';

  return `${tipo}-${num}${year ? '-' + year : ''}`;
}

async function extractOneLei(docId, outputDir) {
  // Fetch metadata
  const metaData = await fetchWithRetry(() =>
    queryDocView(META_QUERY.replace('DOC_ID', docId))
  );
  const doc = metaData.root.document;
  if (!doc) throw new Error(`Document not found: docId=${docId}`);

  const leiId = generateLeiId(doc);
  const leiDir = join(outputDir, leiId);
  mkdirSync(leiDir, { recursive: true });

  // Check resume
  const rawPath = join(leiDir, 'raw.json');
  if (opts.resume && existsSync(rawPath)) {
    return { leiId, skipped: true };
  }

  // Fetch all items in batches
  const batchSize = 500;
  const allItems = [];
  let start = 0;

  while (true) {
    const data = await fetchWithRetry(() =>
      queryDocView(ITEMS_QUERY, {
        docId,
        lawItemsStartFrom: start,
        lawItemsLimit: start + batchSize
      }, 'LawItems')
    );

    const items = data.root.document.lawItems;
    if (!items || items.length === 0) break;

    allItems.push(...items.map((item, i) => ({
      codeInt64: item.codeInt64,
      type: item.type,
      description: item.description,
      revoked: item.revoked,
      index: start + i
    })));

    if (items.length < batchSize) break;
    start += batchSize;
    await new Promise(r => setTimeout(r, parseInt(opts.delay)));
  }

  // Build structural
  const structural = buildStructural(allItems);

  // Stats
  const stats = {
    totalItems: allItems.length,
    totalStructural: structural.length,
    totalArticles: allItems.filter(i => i.type === 'ARTIGO').length,
    totalRevoked: allItems.filter(i => i.revoked).length
  };

  // Save raw.json
  const rawData = {
    document: {
      title: doc.title,
      description: doc.description,
      url: doc.url,
      type: doc.type,
      date: doc.date,
      docId: doc.docId,
      status: doc.status,
      keywords: doc.keywords
    },
    allItems,
    structural,
    stats
  };

  writeFileSync(rawPath, JSON.stringify(rawData, null, 2), 'utf-8');
  return { leiId, items: allItems.length, stats };
}

async function main() {
  if (opts.docId) {
    // Single extraction
    console.log(`Extracting docId=${opts.docId}...`);
    const result = await extractOneLei(parseInt(opts.docId), opts.output);
    if (result.skipped) {
      console.log(`  ${result.leiId} — skipped (already exists)`);
    } else {
      console.log(`  ${result.leiId} ✓ ${result.items} items`);
    }
    return;
  }

  if (opts.all) {
    // Batch extraction from _index.json
    const indexPath = join(opts.input, '_index.json');
    if (!existsSync(indexPath)) {
      console.error(`_index.json not found at ${indexPath}. Run extract-index.js first.`);
      process.exit(1);
    }

    const index = JSON.parse(readFileSync(indexPath, 'utf-8'));
    console.log(`Extracting ${index.length} laws...`);

    let done = 0;
    let skipped = 0;
    let errors = 0;

    // Process in parallel batches
    const parallel = parseInt(opts.parallel);
    for (let i = 0; i < index.length; i += parallel) {
      const batch = index.slice(i, i + parallel);
      const results = await Promise.allSettled(
        batch.map(entry => extractOneLei(entry.docId, opts.output))
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value.skipped) {
            skipped++;
          } else {
            done++;
            const r = result.value;
            console.log(`  [${done + skipped + errors}/${index.length}] ${r.leiId} ✓ ${r.items} items`);
          }
        } else {
          errors++;
          console.error(`  [${done + skipped + errors}/${index.length}] ERROR: ${result.reason.message}`);
        }
      }

      // Delay between batches
      if (i + parallel < index.length) {
        await new Promise(r => setTimeout(r, parseInt(opts.delay)));
      }
    }

    console.log(`\nDone: ${done} extracted, ${skipped} skipped, ${errors} errors`);
    return;
  }

  console.error('Specify --docId <id> or --all');
  process.exit(1);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Test with Código Civil**

```bash
cd "scripts/lei-pipeline"
node extract-lei.js --docId 91577 --output ./leis
```

Expected: `leis/lei-10406-2002/raw.json` created with 5098 items.

- [ ] **Step 3: Test with Código Penal**

```bash
node extract-lei.js --docId 91614 --output ./leis
```

Expected: `leis/decreto-lei-2848-1940/raw.json` created with ~3524 items.

- [ ] **Step 4: Test resume (should skip)**

```bash
node extract-lei.js --docId 91577 --output ./leis
```

Expected: `lei-10406-2002 — skipped (already exists)`

- [ ] **Step 5: Commit**

```bash
git add scripts/lei-pipeline/extract-lei.js
git commit -m "feat(pipeline): extract-lei.js — extract single law with batch + resume"
```

---

## Task 4: Classification + Annotation Libraries

**Files:**
- Create: `scripts/lei-pipeline/lib/classifier.js`
- Create: `scripts/lei-pipeline/lib/annotation-regex.js`
- Create: `scripts/lei-pipeline/lib/link-extractor.js`
- Create: `scripts/lei-pipeline/lib/slug-generator.js`

Port the core logic from TypeScript to plain JS.

- [ ] **Step 1: Write annotation-regex.js**

Port from `src/lib/lei-annotation-regex.ts`:

```js
// scripts/lei-pipeline/lib/annotation-regex.js

export const RE_ANOTACAO = /\((?:Reda[çc][ãa]o\s+dad|Inclu[ií]d|Revogad|Vide\s|Vig[eê]ncia|Acrescid|Alterad|VETAD|Suprimid|Renumerad|Regulament|Produ[çc][ãa]o\s+de\s+efeito|Promulga[çc]|Texto\s+compilad|Convers[ãa]o|Declara[çc]|Norma\s+anterior|Publica[çc][ãa]o\s+original|Mensagem\s+de\s+veto|Refer[eê]ncia)[^)]*\)/gi;

export function classifyAnnotation(text) {
  const t = text.toLowerCase();
  if (t.includes('reda') && t.includes('dad')) return 'redacao';
  if (t.includes('inclu')) return 'inclusao';
  if (t.includes('revogad')) return 'revogacao';
  if (t.includes('vigência') || t.includes('vigencia')) return 'vigencia';
  if (t.includes('vide')) return 'vide';
  if (t.includes('regulament')) return 'regulamento';
  if (t.includes('produ') && t.includes('efeito')) return 'producao_efeito';
  if (t.includes('vetad')) return 'veto';
  return 'outro';
}

export function extractLeiRef(text) {
  const m = text.match(/Lei\s+(?:n[ºo°]?\s*)?(\d+[\.\d]*)\s*(?:,\s*de\s+|\s*\/\s*)(\d{4})/i);
  if (!m) return null;
  return `${m[1].replace(/\./g, '')}/${m[2]}`;
}

export function separateAnnotations(text) {
  const anotacoes = [];
  let match;
  const re = new RegExp(RE_ANOTACAO.source, RE_ANOTACAO.flags);
  while ((match = re.exec(text)) !== null) {
    anotacoes.push({
      tipo: classifyAnnotation(match[0]),
      texto: match[0],
      lei: extractLeiRef(match[0])
    });
  }
  const textoLimpo = text.replace(RE_ANOTACAO, '').replace(/\s{2,}/g, ' ').trim();
  return { textoLimpo, anotacoes, textoOriginal: text };
}
```

- [ ] **Step 2: Write link-extractor.js**

Port from `extractInlineLinks` in `src/lib/lei-graphql-mapper.ts`:

```js
// scripts/lei-pipeline/lib/link-extractor.js

const HTML_ENTITIES = {
  '&ordm;': 'º', '&amp;': '&', '&lt;': '<', '&gt;': '>',
  '&quot;': '"', '&nbsp;': ' ',
  '&Ccedil;': 'Ç', '&ccedil;': 'ç',
  '&Atilde;': 'Ã', '&atilde;': 'ã',
  '&Aacute;': 'Á', '&aacute;': 'á',
  '&Eacute;': 'É', '&eacute;': 'é',
  '&Iacute;': 'Í', '&iacute;': 'í',
  '&Oacute;': 'Ó', '&oacute;': 'ó',
  '&Uacute;': 'Ú', '&uacute;': 'ú',
  '&Acirc;': 'Â', '&acirc;': 'â',
  '&Ecirc;': 'Ê', '&ecirc;': 'ê',
  '&Ocirc;': 'Ô', '&ocirc;': 'ô',
};

function decodeEntities(text) {
  let result = text;
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    result = result.replaceAll(entity, char);
  }
  // Numeric entities &#123;
  result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
  return result;
}

export function extractInlineLinks(description) {
  const links = [];
  const re = /<a\s+[^>]*href="([^"]*)"[^>]*(?:title="([^"]*)")?[^>]*>(.*?)<\/a>/gi;
  let match;

  while ((match = re.exec(description)) !== null) {
    const href = match[1];
    const title = match[2] ? decodeEntities(match[2]) : '';
    const textoAncora = match[3].replace(/<[^>]*>/g, '').trim();

    links.push({ href, titulo: title, textoAncora });
  }

  // Replace <a> tags with their text content
  let cleanText = description.replace(/<a\s+[^>]*>(.*?)<\/a>/gi, '$1');
  // Strip remaining HTML tags
  cleanText = cleanText.replace(/<[^>]*>/g, '');
  // Decode entities
  cleanText = decodeEntities(cleanText);

  return { cleanText, links };
}
```

- [ ] **Step 3: Write classifier.js**

Port from `src/lib/lei-nao-identificado.ts`:

```js
// scripts/lei-pipeline/lib/classifier.js
import { RE_ANOTACAO } from './annotation-regex.js';

const STRUCTURAL_TYPES = new Set([
  'PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO'
]);

export function buildSubtitleIndexes(allItems, structural) {
  const indexes = new Set();
  for (const s of structural) {
    if (!s.subtitle) continue;
    for (let offset = 1; offset <= 5; offset++) {
      const candidate = allItems[s.index + offset];
      if (!candidate) break;
      if (candidate.type !== 'NAO_IDENTIFICADO') break;
      if (candidate.description === s.subtitle) {
        indexes.add(candidate.index);
        break;
      }
      if (candidate.description.startsWith('(')) continue;
      break;
    }
  }
  return indexes;
}

export function classifyNaoIdentificado(item, prevItem, subtitleIndexes) {
  const desc = item.description;

  // 1. Known subtitle
  if (subtitleIndexes && subtitleIndexes.has(item.index)) return 'subtitulo';
  if (prevItem && STRUCTURAL_TYPES.has(prevItem.type)) return 'subtitulo';
  if (/^SUBT[IÍ]TULO\s+/i.test(desc)) return 'subtitulo';

  // 2. Pena
  if (/^Pena\s*[-–—]/i.test(desc)) return 'pena';

  // 3. Broken paragraph
  if (/^P\s+ar[áa]grafo/i.test(desc)) return 'paragrafo_quebrado';
  if (/^\d+[ºo°]\s+/i.test(desc)) return 'paragrafo_quebrado';

  // 4. Standalone annotation
  if (desc.startsWith('(') && RE_ANOTACAO.test(desc)) {
    RE_ANOTACAO.lastIndex = 0; // reset regex state
    return 'anotacao_standalone';
  }
  RE_ANOTACAO.lastIndex = 0;

  // 5. Vide
  if (/^(\(?\s*Vide\s|Vide\s)/i.test(desc)) return 'vide';

  // 6. Vigência
  if (/^Vig[êe]ncia$/i.test(desc)) return 'vigencia';

  // 7. HTML content
  if (desc.startsWith('<table') || desc.startsWith('<a ') || desc.includes('<tr>')) return 'html_content';

  // 8. Preamble
  if (/^O PRESIDENTE DA REP[ÚU]BLICA/i.test(desc)) return 'preambulo';

  // 9. Epigrafe (high caps)
  const stripped = desc.replace(RE_ANOTACAO, '').trim();
  RE_ANOTACAO.lastIndex = 0;
  const letters = stripped.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  if (letters.length > 5) {
    const upperCount = (stripped.match(/[A-ZÀ-Ý]/g) || []).length;
    if (upperCount / letters.length > 0.8) return 'epigrafe';
  }

  // 10. Epigrafe (short text)
  if (!desc.startsWith('(') && stripped.length < 120) return 'epigrafe';

  // 11. Fallback
  return 'nao_classificado';
}
```

- [ ] **Step 4: Write slug-generator.js**

```js
// scripts/lei-pipeline/lib/slug-generator.js

export function extractNumero(description) {
  const m = description.match(/Art\.?\s+(\d+(?:\.\d+)*[ºo°]?(?:-[A-Za-z]+)?)/i);
  return m ? m[1].replace(/[ºo°]/g, '').replace(/\./g, '') : null;
}

export function generateSlug(tipo, numero, context) {
  const base = tipo.toLowerCase();
  if (tipo === 'ARTIGO') return `art-${numero || 'unknown'}`;
  if (tipo === 'PARAGRAFO') {
    if (/único/i.test(context || '')) return `art-${context}-par-unico`;
    return `art-${context}-par-${numero || 'unknown'}`;
  }
  if (tipo === 'INCISO') return `art-${context}-inc-${numero || 'unknown'}`;
  if (tipo === 'ALINEA') return `art-${context}-al-${numero || 'unknown'}`;
  return `${base}-${numero || 'unknown'}`;
}
```

- [ ] **Step 5: Test classifiers against real data**

```bash
cd "scripts/lei-pipeline"
node -e "
import { readFileSync } from 'fs';
import { classifyNaoIdentificado, buildSubtitleIndexes } from './lib/classifier.js';

const data = JSON.parse(readFileSync('./leis/decreto-lei-2848-1940/raw.json', 'utf-8'));
const indexes = buildSubtitleIndexes(data.allItems, data.structural);

const naoId = data.allItems.filter(i => i.type === 'NAO_IDENTIFICADO' && !i.revoked);
const counts = {};
for (const item of naoId) {
  const prev = data.allItems[item.index - 1] || null;
  const cls = classifyNaoIdentificado(item, prev, indexes);
  counts[cls] = (counts[cls] || 0) + 1;
}
console.log(counts);
"
```

Expected: Counts showing subtitulo, pena, epigrafe, anotacao_standalone, vigencia, etc.

- [ ] **Step 6: Commit**

```bash
git add scripts/lei-pipeline/lib/
git commit -m "feat(pipeline): classification + annotation + link extraction libraries"
```

---

## Task 5: process.js — Transform Raw to Processed

**Files:**
- Create: `scripts/lei-pipeline/lib/hierarchy-builder.js`
- Create: `scripts/lei-pipeline/process.js`

- [ ] **Step 1: Write hierarchy-builder.js**

```js
// scripts/lei-pipeline/lib/hierarchy-builder.js

const TYPE_DEPTH = {
  'PARTE': 0, 'LIVRO': 1, 'TITULO': 2,
  'CAPITULO': 3, 'SECAO': 4, 'SUBSECAO': 5
};

export function buildHierarchy(structural) {
  const root = { tipo: 'ROOT', descricao: '', filhos: [] };
  const stack = [root];

  for (const item of structural) {
    const depth = TYPE_DEPTH[item.type];
    if (depth === undefined) continue;

    const node = {
      tipo: item.type,
      descricao: item.description,
      subtitulo: item.subtitle || null,
      path: '', // computed below
      filhos: []
    };

    // Pop stack to find parent
    while (stack.length > depth + 1) stack.pop();
    const parent = stack[stack.length - 1];
    parent.filhos.push(node);
    stack.push(node);
  }

  // Compute paths
  function computePaths(node, parentPath) {
    const slug = node.descricao
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    node.path = parentPath ? `${parentPath}/${slug}` : slug;
    for (const child of node.filhos) {
      computePaths(child, node.path);
    }
  }

  for (const child of root.filhos) computePaths(child, '');
  return root.filhos;
}

export function buildPathMap(structural, allItems) {
  // Map each item index to its path in the hierarchy
  const pathMap = new Map();
  let currentPath = '';

  const TYPE_DEPTH = {
    'PARTE': 0, 'LIVRO': 1, 'TITULO': 2,
    'CAPITULO': 3, 'SECAO': 4, 'SUBSECAO': 5
  };
  const pathStack = [];

  for (const item of allItems) {
    if (TYPE_DEPTH[item.type] !== undefined) {
      const depth = TYPE_DEPTH[item.type];
      const slug = item.description
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);

      while (pathStack.length > depth) pathStack.pop();
      pathStack.push(slug);
      currentPath = pathStack.join('/');
    }
    pathMap.set(item.index, currentPath);
  }

  return pathMap;
}
```

- [ ] **Step 2: Write process.js**

```js
// scripts/lei-pipeline/process.js
import { program } from 'commander';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { classifyNaoIdentificado, buildSubtitleIndexes } from './lib/classifier.js';
import { separateAnnotations } from './lib/annotation-regex.js';
import { extractInlineLinks } from './lib/link-extractor.js';
import { extractNumero } from './lib/slug-generator.js';
import { buildHierarchy, buildPathMap } from './lib/hierarchy-builder.js';

program
  .option('--input <dir>', 'Directory with raw.json files', './leis')
  .option('--lei <id>', 'Process single lei (folder name)')
  .option('--force', 'Reprocess even if processed.json exists', false)
  .parse();

const opts = program.opts();

function processLei(leiDir) {
  const rawPath = join(leiDir, 'raw.json');
  const processedPath = join(leiDir, 'processed.json');

  if (!existsSync(rawPath)) return null;
  if (!opts.force && existsSync(processedPath)) return { skipped: true };

  const raw = JSON.parse(readFileSync(rawPath, 'utf-8'));
  const { document: doc, allItems, structural } = raw;

  // Build indexes
  const subtitleIndexes = buildSubtitleIndexes(allItems, structural);
  const pathMap = buildPathMap(structural, allItems);
  const hierarchy = buildHierarchy(structural);

  // Process each non-revoked item
  const dispositivos = [];
  const flagged = [];
  let currentArticleNum = null;

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    if (item.revoked) continue; // skip revoked versions

    const prevItem = i > 0 ? allItems[i - 1] : null;

    // Extract links from HTML
    const { cleanText: textWithoutLinks, links } = extractInlineLinks(item.description);

    // Separate annotations
    const { textoLimpo, anotacoes } = separateAnnotations(textWithoutLinks);

    // Determine tipo
    let tipo = item.type;
    let epigrafe = null;
    let pena = null;

    if (tipo === 'NAO_IDENTIFICADO') {
      const subtype = classifyNaoIdentificado(item, prevItem, subtitleIndexes);
      tipo = subtype.toUpperCase();

      // Flag items that need manual review
      if (subtype === 'paragrafo_quebrado' || subtype === 'nao_classificado') {
        flagged.push({ index: item.index, tipo: subtype, description: item.description });
      }
    }

    // Extract numero for articles
    let numero = null;
    if (item.type === 'ARTIGO') {
      numero = extractNumero(item.description);
      currentArticleNum = numero;
    } else if (item.type === 'PARAGRAFO') {
      const m = item.description.match(/§\s*(\d+[ºo°]?)/i);
      numero = m ? m[1].replace(/[ºo°]/g, '') : 'unico';
    } else if (item.type === 'INCISO') {
      const m = item.description.match(/^([IVXLCDM]+)\s*[-–—]/);
      numero = m ? m[1] : null;
    } else if (item.type === 'ALINEA') {
      const m = item.description.match(/^([a-z])\)/i);
      numero = m ? m[1].toLowerCase() : null;
    }

    // Look ahead/behind for epigrafe and pena linking
    if (item.type === 'ARTIGO' || item.type === 'PARAGRAFO') {
      // Check previous item for epigrafe
      if (prevItem && prevItem.type === 'NAO_IDENTIFICADO' && !prevItem.revoked) {
        const prevSub = classifyNaoIdentificado(prevItem, i > 1 ? allItems[i-2] : null, subtitleIndexes);
        if (prevSub === 'epigrafe') {
          epigrafe = prevItem.description.replace(/\(.*?\)/g, '').trim();
        }
      }
      // Check next item for pena
      const nextItem = allItems[i + 1];
      if (nextItem && nextItem.type === 'NAO_IDENTIFICADO' && !nextItem.revoked) {
        const nextSub = classifyNaoIdentificado(nextItem, item, subtitleIndexes);
        if (nextSub === 'pena') {
          pena = nextItem.description;
        }
      }
    }

    dispositivos.push({
      id: item.codeInt64,
      tipo,
      numero,
      texto: textoLimpo,
      raw_description: item.description,
      epigrafe,
      pena,
      anotacoes: anotacoes.length > 0 ? anotacoes : null,
      links: links.length > 0 ? links : null,
      revogado: false,
      posicao: item.index,
      path: pathMap.get(item.index) || null
    });
  }

  // Build lei ID from folder name
  const leiId = leiDir.split(/[/\\]/).pop();

  const processed = {
    lei: {
      id: leiId,
      titulo: doc.title,
      ementa: doc.description,
      tipo: doc.type,
      nivel: 'FEDERAL',
      data: doc.date ? new Date(doc.date).toISOString().split('T')[0] : null,
      status: doc.status,
      hierarquia: hierarchy,
      raw_metadata: { keywords: doc.keywords, metadata: doc.metadata },
      doc_id: doc.docId
    },
    dispositivos,
    stats: {
      total: dispositivos.length,
      artigos: dispositivos.filter(d => d.tipo === 'ARTIGO').length,
      revogados: allItems.filter(i => i.revoked).length,
      flagged: flagged.length
    },
    flagged
  };

  writeFileSync(processedPath, JSON.stringify(processed, null, 2), 'utf-8');
  return processed.stats;
}

function main() {
  const inputDir = opts.input;

  if (opts.lei) {
    // Process single lei
    const leiDir = join(inputDir, opts.lei);
    console.log(`Processing ${opts.lei}...`);
    const result = processLei(leiDir);
    if (!result) console.error('raw.json not found');
    else if (result.skipped) console.log('  Skipped (processed.json exists)');
    else console.log(`  ✓ ${result.total} dispositivos, ${result.flagged} flagged`);
    return;
  }

  // Process all
  const dirs = readdirSync(inputDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_'))
    .map(d => d.name);

  console.log(`Processing ${dirs.length} laws...`);
  let done = 0, skipped = 0, errors = 0;

  for (const dir of dirs) {
    try {
      const result = processLei(join(inputDir, dir));
      if (!result) continue;
      if (result.skipped) { skipped++; continue; }
      done++;
      if (result.flagged > 0) {
        console.log(`  [${done}] ${dir} ✓ ${result.total} dispositivos (${result.flagged} flagged)`);
      }
    } catch (err) {
      errors++;
      console.error(`  ${dir} ERROR: ${err.message}`);
    }
  }

  console.log(`\nDone: ${done} processed, ${skipped} skipped, ${errors} errors`);
}

main();
```

- [ ] **Step 3: Test against Código Civil**

```bash
cd "scripts/lei-pipeline"
node process.js --lei lei-10406-2002 --input ./leis
```

Expected: `leis/lei-10406-2002/processed.json` created. Check stats.

- [ ] **Step 4: Test against Código Penal (has epígrafes)**

```bash
node process.js --lei decreto-lei-2848-1940 --input ./leis
```

Verify in processed.json that Art. 121 has `epigrafe: "Homicídio simples"` and `pena: "Pena - reclusão..."`.

- [ ] **Step 5: Check flagged items**

```bash
node -e "
import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('./leis/decreto-lei-2848-1940/processed.json', 'utf-8'));
console.log('Flagged:', data.flagged.length);
data.flagged.forEach(f => console.log('  ', f.tipo, '|', f.description.substring(0, 80)));
"
```

Review flagged items — should be few (paragrafo_quebrado, nao_classificado).

- [ ] **Step 6: Commit**

```bash
git add scripts/lei-pipeline/process.js scripts/lei-pipeline/lib/hierarchy-builder.js
git commit -m "feat(pipeline): process.js — classify, clean, derive fields from raw"
```

---

## Task 6: Database Schema + upload.js

**Files:**
- Create: `scripts/lei-pipeline/schema/create-tables.sql`
- Create: `scripts/lei-pipeline/schema/typesense-schema.json`
- Create: `scripts/lei-pipeline/upload.js`

- [ ] **Step 1: Write create-tables.sql**

Copy the DDL from the spec (section "Database Schema — PostgreSQL — Hetzner"). This file is for manual execution on the Hetzner PostgreSQL instance.

- [ ] **Step 2: Write typesense-schema.json**

```json
{
  "name": "dispositivos",
  "fields": [
    { "name": "id", "type": "string" },
    { "name": "lei_id", "type": "string", "facet": true },
    { "name": "lei_titulo", "type": "string" },
    { "name": "tipo", "type": "string", "facet": true },
    { "name": "nivel", "type": "string", "facet": true },
    { "name": "texto", "type": "string" },
    { "name": "epigrafe", "type": "string", "optional": true },
    { "name": "numero", "type": "string", "optional": true },
    { "name": "posicao", "type": "int32" },
    { "name": "path", "type": "string", "optional": true, "facet": true }
  ],
  "default_sorting_field": "posicao"
}
```

- [ ] **Step 3: Write upload.js**

```js
// scripts/lei-pipeline/upload.js
import { program } from 'commander';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import pg from 'pg';
import Typesense from 'typesense';

program
  .option('--input <dir>', 'Directory with processed.json files', './leis')
  .option('--lei <id>', 'Upload single lei')
  .option('--pg <url>', 'PostgreSQL connection string')
  .option('--typesense <url>', 'Typesense URL', 'http://localhost:8108')
  .option('--typesense-key <key>', 'Typesense API key')
  .option('--batch-size <n>', 'Insert batch size', '500')
  .option('--dry-run', 'Show what would be done', false)
  .parse();

const opts = program.opts();

async function uploadLei(leiDir, pgClient, tsClient) {
  const processedPath = join(leiDir, 'processed.json');
  if (!existsSync(processedPath)) return null;

  const data = JSON.parse(readFileSync(processedPath, 'utf-8'));
  const { lei, dispositivos } = data;
  const leiId = leiDir.split(/[/\\]/).pop();

  if (opts.dryRun) {
    console.log(`  [DRY] ${leiId}: ${dispositivos.length} dispositivos`);
    return { dryRun: true };
  }

  // Upload to PostgreSQL
  // 1. Upsert lei
  await pgClient.query(`
    INSERT INTO leis (id, titulo, ementa, tipo, nivel, data, status, hierarquia, raw_metadata, doc_id, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
    ON CONFLICT (id) DO UPDATE SET
      titulo = EXCLUDED.titulo, ementa = EXCLUDED.ementa,
      hierarquia = EXCLUDED.hierarquia, raw_metadata = EXCLUDED.raw_metadata,
      updated_at = now()
  `, [lei.id, lei.titulo, lei.ementa, lei.tipo, lei.nivel, lei.data, lei.status,
      JSON.stringify(lei.hierarquia), JSON.stringify(lei.raw_metadata), lei.doc_id]);

  // 2. Upsert dispositivos in batches
  const batchSize = parseInt(opts.batchSize);
  for (let i = 0; i < dispositivos.length; i += batchSize) {
    const batch = dispositivos.slice(i, i + batchSize);

    // Build bulk upsert
    const values = [];
    const params = [];
    let paramIdx = 1;

    for (const d of batch) {
      values.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, now())`);
      params.push(
        d.id, lei.id, d.tipo, d.numero, d.texto, d.raw_description,
        d.epigrafe, d.pena,
        d.anotacoes ? JSON.stringify(d.anotacoes) : null,
        d.links ? JSON.stringify(d.links) : null,
        d.revogado, d.posicao, d.path
      );
    }

    await pgClient.query(`
      INSERT INTO dispositivos (id, lei_id, tipo, numero, texto, raw_description, epigrafe, pena, anotacoes, links, revogado, posicao, path, updated_at)
      VALUES ${values.join(', ')}
      ON CONFLICT (id) DO UPDATE SET
        tipo = EXCLUDED.tipo, numero = EXCLUDED.numero, texto = EXCLUDED.texto,
        raw_description = EXCLUDED.raw_description, epigrafe = EXCLUDED.epigrafe,
        pena = EXCLUDED.pena, anotacoes = EXCLUDED.anotacoes, links = EXCLUDED.links,
        revogado = EXCLUDED.revogado, posicao = EXCLUDED.posicao, path = EXCLUDED.path,
        updated_at = now()
    `, params);
  }

  // 3. Sync to Typesense
  if (tsClient) {
    const tsDocs = dispositivos.map(d => ({
      id: String(d.id),
      lei_id: lei.id,
      lei_titulo: lei.titulo,
      tipo: d.tipo,
      nivel: lei.nivel,
      texto: d.texto,
      epigrafe: d.epigrafe || '',
      numero: d.numero || '',
      posicao: d.posicao,
      path: d.path || ''
    }));

    // Upsert in batches
    for (let i = 0; i < tsDocs.length; i += batchSize) {
      const batch = tsDocs.slice(i, i + batchSize);
      await tsClient.collections('dispositivos').documents().import(batch, { action: 'upsert' });
    }
  }

  // Mark as uploaded
  writeFileSync(join(leiDir, 'meta.json'), JSON.stringify({
    uploaded: true,
    date: new Date().toISOString(),
    dispositivos: dispositivos.length
  }, null, 2));

  return { dispositivos: dispositivos.length };
}

async function main() {
  // Connect PostgreSQL
  let pgClient = null;
  if (opts.pg && !opts.dryRun) {
    pgClient = new pg.Client({ connectionString: opts.pg });
    await pgClient.connect();
    console.log('Connected to PostgreSQL');
  }

  // Connect Typesense
  let tsClient = null;
  if (opts.typesenseKey && !opts.dryRun) {
    const url = new URL(opts.typesense);
    tsClient = new Typesense.Client({
      nodes: [{ host: url.hostname, port: url.port || 8108, protocol: url.protocol.replace(':', '') }],
      apiKey: opts.typesenseKey
    });

    // Ensure collection exists
    try {
      await tsClient.collections('dispositivos').retrieve();
    } catch {
      const schema = JSON.parse(readFileSync(
        join(import.meta.dirname, 'schema/typesense-schema.json'), 'utf-8'
      ));
      await tsClient.collections().create(schema);
      console.log('Created Typesense collection: dispositivos');
    }
  }

  const inputDir = opts.input;

  if (opts.lei) {
    const leiDir = join(inputDir, opts.lei);
    console.log(`Uploading ${opts.lei}...`);
    const result = await uploadLei(leiDir, pgClient, tsClient);
    if (!result) console.error('processed.json not found');
    else console.log(`  ✓ ${result.dispositivos || 0} dispositivos`);
  } else {
    // Upload all
    const dirs = readdirSync(inputDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('_'))
      .map(d => d.name);

    console.log(`Uploading ${dirs.length} laws...`);
    let done = 0, errors = 0;

    for (const dir of dirs) {
      try {
        const result = await uploadLei(join(inputDir, dir), pgClient, tsClient);
        if (!result) continue;
        done++;
        console.log(`  [${done}/${dirs.length}] ${dir} ✓ ${result.dispositivos || 'dry-run'}`);
      } catch (err) {
        errors++;
        console.error(`  ${dir} ERROR: ${err.message}`);
      }
    }

    console.log(`\nDone: ${done} uploaded, ${errors} errors`);
  }

  if (pgClient) await pgClient.end();
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
```

- [ ] **Step 4: Test with --dry-run**

```bash
cd "scripts/lei-pipeline"
node upload.js --input ./leis --dry-run
```

Expected: Lists all laws and dispositivo counts without touching any database.

- [ ] **Step 5: Create database and tables on Hetzner**

Run `schema/create-tables.sql` on the PostgreSQL instance via Coolify terminal or psql.

- [ ] **Step 6: Test upload for Código Civil**

```bash
node upload.js --lei lei-10406-2002 --input ./leis --pg "postgresql://user:pass@95.217.197.95:5432/leis"
```

Verify in PostgreSQL: `SELECT count(*) FROM dispositivos WHERE lei_id = 'lei-10406-2002';`

- [ ] **Step 7: Commit**

```bash
git add scripts/lei-pipeline/upload.js scripts/lei-pipeline/schema/
git commit -m "feat(pipeline): upload.js — upsert to PostgreSQL + Typesense"
```

---

## Task 7: End-to-End Validation

- [ ] **Step 1: Full pipeline test with Código Penal**

```bash
cd "scripts/lei-pipeline"
node extract-lei.js --docId 91614 --output ./leis
node process.js --lei decreto-lei-2848-1940 --input ./leis --force
node upload.js --lei decreto-lei-2848-1940 --input ./leis --pg "postgresql://..."
```

- [ ] **Step 2: Validate epigrafes in database**

```sql
SELECT numero, epigrafe, substring(texto, 1, 60), pena
FROM dispositivos
WHERE lei_id LIKE '%2848%' AND epigrafe IS NOT NULL
ORDER BY posicao
LIMIT 10;
```

Expected: Art. 121 with "Homicídio simples", Art. 155 with "Furto", etc.

- [ ] **Step 3: Validate ordering**

```sql
SELECT posicao, tipo, substring(texto, 1, 80)
FROM dispositivos
WHERE lei_id LIKE '%2848%' AND posicao BETWEEN 1267 AND 1280
ORDER BY posicao;
```

Expected: Sequential items around Homicídio simples in correct order.

- [ ] **Step 4: Validate links extraction (Código Civil)**

```sql
SELECT numero, links
FROM dispositivos
WHERE lei_id LIKE '%10406%' AND links IS NOT NULL
LIMIT 5;
```

Expected: Dispositivos with extracted cross-reference links.

- [ ] **Step 5: Commit final validation notes**

```bash
git commit --allow-empty -m "test(pipeline): validated e2e against Codigo Civil + Codigo Penal"
```
