// ============================================================
// Lei Parser — Plain text → Structured data
// Parses Brazilian legal text following LC 95/1998 conventions.
// Works on plain text (Ctrl+C from Planalto), NOT HTML.
// ============================================================

import type {
  HierarchyLevel,
  HierarchyNode,
  HierarchyPath,
  ParsedArticle,
  ParsedElement,
  ParsedElementType,
  ParseResult,
} from '@/types/lei-import';

// --- Regex patterns ---

// Annotations: (Redação dada...), (Incluído...), (Revogado...), etc.
const RE_ANOTACAO =
  /\((?:Reda[çc][ãa]o|Inclu[ií]d|Revogad|Vide|Vig[êe]ncia|Acrescid|Alterad|VETAD|Suprimi|Renumerad)[^)]*\)/gi;

// Article: Art. 1º, Art. 121-A., Art. 1.228, etc.
const RE_ARTIGO =
  /^\s*Art\.?\s+(\d+(?:\.\d+)*[ºo°]?(?:-[A-Za-z]+)?)\s*[.\-–—]?\s+(.*)/i;

// Paragraph: § 1º, § 2º-B., etc.
const RE_PARAGRAFO =
  /^\s*§\s*(\d+[ºo°]?(?:-[A-Za-z]+)?)\s*[.\-–—]?\s*(.*)/i;

// Parágrafo único
const RE_PARAGRAFO_UNICO =
  /^\s*Par[áa]grafo\s+[úu]nico\s*[.\-–—]?\s*(.*)/i;

// Inciso: I -, II -, III -, IV -, ... (Roman numerals)
const RE_INCISO =
  /^\s*([IVXLCDM]+)\s*[–—-]\s*(.*)/;

// Alinea: a), b), c), ...
const RE_ALINEA =
  /^\s*([a-z])\)\s*(.*)/;

// Item: 1., 2., 3. (rare numbered sub-items)
const RE_ITEM =
  /^\s*(\d+)\.\s+(.*)/;

// Pena line: Pena - reclusão, ...
const RE_PENA =
  /^\s*Pena\s*[–—-]\s*(.*)/i;

// --- Hierarchy patterns ---
const RE_PARTE =
  /^\s*PARTE\s+(GERAL|ESPECIAL|PRELIMINAR|COMPLEMENTAR|[IVXLCDM]+)\s*(.*)/i;

const RE_LIVRO =
  /^\s*LIVRO\s+([IVXLCDM]+(?:\s+COMPLEMENTAR)?|COMPLEMENTAR|[ÚU]NICO)\s*(.*)/i;

const RE_TITULO =
  /^\s*T[ÍI]TULO\s+([IVXLCDM]+|[ÚU]NICO)\s*(.*)/i;

const RE_SUBTITULO =
  /^\s*SUBT[ÍI]TULO\s+([IVXLCDM]+|[ÚU]NICO)\s*(.*)/i;

const RE_CAPITULO =
  /^\s*CAP[ÍI]TULO\s+([IVXLCDM]+(?:-[A-Z]+)?|[ÚU]NICO)\s*(.*)/i;

const RE_SECAO =
  /^\s*Se[çc][ãa]o\s+([IVXLCDM]+|[ÚU]NICA)\s*(.*)/i;

const RE_SUBSECAO =
  /^\s*Subse[çc][ãa]o\s+([IVXLCDM]+|[ÚU]NICA)\s*(.*)/i;

// Preamble lines to skip
const RE_PREAMBULO_SKIP =
  /^(Presidência da República|Casa Civil|Subchefia|Brastra\.gif|Vigência$|\(Vide\s|O PRESIDENTE|Este texto não substitui)/i;

// --- Helpers ---

function stripAnnotations(text: string): { clean: string; anotacoes: string[] } {
  const anotacoes: string[] = [];
  let clean = text.replace(RE_ANOTACAO, (match) => {
    anotacoes.push(match.trim());
    return '';
  });
  // Clean up whitespace
  clean = clean.replace(/\s{2,}/g, ' ').trim();
  return { clean, anotacoes };
}

function normalizeOrdinal(num: string): string {
  return num.replace(/[o°]/g, 'º');
}

function makeArticleId(numero: string): string {
  const clean = normalizeOrdinal(numero);
  return `artigo-${clean}`;
}

function makeArticleSlug(numero: string): string {
  return makeArticleId(numero);
}

function isRevoked(text: string): boolean {
  return /^\s*\(?\s*Revogad[oa]\s*\)?\s*\.?\s*$/i.test(text) ||
    /^\s*\(Revogad[oa]\s+pel[oa]\s/i.test(text);
}

function isRevokedOrVetoed(textoOriginal: string, anotacoes: string[]): boolean {
  // Check the original text (before annotation stripping) for revogado/vetado
  if (isRevoked(textoOriginal)) return true;
  if (/^\s*\(?\s*VETAD[OA]\s*\)?\s*\.?\s*"?\s*$/i.test(textoOriginal)) return true;
  // Check if annotations contain revogado/vetado
  return anotacoes.some(a => /Revogad/i.test(a) && /^\s*\(?\s*Revogad/i.test(a));
}

function createEmptyHierarchyNode(
  tipo: HierarchyLevel | 'documento',
  titulo: string
): HierarchyNode {
  return {
    tipo,
    titulo,
    partes: [],
    livros: [],
    titulos: [],
    subtitulos: [],
    capitulos: [],
    secoes: [],
    subsecoes: [],
  };
}

// Maps hierarchy level to the property name in HierarchyNode
const LEVEL_CHILD_KEY: Record<HierarchyLevel, keyof HierarchyNode> = {
  parte: 'partes',
  livro: 'livros',
  titulo: 'titulos',
  subtitulo: 'subtitulos',
  capitulo: 'capitulos',
  secao: 'secoes',
  subsecao: 'subsecoes',
};

// Hierarchy depth order
const LEVEL_ORDER: HierarchyLevel[] = [
  'parte', 'livro', 'titulo', 'subtitulo', 'capitulo', 'secao', 'subsecao',
];

// --- Main parser ---

export function parsePlainText(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const elements: ParsedElement[] = [];
  const warnings: string[] = [];

  // Pass 1: Classify each line
  let inPreambulo = true;
  let foundFirstArticleOrHierarchy = false;
  let lastHierarchyHasDesc = false; // tracks if last hierarchy already got a description

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Skip preamble lines (before first hierarchy or article)
    if (inPreambulo) {
      if (RE_PREAMBULO_SKIP.test(trimmed)) continue;

      // Check if this starts the law content
      const isHierarchy = RE_PARTE.test(trimmed) || RE_LIVRO.test(trimmed) ||
        RE_TITULO.test(trimmed) || RE_CAPITULO.test(trimmed);
      const isArticle = RE_ARTIGO.test(trimmed);

      if (!isHierarchy && !isArticle && !foundFirstArticleOrHierarchy) {
        // Still in preamble — could be the law title or ementa
        elements.push({
          tipo: 'preambulo',
          numero: '',
          texto: trimmed,
          textoOriginal: trimmed,
          anotacoes: [],
          linha: lineNum,
          indent: 0,
        });
        continue;
      }
      inPreambulo = false;
      foundFirstArticleOrHierarchy = true;
    }

    // Try hierarchy patterns first
    const hierarchyResult = tryParseHierarchy(trimmed, lineNum);
    if (hierarchyResult) {
      elements.push(hierarchyResult);
      lastHierarchyHasDesc = hierarchyResult._hasInlineDesc ?? false;
      continue;
    }

    // Article
    const artMatch = RE_ARTIGO.exec(trimmed);
    if (artMatch) {
      const numero = normalizeOrdinal(artMatch[1]);
      const { clean, anotacoes } = stripAnnotations(artMatch[2]);
      elements.push({
        tipo: 'artigo',
        numero,
        texto: clean,
        textoOriginal: artMatch[2].trim(),
        anotacoes,
        linha: lineNum,
        indent: 0,
      });
      continue;
    }

    // Parágrafo único (before § to avoid conflicts)
    const parUnicoMatch = RE_PARAGRAFO_UNICO.exec(trimmed);
    if (parUnicoMatch) {
      const { clean, anotacoes } = stripAnnotations(parUnicoMatch[1]);
      elements.push({
        tipo: 'paragrafo_unico',
        numero: 'único',
        texto: clean,
        textoOriginal: parUnicoMatch[1].trim(),
        anotacoes,
        linha: lineNum,
        indent: 1,
      });
      continue;
    }

    // Parágrafo §
    const parMatch = RE_PARAGRAFO.exec(trimmed);
    if (parMatch) {
      const numero = normalizeOrdinal(parMatch[1]);
      const { clean, anotacoes } = stripAnnotations(parMatch[2]);
      elements.push({
        tipo: 'paragrafo',
        numero,
        texto: clean,
        textoOriginal: parMatch[2].trim(),
        anotacoes,
        linha: lineNum,
        indent: 1,
      });
      continue;
    }

    // Inciso
    const incisoMatch = RE_INCISO.exec(trimmed);
    if (incisoMatch) {
      const { clean, anotacoes } = stripAnnotations(incisoMatch[2]);
      elements.push({
        tipo: 'inciso',
        numero: incisoMatch[1],
        texto: clean,
        textoOriginal: incisoMatch[2].trim(),
        anotacoes,
        linha: lineNum,
        indent: 1,
      });
      continue;
    }

    // Alinea
    const alineaMatch = RE_ALINEA.exec(trimmed);
    if (alineaMatch) {
      const { clean, anotacoes } = stripAnnotations(alineaMatch[2]);
      elements.push({
        tipo: 'alinea',
        numero: alineaMatch[1],
        texto: clean,
        textoOriginal: alineaMatch[2].trim(),
        anotacoes,
        linha: lineNum,
        indent: 2,
      });
      continue;
    }

    // Item
    const itemMatch = RE_ITEM.exec(trimmed);
    if (itemMatch) {
      const { clean, anotacoes } = stripAnnotations(itemMatch[2]);
      elements.push({
        tipo: 'item',
        numero: itemMatch[1],
        texto: clean,
        textoOriginal: itemMatch[2].trim(),
        anotacoes,
        linha: lineNum,
        indent: 3,
      });
      continue;
    }

    // Pena
    const penaMatch = RE_PENA.exec(trimmed);
    if (penaMatch) {
      const { clean, anotacoes } = stripAnnotations(penaMatch[1]);
      elements.push({
        tipo: 'pena',
        numero: '',
        texto: clean,
        textoOriginal: penaMatch[1].trim(),
        anotacoes,
        linha: lineNum,
        indent: 1,
      });
      continue;
    }

    // Standalone annotation line (just an annotation, no content)
    if (/^\s*\((?:Reda[çc][ãa]o|Inclu[ií]d|Revogad|Vide|Vig[êe]ncia|Acrescid|Alterad|VETAD|Suprimi|Renumerad)/.test(trimmed)) {
      // Attach to previous element
      if (elements.length > 0) {
        const prev = elements[elements.length - 1];
        const { anotacoes } = stripAnnotations(trimmed);
        prev.anotacoes.push(...anotacoes);
        prev.textoOriginal += ' ' + trimmed;
      }
      continue;
    }

    // Hierarchy description on a separate line (LC 95/1998 convention)
    // e.g.: "Seção II\n(Incluído...)\nDas Competências\nArt. 8º-A."
    // Annotations are already attached to the hierarchy (lines above),
    // so elements[last] is still the hierarchy when we reach the description.
    // Rule: if last element is hierarchy AND it doesn't have a description yet,
    // treat this line as the hierarchy's description (not an epigraph).
    if (elements.length > 0 && !inPreambulo) {
      const lastEl = elements[elements.length - 1];
      if (lastEl.tipo === 'hierarchy' && !lastHierarchyHasDesc) {
        const { clean: descClean, anotacoes: descAnot } = stripAnnotations(trimmed);
        if (descClean.length > 0) {
          lastEl.texto += ' ' + descClean;
          lastEl.textoOriginal += ' ' + trimmed;
          if (descAnot.length > 0) {
            lastEl.anotacoes.push(...descAnot);
          }
          lastHierarchyHasDesc = true;
          continue;
        }
      }
    }

    // Possible epigraphe (title-case line, typically before an article)
    // Heuristic: short, starts with uppercase, NOT all caps (that's hierarchy desc)
    const isShort = trimmed.length < 120;
    const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
    const startsUpperCase = /^[A-ZÀ-Ú]/.test(trimmed);
    // After stripping annotations, should be short (< 80 chars)
    const { clean: cleanEpi, anotacoes: epiAnotacoes } = stripAnnotations(trimmed);
    const isShortAfterStrip = cleanEpi.length < 80;

    if (isShort && startsUpperCase && !isAllCaps && isShortAfterStrip && !inPreambulo) {
      elements.push({
        tipo: 'epigrafe',
        numero: '',
        texto: cleanEpi,
        textoOriginal: trimmed,
        anotacoes: epiAnotacoes,
        linha: lineNum,
        indent: 0,
      });
      continue;
    }

    // Footer/index detection — stop parsing
    if (/^[ÍI]NDICE\s*$/i.test(trimmed) ||
        /^Este texto não substitui/i.test(trimmed)) {
      break;
    }

    // Unclassified line — might be continuation or noise
    // If short and all caps, could be a hierarchy description we missed
    if (isAllCaps && isShort && elements.length > 0) {
      const prev = elements[elements.length - 1];
      if (prev.tipo === 'hierarchy') {
        // Append as description to previous hierarchy element
        prev.texto += ' ' + trimmed;
        prev.textoOriginal += ' ' + trimmed;
        lastHierarchyHasDesc = true;
        continue;
      }
    }

    // Fallback: treat as epigraphe if we haven't hit articles yet,
    // or as unclassified content
    if (elements.length > 0) {
      const { clean, anotacoes } = stripAnnotations(trimmed);
      elements.push({
        tipo: 'epigrafe',
        numero: '',
        texto: clean,
        textoOriginal: trimmed,
        anotacoes,
        linha: lineNum,
        indent: 0,
      });
    }
  }

  // Pass 2: Build hierarchy tree + assign articles to hierarchy paths
  const { hierarquia, articlePaths, hierarchyCounts } = buildHierarchy(elements);

  // Pass 3: Group elements into articles
  const artigos = groupIntoArticles(elements, articlePaths);

  // Summary
  const artigosRevogados = artigos.filter(a => !a.vigente).length;
  const articleWarnings = validateArticles(artigos);
  warnings.push(...articleWarnings);

  return {
    hierarquia,
    artigos,
    resumo: {
      totalArtigos: artigos.length,
      totalHierarquia: hierarchyCounts,
      artigosRevogados,
      warnings,
    },
  };
}

// --- Hierarchy parser ---

function tryParseHierarchy(line: string, lineNum: number): ParsedElement | null {
  const patterns: [RegExp, HierarchyLevel][] = [
    [RE_PARTE, 'parte'],
    [RE_LIVRO, 'livro'],
    [RE_TITULO, 'titulo'],
    [RE_SUBTITULO, 'subtitulo'],
    [RE_CAPITULO, 'capitulo'],
    [RE_SECAO, 'secao'],
    [RE_SUBSECAO, 'subsecao'],
  ];

  for (const [regex, nivel] of patterns) {
    const match = regex.exec(line);
    if (match) {
      // Reconstruct full title: "TÍTULO I DAS MODALIDADES..."
      const label = line.trim();
      // match[2] captures text after the number — if non-empty, description is inline
      const inlineDesc = (match[2] || '').trim();
      return {
        tipo: 'hierarchy',
        nivel,
        numero: match[1],
        texto: label,
        textoOriginal: label,
        anotacoes: [],
        linha: lineNum,
        indent: 0,
        _hasInlineDesc: inlineDesc.length > 0,
      };
    }
  }
  return null;
}

// --- Hierarchy tree builder ---

interface HierarchyBuildResult {
  hierarquia: HierarchyNode;
  articlePaths: Map<number, HierarchyPath>;
  hierarchyCounts: Record<HierarchyLevel, number>;
}

function buildHierarchy(elements: ParsedElement[]): HierarchyBuildResult {
  const root = createEmptyHierarchyNode('documento', 'documento');
  const articlePaths = new Map<number, HierarchyPath>();
  const counts: Record<HierarchyLevel, number> = {
    parte: 0, livro: 0, titulo: 0, subtitulo: 0,
    capitulo: 0, secao: 0, subsecao: 0,
  };

  // Current path state
  const currentPath: HierarchyPath = {};

  // Stack of parent nodes for nesting
  const stack: { level: HierarchyLevel; node: HierarchyNode }[] = [];

  function getParentForLevel(level: HierarchyLevel): HierarchyNode {
    const levelIdx = LEVEL_ORDER.indexOf(level);

    // Pop stack until we find a parent at a higher level
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const topIdx = LEVEL_ORDER.indexOf(top.level);
      if (topIdx < levelIdx) break;
      stack.pop();
    }

    return stack.length > 0 ? stack[stack.length - 1].node : root;
  }

  for (const el of elements) {
    if (el.tipo === 'hierarchy' && el.nivel) {
      const level = el.nivel;
      counts[level]++;

      const node = createEmptyHierarchyNode(level, el.texto);
      const parent = getParentForLevel(level);
      const childKey = LEVEL_CHILD_KEY[level];
      (parent[childKey] as HierarchyNode[]).push(node);

      stack.push({ level, node });

      // Update current path: set this level, clear all lower levels
      currentPath[level] = el.texto;
      const levelIdx = LEVEL_ORDER.indexOf(level);
      for (let i = levelIdx + 1; i < LEVEL_ORDER.length; i++) {
        delete currentPath[LEVEL_ORDER[i]];
      }
    } else if (el.tipo === 'artigo') {
      // Snapshot the current path for this article
      articlePaths.set(el.linha, { ...currentPath });
    }
  }

  return { hierarquia: root, articlePaths, hierarchyCounts: counts };
}

// --- Group elements into articles ---

function groupIntoArticles(
  elements: ParsedElement[],
  articlePaths: Map<number, HierarchyPath>
): ParsedArticle[] {
  const artigos: ParsedArticle[] = [];
  let currentArticle: ParsedArticle | null = null;
  let pendingEpigrafe = '';
  let pendingEpigrafeElements: ParsedElement[] = [];

  for (const el of elements) {
    // Skip preamble and hierarchy in article grouping
    if (el.tipo === 'preambulo' || el.tipo === 'hierarchy') {
      continue;
    }

    // Epigraphe: always buffer — we decide where it goes based on what comes NEXT
    if (el.tipo === 'epigrafe') {
      pendingEpigrafeElements.push(el);
      // Update the text for next article's epigrafe label
      pendingEpigrafe = pendingEpigrafe
        ? pendingEpigrafe + ' / ' + el.texto
        : el.texto;
      continue;
    }

    // New article boundary
    if (el.tipo === 'artigo') {
      // Finalize previous article
      if (currentArticle) {
        artigos.push(currentArticle);
      }

      const path = articlePaths.get(el.linha) || {};
      const contexto = Object.values(path).join(' > ');

      // Check original text (before strip) for Revogado/VETADO
      const vigente = !isRevokedOrVetoed(el.textoOriginal, el.anotacoes);

      currentArticle = {
        id: makeArticleId(el.numero),
        numero: el.numero,
        slug: makeArticleSlug(el.numero),
        epigrafe: pendingEpigrafe,
        elementos: [el],
        vigente,
        contexto,
        path,
      };
      pendingEpigrafe = '';
      pendingEpigrafeElements = [];
      continue;
    }

    // Sub-elements (§, inciso, alínea, item, pena) belong to current article
    if (currentArticle) {
      // If we have buffered epigraphes and the next thing is a sub-element,
      // they are internal epigraphes (e.g., "Homicídio culposo" before § 3º)
      if (pendingEpigrafeElements.length > 0) {
        for (const epi of pendingEpigrafeElements) {
          currentArticle.elementos.push(epi);
        }
        pendingEpigrafe = '';
        pendingEpigrafeElements = [];
      }

      currentArticle.elementos.push(el);

      // If the article was vigente but has some revoked sub-elements, keep vigente=true
      // Only mark vigente=false if the caput itself is revoked
    }
  }

  // Don't forget the last article
  if (currentArticle) {
    artigos.push(currentArticle);
  }

  return artigos;
}

// --- Validation ---

function validateArticles(artigos: ParsedArticle[]): string[] {
  const warnings: string[] = [];
  const seenIds = new Set<string>();

  for (const art of artigos) {
    // Check for duplicate IDs
    if (seenIds.has(art.id)) {
      warnings.push(`Artigo duplicado: ${art.id} (linha ${art.elementos[0]?.linha})`);
    }
    seenIds.add(art.id);

    // Check for empty articles
    if (art.elementos.length === 0) {
      warnings.push(`Artigo vazio: ${art.id}`);
    }

    // Check for articles without hierarchy context
    if (!art.contexto) {
      warnings.push(`Artigo sem contexto hierárquico: ${art.id}`);
    }
  }

  return warnings;
}

// --- Re-export for convenience ---
export { createEmptyHierarchyNode, LEVEL_ORDER, LEVEL_CHILD_KEY, normalizeOrdinal };
