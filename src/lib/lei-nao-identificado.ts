// src/lib/lei-nao-identificado.ts
// Sub-classifies NAO_IDENTIFICADO items from the GraphQL API.
//
// Two modes via flag:
// - useStructuralSubtitles=true (default): uses pre-computed subtitle indexes
//   from the structural JSON. More accurate — no guessing.
// - useStructuralSubtitles=false: uses heuristic (prevItem is structural).
//   Fallback when structural data is not available.

import type { GraphQLItem, StructuralItem, NaoIdentificadoSubType } from '@/types/lei-import';
import { RE_ANOTACAO_V2 } from '@/lib/lei-annotation-regex';

/**
 * Builds a Set of indexes that are known subtitles from the structural data.
 * A subtitle is the NAO_IDENTIFICADO item immediately after a structural item.
 */
export function buildSubtitleIndexes(
  allItems: GraphQLItem[],
  structural: StructuralItem[]
): Set<number> {
  const indexes = new Set<number>();
  for (const s of structural) {
    if (s.subtitle) {
      // Search for the subtitle text in nearby items after the structural item.
      // Can't assume index+1 because annotations like "(Incluído pela Lei...)"
      // may appear between the structural item and its subtitle.
      // Search up to 5 items ahead.
      for (let offset = 1; offset <= 5; offset++) {
        const candidate = allItems[s.index + offset];
        if (!candidate) break;
        if (candidate.type !== 'NAO_IDENTIFICADO') break; // Hit a real device, stop
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
 * @param item The NAO_IDENTIFICADO item
 * @param prevItem Previous item in sequence (used in heuristic mode)
 * @param knownSubtitleIndexes Set of indexes known to be subtitles (from structural).
 *   If provided, subtitle detection uses this set (accurate).
 *   If null, falls back to heuristic (prevItem is structural type).
 */
export function classifyNaoIdentificado(
  item: GraphQLItem,
  prevItem: GraphQLItem | null,
  knownSubtitleIndexes?: Set<number> | null
): NaoIdentificadoSubType {
  const desc = item.description.trim();

  // 1. Subtitle detection
  if (knownSubtitleIndexes) {
    // Accurate mode: check if this item's index is in the known set
    if (knownSubtitleIndexes.has(item.index)) {
      return 'subtitulo';
    }
  } else {
    // Heuristic mode: after a structural item = subtitle
    if (prevItem && ['PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO'].includes(prevItem.type)) {
      return 'subtitulo';
    }
  }

  // 1b. SUBTÍTULO pattern — the API doesn't recognize SUBTITULO as a structural type,
  // it comes as NAO_IDENTIFICADO. Treat as subtitulo (hierarchy, not article content).
  if (/^SUBT[IÍ]TULO\s+/i.test(desc)) {
    return 'subtitulo';
  }

  // 1c. NAO_IDENTIFICADO right after a SUBTÍTULO = its description (e.g., "Do Regime de Bens")
  // The SUBTÍTULO line itself is caught above. The next line (description) needs to be caught here.
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
  RE_ANOTACAO_V2.lastIndex = 0;
  if (RE_ANOTACAO_V2.test(desc) && desc.startsWith('(')) {
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
  RE_ANOTACAO_V2.lastIndex = 0;
  const strippedForCaps = desc.replace(RE_ANOTACAO_V2, '').trim();
  const letters = strippedForCaps.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  const upperLetters = letters.replace(/[^A-ZÀ-ÖØ-Þ]/g, '');
  const capsRatio = letters.length > 0 ? upperLetters.length / letters.length : 0;
  if (!desc.startsWith('(') && letters.length > 5 && capsRatio > 0.8) {
    return 'epigrafe';
  }

  // 9. Epigrafe — shorter text (stripped < 120 chars) not starting with "("
  if (!desc.startsWith('(')) {
    RE_ANOTACAO_V2.lastIndex = 0;
    const stripped = desc.replace(RE_ANOTACAO_V2, '').trim();
    if (stripped.length < 120) {
      return 'epigrafe';
    }
  }

  // 10. Fallback
  return 'nao_classificado';
}
