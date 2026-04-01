// scripts/lei-pipeline/lib/hierarchy-builder.js
//
// Builds a hierarchy tree and path map from structural items.

const HIERARCHY_LEVEL = {
  PARTE: 0, LIVRO: 1, TITULO: 2, CAPITULO: 3, SECAO: 4, SUBSECAO: 5,
};

const LEVEL_TO_TIPO = {
  PARTE: 'parte', LIVRO: 'livro', TITULO: 'titulo',
  CAPITULO: 'capitulo', SECAO: 'secao', SUBSECAO: 'subsecao',
};

const LEVEL_ORDER = ['PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO'];

const STRUCTURAL_TYPES = new Set(LEVEL_ORDER);

/**
 * Slugify a structural description for path segments.
 * E.g., "PARTE GERAL" → "parte-geral", "CAPÍTULO I" → "capitulo-i"
 * @param {string} text
 * @returns {string}
 */
function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Builds a hierarchy tree from structural items.
 *
 * @param {Array<{type: string, description: string, subtitle: string|null, index: number}>} structural
 * @returns {Array<{tipo: string, descricao: string, subtitulo: string|null, path: string, filhos: Array}>}
 */
export function buildHierarchy(structural) {
  const root = [];
  const stack = []; // { level, node, children_ref }

  for (const item of structural) {
    const levelIdx = HIERARCHY_LEVEL[item.type];
    if (levelIdx === undefined) continue;

    // Path slug must include subtitle (when present) to match buildPathMap behavior.
    // buildPathMap generates: "titulo-i-da-aplicacao-da-lei-penal" (description + subtitle)
    // so hierarchy must use the same slug, not just "titulo-i" (description only).
    const pathLabel = item.subtitle
      ? `${item.description} ${item.subtitle}`
      : item.description;
    const node = {
      tipo: LEVEL_TO_TIPO[item.type] || item.type.toLowerCase(),
      descricao: item.description,
      subtitulo: item.subtitle || null,
      path: slugify(pathLabel),
      filhos: [],
    };

    // Pop stack until we find a parent at a lower level
    while (stack.length > 0 && stack[stack.length - 1].level >= levelIdx) {
      stack.pop();
    }

    if (stack.length > 0) {
      // Add as child of the current parent
      const parent = stack[stack.length - 1];
      parent.node.filhos.push(node);
    } else {
      // Top-level node
      root.push(node);
    }

    stack.push({ level: levelIdx, node });
  }

  return root;
}

/**
 * Builds a path map: item index → path string (e.g., "parte-geral/livro-i/titulo-i/capitulo-i").
 *
 * Walks through all items, tracking the current structural context.
 * Each content item (ARTIGO, PARAGRAFO, etc.) gets the path of its enclosing structure.
 *
 * @param {Array<{type: string, description: string, index: number}>} structural
 * @param {Array<{type: string, description: string, index: number}>} allItems
 * @returns {Map<number, string>}
 */
export function buildPathMap(structural, allItems) {
  const pathMap = new Map();
  const currentSegments = {}; // type → slug
  const structuralByIndex = new Map(structural.map(s => [s.index, s]));

  for (const item of allItems) {
    if (STRUCTURAL_TYPES.has(item.type)) {
      const s = structuralByIndex.get(item.index);
      const label = s?.subtitle
        ? `${item.description} ${s.subtitle}`
        : item.description;
      currentSegments[item.type] = slugify(label);

      // Clear lower-level segments (e.g., entering a new TITULO clears CAPITULO, SECAO, SUBSECAO)
      const levelIdx = LEVEL_ORDER.indexOf(item.type);
      for (let i = levelIdx + 1; i < LEVEL_ORDER.length; i++) {
        delete currentSegments[LEVEL_ORDER[i]];
      }
    }

    // Build path from all active segments in level order
    const segments = LEVEL_ORDER
      .filter(t => currentSegments[t])
      .map(t => currentSegments[t]);
    const path = segments.join('/');

    pathMap.set(item.index, path);
  }

  return pathMap;
}
