import type { HierarquiaNode, Dispositivo } from '@/types/lei-api'
import type { LeiTreeNode } from '@/components/ui/lei-tree'

// ---- Map API hierarchy → LeiTree data ----
// Hierarchy paths now match dispositivo paths exactly (both use description+subtitle slugs).
// We build full accumulated paths during recursion for tree node IDs.

export function hierarquiaToTreeNodes(nodes: HierarquiaNode[], parentPath = ''): LeiTreeNode[] {
  const seen = new Map<string, number>()
  return nodes.map((node) => {
    const fullPath = parentPath ? `${parentPath}/${node.path}` : node.path
    // Disambiguate duplicate paths at same level
    const count = seen.get(fullPath) ?? 0
    seen.set(fullPath, count + 1)
    const id = count === 0 ? fullPath : `${fullPath}--${count}`

    return {
      id,
      type: node.tipo.toLowerCase() as LeiTreeNode['type'],
      badge: node.descricao,
      label: node.descricao,
      sublabel: node.subtitulo,
      children: node.filhos?.length ? hierarquiaToTreeNodes(node.filhos, fullPath) : undefined,
    }
  })
}

// ---- Inject artigos as leaf nodes when a branch is expanded ----
// Now that hierarchy paths and dispositivo paths match exactly,
// we use straightforward startsWith matching.

export function injectArtigosIntoTree(
  treeNodes: LeiTreeNode[],
  dispositivos: Dispositivo[],
  expandedIds: Set<string>
): LeiTreeNode[] {
  // Build index once: path → artigos (O(m) upfront, O(1) per lookup)
  const artigosByPath = buildArtigoIndex(dispositivos)

  return _injectArtigos(treeNodes, artigosByPath, expandedIds)
}

// Pre-built index: Map<path, {id, numero, texto, epigrafe, globalIndex}[]>
type ArtigoEntry = { id: string; numero: string | null; texto: string; epigrafe: string | null; globalIndex: number }
let _cachedDispositivos: Dispositivo[] | null = null
let _cachedIndex: Map<string, ArtigoEntry[]> | null = null

function buildArtigoIndex(dispositivos: Dispositivo[]): Map<string, ArtigoEntry[]> {
  // Cache: same dispositivos array → same index (referential equality)
  if (_cachedDispositivos === dispositivos && _cachedIndex) return _cachedIndex

  const map = new Map<string, ArtigoEntry[]>()
  for (let i = 0; i < dispositivos.length; i++) {
    const d = dispositivos[i]
    if (d.tipo !== 'ARTIGO' || !d.path) continue
    let arr = map.get(d.path)
    if (!arr) { arr = []; map.set(d.path, arr) }
    arr.push({ id: d.id, numero: d.numero, texto: d.texto, epigrafe: d.epigrafe, globalIndex: i })
  }
  _cachedDispositivos = dispositivos
  _cachedIndex = map
  return map
}

function _injectArtigos(
  treeNodes: LeiTreeNode[],
  artigosByPath: Map<string, ArtigoEntry[]>,
  expandedIds: Set<string>
): LeiTreeNode[] {
  return treeNodes.map(node => {
    const children = node.children
      ? _injectArtigos(node.children, artigosByPath, expandedIds)
      : undefined

    const cleanPath = node.id.replace(/--\d+$/, '')
    const isLeaf = !children || children.length === 0
    const isExpanded = expandedIds.has(node.id)
    const pathArtigos = artigosByPath.get(cleanPath)
    const hasArtigos = pathArtigos && pathArtigos.length > 0

    if (isLeaf) {
      if (hasArtigos && !isExpanded) {
        return {
          ...node,
          children: [{
            id: `${node.id}--placeholder`,
            type: 'artigo' as const,
            label: 'Expandir para ver artigos...',
            children: undefined,
          }],
        }
      }

      if (hasArtigos && isExpanded) {
        return {
          ...node,
          children: pathArtigos.map(a => ({
            id: `artigo-${a.id}`,
            type: 'artigo' as const,
            label: `Art. ${a.numero ?? '?'}`,
            preview: a.texto.slice(0, 60),
            artigoIndex: a.globalIndex,
            children: undefined,
          })),
        }
      }
    }

    if (isExpanded && hasArtigos) {
      const hasStructuralChildren = children?.some(c => c.type !== 'artigo') ?? false
      if (!hasStructuralChildren) {
        const artigos = pathArtigos.map(a => ({
          id: `artigo-${a.id}`,
          type: 'artigo' as const,
          label: `Art. ${a.numero ?? '?'}`,
          preview: a.texto.slice(0, 60),
          artigoIndex: a.globalIndex,
          children: undefined,
        }))
        if (artigos.length > 0) {
          return {
            ...node,
            children: [...(children ?? []), ...artigos],
          }
        }
      }
    }

    return { ...node, children }
  })
}

// ---- Breadcrumb resolution ----

export interface BreadcrumbSegment {
  label: string
  path: string
}

export function resolveBreadcrumb(
  dispositivos: Dispositivo[],
  activeIndex: number,
  hierarquia: HierarquiaNode[]
): BreadcrumbSegment[] {
  const dispositivo = dispositivos[activeIndex]
  if (!dispositivo?.path) {
    if (dispositivo?.numero) {
      return [{ label: `Art. ${dispositivo.numero}`, path: '' }]
    }
    return []
  }

  // Walk hierarchy, matching each level by comparing accumulated paths
  const segments: BreadcrumbSegment[] = []
  function walk(nodes: HierarquiaNode[], parentPath: string) {
    for (const node of nodes) {
      const fullPath = parentPath ? `${parentPath}/${node.path}` : node.path
      // Check if the dispositivo path starts with this node's full path
      if (dispositivo.path === fullPath || dispositivo.path!.startsWith(fullPath + '/')) {
        segments.push({
          label: node.descricao + (node.subtitulo ? ` — ${node.subtitulo}` : ''),
          path: fullPath,
        })
        if (node.filhos?.length) {
          walk(node.filhos, fullPath)
        }
        return // Only one match per level
      }
    }
  }
  walk(hierarquia, '')

  return segments
}

// ---- Resolve tree node path → dispositivo posicao ----

export function resolvePathToPosicao(
  path: string,
  dispositivos: Dispositivo[]
): number | null {
  const cleanPath = path.replace(/--\d+$/, '')
  // Find first dispositivo whose path matches or is under this node
  const match = dispositivos.find(d =>
    d.path === cleanPath || d.path?.startsWith(cleanPath + '/')
  )
  return match?.posicao ?? null
}

// ---- Active path resolution (for auto-expand) ----

/**
 * Given the active artigo index, find all ancestor tree node IDs
 * that must be expanded to make the active artigo visible in the tree.
 * Returns a Set<string> of node IDs (accumulated paths).
 */
export function resolveActivePathIds(
  dispositivos: Dispositivo[],
  activeIndex: number,
  hierarquia: HierarquiaNode[]
): Set<string> {
  const ids = new Set<string>()
  const dispositivo = dispositivos[activeIndex]
  if (!dispositivo?.path) return ids

  function walk(nodes: HierarquiaNode[], parentPath: string) {
    for (const node of nodes) {
      const fullPath = parentPath ? `${parentPath}/${node.path}` : node.path
      if (dispositivo.path === fullPath || dispositivo.path!.startsWith(fullPath + '/')) {
        ids.add(fullPath)
        if (node.filhos?.length) {
          walk(node.filhos, fullPath)
        }
        return
      }
    }
  }
  walk(hierarquia, '')
  return ids
}

// ---- Shared constants ----

/** Mapping from LeiTreeNode.type to display label */
export const TYPE_LABELS: Record<string, string> = {
  parte: 'Parte',
  livro: 'Livro',
  titulo: 'Tít',
  subtitulo: 'Subtít',
  capitulo: 'Cap',
  secao: 'Seç',
  subsecao: 'Subseç',
}
