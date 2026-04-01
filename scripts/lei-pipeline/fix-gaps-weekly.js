// scripts/lei-pipeline/fix-gaps-weekly.js
//
// Reads _gaps_remaining.json and splits by WEEK to handle quinzenas
// that still exceeded the 550 paging limit.
//
// Usage: node fix-gaps-weekly.js

import { querySearch, fetchWithRetry } from './lib/graphql-client.js';
import { program } from 'commander';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

program
  .option('--input <dir>', 'Directory with _gaps_remaining.json', 'D:/leis')
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
            parent { title url body }
            date
            type
            source
            state
            author { name }
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
      docId: m[1], titulo: d.parent.title || '', ementa: d.parent.body || '',
      tipo: d.type || '', data: d.date || null, autor: d.author?.name || '',
      url: d.parent.url || '', source: d.source || '', state: d.state || '',
    });
  }
  return results;
}

async function paginateAll(queryBuilder) {
  const items = [];
  const firstData = await fetchWithRetry(() => querySearch(queryBuilder(PAGE_SIZE, 0)));
  const haystack = firstData.root.searchHaystack;
  const hits = haystack.hits;
  items.push(...extractItems(haystack.items));
  if (hits === 0) return { hits, items };

  for (let offset = PAGE_SIZE; offset < hits && offset < MAX_PAGINABLE; offset += PAGE_SIZE) {
    await sleep(DELAY);
    const data = await fetchWithRetry(() => querySearch(queryBuilder(PAGE_SIZE, offset)));
    items.push(...extractItems(data.root.searchHaystack.items));
  }
  return { hits, items };
}

// Split a date range into ~7-day chunks
function splitIntoWeeks(year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, '0');
  const weeks = [];
  for (let start = 1; start <= lastDay; start += 7) {
    const end = Math.min(start + 6, lastDay);
    weeks.push({
      start: `${year}-${mm}-${String(start).padStart(2, '0')}`,
      end: `${year}-${mm}-${String(end).padStart(2, '0')}`,
      label: `${year}-${mm}-${String(start).padStart(2, '0')}..${String(end).padStart(2, '0')}`
    });
  }
  return weeks;
}

async function main() {
  const inputDir = opts.input;
  const remainingPath = join(inputDir, '_gaps_remaining.json');
  const indexPath = join(inputDir, '_index.json');

  if (!existsSync(remainingPath)) {
    console.log('No _gaps_remaining.json found. Nothing to fix.');
    return;
  }

  const remaining = JSON.parse(readFileSync(remainingPath, 'utf-8'));
  const index = JSON.parse(readFileSync(indexPath, 'utf-8'));
  const seenIds = new Set(index.map(e => e.docId));

  // Group remaining gaps by level+type+year+month (deduplicate halves from same month)
  const monthMap = new Map();
  for (const gap of remaining) {
    const key = `${gap.level}|${gap.type}|${gap.year}|${gap.month}`;
    if (!monthMap.has(key)) monthMap.set(key, gap);
  }
  const uniqueMonths = [...monthMap.values()];

  console.log(`Found ${remaining.length} remaining half-gaps from ${uniqueMonths.length} unique months.`);
  console.log(`Loading existing index (${index.length} entries)...\n`);

  let totalNew = 0;
  let stillTooBig = [];

  for (let i = 0; i < uniqueMonths.length; i++) {
    const gap = uniqueMonths[i];
    const { level, type, year, month } = gap;
    const mm = String(month).padStart(2, '0');
    const weeks = splitIntoWeeks(year, month);

    console.log(`[${i + 1}/${uniqueMonths.length}] ${level} ${type} ${year}-${mm} (splitting into ${weeks.length} weeks)`);

    for (const week of weeks) {
      const filters = [
        { field: 'level', operator: 'equals', value: level },
        { field: 'type', operator: 'equals', value: type },
        { field: 'date', operator: 'between', value: [week.start, week.end] },
      ];

      await sleep(DELAY);

      let probeData;
      try {
        probeData = await fetchWithRetry(() => querySearch(buildQuery(filters)(1, 0)));
      } catch (err) {
        console.error(`  [error] ${week.label}: ${err.message}`);
        continue;
      }

      const weekHits = probeData.root.searchHaystack.hits;
      if (weekHits === 0) continue;

      process.stdout.write(`  ${week.label}: ${weekHits} hits ... `);

      if (weekHits > MAX_PAGINABLE) {
        console.log(`[STILL TOO BIG]`);
        stillTooBig.push({ level, type, year, month, week: week.label, hits: weekHits });
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
  }

  // Save
  writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');

  const stillPath = join(inputDir, '_gaps_still_remaining.json');
  writeFileSync(stillPath, JSON.stringify(stillTooBig, null, 2), 'utf-8');

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Done. New entries added: ${totalNew}`);
  console.log(`Total in _index.json: ${index.length}`);
  if (stillTooBig.length > 0) {
    console.log(`[WARN] ${stillTooBig.length} weeks still exceed limit — saved to ${stillPath}`);
  } else {
    console.log(`All gaps fixed!`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
