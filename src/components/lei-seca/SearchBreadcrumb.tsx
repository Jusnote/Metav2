"use client"

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useActiveArtigoIndex } from '@/stores/activeArtigoStore'
import { useBusca } from '@/hooks/useLeiApi'
import { resolveBreadcrumb } from '@/lib/lei-hierarchy'
import { SearchBreadcrumbDropdown } from './SearchBreadcrumbDropdown'
import type { Dispositivo, HierarquiaNode, Lei } from '@/types/lei-api'

interface SearchBreadcrumbProps {
  currentLei: Lei
  dispositivos: Dispositivo[]
  totalDispositivos: number
  onScrollToDispositivo: (posicao: number) => void
  onSelectArtigoIndex: (index: number) => void
  onOpenChange?: (open: boolean) => void
}

function abbreviateLabel(label: string): string {
  return label
    .replace(/^Título\s/i, 'Tít. ')
    .replace(/^Capítulo\s/i, 'Cap. ')
    .replace(/^Seção\s/i, 'Seç. ')
}

export function SearchBreadcrumb({
  currentLei,
  dispositivos,
  totalDispositivos,
  onScrollToDispositivo,
  onSelectArtigoIndex,
  onOpenChange,
}: SearchBreadcrumbProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const confirmSelectionRef = useRef<(() => void) | null>(null)
  const expandSelectionRef = useRef<(() => void) | null>(null)
  const collapseSelectionRef = useRef<(() => void) | null>(null)

  useEffect(() => { setSelectedIndex(-1) }, [input])
  useEffect(() => { onOpenChange?.(open) }, [open, onOpenChange])

  const [debouncedTerm, setDebouncedTerm] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const activeIndex = useActiveArtigoIndex()

  const segments = useMemo(
    () => resolveBreadcrumb(dispositivos, activeIndex, currentLei.hierarquia ?? []),
    [dispositivos, activeIndex, currentLei.hierarquia]
  )

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (input.length >= 2) {
      timerRef.current = setTimeout(() => setDebouncedTerm(input), 500)
    } else {
      setDebouncedTerm('')
    }
    return () => clearTimeout(timerRef.current)
  }, [input])

  const { hits, total, isSearching } = useBusca(debouncedTerm, currentLei.id)

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

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setInput('')
        setDebouncedTerm('')
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => prev + 1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(-1, prev - 1))
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault()
        confirmSelectionRef.current?.()
      } else if (e.key === 'ArrowRight' && selectedIndex >= 0) {
        e.preventDefault()
        expandSelectionRef.current?.()
      } else if (e.key === 'ArrowLeft' && selectedIndex >= 0) {
        e.preventDefault()
        collapseSelectionRef.current?.()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, selectedIndex])

  const handleOpen = useCallback(() => {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const handleClear = useCallback(() => {
    setInput('')
    setDebouncedTerm('')
    inputRef.current?.focus()
  }, [])

  const handleSelect = useCallback((posicao: number) => {
    onScrollToDispositivo(posicao)
    setOpen(false)
    setInput('')
    setDebouncedTerm('')
  }, [onScrollToDispositivo])

  const handleSelectArtigo = useCallback((artigoIndex: number) => {
    onSelectArtigoIndex(artigoIndex)
    setOpen(false)
    setInput('')
    setDebouncedTerm('')
  }, [onSelectArtigoIndex])

  const hasInput = input.length > 0
  const totalArtigos = currentLei.stats?.totalArtigos ?? totalDispositivos

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone/.test(navigator.userAgent)

  return (
    <div ref={containerRef} className="relative font-[Outfit,sans-serif]">
      {/* ---- CLOSED: Glass Breadcrumb ---- */}
      {!open && (
        <button
          onClick={handleOpen}
          className="w-full flex items-center gap-2 py-2 px-[14px] cursor-pointer transition-opacity hover:opacity-80 bg-white/65 backdrop-blur-[12px] rounded-[10px] border border-white/50"
          style={{
            boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.02), inset 0 1px 0 rgba(255,255,255,0.6)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" className="shrink-0 opacity-50">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
          </svg>

          {segments.length > 0 ? (
            <span className="flex items-center gap-2 min-w-0 overflow-hidden">
              {/* Desktop: all segments */}
              <span className="hidden sm:contents">
                {segments.map((seg, i) => (
                  <span key={seg.path} className="flex items-center gap-2 shrink-0">
                    {i > 0 && <span className="w-[3px] h-[3px] rounded-full bg-[#c5d4c9] shrink-0" />}
                    <span className={`text-[11.5px] ${
                      i === segments.length - 1 ? 'text-[#3a5540] font-medium' : 'text-[#8a9a8f]'
                    }`}>
                      {seg.label}
                    </span>
                  </span>
                ))}
              </span>
              {/* Mobile: ellipsis + last 2 */}
              <span className="sm:hidden contents">
                {segments.length > 2 && (
                  <>
                    <span className="text-[10.5px] text-[#b0c0b5]">...</span>
                    <span className="w-[2.5px] h-[2.5px] rounded-full bg-[#c5d4c9] shrink-0" />
                  </>
                )}
                {segments.slice(segments.length > 2 ? -2 : 0).map((seg, i) => (
                  <span key={seg.path} className="flex items-center gap-2 shrink-0">
                    {i > 0 && <span className="w-[2.5px] h-[2.5px] rounded-full bg-[#c5d4c9] shrink-0" />}
                    <span className={`text-[10.5px] ${
                      i === (segments.length > 2 ? 1 : segments.length - 1) ? 'text-[#3a5540] font-medium' : 'text-[#8a9a8f]'
                    }`}>
                      {abbreviateLabel(seg.label)}
                    </span>
                  </span>
                ))}
              </span>
            </span>
          ) : (
            <span className="text-[11.5px] text-[#8a9a8f] font-light">Buscar na lei...</span>
          )}

          <span className="ml-auto flex items-center gap-2 shrink-0 pl-3">
            <span className="text-[10px] text-[#9aaa9f] tabular-nums">
              <span className="hidden sm:inline">{activeIndex + 1} / {totalArtigos}</span>
              <span className="sm:hidden">{activeIndex + 1}/{totalArtigos}</span>
            </span>
            <span className="text-[9px] text-[#9aaa9f] bg-white/60 border border-black/[0.06] px-[6px] py-[1px] rounded font-mono hidden sm:inline">
              {isMac ? '⌘F' : 'Ctrl+F'}
            </span>
          </span>
        </button>
      )}

      {/* ---- OPEN: Glass Search Input ---- */}
      {open && (
        <div
          className="flex items-center gap-2 py-2 px-[14px] bg-[#fafcfb] rounded-[10px] border border-[rgba(22,163,74,0.2)]"
          style={{
            boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.02), 0 0 0 3px rgba(22,163,74,0.06)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" className="shrink-0 opacity-70">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Buscar artigo, tema, palavra..."
            className="hidden sm:block flex-1 text-[12.5px] outline-none text-[#2a3a30] placeholder:text-[#a0b0a5] placeholder:font-light bg-transparent font-[Outfit,sans-serif] min-w-0"
          />
          <input
            ref={el => { if (el && !inputRef.current) (inputRef as React.MutableRefObject<HTMLInputElement>).current = el }}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Buscar..."
            className="sm:hidden flex-1 text-[12.5px] outline-none text-[#2a3a30] placeholder:text-[#a0b0a5] placeholder:font-light bg-transparent font-[Outfit,sans-serif] min-w-0"
          />
          {hasInput && (
            <>
              {isSearching && <span className="text-[9.5px] text-[#9aaa9f] font-light shrink-0">buscando...</span>}
              {!isSearching && debouncedTerm.length >= 2 && (
                <span className="text-[9.5px] text-[#9aaa9f] font-light shrink-0">{total} resultado{total !== 1 ? 's' : ''}</span>
              )}
              <button
                onClick={handleClear}
                className="w-4 h-4 flex items-center justify-center text-[#b0c0b5] hover:bg-[rgba(22,163,74,0.06)] rounded-full text-[14px] shrink-0 transition-colors"
              >
                ×
              </button>
            </>
          )}
          {!hasInput && (
            <span className="text-[9px] text-[#b0c0b5] font-light shrink-0">esc</span>
          )}
        </div>
      )}

      {/* ---- DROPDOWN ---- */}
      {open && (
        <SearchBreadcrumbDropdown
          hierarquia={currentLei.hierarquia ?? []}
          dispositivos={dispositivos}
          input={input}
          hits={hits}
          total={total}
          isSearching={isSearching}
          debouncedTerm={debouncedTerm}
          onSelectHit={handleSelect}
          onSelectArtigo={handleSelectArtigo}
          selectedIndex={selectedIndex}
          onClampIndex={setSelectedIndex}
          confirmSelectionRef={confirmSelectionRef}
          expandSelectionRef={expandSelectionRef}
          collapseSelectionRef={collapseSelectionRef}
        />
      )}
    </div>
  )
}
