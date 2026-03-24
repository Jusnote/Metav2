"use client"

import { useState, useCallback, useRef, useEffect } from 'react'
import type { GrifoColor } from '@/types/grifo'
import { GRIFO_COLORS } from '@/types/grifo'

interface GrifoNoteInlineProps {
  grifoId: string
  color: GrifoColor
  initialNote: string | null
  onSave: (grifoId: string, note: string) => void
  onCancel: () => void
}

export function GrifoNoteInline({ grifoId, color, initialNote, onSave, onCancel }: GrifoNoteInlineProps) {
  const [note, setNote] = useState(initialNote ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [note])

  const handleSave = useCallback(() => {
    onSave(grifoId, note.trim())
  }, [grifoId, note, onSave])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSave()
    }
  }, [onCancel, handleSave])

  const borderColor = GRIFO_COLORS[color].replace(/[\d.]+\)$/, '0.5)')

  return (
    <div
      className="grid transition-[grid-template-rows] duration-[120ms] ease-out"
      style={{ gridTemplateRows: '1fr' }}
    >
      <div className="overflow-hidden">
        <div
          className="bg-[#fafcfb] rounded-lg mt-1 mb-2 mx-1"
          style={{
            borderLeft: `3px solid ${borderColor}`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}
          aria-label="Nota do grifo"
        >
          <div className="p-3">
            <textarea
              ref={textareaRef}
              value={note}
              onChange={e => setNote(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Adicionar nota..."
              className="w-full resize-none outline-none text-[12px] font-[Outfit,sans-serif] text-[#3a4a40] placeholder:text-[#b0c0b5] bg-transparent leading-[1.6] max-h-[120px]"
              rows={1}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={onCancel}
                className="px-3 py-1 text-[11px] text-[#8a9a8f] hover:text-[#3a5540] transition-colors font-[Outfit,sans-serif]"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1 text-[11px] text-white bg-[#16a34a] hover:bg-[#15803d] rounded-md transition-colors font-[Outfit,sans-serif]"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
