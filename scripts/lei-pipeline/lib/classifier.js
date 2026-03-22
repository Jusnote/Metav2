// scripts/lei-pipeline/lib/classifier.js
//
// Ported from src/lib/lei-nao-identificado.ts
// Sub-classifies NAO_IDENTIFICADO items from the GraphQL API.

import { RE_ANOTACAO } from './annotation-regex.js';

const STRUCTURAL_TYPES = new Set([
  'PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO',
]);

/**
 * Builds a Set of indexes that are known subtitles from the structural data.
 * A subtitle is the NAO_IDENTIFICADO item immediately after a structural item.
 *
 * @param {Array<{index: number, type: string, description: string}>} allItems
 * @param {Array<{index: number, subtitle: string|null}>} structural
 * @returns {Set<number>}
 */
export function buildSubtitleIndexes(allItems, structural) {
  const indexes = new Set();
  for (const s of structural) {
    if (s.subtitle) {
      // Search for the subtitle text in nearby items after the structural item.
      // Can't assume index+1 because annotations like "(Incluído pela Lei...)"
      // may appear between the structural item and its subtitle.
      // Search up to 5 items ahead.
      for (let offset = 1; offset <= 5; offset++) {
        const candidate = allItems[s.index + offset];
        if (!candidate) break;
        if (candidate.type !== 'NAO_IDENTIFICADO') break;
        if (candidate.description === s.subtitle) {
          indexes.add(candidate.index);
          break;
        }
      }
    }
  }
  return indexes;
}

/**
 * Classifies a NAO_IDENTIFICADO item into a sub-type.
 *
 * Classification order (matters!):
 * 1. Known subtitle (in subtitleIndexes, or prev is STRUCTURAL, or regex SUBTÍTULO)
 * 2. Pena: /^Pena\s*[-–—]/i
 * 3. Broken paragraph: /^P\s+ar[áa]grafo/i or /^\d+[ºo°]\s+/i
 * 4. Standalone annotation: starts with ( + matches RE_ANOTACAO
 * 5. Vide: /^(\(?\s*Vide\s|Vide\s)/i
 * 6. Vigência: /^Vig[êe]ncia$/i
 * 7. HTML content: starts with <table, <a , or contains <tr>
 * 8. Preamble: /^O PRESIDENTE DA REP[ÚU]BLICA/i
 * 9. Epigrafe (high caps): >80% uppercase, >5 letters
 * 10. Epigrafe (short): not starting with (, stripped < 120 chars
 * 11. Fallback: nao_classificado
 *
 * @param {{index: number, type: string, description: string}} item
 * @param {{index: number, type: string, description: string}|null} prevItem
 * @param {Set<number>|null} subtitleIndexes
 * @returns {string}
 */
export function classifyNaoIdentificado(item, prevItem, subtitleIndexes) {
  const desc = item.description.trim();

  // 1. Subtitle detection
  if (subtitleIndexes) {
    // Accurate mode: check if this item's index is in the known set
    if (subtitleIndexes.has(item.index)) {
      return 'subtitulo';
    }
  } else {
    // Heuristic mode: after a structural item = subtitle
    if (prevItem && STRUCTURAL_TYPES.has(prevItem.type)) {
      return 'subtitulo';
    }
  }

  // 1b. SUBTÍTULO pattern
  if (/^SUBT[IÍ]TULO\s+/i.test(desc)) {
    return 'subtitulo';
  }

  // 1c. NAO_IDENTIFICADO right after a SUBTÍTULO = its description
  if (prevItem && prevItem.type === 'NAO_IDENTIFICADO' && /^SUBT[IÍ]TULO\s+/i.test(prevItem.description.trim())) {
    return 'subtitulo';
  }

  // 2. Pena pattern
  if (/^Pena\s*[-–—]/i.test(desc)) {
    return 'pena';
  }

  // 2b. Broken paragraph: "P arágrafo" (OCR/source error) or "3º No caso" (missing §)
  if (/^P\s+ar[áa]grafo/i.test(desc)) {
    return 'paragrafo_quebrado';
  }
  if (/^\d+[ºo°]\s+/i.test(desc) && !desc.match(/^\d+[ºo°]\s*[-–—]/)) {
    return 'paragrafo_quebrado';
  }

  // 3. Standalone annotation (starts with parenthesis containing annotation keyword)
  RE_ANOTACAO.lastIndex = 0;
  if (desc.startsWith('(') && RE_ANOTACAO.test(desc)) {
    return 'anotacao_standalone';
  }

  // 4. Vide
  if (/^(\(?\s*Vide\s|Vide\s)/i.test(desc)) {
    return 'vide';
  }

  // 5. Vigencia
  if (/^Vig[êe]ncia$/i.test(desc)) {
    return 'vigencia';
  }

  // 6. HTML content (tables, links from Planalto index)
  if (desc.startsWith('<table') || desc.startsWith('<a ') || desc.includes('<tr>')) {
    return 'html_content';
  }

  // 7. Preambulo pattern
  if (/^O PRESIDENTE DA REP[ÚU]BLICA/i.test(desc)) {
    return 'preambulo';
  }

  // 8. Mostly ALL CAPS text (> 80% uppercase letters) = epigrafe
  RE_ANOTACAO.lastIndex = 0;
  const strippedForCaps = desc.replace(RE_ANOTACAO, '').trim();
  const letters = strippedForCaps.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  const upperLetters = letters.replace(/[^A-ZÀ-ÖØ-Þ]/g, '');
  const capsRatio = letters.length > 0 ? upperLetters.length / letters.length : 0;
  if (!desc.startsWith('(') && letters.length > 5 && capsRatio > 0.8) {
    return 'epigrafe';
  }

  // 9. Epigrafe — shorter text (stripped < 120 chars) not starting with "("
  if (!desc.startsWith('(')) {
    RE_ANOTACAO.lastIndex = 0;
    const stripped = desc.replace(RE_ANOTACAO, '').trim();
    if (stripped.length < 120) {
      return 'epigrafe';
    }
  }

  // 10. Fallback
  return 'nao_classificado';
}
