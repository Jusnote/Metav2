"use client"

import { useState, useCallback, useRef, useMemo, useEffect, type MutableRefObject } from 'react'
import { useActiveArtigoIndex } from '@/stores/activeArtigoStore'
import { LeiTree } from '@/components/ui/lei-tree'
import type { LeiTreeNode } from '@/components/ui/lei-tree'
import { hierarquiaToTreeNodes, injectArtigosIntoTree, resolvePathToPosicao, resolveActivePathIds } from '@/lib/lei-hierarchy'
import { sanitizeHighlight } from './HighlightText'
import { DrillDownView } from './DrillDownView'
import type { HierarquiaNode, Dispositivo, BuscaHit } from '@/types/lei-api'

interface SearchBreadcrumbDropdownProps {
  hierarquia: HierarquiaNode[]
  dispositivos: Dispositivo[]
  input: string
  hits: BuscaHit[]
  total: number
  isSearching: boolean
  debouncedTerm: string
  onSelectHit: (posicao: number) => void
  onSelectArtigo: (artigoIndex: number) => void
  selectedIndex?: number
  onClampIndex?: (index: number) => void
  confirmSelectionRef?: MutableRefObject<(() => void) | null>
  expandSelectionRef?: MutableRefObject<(() => void) | null>
  collapseSelectionRef?: MutableRefObject<(() => void) | null>
}

interface SelectableItem {
  type: 'tree-node' | 'search-hit'
  id: string
  path?: string
  posicao?: number
  artigoIndex?: number
  hasChildren?: boolean
}

// ---- Filter tree by search query ----
function filterTree(nodes: LeiTreeNode[], query: string): LeiTreeNode[] {
  if (!query) return nodes
  const lower = query.toLowerCase()
  return nodes.reduce<LeiTreeNode[]>((acc, node) => {
    const labelMatch = node.label?.toLowerCase().includes(lower)
    const sublabelMatch = node.sublabel?.toLowerCase().includes(lower)
    const filteredChildren = node.children ? filterTree(node.children, query) : undefined
    const hasMatchingChildren = filteredChildren && filteredChildren.length > 0
    if (labelMatch || sublabelMatch || hasMatchingChildren) {
      acc.push({ ...node, children: hasMatchingChildren ? filteredChildren : node.children })
    }
    return acc
  }, [])
}

// ---- Collect all branch IDs for auto-expand on search ----
function collectBranchIds(nodes: LeiTreeNode[]): string[] {
  const ids: string[] = []
  for (const node of nodes) {
    if (node.children?.length) {
      ids.push(node.id)
      ids.push(...collectBranchIds(node.children))
    }
  }
  return ids
}

export function SearchBreadcrumbDropdown({
  hierarquia,
  dispositivos,
  input,
  hits,
  total,
  isSearching,
  debouncedTerm,
  onSelectHit,
  onSelectArtigo,
  selectedIndex,
  onClampIndex,
  confirmSelectionRef,
  expandSelectionRef,
  collapseSelectionRef,
}: SearchBreadcrumbDropdownProps) {
  const activeIndex = useActiveArtigoIndex()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-expand active path on mount
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() =>
    resolveActivePathIds(dispositivos, activeIndex, hierarquia)
  )

  // Responsive state
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const toggleSection = useCallback((id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Build base tree from hierarchy
  const baseTree = useMemo(
    () => hierarquiaToTreeNodes(hierarquia),
    [hierarquia]
  )

  // Active path IDs for highlighting ancestors in the connected tree
  const activePathIds = useMemo(
    () => resolveActivePathIds(dispositivos, activeIndex, hierarquia),
    [dispositivos, activeIndex, hierarquia]
  )

  // Inject artigos into expanded nodes
  const treeWithArtigos = useMemo(
    () => injectArtigosIntoTree(baseTree, dispositivos, expandedSections),
    [baseTree, dispositivos, expandedSections]
  )

  // When searching: filter tree
  const displayTree = useMemo(() => {
    if (!input) return treeWithArtigos
    return filterTree(treeWithArtigos, input)
  }, [treeWithArtigos, input])

  // Auto-expand all matching branches when searching
  useEffect(() => {
    if (!input) return
    const filtered = filterTree(baseTree, input)
    const allIds = collectBranchIds(filtered)
    if (allIds.length > 0) {
      setExpandedSections(new Set(allIds))
    }
  }, [input, baseTree])

  const hasInput = input.length > 0
  const showSearchResults = hasInput && (hits.length > 0 || isSearching)

  const handleTreeSelect = useCallback((_artigoIndex: number) => {
    onSelectArtigo(_artigoIndex)
  }, [onSelectArtigo])

  const handleToggle = useCallback((id: string) => {
    toggleSection(id)
  }, [toggleSection])

  // ---- Keyboard navigation: flat list of selectable items ----
  const selectableItems = useMemo<SelectableItem[]>(() => {
    const items: SelectableItem[] = []
    function flattenVisible(nodes: LeiTreeNode[]) {
      for (const node of nodes) {
        if (node.type === 'artigo') {
          items.push({ type: 'tree-node', id: node.id, artigoIndex: node.artigoIndex })
        } else {
          items.push({
            type: 'tree-node',
            id: node.id,
            path: node.id,
            hasChildren: (node.children?.length ?? 0) > 0,
          })
          if (expandedSections.has(node.id) && node.children) {
            flattenVisible(node.children)
          }
        }
      }
    }
    flattenVisible(displayTree)
    hits.forEach((hit, i) => {
      items.push({ type: 'search-hit', id: `hit-${i}`, posicao: hit.dispositivo.posicao })
    })
    return items
  }, [displayTree, expandedSections, hits])

  // Clamp selectedIndex to valid range
  useEffect(() => {
    if (selectedIndex !== undefined && selectedIndex >= selectableItems.length && onClampIndex) {
      onClampIndex(Math.max(0, selectableItems.length - 1))
    }
  }, [selectedIndex, selectableItems.length, onClampIndex])

  // Register confirm handler (Enter)
  useEffect(() => {
    if (!confirmSelectionRef) return
    confirmSelectionRef.current = () => {
      if (selectedIndex === undefined || selectedIndex < 0) return
      const item = selectableItems[selectedIndex]
      if (!item) return
      if (item.type === 'search-hit' && item.posicao !== undefined) {
        onSelectHit(item.posicao)
      } else if (item.artigoIndex !== undefined) {
        onSelectArtigo(item.artigoIndex)
      } else if (item.path) {
        const posicao = resolvePathToPosicao(item.path, dispositivos)
        if (posicao !== null) onSelectHit(posicao)
      }
    }
  }, [selectedIndex, selectableItems, onSelectHit, onSelectArtigo, dispositivos, confirmSelectionRef])

  // Register expand handler (→)
  useEffect(() => {
    if (!expandSelectionRef) return
    expandSelectionRef.current = () => {
      if (selectedIndex === undefined || selectedIndex < 0) return
      const item = selectableItems[selectedIndex]
      if (!item || item.type !== 'tree-node' || !item.hasChildren || !item.path) return
      if (!expandedSections.has(item.path)) {
        setExpandedSections(prev => {
          const next = new Set(prev)
          next.add(item.path!)
          return next
        })
      }
    }
  }, [selectedIndex, selectableItems, expandedSections, expandSelectionRef])

  // Register collapse handler (←)
  useEffect(() => {
    if (!collapseSelectionRef) return
    collapseSelectionRef.current = () => {
      if (selectedIndex === undefined || selectedIndex < 0) return
      const item = selectableItems[selectedIndex]
      if (!item || item.type !== 'tree-node' || !item.path) return
      if (expandedSections.has(item.path)) {
        setExpandedSections(prev => {
          const next = new Set(prev)
          next.delete(item.path!)
          return next
        })
      }
    }
  }, [selectedIndex, selectableItems, expandedSections, collapseSelectionRef])

  // Scroll selected item into view + highlight tree nodes via DOM
  useEffect(() => {
    if (selectedIndex === undefined || selectedIndex < 0) return

    const hitEl = scrollRef.current?.querySelector(`[data-selectable-index="${selectedIndex}"]`)
    if (hitEl) {
      hitEl.scrollIntoView({ block: 'nearest' })
      return
    }

    const item = selectableItems[selectedIndex]
    if (!item || item.type !== 'tree-node') return

    let el: Element | null = null
    if (item.artigoIndex !== undefined) {
      el = scrollRef.current?.querySelector(`[data-artigo-index="${item.artigoIndex}"]`) ?? null
    } else if (item.path) {
      const treeNodeItems = selectableItems.filter(s => s.type === 'tree-node')
      const indexAmongTreeNodes = treeNodeItems.indexOf(item)
      if (indexAmongTreeNodes >= 0) {
        const treeContainer = scrollRef.current?.querySelector('[role="tree"]')
        if (treeContainer) {
          const allNodes = treeContainer.querySelectorAll('[data-tree-branch], [data-artigo-index]')
          el = allNodes[indexAmongTreeNodes] ?? null
        }
      }
    }

    if (el) {
      el.scrollIntoView({ block: 'nearest' })
      el.classList.add('ring-2', 'ring-[rgba(22,163,74,0.3)]', 'bg-[rgba(22,163,74,0.06)]', 'rounded-md')
      return () => {
        el?.classList.remove('ring-2', 'ring-[rgba(22,163,74,0.3)]', 'bg-[rgba(22,163,74,0.06)]', 'rounded-md')
      }
    }
  }, [selectedIndex, selectableItems])

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-[6px]">
      <div
        ref={scrollRef}
        className="bg-[#fafcfb] rounded-xl border border-[#e8ede9] sm:max-h-[380px] max-h-[60vh] overflow-y-auto"
        style={{
          boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 12px 48px rgba(0,0,0,0.04)',
        }}
      >
        {/* ---- HIERARCHY SECTION ---- */}
        <div className="px-4 pt-[10px] pb-1 text-[9px] text-[#8a9a8f] uppercase tracking-[1.5px] font-medium">
          Navegação
          {hasInput && displayTree.length > 0 && (
            <span className="ml-1 normal-case tracking-normal">— {displayTree.length} itens</span>
          )}
        </div>

        {/* Skeleton loading */}
        {hierarquia.length === 0 && (
          <div className="px-4 py-3 space-y-2">
            <div className="h-3 rounded bg-[rgba(22,163,74,0.06)] animate-pulse" style={{ width: '60%' }} />
            <div className="h-3 rounded bg-[rgba(22,163,74,0.06)] animate-pulse" style={{ width: '40%' }} />
            <div className="h-3 rounded bg-[rgba(22,163,74,0.06)] animate-pulse" style={{ width: '50%' }} />
          </div>
        )}

        {/* Desktop: Connected tree */}
        {hierarquia.length > 0 && !isMobile && (
          <div className="px-1">
            <LeiTree
              data={displayTree}
              expanded={expandedSections}
              activePath={activePathIds}
              onToggle={handleToggle}
              onSelectArtigo={handleTreeSelect}
            />
          </div>
        )}

        {/* Mobile: Drill-down */}
        {hierarquia.length > 0 && isMobile && (
          <DrillDownView
            hierarquia={hierarquia}
            dispositivos={dispositivos}
            input={input}
            onSelectHit={onSelectHit}
            onSelectArtigo={onSelectArtigo}
          />
        )}

        {!isMobile && displayTree.length === 0 && hasInput && !showSearchResults && (
          <div className="px-4 py-3 text-[11px] text-[#b0c0b5] font-light">
            Nenhum item na estrutura
          </div>
        )}

        {/* ---- DIVIDER ---- */}
        {showSearchResults && displayTree.length > 0 && (
          <div className="h-px bg-[rgba(22,163,74,0.06)] mx-4 my-[6px]" />
        )}

        {/* ---- FULL-TEXT SEARCH RESULTS ---- */}
        {showSearchResults && (
          <>
            <div className="px-4 pt-2 pb-1 text-[9px] text-[#8a9a8f] uppercase tracking-[1.5px] font-medium">
              No texto
              {!isSearching && (
                <span className="ml-1 normal-case tracking-normal">— {total} resultados</span>
              )}
              {isSearching && (
                <span className="ml-1 normal-case tracking-normal">— buscando...</span>
              )}
            </div>

            {hits.map((hit, i) => {
              const flatIndex = selectableItems.findIndex(s => s.id === `hit-${i}`)
              const isSelected = flatIndex === selectedIndex
              return (
                <button
                  key={i}
                  data-selectable-index={flatIndex}
                  onClick={() => onSelectHit(hit.dispositivo.posicao)}
                  className={`w-full text-left px-4 py-2 border-l-2 transition-all duration-150 ${
                    isSelected
                      ? 'border-l-[#16a34a] bg-[rgba(22,163,74,0.06)]'
                      : 'border-transparent hover:border-l-[#16a34a] hover:bg-[rgba(22,163,74,0.04)]'
                  }`}
                >
                  <div
                    className="text-[12.5px] text-[#4a5a50] leading-[1.6] font-[Literata,Georgia,serif] line-clamp-2 [&_b]:font-semibold [&_b]:text-[#1a2a1f] [&_mark]:bg-[rgba(74,222,128,0.25)] [&_mark]:text-inherit [&_mark]:rounded-sm [&_mark]:px-[1px]"
                    dangerouslySetInnerHTML={{ __html: sanitizeHighlight(hit.highlight) }}
                  />
                  <div className="text-[9.5px] text-[#a0b0a5] mt-[3px] font-light font-[Outfit,sans-serif]">
                    {hit.lei.titulo}
                  </div>
                </button>
              )
            })}
          </>
        )}

        {/* No results at all */}
        {hasInput && !isSearching && debouncedTerm.length >= 2 && hits.length === 0 && displayTree.length === 0 && (
          <div className="px-4 py-6 text-center text-[12px] text-[#b0c0b5] font-light">
            Nenhum resultado para &ldquo;{input}&rdquo;
          </div>
        )}

        {/* ---- FOOTER ---- */}
        <div className="px-4 py-[6px] border-t border-[rgba(22,163,74,0.06)] text-[10px] text-[#b0c0b5] font-light flex gap-[14px] sticky bottom-0 bg-[#fafcfb] rounded-b-xl">
          <span className="hidden sm:flex gap-[14px]">
            <span><kbd className="font-mono text-[9px] bg-white/60 border border-black/[0.06] px-1 rounded mr-[2px]">↑</kbd><kbd className="font-mono text-[9px] bg-white/60 border border-black/[0.06] px-1 rounded">↓</kbd> navegar</span>
            <span><kbd className="font-mono text-[9px] bg-white/60 border border-black/[0.06] px-1 rounded mr-[2px]">→</kbd> expandir</span>
            <span><kbd className="font-mono text-[9px] bg-white/60 border border-black/[0.06] px-1 rounded mr-[2px]">←</kbd> colapsar</span>
            <span><kbd className="font-mono text-[9px] bg-white/60 border border-black/[0.06] px-1 rounded mr-[2px]">⏎</kbd> ir</span>
            <span><kbd className="font-mono text-[9px] bg-white/60 border border-black/[0.06] px-1 rounded">esc</kbd></span>
          </span>
          <span className="sm:hidden">toque para navegar</span>
        </div>
      </div>
    </div>
  )
}
