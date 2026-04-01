// scripts/lei-pipeline/upload.js
//
// Reads processed.json files and upserts to PostgreSQL + Typesense.
//
// Usage:
//   node upload.js --input D:/leis --dry-run
//   node upload.js --input D:/leis --pg postgres://user:pass@host/db --typesense http://localhost:8108 --typesense-key xyz
//   node upload.js --lei decreto-lei-2848-1940 --pg postgres://...
//   node upload.js --input D:/leis/federal --pg postgres://...   # upload only federal laws

import {
  readFileSync, writeFileSync, readdirSync, existsSync, statSync,
} from 'fs';
import { join } from 'path';
import pg from 'pg';
import Typesense from 'typesense';

// ── CLI (manual parsing to avoid Commander stdin hang) ──────────────

const args = process.argv.slice(2);
function getArg(name, defaultVal) {
  const idx = args.indexOf(name);
  if (idx === -1) return defaultVal;
  if (typeof defaultVal === 'boolean') return true;
  return args[idx + 1] || defaultVal;
}

const opts = {
  input: getArg('--input', 'D:/leis'),
  lei: getArg('--lei', null),
  pg: getArg('--pg', null),
  typesense: getArg('--typesense', 'http://localhost:8108'),
  typesenseKey: getArg('--typesense-key', null),
  batchSize: getArg('--batch-size', '500'),
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force'),
};

// ── Directory helpers (same pattern as process.js) ────────────────

/**
 * Recursively find all directories containing processed.json
 */
function findAllLeiDirs(dir, result) {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir);

  // If this directory has processed.json, it's a lei directory
  if (entries.includes('processed.json')) {
    result.push(dir);
    return;
  }

  // Otherwise recurse into subdirectories
  for (const entry of entries) {
    if (entry.startsWith('_') || entry.startsWith('.')) continue;
    const fullPath = join(dir, entry);
    try {
      if (statSync(fullPath).isDirectory()) {
        findAllLeiDirs(fullPath, result);
      }
    } catch {
      // skip unreadable entries
    }
  }
}

/**
 * Find a lei directory by name, searching recursively
 */
function findLeiDir(dir, leiName) {
  if (!existsSync(dir)) return null;
  const entries = readdirSync(dir);

  for (const entry of entries) {
    if (entry.startsWith('_') || entry.startsWith('.')) continue;
    const fullPath = join(dir, entry);
    try {
      if (!statSync(fullPath).isDirectory()) continue;
    } catch {
      continue;
    }

    // Check if this is the lei we're looking for
    if (entry === leiName && existsSync(join(fullPath, 'processed.json'))) {
      return fullPath;
    }

    // Recurse
    const found = findLeiDir(fullPath, leiName);
    if (found) return found;
  }
  return null;
}

// ── Upload a single lei ──────────────────────────────────────────────

/**
 * Upload a single lei's processed.json to PostgreSQL + Typesense.
 * @param {string} leiDir - Absolute path to the lei directory
 * @param {pg.Client|null} pgClient - PostgreSQL client (null in dry-run)
 * @param {Typesense.Client|null} tsClient - Typesense client (null if not configured)
 * @param {object} opts - CLI options
 * @returns {Promise<{count: number, dryRun?: boolean}|null>}
 */
async function uploadLei(leiDir, pgClient, tsClient, opts) {
  const processedPath = join(leiDir, 'processed.json');
  if (!existsSync(processedPath)) return null;

  const data = JSON.parse(readFileSync(processedPath, 'utf-8'));
  const { lei, dispositivos } = data;

  if (!lei || !dispositivos) {
    console.warn(`  [skip] Invalid processed.json in ${leiDir}`);
    return null;
  }

  const dirName = leiDir.split('/').pop().split('\\').pop();

  if (opts.dryRun) {
    console.log(`  [DRY] ${lei.id}: ${dispositivos.length} dispositivos`);
    return { dryRun: true, count: dispositivos.length };
  }

  const leiId = lei.id;
  const batchSize = parseInt(opts.batchSize || '500');

  await pgClient.query('BEGIN');
  try {
    // ── 1. Upsert lei ──

    await pgClient.query(`
      INSERT INTO leis (id, titulo, apelido, ementa, tipo, nivel, estado, data, status, is_active,
                        hierarquia, raw_metadata, doc_id, publisher, parent_document,
                        published_date, updated_date, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now())
      ON CONFLICT (id) DO UPDATE SET
        titulo=EXCLUDED.titulo, apelido=EXCLUDED.apelido, ementa=EXCLUDED.ementa,
        tipo=EXCLUDED.tipo, nivel=EXCLUDED.nivel, estado=EXCLUDED.estado,
        data=EXCLUDED.data, status=EXCLUDED.status, is_active=EXCLUDED.is_active,
        hierarquia=EXCLUDED.hierarquia, raw_metadata=EXCLUDED.raw_metadata,
        publisher=EXCLUDED.publisher, parent_document=EXCLUDED.parent_document,
        published_date=EXCLUDED.published_date, updated_date=EXCLUDED.updated_date,
        updated_at=now()
    `, [
      leiId, lei.titulo, lei.apelido || null, lei.ementa || null,
      lei.tipo, lei.nivel,
      lei.raw_metadata?.legisState || null,
      lei.data || null, lei.status || 'ATIVO', lei.isActive !== false,
      JSON.stringify(lei.hierarquia), JSON.stringify(lei.raw_metadata),
      lei.doc_id ? String(lei.doc_id) : null,
      lei.publisher ? JSON.stringify(lei.publisher) : null,
      lei.parentDocument ? JSON.stringify(lei.parentDocument) : null,
      lei.publishedDate || null, lei.updatedDate || null,
    ]);

    // ── 1b. Delete stale dispositivos (reconciliation) ──

    const currentIds = dispositivos.map(d => String(d.id));
    if (currentIds.length > 0) {
      await pgClient.query(
        'DELETE FROM dispositivos WHERE lei_id = $1 AND id != ALL($2::bigint[])',
        [leiId, currentIds]
      );
    }

    // ── 2. Upsert dispositivos in batches ──

    for (let i = 0; i < dispositivos.length; i += batchSize) {
      const batch = dispositivos.slice(i, i + batchSize);
      const values = [];
      const params = [];
      let idx = 1;

      for (const d of batch) {
        values.push(
          `($${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},now())`
        );
        params.push(
          String(d.id), leiId, d.tipo, d.numero || null,
          d.texto, d.raw_description,
          d.epigrafe || null, d.pena || null,
          d.anotacoes ? JSON.stringify(d.anotacoes) : null,
          d.links ? JSON.stringify(d.links) : null,
          d.revogado || false, d.posicao, d.path || null,
          d.parent_id ? String(d.parent_id) : null,
          d.artigo_id ? String(d.artigo_id) : null,
          d.depth != null ? d.depth : null,
        );
      }

      await pgClient.query(`
        INSERT INTO dispositivos (id,lei_id,tipo,numero,texto,raw_description,epigrafe,pena,anotacoes,links,revogado,posicao,path,parent_id,artigo_id,depth,updated_at)
        VALUES ${values.join(',')}
        ON CONFLICT (id) DO UPDATE SET
          lei_id=EXCLUDED.lei_id, tipo=EXCLUDED.tipo, numero=EXCLUDED.numero,
          texto=EXCLUDED.texto, raw_description=EXCLUDED.raw_description,
          epigrafe=EXCLUDED.epigrafe, pena=EXCLUDED.pena,
          anotacoes=EXCLUDED.anotacoes, links=EXCLUDED.links,
          revogado=EXCLUDED.revogado, posicao=EXCLUDED.posicao,
          path=EXCLUDED.path, parent_id=EXCLUDED.parent_id,
          artigo_id=EXCLUDED.artigo_id, depth=EXCLUDED.depth,
          updated_at=now()
      `, params);

      // Progress for large laws
      if (dispositivos.length > batchSize) {
        const end = Math.min(i + batchSize, dispositivos.length);
        console.log(`    [pg] ${dirName}: batch ${i + 1}-${end} / ${dispositivos.length}`);
      }
    }

    await pgClient.query('COMMIT');
  } catch (err) {
    await pgClient.query('ROLLBACK');
    console.error(`  [ERROR] Upload failed for ${dirName}:`, err.message);
    throw err;
  }

  // ── 3. Typesense sync ──

  if (tsClient) {
    const tsDocs = dispositivos
      .filter(d => !d.revogado) // only index non-revoked for search
      .map(d => ({
        id: String(d.id),
        lei_id: lei.id,
        lei_titulo: lei.titulo,
        tipo: d.tipo,
        nivel: lei.nivel,
        texto: d.texto,
        epigrafe: d.epigrafe || '',
        numero: d.numero || '',
        posicao: d.posicao,
        path: d.path || '',
      }));

    for (let i = 0; i < tsDocs.length; i += batchSize) {
      const batch = tsDocs.slice(i, i + batchSize);
      await tsClient.collections('dispositivos').documents().import(batch, { action: 'upsert' });

      if (tsDocs.length > batchSize) {
        const end = Math.min(i + batchSize, tsDocs.length);
        console.log(`    [ts] ${dirName}: batch ${i + 1}-${end} / ${tsDocs.length}`);
      }
    }
  }

  // ── 4. Write meta.json ──

  const metaPath = join(leiDir, 'meta.json');
  const existingMeta = existsSync(metaPath)
    ? JSON.parse(readFileSync(metaPath, 'utf-8'))
    : {};

  writeFileSync(metaPath, JSON.stringify({
    ...existingMeta,
    uploaded: true,
    uploadDate: new Date().toISOString(),
    dispositivos: dispositivos.length,
    pg: true,
    typesense: !!tsClient,
  }, null, 2));

  return { count: dispositivos.length };
}

// ── Typesense client factory ──────────────────────────────────────────

function createTypesenseClient(url, apiKey) {
  if (!url || !apiKey) return null;

  const parsed = new URL(url);
  return new Typesense.Client({
    nodes: [{
      host: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? '443' : '8108'),
      protocol: parsed.protocol.replace(':', ''),
    }],
    apiKey,
    connectionTimeoutSeconds: 10,
  });
}

/**
 * Ensure the Typesense collection exists, creating it if needed.
 */
async function ensureTypesenseCollection(tsClient) {
  if (!tsClient) return;

  const schemaPath = new URL('./schema/typesense-schema.json', import.meta.url).pathname;
  // On Windows, pathname starts with /C:/ — strip leading slash
  const normalizedPath = process.platform === 'win32' && schemaPath.startsWith('/')
    ? schemaPath.slice(1)
    : schemaPath;
  const schema = JSON.parse(readFileSync(normalizedPath, 'utf-8'));

  try {
    await tsClient.collections('dispositivos').retrieve();
    console.log('[ts] Collection "dispositivos" already exists');
  } catch (err) {
    if (err.httpStatus === 404) {
      await tsClient.collections().create(schema);
      console.log('[ts] Collection "dispositivos" created');
    } else {
      throw err;
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const inputDir = opts.input;

  if (!existsSync(inputDir)) {
    console.error(`[error] Input directory not found: ${inputDir}`);
    process.exit(1);
  }

  // Validate: need --pg unless --dry-run
  if (!opts.dryRun && !opts.pg) {
    console.error('[error] --pg <connection-string> is required (or use --dry-run)');
    process.exit(1);
  }

  // ── Find lei directories ──

  let leiDirs = [];

  if (opts.lei) {
    // Accept full path or search
    let found = null;
    if (existsSync(join(opts.lei, 'processed.json'))) {
      found = opts.lei;
    } else if (existsSync(join(inputDir, opts.lei, 'processed.json'))) {
      found = join(inputDir, opts.lei);
    } else {
      console.log(`[search] Looking for ${opts.lei} in ${inputDir}...`);
      found = findLeiDir(inputDir, opts.lei);
    }
    if (!found) {
      console.error(`[error] Lei directory not found: ${opts.lei}`);
      process.exit(1);
    }
    leiDirs.push(found);
  } else {
    console.log(`[scan] Scanning for processed.json files in ${inputDir}...`);
    findAllLeiDirs(inputDir, leiDirs);
    console.log(`[scan] Found ${leiDirs.length} lei directories.`);
  }

  if (leiDirs.length === 0) {
    console.log('[done] No lei directories with processed.json found.');
    return;
  }

  console.log(`[plan] Uploading ${leiDirs.length} lei(s) from ${inputDir}${opts.dryRun ? ' (DRY RUN)' : ''}`);

  // ── Connect to databases ──

  let pgClient = null;
  let tsClient = null;

  if (!opts.dryRun) {
    // PostgreSQL
    pgClient = new pg.Client({ connectionString: opts.pg });
    await pgClient.connect();
    console.log('[pg] Connected');

    // Typesense (optional)
    if (opts.typesenseKey) {
      tsClient = createTypesenseClient(opts.typesense, opts.typesenseKey);
      await ensureTypesenseCollection(tsClient);
    }
  }

  // ── Upload ──

  let uploaded = 0;
  let skipped = 0;
  let errors = 0;
  let totalDisp = 0;
  const startTime = Date.now();

  for (const leiDir of leiDirs) {
    const dirName = leiDir.split('/').pop().split('\\').pop();

    // Check if already uploaded (resume logic)
    const metaPath = join(leiDir, 'meta.json');
    if (existsSync(metaPath) && !opts.force) {
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
        if (meta.uploaded) {
          skipped++;
          continue;
        }
      } catch {}
    }

    try {
      const result = await uploadLei(leiDir, pgClient, tsClient, opts);
      if (result) {
        uploaded++;
        totalDisp += result.count;
        if (!result.dryRun) {
          console.log(`  [ok] ${dirName}: ${result.count} dispositivos`);
        }
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`  [error] ${dirName}: ${err.message}`);
      errors++;
    }
  }

  // ── Cleanup ──

  if (pgClient) {
    await pgClient.end();
    console.log('[pg] Disconnected');
  }

  // ── Summary ──

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Done. Uploaded: ${uploaded}, Skipped: ${skipped}, Errors: ${errors}`);
  console.log(`Total dispositivos: ${totalDisp} in ${elapsed}s`);
}

main().catch(err => {
  console.error('[fatal]', err);
  process.exit(1);
});
