// scripts/lei-pipeline/process.js
//
// Reads raw.json and produces processed.json with classified types,
// clean text, annotations, links, and epigrafe/pena linking.
//
// Usage:
//   node process.js --input ./leis                      # process all
//   node process.js --lei lei-10406-2002 --input ./leis # process one
//   node process.js --force --input ./leis              # reprocess even if processed.json exists

import {
  readFileSync, writeFileSync, readdirSync, existsSync, statSync,
} from 'fs';
import { join } from 'path';

import { RE_ANOTACAO, classifyAnnotation, extractLeiRef, separateAnnotations } from './lib/annotation-regex.js';
import { extractInlineLinks } from './lib/link-extractor.js';
import { buildSubtitleIndexes, classifyNaoIdentificado } from './lib/classifier.js';
import { buildHierarchy, buildPathMap } from './lib/hierarchy-builder.js';

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
  force: args.includes('--force'),
};

// ── Constants ────────────────────────────────────────────────────────

const STRUCTURAL_TYPES = new Set([
  'PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO',
]);

const METADATA_TYPES = new Set([
  'EMENTA', 'PROTOCOLO', 'DOU_PUBLICACAO',
]);

// ── Numero extraction ────────────────────────────────────────────────

/**
 * Extract numero from a dispositivo based on its type.
 * @param {string} type
 * @param {string} description
 * @returns {string|null}
 */
function extractNumero(type, description) {
  if (type === 'ARTIGO') {
    const m = description.match(/Art\.?\s+(\d+(?:\.\d+)*[ºo°]?(?:-[A-Za-z]+)?)/i);
    if (m) return m[1].replace(/[ºo°]/g, '').replace(/\./g, '');
    return null;
  }
  if (type === 'PARAGRAFO') {
    if (/par[áa]grafo\s+[úu]nico/i.test(description)) return 'unico';
    const m = description.match(/§\s*(\d+[ºo°]?)/i);
    if (m) return m[1].replace(/[ºo°]/g, '');
    return null;
  }
  if (type === 'INCISO') {
    const m = description.match(/^([IVXLCDM]+)\s*[-–—]/);
    if (m) return m[1];
    return null;
  }
  if (type === 'ALINEA') {
    const m = description.match(/^([a-z])\)/i);
    if (m) return m[1].toLowerCase();
    return null;
  }
  return null;
}

// ── Compute parent-child relationships ──────────────────────────────
const PC_STRUCTURAL = new Set(['PARTE','LIVRO','TITULO','CAPITULO','SECAO','SUBSECAO','SUBTITULO','EMENTA','PREAMBULO']);

function computeParentChild(dispositivos) {
  let currentArtigo = null;
  let currentParagrafo = null;
  let currentInciso = null;

  for (const d of dispositivos) {
    if (PC_STRUCTURAL.has(d.tipo) || d.tipo === 'EPIGRAFE') {
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
      d.parent_id = currentArtigo;
      d.artigo_id = currentArtigo;
      d.depth = currentParagrafo ? 2 : 1;
    }
  }
}

// ── Process a single lei ─────────────────────────────────────────────

/**
 * Process a single lei directory: read raw.json, classify, and write processed.json.
 * @param {string} leiDir - Absolute path to the lei directory
 * @returns {{ leiId: string, stats: object }|null}
 */
function processLei(leiDir) {
  const rawPath = join(leiDir, 'raw.json');
  if (!existsSync(rawPath)) {
    console.warn(`  [skip] No raw.json in ${leiDir}`);
    return null;
  }

  const raw = JSON.parse(readFileSync(rawPath, 'utf-8'));
  const { document: doc, structural } = raw;

  // Re-add index field to allItems (extract-lei.js strips it before saving)
  const allItems = (raw.allItems || []).map((item, i) => ({
    ...item,
    index: i,
  }));

  // Build subtitle indexes for accurate classification
  const subtitleIndexes = buildSubtitleIndexes(allItems, structural);

  // Build hierarchy tree
  const hierarquia = buildHierarchy(structural);

  // Build path map (index → path string)
  const pathMap = buildPathMap(structural, allItems);

  // ── Generate lei ID from directory name ──
  const leiId = leiDir.split('/').pop().split('\\').pop();

  // ── Determine lei type from legisType ──
  const leiTipo = (doc.legisType || 'LEI').toUpperCase().replace(/_/g, '-');

  // ── Build lei metadata ──
  const lei = {
    id: leiId,
    titulo: doc.title || '',
    apelido: doc.legisNickname || null,
    ementa: doc.description || '',
    tipo: leiTipo,
    nivel: (doc.legisLevel || 'FEDERAL').toUpperCase(),
    data: (() => { try { const d = new Date(doc.date); return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : null; } catch { return null; } })(),
    status: doc.status || 'ATIVO',
    isActive: doc.isActive !== undefined ? doc.isActive : true,
    publisher: doc.publisher || null,
    parentDocument: doc.parentDocument || null,
    publishedDate: doc.publishedDate ? new Date(doc.publishedDate).toISOString() : null,
    updatedDate: doc.updatedDate ? new Date(doc.updatedDate).toISOString() : null,
    hierarquia,
    raw_metadata: {
      legisType: doc.legisType,
      legisLevel: doc.legisLevel,
      legisState: doc.legisState,
      url: doc.url,
    },
    doc_id: doc.docId,
  };

  // ── Process dispositivos ──
  const dispositivos = [];
  const flagged = [];

  // Track previous non-revoked item for epigrafe/pena linking
  // We'll do a two-pass approach: first pass collects all items with classification,
  // second pass does epigrafe/pena linking.

  // First pass: classify and extract data from each item
  const classified = [];

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    const prevItem = i > 0 ? allItems[i - 1] : null;

    // Skip internal metadata (PROTOCOLO, DOU_PUBLICACAO, TABELA)
    // These are not part of the law text sequence
    if (item.type === 'PROTOCOLO' || item.type === 'DOU_PUBLICACAO' || item.type === 'TABELA') {
      classified.push({ item, skip: true, tipo: item.type });
      continue;
    }

    // Determine effective type
    let tipo = item.type;
    let subtype = null;

    if (item.type === 'NAO_IDENTIFICADO') {
      subtype = classifyNaoIdentificado(item, prevItem, subtitleIndexes);
      tipo = subtype; // The subtype becomes the tipo
    }

    // Structural items: keep as dispositivos with minimal processing
    if (STRUCTURAL_TYPES.has(item.type)) {
      classified.push({
        item,
        skip: false,
        tipo: item.type,
        subtype: null,
        textoLimpo: item.description,
        rawDescription: item.description,
        anotacoes: null,
        links: null,
        numero: null,
        path: pathMap.get(item.index) || '',
        isStructural: true,
      });
      continue;
    }

    // EMENTA: process through link extraction (may contain HTML <a> tags)
    if (item.type === 'EMENTA') {
      const ementaLinks = extractInlineLinks(item.description);
      classified.push({
        item,
        skip: false,
        tipo: item.type,
        subtype: null,
        textoLimpo: ementaLinks.cleanText,
        rawDescription: item.description,
        anotacoes: null,
        links: ementaLinks.links.length > 0 ? ementaLinks.links : null,
        numero: null,
        path: pathMap.get(item.index) || '',
        isStructural: true,
      });
      continue;
    }

    // Extract inline links
    const linkResult = extractInlineLinks(item.description);
    let cleanTextFromLinks = linkResult.cleanText;
    const links = linkResult.links;

    // Strip <strike>...</strike> blocks (old penalty text embedded with new)
    cleanTextFromLinks = cleanTextFromLinks.replace(/<strike>[^<]*<\/strike>\s*/gi, '');
    cleanTextFromLinks = cleanTextFromLinks.replace(/<\/?strike>/gi, '');
    // Targeted HTML cleanup (safe for "X < Y" expressions)
    const KNOWN_TAGS = /(<\/?(a|span|b|i|em|strong|strike|font|div|p|br|sup|sub|table|tr|td|th|thead|tbody)\b[^>]*>)/gi;
    cleanTextFromLinks = cleanTextFromLinks.replace(KNOWN_TAGS, '');
    cleanTextFromLinks = cleanTextFromLinks.replace(/\s*>\s*$/, '');

    // Separate annotations from the link-cleaned text
    const annotResult = separateAnnotations(cleanTextFromLinks);
    const textoLimpo = annotResult.textoLimpo;
    const anotacoes = annotResult.anotacoes;

    // Extract numero
    const numero = extractNumero(item.type !== 'NAO_IDENTIFICADO' ? item.type : tipo.toUpperCase(), item.description);

    classified.push({
      item,
      skip: false,
      tipo,
      subtype,
      textoLimpo,
      rawDescription: item.description,
      anotacoes,
      links,
      numero,
      path: pathMap.get(item.index) || '',
    });
  }

  // Second pass: build dispositivos with epigrafe/pena linking
  const itensExcluidos = [];

  for (let ci = 0; ci < classified.length; ci++) {
    const entry = classified[ci];

    // Items marked skip in first pass (PROTOCOLO, DOU_PUBLICACAO, TABELA)
    if (entry.skip) {
      itensExcluidos.push({
        id: entry.item.codeInt64,
        tipo: entry.item.type,
        texto: entry.item.description,
        posicao: entry.item.index,
        motivo: entry.item.type,
      });
      continue;
    }

    const { item, tipo, subtype, textoLimpo, rawDescription, anotacoes, links, numero, path } = entry;

    // NAO_IDENTIFICADO classified as metadata — preserve in itens_excluidos
    if (['html_content', 'vigencia', 'vide', 'anotacao_standalone'].includes(tipo)) {
      itensExcluidos.push({
        id: item.codeInt64,
        tipo: tipo,
        texto: item.description,
        posicao: item.index,
        motivo: tipo,
      });
      continue;
    }

    // Look backward for epigrafe: find the nearest previous non-revoked NAO_IDENTIFICADO
    // classified as epigrafe that hasn't been consumed yet
    let epigrafe = null;
    if (item.type === 'ARTIGO' || item.type === 'PARAGRAFO') {
      for (let j = ci - 1; j >= 0; j--) {
        const prev = classified[j];
        if (prev.skip) {
          // If we hit a structural item, stop searching
          if (STRUCTURAL_TYPES.has(prev.tipo)) break;
          continue;
        }
        // If we hit another content item (ARTIGO, PARAGRAFO, etc.), stop
        if (!prev.skip && prev.tipo !== 'epigrafe' && prev.tipo !== 'anotacao_standalone'
            && prev.tipo !== 'vide' && prev.tipo !== 'vigencia' && prev.tipo !== 'subtitulo') break;
        if (prev.tipo === 'epigrafe') {
          epigrafe = prev.textoLimpo;
          break;
        }
      }
    }

    // Look forward for pena: find the nearest next non-revoked NAO_IDENTIFICADO classified as pena
    let pena = null;
    if (item.type === 'ARTIGO' || item.type === 'PARAGRAFO') {
      for (let j = ci + 1; j < classified.length; j++) {
        const next = classified[j];
        if (next.skip) {
          if (STRUCTURAL_TYPES.has(next.tipo)) break;
          continue;
        }
        // If we hit another content item that's not pena-like, stop
        if (next.tipo === 'pena') {
          pena = next.textoLimpo;
          break;
        }
        // If we hit another ARTIGO/PARAGRAFO/INCISO/ALINEA, stop
        if (['ARTIGO', 'PARAGRAFO', 'INCISO', 'ALINEA'].includes(next.item.type)) break;
        // Continue past annotations, vide, etc.
        if (['anotacao_standalone', 'vide', 'vigencia', 'epigrafe'].includes(next.tipo)) continue;
        break;
      }
    }

    // Flag problematic items
    const isFlagged = tipo === 'paragrafo_quebrado' || tipo === 'nao_classificado';
    if (isFlagged) {
      flagged.push({
        index: item.index,
        tipo,
        description: item.description.substring(0, 200),
      });
    }

    // Pena and epigrafe: KEEP as dispositivos (maintain sequential order)
    // They are ALSO linked as fields on the parent ARTIGO/PARAGRAFO

    // Fix empty texto (violated NOT NULL) and unclassified tipos
    const finalTipo = item.type !== 'NAO_IDENTIFICADO'
      ? item.type
      : (tipo === 'nao_classificado')
        ? 'NAO_IDENTIFICADO'
        : (tipo === 'paragrafo_quebrado')
          ? 'PARAGRAFO'
          : tipo.toUpperCase();
    const finalTexto = textoLimpo || rawDescription || '(sem conteúdo)';

    dispositivos.push({
      id: item.codeInt64,
      tipo: finalTipo,
      numero: numero || null,
      texto: finalTexto,
      raw_description: rawDescription,
      epigrafe: epigrafe || null,
      pena: pena || null,
      anotacoes: anotacoes || null,
      links: links || null,
      revogado: item.revoked || false,
      posicao: item.index,
      path: path || '',
      parent_id: null,   // computed by computeParentChild
      artigo_id: null,   // computed by computeParentChild
      depth: 0,          // computed by computeParentChild
    });
  }

  // Compute parent-child relationships
  computeParentChild(dispositivos);

  // ── Stats ──
  const stats = {
    total: dispositivos.length,
    artigos: dispositivos.filter(d => d.tipo === 'ARTIGO').length,
    revogados: dispositivos.filter(d => d.revogado).length,
    flagged: flagged.length,
    excluidos: itensExcluidos.length,
  };

  // ── Write output ──
  const output = { lei, dispositivos, stats, flagged, itens_excluidos: itensExcluidos };
  const outPath = join(leiDir, 'processed.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');

  return { leiId, stats };
}

// ── Directory helpers ────────────────────────────────────────────

/**
 * Recursively find all directories containing raw.json
 */
function findAllLeiDirs(dir, result) {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir);

  // If this directory has raw.json, it's a lei directory
  if (entries.includes('raw.json')) {
    result.push(dir);
    return;
  }

  // Otherwise recurse into subdirectories
  for (const entry of entries) {
    if (entry.startsWith('_') || entry.startsWith('.')) continue;
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      findAllLeiDirs(fullPath, result);
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
    if (!statSync(fullPath).isDirectory()) continue;

    // Check if this is the lei we're looking for
    if (entry === leiName && existsSync(join(fullPath, 'raw.json'))) {
      return fullPath;
    }

    // Recurse
    const found = findLeiDir(fullPath, leiName);
    if (found) return found;
  }
  return null;
}

// ── Main ─────────────────────────────────────────────────────────────

function main() {
  const inputDir = opts.input;
  const force = opts.force;

  if (!existsSync(inputDir)) {
    console.error(`[error] Input directory not found: ${inputDir}`);
    process.exit(1);
  }

  let leiDirs = [];

  if (opts.lei) {
    // If full path provided, use directly. Otherwise search.
    let found = null;
    if (existsSync(join(opts.lei, 'raw.json'))) {
      found = opts.lei;
    } else if (existsSync(join(inputDir, opts.lei, 'raw.json'))) {
      found = join(inputDir, opts.lei);
    } else {
      // Search recursively (slow for large trees)
      console.log(`[search] Looking for ${opts.lei} in ${inputDir}...`);
      found = findLeiDir(inputDir, opts.lei);
    }
    if (!found) {
      console.error(`[error] Lei directory not found: ${opts.lei}`);
      process.exit(1);
    }
    leiDirs.push(found);
  } else {
    // Process all lei directories recursively (nivel/tipo/lei-id/)
    console.log(`[scan] Scanning for raw.json files in ${inputDir}...`);
    findAllLeiDirs(inputDir, leiDirs);
    console.log(`[scan] Found ${leiDirs.length} lei directories.`);
  }

  if (leiDirs.length === 0) {
    console.log('[done] No lei directories to process.');
    return;
  }

  console.log(`[plan] Processing ${leiDirs.length} lei(s) from ${inputDir}`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  const startTime = Date.now();

  for (const leiDir of leiDirs) {
    const processedPath = join(leiDir, 'processed.json');
    if (!force && existsSync(processedPath)) {
      skipped++;
      continue;
    }

    const dirName = leiDir.split('/').pop().split('\\').pop();

    try {
      const result = processLei(leiDir);
      if (result) {
        const { stats } = result;
        console.log(
          `  [ok] ${dirName}: ${stats.total} dispositivos, ${stats.artigos} artigos, ${stats.revogados} revogados, ${stats.flagged} flagged`
        );
        processed++;
      }
    } catch (err) {
      console.error(`  [error] ${dirName}: ${err.message}`);
      errors++;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Done. Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors} in ${elapsed}s`);
}

main();
