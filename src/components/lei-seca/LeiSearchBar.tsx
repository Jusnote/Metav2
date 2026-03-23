"use client"

import { useState, useCallback, useRef, useEffect } from 'react'
import { useBusca } from '@/hooks/useLeiApi'

interface LeiSearchBarProps {
  leiId: string
  onClose: () => void
  onSelectHit: (posicao: number) => void
}

export function LeiSearchBar({ leiId, onClose, onSelectHit }: LeiSearchBarProps) {
  const [input, setInput] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleChange = useCallback((value: string) => {
    setInput(value)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebouncedTerm(value), 500)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const { hits, total, isSearching } = useBusca(debouncedTerm, leiId)

  return (
    <div className="absolute top-0 left-0 right-0 z-50 bg-white border-b border-[#eee] shadow-sm">
      <div className="max-w-[820px] mx-auto px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-[#999] text-sm">&#128269;</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => handleChange(e.target.value)}
            placeholder='Buscar na lei... (ex: "pris&atilde;o preventiva" -fian&ccedil;a)'
            className="flex-1 text-sm outline-none text-[rgb(67,80,92)] placeholder:text-[#ccc] bg-transparent"
          />
          {isSearching && <span className="text-[#ccc] text-xs">buscando...</span>}
          {!isSearching && debouncedTerm.length >= 2 && (
            <span className="text-[#999] text-xs">{total} resultado{total !== 1 ? 's' : ''}</span>
          )}
          <button onClick={onClose} className="text-[#ccc] hover:text-[#888] text-sm">&#10005;</button>
        </div>

        {hits.length > 0 && (
          <div className="mt-2 max-h-[240px] overflow-y-auto border-t border-[#f4f4f4] pt-2 space-y-1">
            {hits.map((hit, i) => (
              <button
                key={i}
                onClick={() => onSelectHit(hit.dispositivo.posicao)}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-[#f8f8f8] transition-colors"
              >
                <div
                  className="text-[13px] text-[rgb(67,80,92)] line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: hit.highlight }}
                />
                <div className="text-[11px] text-[#bbb] mt-0.5">{hit.lei.titulo}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
