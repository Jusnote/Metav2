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
  return treeNodes.map(node => {
    const children = node.children
      ? injectArtigosIntoTree(node.children, dispositivos, expandedIds)
      : undefined

    if (expandedIds.has(node.id)) {
      // Strip disambiguation suffix for path matching
      const cleanPath = node.id.replace(/--\d+$/, '')

      // Only inject in leaf structural nodes (no structural sub-children)
      const hasStructuralChildren = children?.some(c => c.type !== 'artigo') ?? false
      if (hasStructuralChildren) {
        return { ...node, children }
      }

      // Match artigos whose path exactly equals this node's path
      // (artigos share the path of their deepest structural ancestor)
      const artigos = dispositivos
        .filter(d => d.tipo === 'ARTIGO' && d.path === cleanPath)
        .map((d) => ({
          id: `artigo-${d.id}`,
          type: 'artigo' as const,
          label: `Art. ${d.numero ?? '?'}`,
          preview: d.texto.slice(0, 60),
          artigoIndex: dispositivos.indexOf(d),
          children: undefined,
        }))

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
