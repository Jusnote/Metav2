"use client"

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useActiveArtigoIndex } from '@/stores/activeArtigoStore'
import { LeiTree } from '@/components/ui/lei-tree'
import type { LeiTreeNode } from '@/components/ui/lei-tree'
import { TracingBeam } from '@/components/ui/tracing-beam'
import type { TracingBeamRef } from '@/components/ui/tracing-beam'
import { hierarquiaToTreeNodes, injectArtigosIntoTree, resolvePathToPosicao } from '@/lib/lei-hierarchy'
import { sanitizeHighlight } from './HighlightText'
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
}: SearchBreadcrumbDropdownProps) {
  const activeIndex = useActiveArtigoIndex()
  const scrollRef = useRef<HTMLDivElement>(null)
  const beamRef = useRef<TracingBeamRef>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

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

  // Auto-expand all matching branches when searching (separate effect, not inside useMemo)
  useEffect(() => {
    if (!input) return
    const filtered = filterTree(treeWithArtigos, input)
    const allIds = collectBranchIds(filtered)
    if (allIds.length > 0) {
      setExpandedSections(new Set(allIds))
    }
  }, [input, treeWithArtigos])

  const hasInput = input.length > 0
  const showSearchResults = hasInput && (hits.length > 0 || isSearching)

  // Handle tree node click → scroll to position
  const handleTreeSelect = useCallback((_artigoIndex: number) => {
    onSelectArtigo(_artigoIndex)
  }, [onSelectArtigo])

  // Handle section node click → resolve path to posicao
  const handleToggleAndNavigate = useCallback((id: string) => {
    toggleSection(id)
    const posicao = resolvePathToPosicao(id, dispositivos)
    if (posicao !== null) {
      onSelectHit(posicao)
    }
  }, [toggleSection, dispositivos, onSelectHit])

  return (
    <div className="absolute left-0 right-0 top-full z-50">
      <div
        ref={scrollRef}
        className="bg-[#fafafa] border border-[#e8e8e8] border-t-0 sm:rounded-b-[10px] rounded-b-[8px] shadow-[0_12px_32px_rgba(0,0,0,0.08)] sm:max-h-[380px] max-h-[60vh] overflow-y-auto"
      >
        {/* ---- HIERARCHY SECTION ---- */}
        <div className="px-[14px] pt-[10px] pb-1 text-[9px] text-[#c0c0c0] uppercase tracking-[1.5px] font-normal">
          Navegação
          {hasInput && displayTree.length > 0 && (
            <span className="ml-1 normal-case tracking-normal">— {displayTree.length} itens</span>
          )}
        </div>

        {/* LeiTree + TracingBeam */}
        <div className="px-1">
          <TracingBeam
            ref={beamRef}
            activeArtigoIndex={activeIndex}
            scrollContainerRef={scrollRef}
          >
            <LeiTree
              data={displayTree}
              expanded={expandedSections}
              onToggle={handleToggleAndNavigate}
              onSelectArtigo={handleTreeSelect}
              onAnimationStart={() => beamRef.current?.animationStarted()}
              onAnimationSettled={() => beamRef.current?.remeasure()}
            />
          </TracingBeam>
        </div>

        {displayTree.length === 0 && hasInput && !showSearchResults && (
          <div className="px-[14px] py-3 text-[11px] text-[#ccc] font-light">
            Nenhum item na estrutura
          </div>
        )}

        {/* ---- DIVIDER ---- */}
        {showSearchResults && displayTree.length > 0 && (
          <div className="h-px bg-[#efefef] mx-[14px] my-[6px]" />
        )}

        {/* ---- FULL-TEXT SEARCH RESULTS ---- */}
        {showSearchResults && (
          <>
            <div className="px-[14px] pt-[8px] pb-1 text-[9px] text-[#c0c0c0] uppercase tracking-[1.5px] font-normal">
              No texto
              {!isSearching && (
                <span className="ml-1 normal-case tracking-normal">— {total} resultados</span>
              )}
              {isSearching && (
                <span className="ml-1 normal-case tracking-normal">— buscando...</span>
              )}
            </div>

            {hits.map((hit, i) => (
              <button
                key={i}
                onClick={() => onSelectHit(hit.dispositivo.posicao)}
                className="w-full text-left px-[14px] py-2 border-l-2 border-transparent hover:border-l-[#2c3338] hover:bg-[#f0f0f0] transition-all duration-150 rounded-r-lg"
              >
                <div
                  className="text-[12.5px] text-[#4a5058] leading-[1.6] font-[Literata,Georgia,serif] line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: sanitizeHighlight(hit.highlight) }}
                />
                <div className="text-[9px] text-[#c0c0c0] mt-[3px] font-light font-[Outfit,sans-serif]">
                  {hit.lei.titulo}
                </div>
              </button>
            ))}
          </>
        )}

        {/* No results at all */}
        {hasInput && !isSearching && debouncedTerm.length >= 2 && hits.length === 0 && displayTree.length === 0 && (
          <div className="px-[14px] py-6 text-center text-[12px] text-[#ccc] font-light">
            Nenhum resultado para &ldquo;{input}&rdquo;
          </div>
        )}

        {/* ---- FOOTER ---- */}
        <div className="px-[14px] py-[6px] border-t border-[#f0f0f0] text-[10px] text-[#d0d0d0] font-light flex gap-[14px] sticky bottom-0 bg-[#fafafa] sm:rounded-b-[10px] rounded-b-[8px]">
          <span className="hidden sm:inline">↑↓</span>
          <span className="hidden sm:inline">→ expandir</span>
          <span className="hidden sm:inline">← colapsar</span>
          <span className="hidden sm:inline">⏎ ir</span>
          <span className="hidden sm:inline">esc</span>
          <span className="sm:hidden">toque para navegar</span>
        </div>
      </div>
    </div>
  )
}
