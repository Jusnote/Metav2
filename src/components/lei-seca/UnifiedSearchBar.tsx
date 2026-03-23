"use client"

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useBusca } from '@/hooks/useLeiApi'
import type { HierarquiaNode, BuscaHit } from '@/types/lei-api'

interface UnifiedSearchBarProps {
  leiId: string
  hierarquia: HierarquiaNode[]
  onScrollToDispositivo: (posicao: number) => void
}

interface FlatTreeItem {
  id: string
  label: string
  desc?: string
  depth: number
  hasChildren: boolean
  path: string
}

function flattenHierarchy(nodes: HierarquiaNode[], depth = 0): FlatTreeItem[] {
  const result: FlatTreeItem[] = []
  for (const node of nodes) {
    result.push({
      id: node.path,
      label: node.descricao,
      desc: node.subtitulo,
      depth,
      hasChildren: (node.filhos?.length ?? 0) > 0,
      path: node.path,
    })
    if (node.filhos?.length) {
      result.push(...flattenHierarchy(node.filhos, depth + 1))
    }
  }
  return result
}

function highlightText(text: string, query: string): string {
  if (!query) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="bg-yellow-100 rounded px-0.5">$1</mark>')
}

export function UnifiedSearchBar({ leiId, hierarquia, onScrollToDispositivo }: UnifiedSearchBarProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Debounce search term
  useEffect(() => {
    clearTimeout(timerRef.current)
    if (input.length >= 2) {
      timerRef.current = setTimeout(() => setDebouncedTerm(input), 500)
    } else {
      setDebouncedTerm('')
    }
    return () => clearTimeout(timerRef.current)
  }, [input])

  // API search
  const { hits, total, isSearching } = useBusca(debouncedTerm, leiId)

  // Flatten hierarchy
  const flatTree = useMemo(() => flattenHierarchy(hierarquia), [hierarquia])

  // Filter hierarchy by input
  const filteredTree = useMemo(() => {
    if (!input) return flatTree
    const lower = input.toLowerCase()
    return flatTree.filter(item =>
      item.label.toLowerCase().includes(lower) ||
      (item.desc && item.desc.toLowerCase().includes(lower))
    )
  }, [flatTree, input])

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('keydown', handler)
      return () => document.removeEventListener('keydown', handler)
    }
  }, [open])

  // Ctrl+F opens
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const handleFocus = useCallback(() => setOpen(true), [])

  const handleSelectHit = useCallback((posicao: number) => {
    onScrollToDispositivo(posicao)
    setOpen(false)
    setInput('')
    setDebouncedTerm('')
  }, [onScrollToDispositivo])

  const handleClear = useCallback(() => {
    setInput('')
    setDebouncedTerm('')
    inputRef.current?.focus()
  }, [])

  const hasInput = input.length > 0
  const showTree = open && !hasInput
  const showResults = open && hasInput

  return (
    <div ref={containerRef} className="flex-1 max-w-[520px] relative font-[Outfit,sans-serif]">
      {/* Search input pill */}
      <div className={`flex items-center gap-2 px-4 py-[7px] border bg-white transition-all ${
        open
          ? 'rounded-[16px_16px_0_0] border-[#e0e0e0] border-b-transparent shadow-[0_4px_20px_rgba(0,0,0,0.1)]'
          : 'rounded-full border-[#e5e5e5] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
      }`}>
        <span className="text-[#bbb] text-[14px] flex-shrink-0">&#128269;</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onFocus={handleFocus}
          placeholder="Buscar na lei..."
          className="flex-1 text-[13px] outline-none text-[#333] placeholder:text-[#bbb] bg-transparent min-w-0"
        />
        {hasInput && (
          <>
            {isSearching && <span className="text-[#ccc] text-[10px] flex-shrink-0">buscando...</span>}
            {!isSearching && debouncedTerm.length >= 2 && (
              <span className="text-[#999] text-[10px] flex-shrink-0">{total} resultado{total !== 1 ? 's' : ''}</span>
            )}
            <button onClick={handleClear} className="text-[#ccc] hover:text-[#888] text-[13px] flex-shrink-0">&times;</button>
          </>
        )}
        {!hasInput && !open && (
          <span className="text-[#ddd] text-[10px] flex-shrink-0">Ctrl+F</span>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 bg-white border border-[#e0e0e0] border-t-0 rounded-[0_0_16px_16px] shadow-[0_8px_24px_rgba(0,0,0,0.1)] z-50 max-h-[420px] overflow-y-auto">

          {/* Empty input: full tree */}
          {showTree && (
            <>
              <div className="px-4 pt-2 pb-1 text-[10px] font-semibold text-[#bbb] uppercase tracking-[1px] flex items-center gap-1.5">
                <span>&#128194;</span> Navega&ccedil;&atilde;o
              </div>
              {flatTree.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleSelectHit(0)}
                  className="w-full text-left flex items-baseline gap-1.5 py-[6px] px-4 hover:bg-[#f8f8f8] transition-colors text-[13px]"
                  style={{ paddingLeft: `${16 + item.depth * 16}px` }}
                >
                  <span className="text-[#ccc] text-[10px] w-3 flex-shrink-0 text-center">
                    {item.hasChildren ? '\u25BC' : ''}
                  </span>
                  <span className={`${item.depth === 0 ? 'font-semibold text-[#333]' : 'text-[#555]'}`}>
                    {item.label}
                  </span>
                  {item.desc && (
                    <span className="text-[#999] text-[12px] italic">&mdash; {item.desc}</span>
                  )}
                </button>
              ))}
            </>
          )}

          {/* Has input: filtered tree + search results */}
          {showResults && (
            <>
              {/* Filtered hierarchy */}
              {filteredTree.length > 0 && (
                <>
                  <div className="px-4 pt-2 pb-1 text-[10px] font-semibold text-[#bbb] uppercase tracking-[1px] flex items-center gap-1.5">
                    <span>&#128194;</span> Navega&ccedil;&atilde;o
                    <span className="font-normal text-[#ddd] ml-1">&mdash; {filteredTree.length} itens</span>
                  </div>
                  {filteredTree.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectHit(0)}
                      className="w-full text-left flex items-baseline gap-1.5 py-[6px] px-4 hover:bg-[#f8f8f8] transition-colors text-[13px]"
                      style={{ paddingLeft: `${16 + Math.min(item.depth, 2) * 16}px` }}
                    >
                      <span className="text-[#ccc] text-[10px] w-3 flex-shrink-0 text-center">&#9654;</span>
                      <span
                        className="text-[#333]"
                        dangerouslySetInnerHTML={{
                          __html: highlightText(item.label + (item.desc ? ` \u2014 ${item.desc}` : ''), input)
                        }}
                      />
                    </button>
                  ))}
                </>
              )}

              {/* Divider */}
              {filteredTree.length > 0 && (hits.length > 0 || isSearching) && (
                <div className="h-px bg-[#f0f0f0] mx-3 my-1" />
              )}

              {/* Search results from API */}
              {(hits.length > 0 || (isSearching && debouncedTerm.length >= 2)) && (
                <>
                  <div className="px-4 pt-2 pb-1 text-[10px] font-semibold text-[#bbb] uppercase tracking-[1px] flex items-center gap-1.5">
                    <span>&#128196;</span> No texto
                    {!isSearching && <span className="font-normal text-[#ddd] ml-1">&mdash; {total} resultados</span>}
                    {isSearching && <span className="font-normal text-[#ddd] ml-1">&mdash; buscando...</span>}
                  </div>
                  {hits.map((hit, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectHit(hit.dispositivo.posicao)}
                      className="w-full text-left px-4 py-2 hover:bg-[#f8f8f8] transition-colors"
                    >
                      <div
                        className="text-[13px] text-[rgb(67,80,92)] line-clamp-2"
                        dangerouslySetInnerHTML={{ __html: hit.highlight }}
                      />
                      <div className="text-[11px] text-[#bbb] mt-0.5">{hit.lei.titulo}</div>
                    </button>
                  ))}
                </>
              )}

              {/* No results */}
              {!isSearching && debouncedTerm.length >= 2 && hits.length === 0 && filteredTree.length === 0 && (
                <div className="px-4 py-6 text-center text-[13px] text-[#bbb]">
                  Nenhum resultado para &ldquo;{input}&rdquo;
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <div className="px-4 py-2 border-t border-[#f4f4f4] text-[11px] text-[#ccc] flex gap-3 sticky bottom-0 bg-white rounded-b-[16px]">
            <span>&uarr;&darr; navegar</span>
            <span>&crarr; ir para</span>
            <span>esc fechar</span>
          </div>
        </div>
      )}
    </div>
  )
}
