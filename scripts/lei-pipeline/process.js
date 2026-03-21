// scripts/lei-pipeline/process.js
//
// Reads raw.json and produces processed.json with classified types,
// clean text, annotations, links, and epigrafe/pena linking.
//
// Usage:
//   node process.js --input ./leis                      # process all
//   node process.js --lei lei-10406-2002 --input ./leis # process one
//   node process.js --force --input ./leis              # reprocess even if processed.json exists

import { program } from 'commander';
import {
  readFileSync, writeFileSync, readdirSync, existsSync, statSync,
} from 'fs';
import { join } from 'path';

import { RE_ANOTACAO, classifyAnnotation, extractLeiRef, separateAnnotations } from './lib/annotation-regex.js';
import { extractInlineLinks } from './lib/link-extractor.js';
import { buildSubtitleIndexes, classifyNaoIdentificado } from './lib/classifier.js';
import { buildHierarchy, buildPathMap } from './lib/hierarchy-builder.js';

// ── CLI ──────────────────────────────────────────────────────────────

program
  .option('--input <dir>', 'Directory with lei subdirectories', './leis')
  .option('--lei <id>', 'Process a single lei by directory name')
  .option('--force', 'Reprocess even if processed.json exists', false)
  .parse();

const opts = program.opts();

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
    data: doc.date ? new Date(doc.date).toISOString().split('T')[0] : null,
    status: doc.status || 'ATIVO',
    isActive: doc.isActive !== undefined ? doc.isActive : true,
    publisher: doc.publisher || null,
    parentDocument: doc.parentDocument || null,
    publishedDate: doc.publishedDate || null,
    updatedDate: doc.updatedDate || null,
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
  let artigos = 0;
  let revogados = 0;

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

    // Count revoked items but DO NOT skip them — they are included as
    // dispositivos with revogado=true. Frontend controls visibility.
    if (item.revoked) {
      revogados++;
    }

    // Determine effective type
    let tipo = item.type;
    let subtype = null;

    if (item.type === 'NAO_IDENTIFICADO') {
      subtype = classifyNaoIdentificado(item, prevItem, subtitleIndexes);
      tipo = subtype; // The subtype becomes the tipo
    }

    // Structural and EMENTA items: keep as dispositivos with their type
    // They need minimal processing (no annotation extraction)
    if (STRUCTURAL_TYPES.has(item.type) || item.type === 'EMENTA') {
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

    // Extract inline links
    const linkResult = extractInlineLinks(item.description);
    const cleanTextFromLinks = linkResult.cleanText;
    const links = linkResult.links;

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
  for (let ci = 0; ci < classified.length; ci++) {
    const entry = classified[ci];
    if (entry.skip) continue;

    const { item, tipo, subtype, textoLimpo, rawDescription, anotacoes, links, numero, path } = entry;

    // Skip only items that are pure metadata, not part of the law text sequence
    if (['html_content', 'vigencia', 'vide', 'anotacao_standalone'].includes(tipo)) continue;

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

    // Count artigos
    if (item.type === 'ARTIGO') artigos++;

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

    dispositivos.push({
      id: item.codeInt64,
      tipo: item.type !== 'NAO_IDENTIFICADO'
        ? item.type
        : (tipo === 'nao_classificado' || tipo === 'paragrafo_quebrado')
          ? 'NAO_IDENTIFICADO'
          : tipo.toUpperCase(),
      numero: numero || null,
      texto: textoLimpo,
      raw_description: rawDescription,
      epigrafe: epigrafe || null,
      pena: pena || null,
      anotacoes: anotacoes || null,
      links: links || null,
      revogado: item.revoked || false,
      posicao: item.index,
      path: path || '',
    });
  }

  // ── Stats ──
  const stats = {
    total: dispositivos.length,
    artigos,
    revogados,
    flagged: flagged.length,
  };

  // ── Write output ──
  const output = { lei, dispositivos, stats, flagged };
  const outPath = join(leiDir, 'processed.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');

  return { leiId, stats };
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
    // Process a single lei
    const leiDir = join(inputDir, opts.lei);
    if (!existsSync(leiDir)) {
      console.error(`[error] Lei directory not found: ${leiDir}`);
      process.exit(1);
    }
    leiDirs.push(leiDir);
  } else {
    // Process all lei directories
    const entries = readdirSync(inputDir);
    for (const entry of entries) {
      if (entry.startsWith('_') || entry.startsWith('.')) continue;
      const fullPath = join(inputDir, entry);
      if (!statSync(fullPath).isDirectory()) continue;
      if (!existsSync(join(fullPath, 'raw.json'))) continue;
      leiDirs.push(fullPath);
    }
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
