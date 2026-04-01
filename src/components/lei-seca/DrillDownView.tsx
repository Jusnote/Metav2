"use client"

import { useState, useCallback, useMemo } from 'react'
import { useActiveArtigoIndex } from '@/stores/activeArtigoStore'
import { hierarquiaToTreeNodes, TYPE_LABELS } from '@/lib/lei-hierarchy'
import type { LeiTreeNode } from '@/components/ui/lei-tree'
import type { HierarquiaNode, Dispositivo } from '@/types/lei-api'

const ABBREV_LABELS: Record<string, string> = {
  parte: 'Parte',
  livro: 'Livro',
  titulo: 'Tít.',
  subtitulo: 'Subtít.',
  capitulo: 'Cap.',
  secao: 'Seç.',
  subsecao: 'Sub.',
}

interface DrillDownViewProps {
  hierarquia: HierarquiaNode[]
  dispositivos: Dispositivo[]
  input: string
  onSelectHit: (posicao: number) => void
  onSelectArtigo: (artigoIndex: number) => void
}

function formatCount(node: LeiTreeNode, dispositivos: Dispositivo[]): string {
  const sections = (node.children ?? []).filter(c => c.type !== 'artigo').length
  const cleanPath = node.id.replace(/--\d+$/, '')
  const artigoCount = dispositivos.filter(d => d.tipo === 'ARTIGO' && d.path === cleanPath).length
  const parts: string[] = []
  if (sections > 0) parts.push(`${sections} ${sections === 1 ? 'item' : 'itens'}`)
  if (artigoCount > 0) parts.push(`${artigoCount} art.`)
  return parts.join(' · ') || ''
}

function findNodeAtPath(tree: LeiTreeNode[], drillPath: string[]): LeiTreeNode | null {
  if (drillPath.length === 0) return null
  let current: LeiTreeNode | null = null
  let nodes = tree
  for (const id of drillPath) {
    current = nodes.find(n => n.id === id) ?? null
    if (!current) return null
    nodes = current.children ?? []
  }
  return current
}

function findPathToActive(
  tree: LeiTreeNode[],
  dispositivos: Dispositivo[],
  activeIndex: number
): string[] {
  const dispositivo = dispositivos[activeIndex]
  if (!dispositivo?.path) return []

  const path: string[] = []
  function walk(nodes: LeiTreeNode[]): boolean {
    for (const node of nodes) {
      if (node.type === 'artigo') continue
      const cleanPath = node.id.replace(/--\d+$/, '')
      if (dispositivo.path === cleanPath || dispositivo.path!.startsWith(cleanPath + '/')) {
        path.push(node.id)
        if (node.children?.length) {
          walk(node.children)
        }
        return true
      }
    }
    return false
  }
  walk(tree)
  return path.length > 1 ? path.slice(0, -1) : []
}

function flatFilter(nodes: LeiTreeNode[], query: string): LeiTreeNode[] {
  const lower = query.toLowerCase()
  const results: LeiTreeNode[] = []
  function walk(items: LeiTreeNode[]) {
    for (const node of items) {
      if (node.type !== 'artigo') {
        if (node.label?.toLowerCase().includes(lower) || node.sublabel?.toLowerCase().includes(lower)) {
          results.push(node)
        }
      }
      if (node.children) walk(node.children)
    }
  }
  walk(nodes)
  return results
}

export function DrillDownView({
  hierarquia,
  dispositivos,
  input,
  onSelectHit,
  onSelectArtigo,
}: DrillDownViewProps) {
  const activeIndex = useActiveArtigoIndex()

  const tree = useMemo(
    () => hierarquiaToTreeNodes(hierarquia),
    [hierarquia]
  )

  const [drillPath, setDrillPath] = useState<string[]>(() =>
    findPathToActive(tree, dispositivos, activeIndex)
  )

  const currentNode = useMemo(
    () => findNodeAtPath(tree, drillPath),
    [tree, drillPath]
  )

  const children = useMemo(() => {
    if (!currentNode) return tree.filter(n => n.type !== 'artigo')
    return (currentNode.children ?? []).filter(n => n.type !== 'artigo')
  }, [currentNode, tree])

  const artigos = useMemo(() => {
    const targetPath = currentNode ? currentNode.id.replace(/--\d+$/, '') : null
    if (!targetPath) return []
    return dispositivos
      .map((d, i) => ({ ...d, _index: i }))
      .filter(d => d.tipo === 'ARTIGO' && d.path === targetPath)
  }, [currentNode, dispositivos])

  const filteredNodes = useMemo(() => {
    if (!input) return null
    return flatFilter(tree, input)
  }, [tree, input])

  const handleDrill = useCallback((nodeId: string) => {
    setDrillPath(prev => [...prev, nodeId])
  }, [])

  const handleBack = useCallback(() => {
    setDrillPath(prev => prev.slice(0, -1))
  }, [])

  // When searching: show flat filtered list
  if (filteredNodes) {
    if (filteredNodes.length === 0) {
      return (
        <div className="px-3 py-4 text-center text-[11px] text-[#b0c0b5] font-light">
          Nenhum item na estrutura
        </div>
      )
    }
    return (
      <div role="listbox" aria-label="Navegação na hierarquia">
        {filteredNodes.map(node => (
          <button
            key={node.id}
            onClick={() => {
              const cleanPath = node.id.replace(/--\d+$/, '')
              const match = dispositivos.find(d => d.path === cleanPath || d.path?.startsWith(cleanPath + '/'))
              if (match) onSelectHit(match.posicao)
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[rgba(22,163,74,0.04)] transition-colors"
          >
            <div className="w-7 h-7 rounded-[7px] bg-[rgba(22,163,74,0.06)] flex items-center justify-center text-[9px] font-semibold text-[#16a34a] shrink-0">
              {TYPE_LABELS[node.type] ?? '?'}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-medium text-[#3a4a40] truncate">{node.label}</div>
              {node.sublabel && (
                <div className="text-[10.5px] text-[#8a9a8f] font-light truncate">{node.sublabel}</div>
              )}
            </div>
          </button>
        ))}
      </div>
    )
  }

  // Normal drill-down view
  return (
    <div role="listbox" aria-label="Navegação na hierarquia">
      {/* Path breadcrumb */}
      {drillPath.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-2 mx-[10px] mt-[6px] mb-1 bg-[rgba(22,163,74,0.04)] rounded-lg overflow-x-auto text-[10px] text-[#8a9a8f]" style={{ whiteSpace: 'nowrap' }}>
          {drillPath.map((id, i) => {
            const node = findNodeAtPath(tree, drillPath.slice(0, i + 1))
            if (!node) return null
            return (
              <span key={id} className="flex items-center gap-1">
                {i > 0 && <span className="text-[8px] text-[#c5d4c9]">›</span>}
                <span className={i === drillPath.length - 1 ? 'text-[#16a34a] font-medium' : ''}>
                  {ABBREV_LABELS[node.type] ?? ''} {node.label?.split(' — ')[0]?.split(' ').slice(-1)[0] ?? ''}
                </span>
              </span>
            )
          })}
        </div>
      )}

      {/* Back button */}
      {drillPath.length > 0 && (
        <button
          onClick={handleBack}
          className="flex items-center gap-1 px-3 py-1 text-[10px] text-[#16a34a] font-medium"
        >
          ← {currentNode?.sublabel || currentNode?.label || 'Voltar'}
        </button>
      )}

      {/* Child items */}
      {children.map(node => {
        const count = formatCount(node, dispositivos)
        return (
          <button
            key={node.id}
            onClick={() => handleDrill(node.id)}
            className="w-full flex items-center gap-2 px-3 py-2 mx-[6px] rounded-lg text-left hover:bg-[rgba(22,163,74,0.03)] border border-transparent hover:border-[rgba(22,163,74,0.06)] transition-colors"
            style={{ width: 'calc(100% - 12px)' }}
          >
            <div className="w-7 h-7 rounded-[7px] bg-[rgba(22,163,74,0.06)] flex items-center justify-center text-[9px] font-semibold text-[#16a34a] shrink-0">
              {TYPE_LABELS[node.type] ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-[#3a4a40] truncate">
                {node.sublabel ? `${node.label} — ${node.sublabel}` : node.label}
              </div>
              {count && <div className="text-[9px] text-[#a0b0a5] mt-[1px]">{count}</div>}
            </div>
            <span className="text-[12px] text-[#c5d4c9] shrink-0">›</span>
          </button>
        )
      })}

      {/* Artigos at this level */}
      {artigos.length > 0 && (
        <>
          {children.length > 0 && (
            <div className="h-px bg-[rgba(22,163,74,0.06)] mx-3 my-[6px]" />
          )}
          <div className="text-[9px] text-[#8a9a8f] uppercase tracking-[1px] font-medium px-3 pb-1">
            Artigos
          </div>
          {artigos.map(d => {
            const isActive = d._index === activeIndex
            return (
              <button
                key={d.id}
                onClick={() => onSelectArtigo(d._index)}
                className={`w-full flex items-center gap-[6px] px-3 py-[6px] mx-[6px] rounded-md text-left transition-colors text-[11.5px] ${
                  isActive
                    ? 'text-[#16a34a] font-medium bg-[rgba(22,163,74,0.06)]'
                    : 'text-[#5a6a60] hover:bg-[rgba(22,163,74,0.03)]'
                }`}
                style={{ width: 'calc(100% - 12px)' }}
              >
                <div className={`w-[5px] h-[5px] rounded-full shrink-0 ${isActive ? 'bg-[#4ade80]' : 'bg-[#d0dcd4]'}`} />
                Art. {d.numero ?? '?'}
                {d.epigrafe && <span className="text-[#9aaa9f] font-light truncate">— {d.epigrafe}</span>}
              </button>
            )
          })}
        </>
      )}
    </div>
  )
}
