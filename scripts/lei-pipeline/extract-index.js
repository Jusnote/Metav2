// scripts/lei-pipeline/extract-index.js
//
// Fetches all law IDs from JusBrasil's GraphQL search API and saves
// them to leis/_index.json. Segments by year (and by month when a
// year exceeds the deep-paging limit of ~550 results).

import { querySearch, fetchWithRetry } from './lib/graphql-client.js';
import { program } from 'commander';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// ── CLI ─────────────────────────────────────────────────────────────
program
  .option('--level <level>', 'ALL, FEDERAL, ESTADUAL, MUNICIPAL', 'ALL')
  .option('--types <types>', 'Comma-separated: LEIS,DECRETOS,...',
    'LEIS,DECRETOS,LEIS_COMPLEMENTARES,MEDIDAS_PROVISORIAS,DECRETOS_LEI,EMENDAS,LEIS_DELEGADAS,CODIGOS')
  .option('--output <dir>', 'Output directory', 'D:/leis')
  .option('--year-start <y>', 'Start year', '1808')
  .option('--year-end <y>', 'End year', '2026')
  .option('--delay <ms>', 'Delay between requests (ms)', '200')
  .parse();

const opts = program.opts();
const DELAY   = Number(opts.delay);
const Y_START = Number(opts.yearStart);
const Y_END   = Number(opts.yearEnd);
const TYPES   = opts.types.split(',').map(t => t.trim()).filter(Boolean);
const MAX_PAGINABLE = 550;   // safe ceiling for offset paging
const PAGE_SIZE     = 50;    // API hard max

// ── Helpers ─────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function buildQuery(filters) {
  // Build the filters array as a GraphQL literal (not JSON — no quotes on enum keys)
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

const DOC_ID_RE = /legislacao\/(\d+)\//;

function extractItems(items) {
  const results = [];
  for (const item of items) {
    const d = item?.data;
    if (!d?.parent?.url) continue;
    const m = DOC_ID_RE.exec(d.parent.url);
    if (!m) {
      console.warn(`  [warn] Could not extract docId from: ${d.parent.url}`);
      continue;
    }
    results.push({
      docId:   m[1],
      titulo:  d.parent.title || '',
      ementa:  d.parent.body  || '',
      tipo:    d.type          || '',
      data:    d.date          || null,
      autor:   d.author?.name  || '',
      url:     d.parent.url    || '',
      source:  d.source        || '',
      state:   d.state         || '',
    });
  }
  return results;
}

/** Paginate a single filter combo, returning all items. */
async function paginateAll(queryBuilder) {
  const items = [];

  // First page — also gives us the hit count
  const firstQuery = queryBuilder(PAGE_SIZE, 0);
  const firstData = await fetchWithRetry(() => querySearch(firstQuery));
  const haystack = firstData.root.searchHaystack;
  const hits = haystack.hits;
  items.push(...extractItems(haystack.items));

  if (hits === 0) return { hits, items };

  // Remaining pages
  for (let offset = PAGE_SIZE; offset < hits && offset < MAX_PAGINABLE; offset += PAGE_SIZE) {
    await sleep(DELAY);
    const q = queryBuilder(PAGE_SIZE, offset);
    const data = await fetchWithRetry(() => querySearch(q));
    const page = data.root.searchHaystack;
    items.push(...extractItems(page.items));
  }

  if (hits > MAX_PAGINABLE) {
    console.warn(`  [warn] hits (${hits}) > MAX_PAGINABLE (${MAX_PAGINABLE}), some results truncated — caller should split further`);
  }

  return { hits, items };
}

/** Return date range filters for a full year. */
function yearRange(year) {
  return { field: 'date', operator: 'between', value: [`${year}-01-01`, `${year}-12-31`] };
}

/** Return date range filters for a specific month in a year. */
function monthRange(year, month) {
  const mm = String(month).padStart(2, '0');
  // Last day of month — use 31 for all, the API handles overflow gracefully
  const lastDay = new Date(year, month, 0).getDate();
  const dd = String(lastDay).padStart(2, '0');
  return { field: 'date', operator: 'between', value: [`${year}-${mm}-01`, `${year}-${mm}-${dd}`] };
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const outDir = opts.output;
  const indexPath = join(outDir, '_index.json');

  // Ensure output dir exists
  mkdirSync(outDir, { recursive: true });

  // Resumability: warn if _index.json already exists
  let existing = [];
  if (existsSync(indexPath)) {
    try {
      existing = JSON.parse(readFileSync(indexPath, 'utf-8'));
      console.log(`[info] Existing _index.json loaded with ${existing.length} entries — will merge & deduplicate.`);
    } catch {
      console.warn('[warn] Could not parse existing _index.json — starting fresh.');
      existing = [];
    }
  }

  // Collect all items here (will merge with existing at the end)
  const allItems = [...existing];
  const seenIds = new Set(existing.map(e => e.docId));
  let totalNew = 0;

  // Determine which levels to process
  const levels = opts.level.toUpperCase() === 'ALL'
    ? ['FEDERAL', 'ESTADUAL', 'MUNICIPAL']
    : [opts.level.toUpperCase()];

  for (const level of levels) {
    console.log(`\n${'#'.repeat(60)}`);
    console.log(`# Level: ${level}`);
    console.log(`${'#'.repeat(60)}`);

  for (const type of TYPES) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Type: ${type} (${level})`);
    console.log(`${'='.repeat(60)}`);

    let typeTotal = 0;

    for (let year = Y_START; year <= Y_END; year++) {
      const baseFilters = [
        { field: 'level', operator: 'equals', value: level },
        { field: 'type',  operator: 'equals', value: type },
      ];

      // First: probe this year for hit count
      const probeFilters = [...baseFilters, yearRange(year)];
      const probeBuilder = buildQuery(probeFilters);
      const probeQuery   = probeBuilder(1, 0);   // just 1 item to get hits

      await sleep(DELAY);
      let probeData;
      try {
        probeData = await fetchWithRetry(() => querySearch(probeQuery));
      } catch (err) {
        console.error(`  [error] ${type} ${year}: ${err.message}`);
        continue;
      }
      const yearHits = probeData.root.searchHaystack.hits;

      if (yearHits === 0) continue;  // skip empty years silently

      if (yearHits <= MAX_PAGINABLE) {
        // ── Normal year pagination ──────────────────────────────────
        process.stdout.write(`  ${year}: ${yearHits} hits ... `);
        const yearBuilder = buildQuery([...baseFilters, yearRange(year)]);
        const { items } = await paginateAll(yearBuilder);

        let added = 0;
        for (const item of items) {
          if (!seenIds.has(item.docId)) {
            seenIds.add(item.docId);
            allItems.push(item);
            added++;
          }
        }
        typeTotal += added;
        console.log(`fetched ${items.length}, new ${added}`);
      } else {
        // ── Month-by-month pagination ───────────────────────────────
        console.log(`  ${year}: ${yearHits} hits (> ${MAX_PAGINABLE}) — splitting by month`);
        for (let month = 1; month <= 12; month++) {
          const mFilters = [...baseFilters, monthRange(year, month)];
          const mBuilder = buildQuery(mFilters);

          // Probe month
          await sleep(DELAY);
          let mProbe;
          try {
            mProbe = await fetchWithRetry(() => querySearch(mBuilder(1, 0)));
          } catch (err) {
            console.error(`    [error] ${type} ${year}-${String(month).padStart(2,'0')}: ${err.message}`);
            continue;
          }
          const mHits = mProbe.root.searchHaystack.hits;
          if (mHits === 0) continue;

          process.stdout.write(`    ${year}-${String(month).padStart(2, '0')}: ${mHits} hits ... `);

          if (mHits > MAX_PAGINABLE) {
            console.log(`[WARN] month has ${mHits} hits, exceeds limit — some laws will be missed!`);
          }

          const { items } = await paginateAll(mBuilder);
          let added = 0;
          for (const item of items) {
            if (!seenIds.has(item.docId)) {
              seenIds.add(item.docId);
              allItems.push(item);
              added++;
            }
          }
          typeTotal += added;
          console.log(`fetched ${items.length}, new ${added}`);
        }
      }
    }

    totalNew += typeTotal;
    console.log(`  ── ${type} (${level}) total new: ${typeTotal}`);
  }
  } // end levels loop

  // ── Save ────────────────────────────────────────────────────────
  writeFileSync(indexPath, JSON.stringify(allItems, null, 2), 'utf-8');
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Done. Total entries in _index.json: ${allItems.length} (${totalNew} new this run)`);
  console.log(`Saved to: ${indexPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
