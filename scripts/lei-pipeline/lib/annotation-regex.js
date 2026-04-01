// scripts/lei-pipeline/lib/annotation-regex.js
//
// Ported from src/lib/lei-annotation-regex.ts
// Extracts and classifies legislative annotations from dispositivo text.

/**
 * Matches legislative annotations like:
 * (Redacao dada pela Lei...), (Incluido pela...), (Revogado pela...),
 * (Regulamento), (Producao de efeito), (Vigencia), etc.
 *
 * IMPORTANT: This is a global regex — always reset .lastIndex = 0 before .test()
 */
export const RE_ANOTACAO =
  /\((?:Reda[çc][ãa]o\s+dad|Inclu[ií]d|Revogad|Vide\s|Vig[eê]ncia|Acrescid|Alterad|VETAD|Suprimi|Renumerad|Regulamento|Regulamenta[çc][ãa]o|Produ[çc][ãa]o\s+de\s+efeito|Promulga[çc][ãa]o|Texto\s+compilad|Convers[ãa]o\s+d|Declara[çc][ãa]o|Declarad|Norma\s+anterior|Publica[çc][ãa]o\s+original|Mensagem\s+de\s+veto|Refer[eê]ncia)[^)]*\)/gi;

/**
 * Classifies an annotation text into a structured type.
 * @param {string} text - The annotation text (e.g., "(Redação dada pela Lei nº 13.146, de 2015)")
 * @returns {'redacao'|'inclusao'|'revogacao'|'vigencia'|'vide'|'regulamento'|'producao_efeito'|'veto'|'outro'}
 */
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

/**
 * Extracts a referenced law number from annotation text.
 * E.g., "(Redação dada pela Lei nº 13.968, de 2019)" → "13968/2019"
 * @param {string} text
 * @returns {string|null}
 */
export function extractLeiRef(text) {
  const match = text.match(/(?:Lei|Decreto|Medida\s+Provis[oó]ria|Emenda\s+Constitucional|Lei\s+Complementar)\s+(?:n[oº]?\s*\.?\s*)(\d+[\.\d]*)\s*(?:[,/]\s*(?:de\s+)?)?(\d{4})?/i);
  if (match) {
    const numero = match[1].replace(/\./g, '');
    return match[2] ? `${numero}/${match[2]}` : numero;
  }
  return null;
}

/**
 * Separates annotations from text. Returns clean text + extracted annotations.
 * @param {string} text
 * @returns {{ textoLimpo: string, anotacoes: Array<{tipo: string, texto: string, lei: string|null}>, textoOriginal: string }}
 */
export function separateAnnotations(text) {
  const textoOriginal = text;
  const anotacoes = [];

  // Reset before using in replace (global regex)
  RE_ANOTACAO.lastIndex = 0;

  let textoLimpo = text.replace(RE_ANOTACAO, (match) => {
    const trimmed = match.trim();
    anotacoes.push({
      tipo: classifyAnnotation(trimmed),
      texto: trimmed,
      lei: extractLeiRef(trimmed),
    });
    return '';
  });

  textoLimpo = textoLimpo.replace(/\s{2,}/g, ' ').trim();
  textoLimpo = textoLimpo.replace(/\s*[,;]\s*$/, '').trim();

  return { textoLimpo, anotacoes: anotacoes.length > 0 ? anotacoes : null, textoOriginal };
}
