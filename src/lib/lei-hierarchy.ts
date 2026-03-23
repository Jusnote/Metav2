import type { HierarquiaNode, Dispositivo } from '@/types/lei-api'
import type { LeiTreeNode } from '@/components/ui/lei-tree'

// ---- Map API hierarchy → LeiTree data ----

export function hierarquiaToTreeNodes(nodes: HierarquiaNode[]): LeiTreeNode[] {
  return nodes.map((node) => ({
    id: node.path,
    type: node.tipo.toLowerCase() as LeiTreeNode['type'],
    badge: node.descricao,
    label: node.descricao,
    sublabel: node.subtitulo,
    children: node.filhos?.length ? hierarquiaToTreeNodes(node.filhos) : undefined,
  }))
}

// ---- Inject artigos as leaf nodes when a branch is expanded ----

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
      const artigos = dispositivos
        .filter(d => d.tipo === 'ARTIGO' && d.path?.startsWith(node.id + '/'))
        .map((d, _i, arr) => ({
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

  const segments: BreadcrumbSegment[] = []
  const pathParts = dispositivo.path.split('/')

  let currentNodes = hierarquia
  let currentPath = ''

  for (const part of pathParts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part
    const match = currentNodes.find(n => n.path === currentPath)
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
  const match = dispositivos.find(d => d.path?.startsWith(path))
  return match?.posicao ?? null
}
