// ============================================================
// TipTap JSON → Lei structured data
// Reads TipTap editor output and builds hierarchy + articles
// based on formatting:
//   - Centered text = hierarchy (PARTE, TÍTULO, CAPÍTULO, etc.)
//   - Bold prefix = label (Art., §, inciso, alínea)
//   - indent attribute = nesting level
// ============================================================

import type {
  HierarchyLevel,
  HierarchyNode,
  HierarchyPath,
  ParsedArticle,
  ParsedElement,
  ParsedElementType,
  ParseResult,
  PlateChild,
  PlateElement,
  ExportedArticle,
  ExportedLei,
} from '@/types/lei-import';

// --- Regex for classification ---

const RE_ARTIGO = /^Art\.?\s+(\d+(?:\.\d+)*[ºo°]?(?:-[A-Za-z]+)?)/i;
const RE_PARAGRAFO = /^§\s*(\d+[ºo°]?(?:-[A-Za-z]+)?)/i;
const RE_PARAGRAFO_UNICO = /^Par[áa]grafo\s+[úu]nico/i;
const RE_INCISO = /^([IVXLCDM]+)\s*[–—-]/;
const RE_ALINEA = /^([a-z])\)/;
const RE_ITEM = /^(\d+)\.\s/;
const RE_PENA = /^Pena\s*[–—-]/i;

const RE_ANOTACAO =
  /\((?:Reda[çc][ãa]o|Inclu[ií]d|Revogad|Vide|Vig[êe]ncia|Acrescid|Alterad|VETAD|Suprimi|Renumerad)[^)]*\)/gi;

// Hierarchy level detection from centered text
const RE_PARTE = /^PARTE\s+(GERAL|ESPECIAL|PRELIMINAR|COMPLEMENTAR|[IVXLCDM]+)/i;
const RE_LIVRO = /^LIVRO\s+([IVXLCDM]+|COMPLEMENTAR|[ÚU]NICO)/i;
const RE_TITULO_H = /^T[ÍI]TULO\s+([IVXLCDM]+|[ÚU]NICO)/i;
const RE_SUBTITULO = /^SUBT[ÍI]TULO\s+([IVXLCDM]+|[ÚU]NICO)/i;
const RE_CAPITULO = /^CAP[ÍI]TULO\s+([IVXLCDM]+(?:-[A-Z]+)?|[ÚU]NICO)/i;
const RE_SECAO = /^Se[çc][ãa]o\s+([IVXLCDM]+|[ÚU]NICA)/i;
const RE_SUBSECAO = /^Subse[çc][ãa]o\s+([IVXLCDM]+|[ÚU]NICA)/i;

const LEVEL_ORDER: HierarchyLevel[] = [
  'parte', 'livro', 'titulo', 'subtitulo', 'capitulo', 'secao', 'subsecao',
];

const LEVEL_CHILDREN_KEY: Record<HierarchyLevel, string> = {
  parte: 'partes',
  livro: 'livros',
  titulo: 'titulos',
  subtitulo: 'subtitulos',
  capitulo: 'capitulos',
  secao: 'secoes',
  subsecao: 'subsecoes',
};

// --- Helpers ---

function createEmptyNode(tipo: HierarchyLevel | 'documento', titulo: string): HierarchyNode {
  return {
    tipo, titulo,
    partes: [], livros: [], titulos: [], subtitulos: [],
    capitulos: [], secoes: [], subsecoes: [],
  };
}

function stripAnnotations(text: string): { clean: string; anotacoes: string[] } {
  const anotacoes: string[] = [];
  let clean = text.replace(RE_ANOTACAO, (match) => {
    anotacoes.push(match.trim());
    return '';
  });
  clean = clean.replace(/\s{2,}/g, ' ').trim();
  return { clean, anotacoes };
}

function normalizeOrdinal(num: string): string {
  return num.replace(/[o°]/g, 'º');
}

function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- TipTap node text extraction ---

interface TipTapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TipTapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, any> }[];
}

function getNodeText(node: TipTapNode): string {
  if (node.text) return node.text;
  if (!node.content) return '';
  return node.content.map(getNodeText).join('');
}

function getBoldPrefix(node: TipTapNode): string {
  if (!node.content) return '';
  let boldText = '';
  for (const child of node.content) {
    if (child.text && child.marks?.some(m => m.type === 'bold')) {
      boldText += child.text;
    } else {
      break; // Stop at first non-bold
    }
  }
  return boldText.trim();
}

function isCentered(node: TipTapNode): boolean {
  return node.attrs?.textAlign === 'center';
}

function isFullyBold(node: TipTapNode): boolean {
  if (!node.content) return false;
  const textNodes = node.content.filter(child => child.text);
  return textNodes.length > 0 && textNodes.every(child =>
    child.marks?.some(m => m.type === 'bold')
  );
}

function getIndent(node: TipTapNode): number {
  return node.attrs?.indent || 0;
}

// --- Detect hierarchy level from centered text ---

function detectHierarchyLevel(text: string): { level: HierarchyLevel; titulo: string } | null {
  const patterns: [RegExp, HierarchyLevel][] = [
    [RE_PARTE, 'parte'],
    [RE_LIVRO, 'livro'],
    [RE_TITULO_H, 'titulo'],
    [RE_SUBTITULO, 'subtitulo'],
    [RE_CAPITULO, 'capitulo'],
    [RE_SECAO, 'secao'],
    [RE_SUBSECAO, 'subsecao'],
  ];

  for (const [re, level] of patterns) {
    if (re.test(text.trim())) {
      return { level, titulo: text.trim() };
    }
  }

  // Centered but unrecognized — treat as epigraph, not hierarchy
  return null;
}

// --- Classify paragraph node ---

interface ClassifiedNode {
  type: ParsedElementType;
  numero: string;
  label: string;
  text: string;
  fullText: string;
  indent: number;
  hierLevel?: HierarchyLevel;
}

function classifyNode(node: TipTapNode): ClassifiedNode {
  const fullText = getNodeText(node);
  const trimmed = fullText.trim();
  const indent = getIndent(node);

  // Centered = hierarchy
  if (isCentered(node) && trimmed) {
    const hier = detectHierarchyLevel(trimmed);
    if (hier) {
      return {
        type: 'hierarchy',
        numero: '',
        label: trimmed,
        text: trimmed,
        fullText: trimmed,
        indent: 0,
        hierLevel: hier.level,
      };
    }
    // Centered but not a recognized keyword — hierarchy description (e.g. "DOS SERVIDORES PÚBLICOS")
    return { type: 'hierarchy', numero: '', label: '', text: trimmed, fullText: trimmed, indent: 0 };
  }

  // Article-level detection from text
  let m = trimmed.match(RE_ARTIGO);
  if (m) return { type: 'artigo', numero: normalizeOrdinal(m[1]), label: `Art. ${m[1]}`, text: trimmed.slice(m[0].length).replace(/^[.\s–—-]+/, '').trim(), fullText: trimmed, indent: 0 };

  m = trimmed.match(RE_PARAGRAFO_UNICO);
  if (m) return { type: 'paragrafo_unico', numero: 'único', label: 'Parágrafo único.', text: trimmed.slice(m[0].length).replace(/^[.\s]+/, '').trim(), fullText: trimmed, indent: indent || 1 };

  m = trimmed.match(RE_PARAGRAFO);
  if (m) return { type: 'paragrafo', numero: normalizeOrdinal(m[1]), label: `§ ${m[1]}`, text: trimmed.slice(m[0].length).replace(/^[.\s–—-]+/, '').trim(), fullText: trimmed, indent: indent || 1 };

  m = trimmed.match(RE_INCISO);
  if (m) return { type: 'inciso', numero: m[1], label: `${m[1]} -`, text: trimmed.slice(m[0].length).trim(), fullText: trimmed, indent: indent || 1 };

  m = trimmed.match(RE_ALINEA);
  if (m) return { type: 'alinea', numero: m[1], label: `${m[1]})`, text: trimmed.slice(m[0].length).trim(), fullText: trimmed, indent: indent || 2 };

  m = trimmed.match(RE_PENA);
  if (m) return { type: 'pena', numero: '', label: 'Pena -', text: trimmed.slice(m[0].length).trim(), fullText: trimmed, indent: indent || 1 };

  // Non-centered, fully bold, unrecognized — real epigrafe (bold label before article)
  if (isFullyBold(node) && trimmed) {
    return { type: 'epigrafe', numero: '', label: '', text: trimmed, fullText: trimmed, indent };
  }

  return { type: 'continuacao', numero: '', label: '', text: trimmed, fullText: trimmed, indent };
}

// ============================================================
// Main parser: TipTap JSON → ParseResult
// ============================================================

export function parseTipTapJson(doc: TipTapNode): ParseResult {
  const paragraphs = (doc.content || []).filter(n => n.type === 'paragraph');

  // --- Pass 1: Classify all nodes ---
  const classified = paragraphs.map(classifyNode);

  // --- Pass 2: Build hierarchy tree ---
  const root = createEmptyNode('documento', 'Documento');
  const hierStack: { level: HierarchyLevel; node: HierarchyNode }[] = [];
  const hierCounts: Record<HierarchyLevel, number> = {
    parte: 0, livro: 0, titulo: 0, subtitulo: 0, capitulo: 0, secao: 0, subsecao: 0,
  };

  // Current path for context
  const currentPath: HierarchyPath = {};

  function getParentForLevel(level: HierarchyLevel): HierarchyNode {
    const levelIdx = LEVEL_ORDER.indexOf(level);
    // Pop stack until we find a parent of higher level
    while (hierStack.length > 0) {
      const top = hierStack[hierStack.length - 1];
      if (LEVEL_ORDER.indexOf(top.level) < levelIdx) {
        return top.node;
      }
      hierStack.pop();
    }
    return root;
  }

  // Track hierarchy path at each classified index
  const pathAtIndex: HierarchyPath[] = [];

  for (const cls of classified) {
    if (cls.type === 'hierarchy' && cls.hierLevel) {
      const level = cls.hierLevel;
      hierCounts[level]++;

      const newNode = createEmptyNode(level, cls.text);
      const parent = getParentForLevel(level);
      const childKey = LEVEL_CHILDREN_KEY[level] as keyof HierarchyNode;
      (parent[childKey] as HierarchyNode[]).push(newNode);
      hierStack.push({ level, node: newNode });

      // Update current path
      currentPath[level] = cls.text;
      // Clear lower levels
      const levelIdx = LEVEL_ORDER.indexOf(level);
      for (let i = levelIdx + 1; i < LEVEL_ORDER.length; i++) {
        delete currentPath[LEVEL_ORDER[i]];
      }
    } else if (cls.type === 'hierarchy' && !cls.hierLevel) {
      // Hierarchy description (centered text after header) — append to last node
      if (hierStack.length > 0) {
        const lastNode = hierStack[hierStack.length - 1].node;
        lastNode.titulo += '\n' + cls.text;
        // Also update path to include description
        const lastLevel = hierStack[hierStack.length - 1].level;
        currentPath[lastLevel] = lastNode.titulo;
      }
    }
    pathAtIndex.push({ ...currentPath });
  }

  // --- Pass 3: Group into articles ---
  const articles: ParsedArticle[] = [];
  let currentArticle: ParsedArticle | null = null;
  let currentEpigrafe = '';

  for (let i = 0; i < classified.length; i++) {
    const cls = classified[i];
    const path = pathAtIndex[i];

    if (cls.type === 'hierarchy') continue; // Already processed

    if (cls.type === 'epigrafe') {
      currentEpigrafe = cls.text;
      continue;
    }

    const { anotacoes } = stripAnnotations(cls.fullText);
    const { clean: textoLimpo } = stripAnnotations(cls.text || cls.fullText);
    const isRevoked = /\(Revogad[oa][^)]*\)/i.test(cls.fullText);

    const element: ParsedElement = {
      tipo: cls.type,
      nivel: cls.hierLevel,
      numero: cls.numero,
      texto: textoLimpo,
      textoOriginal: cls.fullText,
      anotacoes,
      linha: i,
      indent: cls.indent,
    };

    if (cls.type === 'artigo') {
      // Save previous
      if (currentArticle) articles.push(currentArticle);

      const id = `artigo-${normalizeOrdinal(cls.numero)}`;
      currentArticle = {
        id,
        numero: normalizeOrdinal(cls.numero),
        slug: id,
        epigrafe: currentEpigrafe,
        elementos: [element],
        vigente: !isRevoked,
        contexto: Object.values(path).filter(Boolean).join(' > '),
        path,
      };
      currentEpigrafe = '';
    } else if (currentArticle) {
      currentArticle.elementos.push(element);
      if (isRevoked) currentArticle.vigente = false;
    }
    // Elements before first article are ignored (preamble)
  }

  // Push last article
  if (currentArticle) articles.push(currentArticle);

  // --- Build summary ---
  const warnings: string[] = [];
  if (articles.length === 0) warnings.push('Nenhum artigo detectado.');
  if (hierCounts.parte === 0 && hierCounts.titulo === 0 && hierCounts.capitulo === 0) {
    warnings.push('Nenhuma hierarquia detectada. Centralize os títulos de PARTE, TÍTULO, CAPÍTULO, etc.');
  }

  return {
    hierarquia: root,
    artigos: articles,
    resumo: {
      totalArtigos: articles.length,
      totalHierarquia: hierCounts,
      artigosRevogados: articles.filter(a => !a.vigente).length,
      warnings,
    },
  };
}

// ============================================================
// Convert ParseResult → ExportedLei (for Supabase upload)
// Same format as lei-to-plate.ts output
// ============================================================

export function convertTipTapToExport(
  parseResult: ParseResult,
  leiId: string,
): ExportedLei {
  const exportedArticles: ExportedArticle[] = parseResult.artigos.map(art => {
    const plateContent: PlateElement[] = art.elementos.map((el, idx) => {
      const children: PlateChild[] = [];

      // Build bold label + normal text
      if (el.tipo === 'artigo') {
        children.push({ text: `Art. ${art.numero} `, bold: true });
        if (el.texto) children.push({ text: el.texto });
      } else if (el.tipo === 'paragrafo_unico') {
        children.push({ text: 'Parágrafo único. ', bold: true });
        if (el.texto) children.push({ text: el.texto });
      } else if (el.tipo === 'paragrafo') {
        children.push({ text: `§ ${el.numero} `, bold: true });
        if (el.texto) children.push({ text: el.texto });
      } else if (el.tipo === 'inciso') {
        children.push({ text: `${el.numero} - `, bold: true });
        if (el.texto) children.push({ text: el.texto });
      } else if (el.tipo === 'alinea') {
        children.push({ text: `${el.numero}) `, bold: true });
        if (el.texto) children.push({ text: el.texto });
      } else if (el.tipo === 'pena') {
        children.push({ text: 'Pena - ', bold: true });
        if (el.texto) children.push({ text: el.texto });
      } else if (el.tipo === 'epigrafe') {
        children.push({ text: el.texto, bold: true });
      } else {
        children.push({ text: el.texto });
      }

      const slug = `${leiId}-${art.slug}-${idx}`;
      const searchText = normalizeSearchText(children.map(c => c.text).join(''));

      return {
        type: 'p' as const,
        children,
        id: `${art.id}-${idx}`,
        slug,
        urn: slug,
        search_text: searchText,
        texto_original: el.anotacoes.length > 0 ? el.textoOriginal : null,
        anotacoes: el.anotacoes.length > 0 ? el.anotacoes : null,
        indent: el.indent > 0 ? el.indent : undefined,
      };
    });

    const textoPlano = art.elementos.map(e => e.texto).join('\n');
    const searchText = normalizeSearchText(textoPlano);

    return {
      id: `${leiId}-${art.slug}`,
      numero: art.numero,
      slug: `${leiId}-${art.slug}`,
      epigrafe: art.epigrafe,
      plate_content: plateContent,
      texto_plano: textoPlano,
      search_text: searchText,
      vigente: art.vigente,
      contexto: art.contexto,
      path: art.path,
      content_hash: simpleHash(textoPlano),
      revoked_versions: [],
    };
  });

  return {
    lei: { hierarquia: parseResult.hierarquia },
    artigos: exportedArticles,
  };
}
