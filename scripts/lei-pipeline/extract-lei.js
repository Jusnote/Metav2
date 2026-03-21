// scripts/lei-pipeline/extract-lei.js
//
// Extracts full law content from JusBrasil's GraphQL API.
//
// Supports 3 modes:
//   1. Single law:   --docId 91577
//   2. All from index: --all --input ./leis
//   3. List file:    --list prioridades.txt
//
// Key optimization: batches up to 200 laws per GraphQL query using
// aliases, with parallel batch requests. ~59k laws in ~3 minutes.
//
// Uses `documentByNumericID` (not `document`) because docIds from
// 2024+ exceed INT32 and break the `document()` resolver.

import { queryDocView, fetchWithRetry } from './lib/graphql-client.js';
import { program } from 'commander';
import {
  writeFileSync, readFileSync, mkdirSync, existsSync
} from 'fs';
import { join } from 'path';

// ── Constants ────────────────────────────────────────────────────────

const STRUCTURAL_TYPES = new Set([
  'PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO'
]);

const DOC_FRAGMENT = `
  docId title url date status isActive
  legisNickname legisType legisLevel legisState
  description
  publisher { pid fullname }
  parentDocument { docId title legisType }
  publishedDate updatedDate
  lawItems(start: 0, end: 2147483647) {
    codeInt64 type description revoked
  }
`;

// ── CLI ──────────────────────────────────────────────────────────────

program
  .option('--docId <ids...>', 'Extract one or more laws by docId')
  .option('--all', 'Extract all from _index.json')
  .option('--list <file>', 'Extract from file (one docId per line)')
  .option('--input <dir>', 'Directory with _index.json', './leis')
  .option('--output <dir>', 'Output directory', 'D:/leis')
  .option('--batch-size <n>', 'Laws per GraphQL query', '200')
  .option('--parallel <n>', 'Parallel batch requests', '3')
  .option('--delay <ms>', 'Delay between parallel rounds (ms)', '500')
  .option('--resume', 'Skip already extracted (default)', true)
  .option('--no-resume', 'Force re-extraction')
  .parse();

const opts = program.opts();
const BATCH_SIZE = Math.min(Number(opts.batchSize), 200);
const PARALLEL   = Number(opts.parallel);
const DELAY      = Number(opts.delay);
const RESUME     = opts.resume;

// ── Helpers ──────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Generate a filesystem-safe ID from the document metadata.
 * Format: {legisType}-{number}-{year}  e.g. lei-10406-2002
 */
function generateLeiId(doc) {
  const title = doc.title || '';
  const tipo = (doc.legisType || doc.type || 'lei')
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
  const numMatch = title.match(/(\d+[\.\d]*)/);
  const yearMatch = title.match(/(\d{4})/g);
  const num = numMatch ? numMatch[1].replace(/\./g, '') : String(doc.docId);
  const year = yearMatch ? yearMatch[yearMatch.length - 1] : '';
  return `${tipo}-${num}${year ? '-' + year : ''}`;
}

/**
 * Build structural hierarchy from lawItems.
 * Looks ahead up to 5 items for a subtitle (NAO_IDENTIFICADO that
 * doesn't start with '(').
 */
function buildStructural(allItems) {
  const structural = [];
  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    if (!STRUCTURAL_TYPES.has(item.type)) continue;

    let subtitle = null;
    for (let offset = 1; offset <= 5; offset++) {
      const candidate = allItems[i + offset];
      if (!candidate) break;
      if (candidate.type !== 'NAO_IDENTIFICADO') break;
      if (candidate.description && candidate.description.startsWith('(')) continue;
      subtitle = candidate.description;
      break;
    }

    structural.push({
      codeInt64: item.codeInt64,
      type: item.type,
      description: item.description,
      revoked: item.revoked,
      index: i,
      subtitle,
    });
  }
  return structural;
}

/**
 * Compute stats for a law's items.
 */
function computeStats(allItems, structural) {
  return {
    totalItems: allItems.length,
    totalStructural: structural.length,
    totalArticles: allItems.filter(it => it.type === 'ARTIGO').length,
    totalRevoked: allItems.filter(it => it.revoked).length,
  };
}

/**
 * Build a single GraphQL query with aliases for a batch of docIds.
 *
 * Example output for docIds [91577, 91614]:
 *   { root { d0: documentByNumericID(docId: 91577, ...) { ... } d1: ... } }
 */
function buildBatchQuery(docIds) {
  const aliases = docIds.map((id, i) =>
    `    d${i}: documentByNumericID(docId: ${id}, artifact: "LEGISLACAO") {${DOC_FRAGMENT}    }`
  ).join('\n');

  return `{\n  root {\n${aliases}\n  }\n}`;
}

/**
 * Load the set of already-extracted docIds from _extracted.json.
 */
function loadExtractedSet(outputDir) {
  const path = join(outputDir, '_extracted.json');
  if (!existsSync(path)) return new Set();
  try {
    const arr = JSON.parse(readFileSync(path, 'utf-8'));
    return new Set(arr.map(String));
  } catch {
    return new Set();
  }
}

/**
 * Save the set of extracted docIds to _extracted.json.
 */
function saveExtractedSet(outputDir, set) {
  const path = join(outputDir, '_extracted.json');
  writeFileSync(path, JSON.stringify([...set], null, 2), 'utf-8');
}

/**
 * Process a single document from the API response: build hierarchy,
 * compute stats, write raw.json.
 *
 * Returns { docId, leiId, itemCount } on success, null on skip/error.
 */
function processAndSave(doc, outputDir) {
  if (!doc || !doc.docId) return null;

  const leiId = generateLeiId(doc);

  // Organize by nivel/tipo: D:/leis/federal/leis/lei-10406-2002/
  const nivel = (doc.legisLevel || 'federal').toLowerCase();
  const tipo = (doc.legisType || 'outros').toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
  const leiDir = join(outputDir, nivel, tipo, leiId);
  mkdirSync(leiDir, { recursive: true });

  // Separate lawItems from document metadata
  const allItems = (doc.lawItems || []).map((item, index) => ({
    ...item,
    index,
  }));

  // Build document (without lawItems embedded)
  const document = {
    docId: doc.docId,
    title: doc.title,
    legisNickname: doc.legisNickname,
    legisType: doc.legisType,
    legisLevel: doc.legisLevel,
    legisState: doc.legisState,
    description: doc.description,
    url: doc.url,
    date: doc.date,
    status: doc.status,
    isActive: doc.isActive,
    publisher: doc.publisher,
    parentDocument: doc.parentDocument,
    publishedDate: doc.publishedDate,
    updatedDate: doc.updatedDate,
  };

  const structural = buildStructural(allItems);
  const stats = computeStats(allItems, structural);

  // Strip the index field from allItems before saving (it was only for buildStructural)
  const cleanItems = allItems.map(({ index, ...rest }) => rest);

  const raw = { document, allItems: cleanItems, structural, stats };
  writeFileSync(join(leiDir, 'raw.json'), JSON.stringify(raw, null, 2), 'utf-8');

  return { docId: String(doc.docId), leiId, itemCount: stats.totalItems };
}

// ── Extraction modes ─────────────────────────────────────────────────

/**
 * Extract a single batch of docIds via one GraphQL query.
 * Returns array of { docId, leiId, itemCount } for successfully extracted laws.
 */
async function extractBatch(docIds, outputDir) {
  const query = buildBatchQuery(docIds);
  const data = await fetchWithRetry(() => queryDocView(query), 3, 2000);

  const results = [];
  const root = data.root || data;

  for (let i = 0; i < docIds.length; i++) {
    const alias = `d${i}`;
    const doc = root[alias];
    if (!doc) {
      console.warn(`  [warn] No data for docId ${docIds[i]} (alias ${alias})`);
      continue;
    }
    const result = processAndSave(doc, outputDir);
    if (result) results.push(result);
  }

  return results;
}

/**
 * Main extraction loop. Takes a list of docIds, batches them,
 * runs parallel batches, and saves results.
 */
async function extractAll(docIds, outputDir) {
  mkdirSync(outputDir, { recursive: true });

  // Resume support: filter out already-extracted docIds
  const extractedSet = RESUME ? loadExtractedSet(outputDir) : new Set();
  const originalCount = docIds.length;

  if (RESUME && extractedSet.size > 0) {
    docIds = docIds.filter(id => !extractedSet.has(String(id)));
    console.log(`[resume] Skipping ${originalCount - docIds.length} already extracted, ${docIds.length} remaining.`);
  }

  if (docIds.length === 0) {
    console.log('[done] All laws already extracted.');
    return;
  }

  // Split into batches
  const batches = [];
  for (let i = 0; i < docIds.length; i += BATCH_SIZE) {
    batches.push(docIds.slice(i, i + BATCH_SIZE));
  }

  console.log(`[plan] ${docIds.length} laws in ${batches.length} batches of up to ${BATCH_SIZE}, ${PARALLEL} parallel.`);

  let totalExtracted = 0;
  let totalItems = 0;
  let errors = 0;
  const startTime = Date.now();

  // Process batches in parallel rounds
  for (let round = 0; round < batches.length; round += PARALLEL) {
    const roundBatches = batches.slice(round, round + PARALLEL);
    const roundNum = Math.floor(round / PARALLEL) + 1;
    const totalRounds = Math.ceil(batches.length / PARALLEL);

    process.stdout.write(`[round ${roundNum}/${totalRounds}] Extracting ${roundBatches.reduce((s, b) => s + b.length, 0)} laws in ${roundBatches.length} parallel batches... `);

    const roundStart = Date.now();

    const promises = roundBatches.map(async (batch, idx) => {
      try {
        return await extractBatch(batch, outputDir);
      } catch (err) {
        console.error(`\n  [error] Batch ${round + idx + 1} failed: ${err.message}`);
        // On batch failure, try individual extraction as fallback
        const fallbackResults = [];
        for (const docId of batch) {
          try {
            const results = await extractBatch([docId], outputDir);
            fallbackResults.push(...results);
          } catch (e2) {
            console.error(`  [error] docId ${docId}: ${e2.message}`);
            errors++;
          }
        }
        return fallbackResults;
      }
    });

    const roundResults = await Promise.all(promises);

    let roundExtracted = 0;
    let roundItems = 0;
    for (const results of roundResults) {
      for (const r of results) {
        extractedSet.add(r.docId);
        roundExtracted++;
        roundItems += r.itemCount;
      }
    }

    totalExtracted += roundExtracted;
    totalItems += roundItems;

    const elapsed = ((Date.now() - roundStart) / 1000).toFixed(1);
    console.log(`${roundExtracted} laws, ${roundItems} items in ${elapsed}s`);

    // Save extracted set periodically (every round)
    saveExtractedSet(outputDir, extractedSet);

    // Delay between rounds (skip after last)
    if (round + PARALLEL < batches.length && DELAY > 0) {
      await sleep(DELAY);
    }
  }

  // Final save
  saveExtractedSet(outputDir, extractedSet);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Done. Extracted ${totalExtracted} laws (${totalItems} total items) in ${totalTime}s`);
  console.log(`Errors: ${errors}`);
  console.log(`Total in _extracted.json: ${extractedSet.size}`);
  console.log(`Output: ${outputDir}`);
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const outputDir = opts.output;

  // Mode 1: Single law (or multiple --docId values)
  if (opts.docId && opts.docId.length > 0) {
    const docIds = opts.docId.map(Number);
    console.log(`[mode] Single/multi extraction: ${docIds.length} law(s)`);
    await extractAll(docIds, outputDir);
    return;
  }

  // Mode 2: All from _index.json
  if (opts.all) {
    const indexPath = join(opts.input, '_index.json');
    if (!existsSync(indexPath)) {
      console.error(`[error] _index.json not found at: ${indexPath}`);
      console.error(`Run extract-index.js first to build the index.`);
      process.exit(1);
    }

    const index = JSON.parse(readFileSync(indexPath, 'utf-8'));
    const docIds = index.map(entry => Number(entry.docId)).filter(Boolean);
    console.log(`[mode] All from _index.json: ${docIds.length} laws`);
    await extractAll(docIds, outputDir);
    return;
  }

  // Mode 3: List file
  if (opts.list) {
    if (!existsSync(opts.list)) {
      console.error(`[error] List file not found: ${opts.list}`);
      process.exit(1);
    }

    const content = readFileSync(opts.list, 'utf-8');
    const docIds = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(Number)
      .filter(id => !isNaN(id) && id > 0);

    console.log(`[mode] List file: ${docIds.length} laws from ${opts.list}`);
    await extractAll(docIds, outputDir);
    return;
  }

  // No mode specified
  console.error('[error] Specify --docId, --all, or --list. Use --help for usage.');
  process.exit(1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
