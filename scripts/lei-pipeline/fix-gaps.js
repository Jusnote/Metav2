// scripts/lei-pipeline/fix-gaps.js
//
// Reads _gaps.json and re-extracts the missing laws by splitting
// each gap month into two halves (quinzenas: 1-15 and 16-end).
//
// Usage:
//   node fix-gaps.js
//   node fix-gaps.js --input D:/leis

import { querySearch, fetchWithRetry } from './lib/graphql-client.js';
import { program } from 'commander';
import { writeFileSync, readFileSync, createWriteStream, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Stream-write large JSON arrays to avoid stringify size limit
async function saveIndexStream(filePath, items) {
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(filePath, 'utf-8');
    stream.on('error', reject);
    stream.write('[\n');
    for (let i = 0; i < items.length; i++) {
      const line = JSON.stringify(items[i]);
      stream.write(i === 0 ? '  ' + line : ',\n  ' + line);
    }
    stream.write('\n]\n');
    stream.end(resolve);
  });
}

program
  .option('--input <dir>', 'Directory with _gaps.json and _index.json', 'D:/leis')
  .option('--delay <ms>', 'Delay between requests (ms)', '300')
  .parse();

const opts = program.opts();
const DELAY = Number(opts.delay);
const PAGE_SIZE = 50;
const MAX_PAGINABLE = 550;

const sleep = ms => new Promise(r => setTimeout(r, ms));

const DOC_ID_RE = /legislacao\/(\d+)\//;

function buildQuery(filters) {
  const filtersGql = filters.map(f => {
    const val = Array.isArray(f.value)
      ? `[${f.value.map(v => `"${v}"`).join(', ')}]`
      : `"${f.value}"`;
    return `{field: "${f.field}", operator: ${f.operator}, value: ${val}}`;
  }).join(',\n        ');

  return (limit, offset) => `{
  root {
    searchHaystack(
      filters: [
        ${filtersGql}
      ]
      kinds: [LAW]
      limit: ${limit}
      offset: ${offset}
      query: ""
      sorts: [{field: "date", order: desc}]
    ) {
      hits
      items {
        kind
        data {
          ... on LawMetadata {
            parent {
              title
              url
              body
            }
            date
            type
            source
            state
            author {
              name
            }
          }
        }
      }
    }
  }
}`;
}

function extractItems(items) {
  const results = [];
  for (const item of items) {
    const d = item?.data;
    if (!d?.parent?.url) continue;
    const m = DOC_ID_RE.exec(d.parent.url);
    if (!m) continue;
    results.push({
      docId: m[1],
      titulo: d.parent.title || '',
      ementa: d.parent.body || '',
      tipo: d.type || '',
      data: d.date || null,
      autor: d.author?.name || '',
      url: d.parent.url || '',
      source: d.source || '',
      state: d.state || '',
    });
  }
  return results;
}

async function paginateAll(queryBuilder) {
  const items = [];
  const firstQuery = queryBuilder(PAGE_SIZE, 0);
  const firstData = await fetchWithRetry(() => querySearch(firstQuery));
  const haystack = firstData.root.searchHaystack;
  const hits = haystack.hits;
  items.push(...extractItems(haystack.items));

  if (hits === 0) return { hits, items };

  for (let offset = PAGE_SIZE; offset < hits && offset < MAX_PAGINABLE; offset += PAGE_SIZE) {
    await sleep(DELAY);
    const q = queryBuilder(PAGE_SIZE, offset);
    const data = await fetchWithRetry(() => querySearch(q));
    const page = data.root.searchHaystack;
    items.push(...extractItems(page.items));
  }

  return { hits, items };
}

async function main() {
  const inputDir = opts.input;
  const gapsPath = join(inputDir, '_gaps.json');
  const indexPath = join(inputDir, '_index.json');

  if (!existsSync(gapsPath)) {
    console.error('_gaps.json not found at', gapsPath);
    process.exit(1);
  }

  const gaps = JSON.parse(readFileSync(gapsPath, 'utf-8'));
  const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf-8')) : [];

  console.log(`Found ${gaps.length} gaps to fix. Loading existing index (${index.length} entries)...`);

  const seenIds = new Set(index.map(e => e.docId));
  let totalNew = 0;
  let gapsFixed = 0;
  let remainingGaps = [];

  for (let gi = 0; gi < gaps.length; gi++) {
    const gap = gaps[gi];
    const { level, type, year, month, hits, missed } = gap;
    const mm = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();

    console.log(`\n[${gi + 1}/${gaps.length}] ${level} ${type} ${year}-${mm} (${hits} hits, ~${missed} missed)`);

    // Split into two halves: 1-15 and 16-end
    const halves = [
      { start: `${year}-${mm}-01`, end: `${year}-${mm}-15`, label: `${year}-${mm}-01..15` },
      { start: `${year}-${mm}-16`, end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`, label: `${year}-${mm}-16..${lastDay}` },
    ];

    let gapFullyFixed = true;

    for (const half of halves) {
      const filters = [
        { field: 'level', operator: 'equals', value: level },
        { field: 'type', operator: 'equals', value: type },
        { field: 'date', operator: 'between', value: [half.start, half.end] },
      ];

      await sleep(DELAY);

      // Probe
      let probeData;
      try {
        const probeBuilder = buildQuery(filters);
        probeData = await fetchWithRetry(() => querySearch(probeBuilder(1, 0)));
      } catch (err) {
        console.error(`  [error] ${half.label}: ${err.message}`);
        gapFullyFixed = false;
        continue;
      }

      const halfHits = probeData.root.searchHaystack.hits;
      if (halfHits === 0) continue;

      process.stdout.write(`  ${half.label}: ${halfHits} hits ... `);

      if (halfHits > MAX_PAGINABLE) {
        console.log(`[STILL TOO BIG] needs further split`);
        remainingGaps.push({ ...gap, label: half.label, halfHits });
        gapFullyFixed = false;
        continue;
      }

      const { items } = await paginateAll(buildQuery(filters));
      let added = 0;
      for (const item of items) {
        if (!seenIds.has(item.docId)) {
          seenIds.add(item.docId);
          index.push(item);
          added++;
        }
      }
      totalNew += added;
      console.log(`fetched ${items.length}, new ${added}`);
    }

    if (gapFullyFixed) gapsFixed++;
  }

  // Save updated index (stream to avoid stringify size limit)
  await saveIndexStream(indexPath, index);

  // Save remaining gaps (if any halves still exceeded limit)
  const remainingPath = join(inputDir, '_gaps_remaining.json');
  writeFileSync(remainingPath, JSON.stringify(remainingGaps, null, 2), 'utf-8');

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Done. ${gapsFixed}/${gaps.length} gaps fully fixed.`);
  console.log(`New entries added: ${totalNew}`);
  console.log(`Total in _index.json: ${index.length}`);
  if (remainingGaps.length > 0) {
    console.log(`\n[WARN] ${remainingGaps.length} halves still exceed limit — saved to ${remainingPath}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
