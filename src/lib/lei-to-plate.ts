// ============================================================
// Lei to Plate.js — Converts parsed articles to Plate.js JSON
// Deterministic template-based conversion (no LLM needed).
// ============================================================

import type {
  ExportedArticle,
  ExportedLei,
  HierarchyNode,
  ParsedArticle,
  ParsedElement,
  ParseResult,
  PlateChild,
  PlateElement,
  LeiMetadata,
} from '@/types/lei-import';

// --- UUID generator (crypto.randomUUID or fallback) ---

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// --- MD5 hash for content_hash (simple implementation) ---

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  // Convert to hex and pad to 32 chars
  const hex = Math.abs(hash).toString(16);
  return hex.padStart(8, '0').repeat(4).slice(0, 32);
}

// --- Roman to Arabic numeral converter ---

function romanToArabic(roman: string): number {
  const values: Record<string, number> = {
    I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000,
  };
  let result = 0;
  for (let i = 0; i < roman.length; i++) {
    const curr = values[roman[i]] || 0;
    const next = values[roman[i + 1]] || 0;
    result += curr < next ? -curr : curr;
  }
  return result;
}

// --- Label formatters ---

function formatArticleLabel(numero: string): string {
  return `Art. ${numero} `;
}

function formatParagraphLabel(numero: string): string {
  if (numero === 'único') return 'Parágrafo único. ';
  return `§ ${numero} `;
}

function formatIncisoLabel(numero: string): string {
  return `${numero} - `;
}

function formatAlineaLabel(numero: string): string {
  return `${numero}) `;
}

function formatItemLabel(numero: string): string {
  return `${numero}. `;
}

function formatPenaLabel(): string {
  return 'Pena - ';
}

// --- Element to Plate node ---

function elementToPlateNode(
  el: ParsedElement,
  articleNumero: string
): PlateElement {
  let label: string;
  let slug: string;

  switch (el.tipo) {
    case 'artigo':
      label = formatArticleLabel(el.numero);
      slug = 'caput';
      break;
    case 'paragrafo':
      label = formatParagraphLabel(el.numero);
      slug = `artigo-${articleNumero}.paragrafo-${el.numero}`;
      break;
    case 'paragrafo_unico':
      label = formatParagraphLabel('único');
      slug = `artigo-${articleNumero}.paragrafo-unico`;
      break;
    case 'inciso':
      label = formatIncisoLabel(el.numero);
      slug = `artigo-${articleNumero}.inciso-${romanToArabic(el.numero)}`;
      break;
    case 'alinea':
      label = formatAlineaLabel(el.numero);
      slug = `artigo-${articleNumero}.alinea-${el.numero}`;
      break;
    case 'item':
      label = formatItemLabel(el.numero);
      slug = `artigo-${articleNumero}.item-${el.numero}`;
      break;
    case 'pena':
      label = formatPenaLabel();
      slug = `artigo-${articleNumero}.pena`;
      break;
    case 'epigrafe':
      // Epigraphs within an article (e.g., "Homicídio culposo" before § 3º)
      label = '';
      slug = `artigo-${articleNumero}.epigrafe-${el.linha}`;
      break;
    default:
      label = '';
      slug = `artigo-${articleNumero}.${el.tipo}-${el.linha}`;
  }

  const children: PlateChild[] = [];

  if (label) {
    children.push({ text: label, bold: true });
    children.push({ text: el.texto });
  } else {
    // Epigraphe: all text in a single bold child
    children.push({ text: el.texto, bold: true });
  }

  const searchText = label ? `${label}${el.texto}` : el.texto;
  const hasAnnotations = el.anotacoes.length > 0;
  const textoOriginal = hasAnnotations
    ? (label ? `${label}${el.textoOriginal}` : el.textoOriginal)
    : null;

  return {
    type: 'p',
    children,
    id: generateId(),
    slug,
    urn: '',
    search_text: searchText,
    texto_original: textoOriginal,
    anotacoes: hasAnnotations ? el.anotacoes : null,
    ...(el.indent > 0 ? { indent: el.indent } : {}),
  };
}

// --- Article to exported format ---

function articleToExported(article: ParsedArticle): ExportedArticle {
  const plateContent = article.elementos.map((el) =>
    elementToPlateNode(el, article.numero)
  );

  const textoPlano = plateContent
    .map((node) => node.search_text)
    .join('\n');

  const searchText = textoPlano;
  const contentHash = simpleHash(textoPlano);

  return {
    id: article.id,
    numero: article.numero,
    slug: article.slug,
    epigrafe: article.epigrafe,
    plate_content: plateContent,
    texto_plano: textoPlano,
    search_text: searchText,
    vigente: article.vigente,
    contexto: article.contexto,
    path: article.path,
    content_hash: contentHash,
    revoked_versions: [],
  };
}

// --- Main conversion ---

export function convertToPlateJson(
  parseResult: ParseResult,
  _metadata: LeiMetadata
): ExportedLei {
  const artigos = parseResult.artigos.map(articleToExported);

  return {
    lei: {
      hierarquia: parseResult.hierarquia,
    },
    artigos,
  };
}

// --- Utility: Update hierarchy in exported data ---

export function updateHierarchy(
  exportData: ExportedLei,
  newHierarchy: HierarchyNode
): ExportedLei {
  return {
    ...exportData,
    lei: {
      ...exportData.lei,
      hierarquia: newHierarchy,
    },
  };
}

// --- Utility: Get stats from exported data ---

export function getExportStats(data: ExportedLei) {
  const total = data.artigos.length;
  const vigentes = data.artigos.filter((a) => a.vigente).length;
  const revogados = total - vigentes;
  const withEpigrafe = data.artigos.filter((a) => a.epigrafe).length;
  const withAnnotations = data.artigos.filter((a) =>
    a.plate_content.some((pc) => pc.anotacoes && pc.anotacoes.length > 0)
  ).length;

  return { total, vigentes, revogados, withEpigrafe, withAnnotations };
}
