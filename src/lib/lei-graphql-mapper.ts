// ============================================================
// Lei GraphQL Mapper — Converts GraphQL API items to our internal schema
//
// Core design:
// 1. Description is NEVER modified — stored as-is
// 2. Type comes from API — no regex classification needed
// 3. source_id (codeInt64) stored but never exposed to frontend
// 4. Annotations extracted in parallel for tooltip only
// 5. ZERO data loss — everything is stored, nothing discarded
// ============================================================

import type {
  GraphQLItem,
  StructuralItem,
  LawDataExport,
  LegislativeAnnotation,
  HierarchyNode,
  HierarchyPath,
  PlateElement,
  PlateChild,
  ExportedArticle,
  ExportedLei,
  LeiMetadata,
  NaoIdentificadoSubType,
} from '@/types/lei-import';

import {
  RE_ANOTACAO_V2,
  classifyAnnotation,
  extractLeiReferenciada,
} from '@/lib/lei-annotation-regex';

import { classifyNaoIdentificado, buildSubtitleIndexes } from '@/lib/lei-nao-identificado';

// --- HTML link extraction + text cleaning ---

interface InlineLink {
  text: string;
  href: string;
  title: string;
}

/**
 * Extracts <a> links from description HTML and returns clean text + links.
 * E.g., 'conforme a <a href="/legislacao/123" title="CF">Constituição</a> Federal'
 * → cleanText: 'conforme a Constituição Federal'
 * → links: [{ text: 'Constituição', href: '/legislacao/123', title: 'CF' }]
 */
function extractInlineLinks(description: string): {
  cleanText: string;
  inlineLinks: InlineLink[];
} {
  const inlineLinks: InlineLink[] = [];

  // Extract links before stripping
  const linkRegex = /<a\s+[^>]*href="([^"]*)"[^>]*(?:title="([^"]*)")?[^>]*>(.*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(description)) !== null) {
    inlineLinks.push({
      href: match[1],
      title: (match[2] || '').replace(/&ordm;/g, 'º').replace(/&Ccedil;&Atilde;O/g, 'ÇÃO').replace(/&amp;/g, '&'),
      text: match[3].replace(/<[^>]*>/g, ''), // Strip any nested tags
    });
  }

  // Replace <a> tags with their text content
  let cleanText = description.replace(/<a\s+[^>]*>(.*?)<\/a>/gi, '$1');

  // Strip any remaining HTML tags
  cleanText = cleanText.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  cleanText = cleanText
    .replace(/&ordm;/g, 'º')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));

  return { cleanText, inlineLinks };
}

// --- Constants ---

const STRUCTURAL_TYPES = new Set([
  'PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO',
]);

const METADATA_TYPES = new Set([
  'EMENTA', 'PROTOCOLO', 'DOU_PUBLICACAO',
]);

const INDENT_MAP: Record<string, number> = {
  ARTIGO: 0,
  PARAGRAFO: 1,
  INCISO: 1,
  ALINEA: 2,
};

const HIERARCHY_LEVEL: Record<string, number> = {
  PARTE: 0, LIVRO: 1, TITULO: 2, CAPITULO: 3, SECAO: 4, SUBSECAO: 5,
};

const LEVEL_TO_KEY: Record<string, keyof HierarchyNode> = {
  PARTE: 'partes', LIVRO: 'livros', TITULO: 'titulos',
  CAPITULO: 'capitulos', SECAO: 'secoes', SUBSECAO: 'subsecoes',
};

const LEVEL_TO_TIPO: Record<string, string> = {
  PARTE: 'parte', LIVRO: 'livro', TITULO: 'titulo',
  CAPITULO: 'capitulo', SECAO: 'secao', SUBSECAO: 'subsecao',
};

const PATH_KEY: Record<string, keyof HierarchyPath> = {
  PARTE: 'parte', LIVRO: 'livro', TITULO: 'titulo',
  CAPITULO: 'capitulo', SECAO: 'secao', SUBSECAO: 'subsecao',
};

const LEVEL_ORDER = ['PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO'];

// --- Slug generation ---

function extractArticleNumber(desc: string): string {
  // Handles: Art. 1º, Art 1.636., Art. 121-A, Art. 2.046, Art 3 o
  const match = desc.match(/^Art\.?\s+(\d+(?:\.\d+)*)\s*[ºo°]?(?:-([A-Za-z]+))?/i);
  if (!match) return '';
  const num = match[1].replace(/\./g, ''); // 1.636 → 1636, 2.046 → 2046
  const suffix = match[2] ? `-${match[2]}` : '';
  return `${num}${suffix}`;
}

function generateSlug(item: GraphQLItem, currentArticle: string): string {
  const desc = item.description.trim();

  if (item.type === 'ARTIGO') {
    return `artigo-${extractArticleNumber(desc)}`;
  }
  if (item.type === 'PARAGRAFO') {
    if (/par[áa]grafo\s+[úu]nico/i.test(desc)) {
      return `paragrafo-unico-artigo-${currentArticle}`;
    }
    const m = desc.match(/§\s*(\d+[ºo°]?)/i);
    const num = m ? m[1].replace(/[o°]/g, 'º') : '';
    return `paragrafo-${num}-artigo-${currentArticle}`;
  }
  if (item.type === 'INCISO') {
    const m = desc.match(/^([IVXLCDM]+)\s*[-–—]/);
    return `inciso-${m ? m[1].toLowerCase() : ''}-artigo-${currentArticle}`;
  }
  if (item.type === 'ALINEA') {
    const m = desc.match(/^([a-z])\)/);
    return `alinea-${m ? m[1] : ''}-artigo-${currentArticle}`;
  }
  return `item-${item.index}`;
}

// --- Annotation extraction (for tooltip — does NOT modify description) ---

function extractAnnotations(desc: string, slug: string): LegislativeAnnotation[] {
  const annotations: LegislativeAnnotation[] = [];
  RE_ANOTACAO_V2.lastIndex = 0;
  let match;
  while ((match = RE_ANOTACAO_V2.exec(desc)) !== null) {
    annotations.push({
      texto: match[0].trim(),
      tipo: classifyAnnotation(match[0]),
      lei_referenciada: extractLeiReferenciada(match[0]),
      dispositivo_slug: slug,
    });
  }
  return annotations;
}

// --- Revoked detection ---

function isRevoked(desc: string): boolean {
  RE_ANOTACAO_V2.lastIndex = 0;
  const clean = desc.replace(RE_ANOTACAO_V2, '').trim();
  return /^\s*\(?\s*Revogad[oa]\s*\)?\s*\.?\s*$/i.test(clean) ||
    (clean.length === 0 && /Revogad/i.test(desc));
}

// --- Plate content generation ---

function itemToPlateElement(item: GraphQLItem, slug: string, indent: number): PlateElement {
  // Clean HTML from description (extract inline links, strip tags, decode entities)
  const { cleanText: desc } = extractInlineLinks(item.description);
  const children: PlateChild[] = [];

  if (item.type === 'ARTIGO') {
    const m = desc.match(/^(Art\.?\s+\d+(?:\.\d+)*\s*[ºo°]?(?:-[A-Za-z]+)?\.?\s*)/i);
    if (m) {
      children.push({ text: m[1], bold: true });
      children.push({ text: desc.slice(m[1].length) });
    } else {
      children.push({ text: desc });
    }
  } else if (item.type === 'PARAGRAFO') {
    const m = desc.match(/^(§\s*\d+[ºo°]?\s*\.?\s*|Par[áa]grafo\s+[úu]nico\.?\s*)/i);
    if (m) {
      children.push({ text: m[1], bold: true });
      children.push({ text: desc.slice(m[1].length) });
    } else {
      children.push({ text: desc });
    }
  } else if (item.type === 'INCISO') {
    const m = desc.match(/^([IVXLCDM]+\s*[-–—]\s*)/);
    if (m) {
      children.push({ text: m[1], bold: true });
      children.push({ text: desc.slice(m[1].length) });
    } else {
      children.push({ text: desc });
    }
  } else if (item.type === 'ALINEA') {
    const m = desc.match(/^([a-z]\)\s*)/);
    if (m) {
      children.push({ text: m[1], bold: true });
      children.push({ text: desc.slice(m[1].length) });
    } else {
      children.push({ text: desc });
    }
  } else {
    // NAO_IDENTIFICADO (pena, epigrafe, etc.) — text as-is
    children.push({ text: desc });
  }

  return {
    type: 'p',
    children,
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2),
    slug,
    urn: '',
    search_text: desc,
    texto_original: null,
    anotacoes: null,
    ...(indent > 0 ? { indent } : {}),
  };
}

// --- Hierarchy builder ---

function createEmptyNode(tipo: string, titulo: string): HierarchyNode {
  return {
    tipo: tipo as any,
    titulo,
    partes: [], livros: [], titulos: [], subtitulos: [],
    capitulos: [], secoes: [], subsecoes: [],
  };
}

function buildHierarchy(structural: StructuralItem[]): HierarchyNode {
  const root = createEmptyNode('documento', 'documento');
  const stack: Array<{ level: number; node: HierarchyNode }> = [];

  for (const item of structural) {
    const levelIdx = HIERARCHY_LEVEL[item.type];
    if (levelIdx === undefined) continue;

    const titulo = item.subtitle
      ? `${item.description} ${item.subtitle}`
      : item.description;

    const node = createEmptyNode(
      LEVEL_TO_TIPO[item.type] || item.type.toLowerCase(),
      titulo
    );

    while (stack.length > 0 && stack[stack.length - 1].level >= levelIdx) {
      stack.pop();
    }

    const parent = stack.length > 0 ? stack[stack.length - 1].node : root;
    const key = LEVEL_TO_KEY[item.type];
    if (key) (parent[key] as HierarchyNode[]).push(node);

    stack.push({ level: levelIdx, node });
  }

  return root;
}

// --- Hierarchy path per article ---

function buildArticlePaths(
  allItems: GraphQLItem[],
  structural: StructuralItem[]
): Map<number, { path: HierarchyPath; contexto: string }> {
  const paths = new Map<number, { path: HierarchyPath; contexto: string }>();
  const currentPath: HierarchyPath = {};
  const structuralByIndex = new Map(structural.map(s => [s.index, s]));

  for (const item of allItems) {
    if (STRUCTURAL_TYPES.has(item.type)) {
      const s = structuralByIndex.get(item.index);
      const label = s?.subtitle
        ? `${item.description} ${s.subtitle}`
        : item.description;

      const key = PATH_KEY[item.type];
      if (key) currentPath[key] = label;

      const levelIdx = LEVEL_ORDER.indexOf(item.type);
      for (let i = levelIdx + 1; i < LEVEL_ORDER.length; i++) {
        const lowerKey = PATH_KEY[LEVEL_ORDER[i]];
        if (lowerKey) delete currentPath[lowerKey];
      }
    }

    if (item.type === 'ARTIGO') {
      const contexto = Object.values(currentPath).filter(Boolean).join(' > ');
      paths.set(item.index, { path: { ...currentPath }, contexto });
    }
  }

  return paths;
}

// --- Simple hash ---

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// Epigraph handling moved to pending buffer + flushArticle

// --- Main conversion ---

export interface ConversionResult {
  exportedLei: ExportedLei;
  rawTabelas: GraphQLItem[];
  rawMetadata: GraphQLItem[];
  preContent: GraphQLItem[];    // Items before first article (preambulo, vigencia, vides)
  unmappedItems: GraphQLItem[]; // Items that couldn't be mapped (for audit)
  structuralWarnings: string[]; // Cross-validation warnings (script structural vs rebuilt)
  sourceItems: Array<{ index: number; sourceId: number; sourceType: string }>;
  stats: {
    totalInput: number;
    totalArticles: number;
    totalUniqueArticles: number;
    totalDuplicateVersions: number;
    totalRevoked: number;
    totalRevokedItems: number; // All revoked items (artigos + incisos + paragrafos)
    totalAnnotations: number;
    totalStructural: number;
    totalMetadata: number;
    totalTabela: number;
    totalPreContent: number;
    totalUnmapped: number;
    totalStructuralWarnings: number;
  };
}

export interface MapperOptions {
  /** Use structural subtitle indexes (accurate) vs heuristic (fallback). Default: true */
  useStructuralSubtitles?: boolean;
}

export function convertGraphQLToExported(
  lawData: LawDataExport,
  metadata: LeiMetadata,
  options: MapperOptions = {}
): ConversionResult {
  const { useStructuralSubtitles = true } = options;
  const { allItems, structural } = lawData;

  // Build subtitle indexes from structural data (if flag enabled)
  const subtitleIndexes = useStructuralSubtitles
    ? buildSubtitleIndexes(allItems, structural)
    : null;

  // --- Cross-validation: script structural vs rebuilt from allItems ---
  const structuralWarnings: string[] = [];
  const rebuiltStructural = allItems
    .filter(i => STRUCTURAL_TYPES.has(i.type))
    .map(item => {
      const next = allItems[item.index + 1];
      return {
        ...item,
        subtitle: (next && next.type === 'NAO_IDENTIFICADO') ? next.description : null,
      };
    });

  if (structural.length !== rebuiltStructural.length) {
    structuralWarnings.push(
      `Structural count mismatch: script=${structural.length}, rebuilt=${rebuiltStructural.length}`
    );
  }

  // Compare subtitle associations
  for (let si = 0; si < Math.min(structural.length, rebuiltStructural.length); si++) {
    const s = structural[si];
    const r = rebuiltStructural[si];
    if (s.index !== r.index) {
      structuralWarnings.push(
        `Structural index mismatch at position ${si}: script=${s.index}, rebuilt=${r.index}`
      );
      break; // If indexes diverge, rest is unreliable
    }
    if (s.subtitle !== r.subtitle) {
      structuralWarnings.push(
        `Subtitle mismatch at ${s.type} "${s.description}" (index ${s.index}): ` +
        `script="${s.subtitle}", rebuilt="${r.subtitle}"`
      );
    }
  }

  const hierarquia = buildHierarchy(structural);
  const articlePaths = buildArticlePaths(allItems, structural);

  // Separate by category — NOTHING is discarded
  const rawTabelas = allItems.filter(i => i.type === 'TABELA');
  const rawMetadata = allItems.filter(i => METADATA_TYPES.has(i.type));

  const articles: ExportedArticle[] = [];
  const sourceItems: Array<{ index: number; sourceId: number; sourceType: string }> = [];
  const preContent: GraphQLItem[] = []; // Before first article
  const unmappedItems: GraphQLItem[] = []; // NAO_IDENTIFICADO that we can't place

  let currentArticleNum = '';
  let currentArticleItems: GraphQLItem[] = [];
  let currentArticleIndex = -1;
  let firstArticleSeen = false;
  let totalAnnotations = 0;
  let totalRevoked = 0;

  // Buffer for NAO_IDENTIFICADO items between articles.
  // These belong to the NEXT article (epigrafes, annotations), not the previous one.
  let pendingBetweenArticles: GraphQLItem[] = [];

  // Track seen article numbers to handle duplicates (original + altered versions)
  const articleNumCount = new Map<string, number>();

  function flushArticle() {
    if (currentArticleItems.length === 0 || currentArticleIndex === -1) return;

    const firstItem = currentArticleItems[0];
    const num = extractArticleNumber(firstItem.description);

    // Handle duplicate article numbers (Art. 3 original + Art. 3º alterado)
    const count = (articleNumCount.get(num) || 0) + 1;
    articleNumCount.set(num, count);
    const slugSuffix = count > 1 ? `-v${count}` : '';
    const slug = `artigo-${num}${slugSuffix}`;
    const id = `artigo-${num}${slugSuffix}`;

    const pathInfo = articlePaths.get(currentArticleIndex);

    // Epigrafe from pending buffer (items between previous article and this one)
    const epigrafeItems = pendingBetweenArticles
      .filter(i => {
        const sub = classifyNaoIdentificado(i, null, subtitleIndexes);
        return sub === 'epigrafe';
      });
    const epigrafe = epigrafeItems.map(i => {
      // Strip annotations from epigrafe text for clean title
      RE_ANOTACAO_V2.lastIndex = 0;
      return i.description.replace(RE_ANOTACAO_V2, '').trim();
    }).join(' / ');

    const plateContent: PlateElement[] = [];
    const allAnnotations: LegislativeAnnotation[] = [];
    const allInlineLinks: InlineLink[] = [];

    // Process pending items from between articles (annotations, vides that belong to this article)
    for (const pending of pendingBetweenArticles) {
      const sub = classifyNaoIdentificado(pending, null, subtitleIndexes);
      if (sub === 'anotacao_standalone' || sub === 'vide' || sub === 'vigencia') {
        allAnnotations.push({
          texto: pending.description,
          tipo: classifyAnnotation(pending.description),
          lei_referenciada: extractLeiReferenciada(pending.description),
          dispositivo_slug: slug,
        });
      }
      // Epigrafes already handled above (epigrafe field)
      // All pending items are accounted for
    }
    pendingBetweenArticles = []; // Clear buffer

    for (let idx = 0; idx < currentArticleItems.length; idx++) {
      const item = currentArticleItems[idx];
      const prevItem = idx > 0 ? currentArticleItems[idx - 1] : null;

      // Handle NAO_IDENTIFICADO within article context
      if (item.type === 'NAO_IDENTIFICADO') {
        const subType: NaoIdentificadoSubType = classifyNaoIdentificado(item, prevItem, subtitleIndexes);

        if (subType === 'pena') {
          // Pena gets its own plate element with indent
          plateContent.push(itemToPlateElement(
            item,
            `${slug}-pena-${item.index}`,
            1
          ));
          // Also extract annotations from pena text
          const { cleanText: cleanPena } = extractInlineLinks(item.description);
          const penaAnnotations = extractAnnotations(cleanPena, `${slug}-pena-${item.index}`);
          allAnnotations.push(...penaAnnotations);
        } else if (subType === 'epigrafe') {
          // Epigrafe within article (e.g., "Modalidade culposa" before §3)
          plateContent.push(itemToPlateElement(
            item,
            `${slug}-epigrafe-${item.index}`,
            0
          ));
        } else if (subType === 'anotacao_standalone' || subType === 'vide' || subType === 'vigencia') {
          // Standalone annotations go to the annotation array
          allAnnotations.push({
            texto: item.description,
            tipo: classifyAnnotation(item.description),
            lei_referenciada: extractLeiReferenciada(item.description),
            dispositivo_slug: slug,
          });
        } else if (subType === 'paragrafo_quebrado') {
          // Broken paragraph (OCR error or missing §) — save as plate element
          // with indent 1 (like a paragraph) BUT flag for manual review
          plateContent.push(itemToPlateElement(
            item,
            `${slug}-paragrafo-quebrado-${item.index}`,
            1
          ));
          unmappedItems.push(item); // Flag for manual correction
        } else if (subType === 'nao_classificado') {
          // Can't classify — still add as plate element (don't lose data)
          plateContent.push(itemToPlateElement(
            item,
            `${slug}-extra-${item.index}`,
            0
          ));
          unmappedItems.push(item); // Flag for manual review
        }
        // subtitulo and html_content within article are unusual but store them
        if (subType === 'subtitulo' || subType === 'html_content' || subType === 'preambulo') {
          plateContent.push(itemToPlateElement(
            item,
            `${slug}-${subType}-${item.index}`,
            0
          ));
        }
        continue;
      }

      // Regular device types (ARTIGO, PARAGRAFO, INCISO, ALINEA)
      const itemSlug = generateSlug(item, num);
      const indent = INDENT_MAP[item.type] || 0;

      // Extract inline HTML links and clean description for annotations
      const { cleanText: cleanDesc, inlineLinks } = extractInlineLinks(item.description);
      allInlineLinks.push(...inlineLinks);

      const itemAnnotations = extractAnnotations(cleanDesc, itemSlug);
      allAnnotations.push(...itemAnnotations);

      plateContent.push(itemToPlateElement(item, itemSlug, indent));

      sourceItems.push({
        index: item.index,
        sourceId: item.codeInt64,
        sourceType: item.type,
      });
    }

    totalAnnotations += allAnnotations.length;

    const textoPlano = plateContent.map(p => p.search_text).join('\n');
    // Use revoked field from API (accurate) with regex fallback
    const vigente = firstItem.revoked !== undefined ? !firstItem.revoked : !isRevoked(firstItem.description);
    if (!vigente) totalRevoked++;

    articles.push({
      id,
      numero: num,
      slug,
      epigrafe,
      plate_content: plateContent,
      texto_plano: textoPlano,
      search_text: textoPlano,
      vigente,
      contexto: pathInfo?.contexto || '',
      path: pathInfo?.path || {},
      content_hash: simpleHash(textoPlano),
      revoked_versions: [],
      anotacoes_legislativas: allAnnotations,
      reference_links: allInlineLinks.map(l => ({
        text: l.text,
        href: l.href,
        type: l.href.includes('/legislacao/') ? 'legislacao' as const : 'topico' as const,
      })),
      fonte: 'jusbrasil-graphql',
      source_id: firstItem.codeInt64,
      source_type: firstItem.type,
      source_index: firstItem.index,
    });
  }

  // --- Main iteration: group items into articles ---

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];

    // Skip structural items (already handled by hierarchy builder)
    if (STRUCTURAL_TYPES.has(item.type)) {
      continue;
    }

    // Skip metadata and tabela (already separated)
    if (METADATA_TYPES.has(item.type) || item.type === 'TABELA') {
      continue;
    }

    // Before first article: store as preContent (NOT discarded)
    if (!firstArticleSeen && item.type !== 'ARTIGO') {
      preContent.push(item);
      continue;
    }

    if (item.type === 'ARTIGO') {
      flushArticle();
      firstArticleSeen = true;
      currentArticleNum = extractArticleNumber(item.description);
      currentArticleItems = [item];
      currentArticleIndex = item.index;
    } else if (item.type === 'NAO_IDENTIFICADO') {
      // NAO_IDENTIFICADO can be: sub-item of current article OR
      // between-article content (epigrafe/annotation for NEXT article).
      // Heuristic: if prev item is also NAO_IDENTIFICADO or a structural type,
      // this is likely between articles (buffer for next article).
      // If prev item is ARTIGO/PARAGRAFO/INCISO/ALINEA, it belongs to current article.
      const prevItem = i > 0 ? allItems[i - 1] : null;
      const prevIsContent = prevItem && ['ARTIGO', 'PARAGRAFO', 'INCISO', 'ALINEA'].includes(prevItem.type);
      const subType = classifyNaoIdentificado(item, prevItem, subtitleIndexes);

      // Items that always belong to current article when one is active
      if (currentArticleItems.length > 0 &&
          (subType === 'pena' || subType === 'paragrafo_quebrado' ||
           subType === 'anotacao_standalone' || subType === 'vide' || subType === 'vigencia')) {
        currentArticleItems.push(item);
      }
      // Subtitulos de hierarquia (já no structural) — SKIP, não pertencem a artigos
      else if (subType === 'subtitulo') {
        // Estes são "DAS PESSOAS NATURAIS", "Da Suspensão e Extinção do Poder Familiar", etc.
        // Já estão no structural.subtitle — não devem virar epigrafe de artigo
        // Não adicionam a nenhum artigo, não vão pro buffer
        continue;
      }
      // Epigrafes: if we're INSIDE an article, they might be internal subtitles
      // (e.g., "MATÉRIAS-PRIMAS..." between incisos of Art. 281).
      // Only buffer for next article if the next real item is ARTIGO/structural.
      else if (subType === 'epigrafe') {
        if (currentArticleItems.length > 0) {
          // Check: is the next non-NAO_IDENTIFICADO item an ARTIGO?
          // If yes, this epigrafe belongs to the NEXT article (buffer it).
          // If no (it's INCISO, PARAGRAFO, etc.), it's internal to current article.
          let nextContentIdx = i + 1;
          while (nextContentIdx < allItems.length && allItems[nextContentIdx].type === 'NAO_IDENTIFICADO') {
            nextContentIdx++;
          }
          const nextContentType = nextContentIdx < allItems.length ? allItems[nextContentIdx].type : null;

          if (nextContentType === 'ARTIGO' || STRUCTURAL_TYPES.has(nextContentType || '')) {
            // Next real item is a new article or structural → buffer for next
            pendingBetweenArticles.push(item);
          } else {
            // Next real item is INCISO/PARAGRAFO/etc. → internal to current article
            currentArticleItems.push(item);
          }
        } else {
          // No active article — buffer for next
          pendingBetweenArticles.push(item);
        }
      }
      // Everything else: if we have an active article, add to it; otherwise buffer
      else if (currentArticleItems.length > 0) {
        currentArticleItems.push(item);
      } else {
        pendingBetweenArticles.push(item);
      }
    } else {
      // PARAGRAFO, INCISO, ALINEA — always belong to current article
      currentArticleItems.push(item);
    }
  }
  flushArticle();

  return {
    exportedLei: { lei: { hierarquia }, artigos: articles },
    rawTabelas,
    rawMetadata,
    preContent,
    unmappedItems,
    structuralWarnings,
    sourceItems,
    stats: {
      totalInput: allItems.length,
      totalArticles: articles.length,
      totalUniqueArticles: articleNumCount.size,
      totalDuplicateVersions: articles.length - articleNumCount.size,
      totalRevoked,
      totalRevokedItems: allItems.filter(i => i.revoked === true).length,
      totalAnnotations,
      totalStructural: structural.length,
      totalMetadata: rawMetadata.length,
      totalTabela: rawTabelas.length,
      totalPreContent: preContent.length,
      totalUnmapped: unmappedItems.length,
      totalStructuralWarnings: structuralWarnings.length,
    },
  };
}
