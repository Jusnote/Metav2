import type { HierarquiaNode, Dispositivo } from '@/types/lei-api'
import type { LeiTreeNode } from '@/components/ui/lei-tree'

// ---- Map API hierarchy → LeiTree data ----
// Builds full paths by accumulating parent paths during recursion.
// API hierarquia paths are relative slugs (e.g. "titulo-i"), but
// dispositivo paths are absolute with longer slugs (e.g. "parte-geral/titulo-i-da-aplicacao-da-lei-penal").
// We store the short relative slug as id for tree keys.

export function hierarquiaToTreeNodes(nodes: HierarquiaNode[], parentPath = ''): LeiTreeNode[] {
  const seen = new Map<string, number>()
  return nodes.map((node) => {
    // Build a full path for this node (relative slugs accumulated)
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
// Match strategy: dispositivo.path uses long slugs (titulo-i-da-aplicacao-da-lei-penal)
// while hierarchy uses short slugs (titulo-i). We match by checking if a dispositivo.path
// segment STARTS WITH the hierarchy slug.

function matchDispositivoToNode(
  dPath: string,
  nodeId: string
): boolean {
  // Strip disambiguation suffix
  const cleanNodeId = nodeId.replace(/--\d+$/, '')
  const nodeParts = cleanNodeId.split('/')
  const dParts = dPath.split('/')

  // The dispositivo path must have at least as many segments as the node
  if (dParts.length < nodeParts.length) return false

  // Each node segment must match the start of the corresponding dispositivo segment,
  // followed by "-" (longer slug) or exact match.
  // e.g. "titulo-i" matches "titulo-i-da-aplicacao-da-lei-penal" (followed by "-")
  // but "titulo-i" must NOT match "titulo-ii-do-crime" (followed by "i", not "-")
  for (let i = 0; i < nodeParts.length; i++) {
    const nSeg = nodeParts[i]
    const dSeg = dParts[i]
    if (dSeg !== nSeg && !dSeg.startsWith(nSeg + '-')) return false
  }

  return true
}

function isDirectChildOf(
  dPath: string,
  nodeId: string
): boolean {
  const cleanNodeId = nodeId.replace(/--\d+$/, '')
  const nodeParts = cleanNodeId.split('/')
  const dParts = dPath.split('/')

  // Direct child: dispositivo path has exactly same number of segments as node
  // (artigos share the path of their parent título/capítulo)
  if (dParts.length !== nodeParts.length) return false

  return matchDispositivoToNode(dPath, nodeId)
}

export function injectArtigosIntoTree(
  treeNodes: LeiTreeNode[],
  dispositivos: Dispositivo[],
  expandedIds: Set<string>
): LeiTreeNode[] {
  return treeNodes.map(node => {
    const children = node.children
      ? injectArtigosIntoTree(node.children, dispositivos, expandedIds)
      : undefined

    if (expandedIds.has(node.id)) {
      // Only inject artigos if this is a leaf structural node (no structural children)
      // or all children are artigos. This prevents artigos appearing at every level.
      const hasStructuralChildren = children?.some(c => c.type !== 'artigo') ?? false

      let artigos: LeiTreeNode[] = []
      if (!hasStructuralChildren) {
        // Leaf node: inject all artigos that match this node's path
        artigos = dispositivos
          .filter(d => d.tipo === 'ARTIGO' && d.path && isDirectChildOf(d.path, node.id))
          .map((d) => ({
            id: `artigo-${d.id}`,
            type: 'artigo' as const,
            label: `Art. ${d.numero ?? '?'}`,
            preview: d.texto.slice(0, 60),
            artigoIndex: dispositivos.indexOf(d),
            children: undefined,
          }))
      }

      if (artigos.length > 0) {
        return {
          ...node,
          children: [...(children ?? []), ...artigos],
        }
      }
    }

    return { ...node, children }
  })
}

// ---- Breadcrumb resolution ----
// Match dispositivo.path segments against hierarchy node paths using fuzzy prefix matching.

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

  const dParts = dispositivo.path.split('/')
  const segments: BreadcrumbSegment[] = []

  // Walk hierarchy depth-first, matching each dispositivo path segment
  let currentNodes = hierarquia
  for (const dPart of dParts) {
    // Find hierarchy node whose slug matches this dispositivo path segment
    // Must be exact or followed by "-" to avoid titulo-i matching titulo-ii
    const match = currentNodes.find(n => dPart === n.path || dPart.startsWith(n.path + '-'))
    if (match) {
      segments.push({
        label: match.descricao + (match.subtitulo ? ` — ${match.subtitulo}` : ''),
        path: match.path,
      })
      currentNodes = match.filhos ?? []
    }
  }

  return segments
}

// ---- Resolve tree node path → dispositivo posicao ----

export function resolvePathToPosicao(
  path: string,
  dispositivos: Dispositivo[]
): number | null {
  const cleanPath = path.replace(/--\d+$/, '')
  const match = dispositivos.find(d => d.path && matchDispositivoToNode(d.path, cleanPath))
  return match?.posicao ?? null
}
