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

  // Sync open state to parent
  useEffect(() => { onOpenChange?.(open) }, [open, onOpenChange])
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const activeIndex = useActiveArtigoIndex()

  // Breadcrumb segments
  const segments = useMemo(
    () => resolveBreadcrumb(dispositivos, activeIndex, currentLei.hierarquia ?? []),
    [dispositivos, activeIndex, currentLei.hierarquia]
  )

  // Debounce search
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
  const { hits, total, isSearching } = useBusca(debouncedTerm, currentLei.id)

  // Ctrl+F / Cmd+F opens
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

  // Click outside closes
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

  // Escape closes
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setInput('')
        setDebouncedTerm('')
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

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

  return (
    <div ref={containerRef} className="relative font-[Outfit,sans-serif]">
      {/* ---- CLOSED: Breadcrumb ---- */}
      {!open && (
        <button
          onClick={handleOpen}
          className="w-full flex items-center gap-[6px] sm:py-[14px] py-[10px] cursor-pointer transition-opacity hover:opacity-80"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c8c8c8" strokeWidth="1.5" strokeLinecap="round" className="flex-shrink-0">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
          </svg>

          {segments.length > 0 ? (
            <>
              {segments.map((seg, i) => (
                <span key={seg.path} className="flex items-center gap-[6px]">
                  {i > 0 && <span className="text-[9px] text-[#ddd]">›</span>}
                  <span className={`text-[11px] font-light ${
                    i === segments.length - 1 ? 'text-[#888] font-normal' : 'text-[#c0c0c0]'
                  }`}>
                    <span className="hidden sm:inline">{seg.label}</span>
                    <span className="sm:hidden">{abbreviateLabel(seg.label)}</span>
                  </span>
                </span>
              ))}
            </>
          ) : (
            <span className="text-[11px] text-[#c0c0c0] font-light">Buscar na lei...</span>
          )}

          <span className="ml-auto flex items-center gap-2 flex-shrink-0">
            <span className="text-[9px] text-[#ddd] font-mono bg-[#f8f8f8] px-[6px] py-[1px] rounded hidden sm:inline">Ctrl+F</span>
            <span className="text-[10px] text-[#ddd] font-light tabular-nums">
              <span className="hidden sm:inline">{activeIndex + 1} / {totalArtigos}</span>
              <span className="sm:hidden">{activeIndex + 1}/{totalArtigos}</span>
            </span>
          </span>
        </button>
      )}

      {/* ---- OPEN: Search input ---- */}
      {open && (
        <div className="sm:py-[14px] py-[10px]">
          <div className="flex items-center gap-2 px-[14px] py-2 bg-[#fafafa] border border-[#e8e8e8] sm:rounded-t-[10px] rounded-[8px] sm:border-b-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2c3338" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Buscar artigo, tema, palavra..."
              className="flex-1 text-[12px] outline-none text-[#333] placeholder:text-[#bbb] bg-transparent font-[Outfit,sans-serif] min-w-0"
            />
            {hasInput && (
              <>
                {isSearching && <span className="text-[9px] text-[#b0b0b0] font-light flex-shrink-0">buscando...</span>}
                {!isSearching && debouncedTerm.length >= 2 && (
                  <span className="text-[9px] text-[#b0b0b0] font-light flex-shrink-0">{total} resultado{total !== 1 ? 's' : ''}</span>
                )}
                <button
                  onClick={handleClear}
                  className="w-4 h-4 flex items-center justify-center text-[#ccc] hover:bg-[#eee] rounded-full text-[14px] flex-shrink-0 transition-colors"
                >
                  ×
                </button>
              </>
            )}
            {!hasInput && (
              <span className="text-[9px] text-[#ccc] font-light flex-shrink-0">esc</span>
            )}
          </div>
        </div>
      )}

      {/* Separator (visible in both states) */}
      <div className="h-px" style={{ background: 'linear-gradient(90deg, #f0f0f0, transparent)' }} />

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
        />
      )}
    </div>
  )
}
