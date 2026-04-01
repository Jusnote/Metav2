"use client"

import { useCallback, useEffect, useState, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useGrifoPopupState, grifoPopupStore } from '@/stores/grifoPopupStore'
import type { GrifoColor } from '@/types/grifo'
import { GRIFO_COLORS, GRIFO_COLOR_NAMES } from '@/types/grifo'

const COLOR_ORDER: GrifoColor[] = ['yellow', 'green', 'blue', 'pink', 'orange']

interface GrifoPopupProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  onCreateGrifo: (color: GrifoColor) => void
  onUpdateColor: (grifoId: string, color: GrifoColor) => void
  onDeleteGrifo: (grifoId: string) => void
  onOpenNote: () => void
}

export function GrifoPopup({ scrollContainerRef, onCreateGrifo, onUpdateColor, onDeleteGrifo, onOpenNote }: GrifoPopupProps) {
  const popupState = useGrifoPopupState()
  const [showMore, setShowMore] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Calculate position relative to scroll container on open
  useLayoutEffect(() => {
    if (!popupState.isOpen || !scrollContainerRef.current) {
      setPos(null)
      return
    }

    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) { setPos(null); return }

    const range = sel.getRangeAt(0)
    const rangeRect = range.getBoundingClientRect()
    const containerRect = scrollContainerRef.current.getBoundingClientRect()
    const scrollTop = scrollContainerRef.current.scrollTop

    // Position above selection, centered horizontally
    // Use scrollTop to convert viewport coords to scroll-relative coords
    setPos({
      top: rangeRect.top - containerRect.top + scrollTop - 44,
      left: rangeRect.left - containerRect.left + (rangeRect.width / 2),
    })
  }, [popupState.isOpen, popupState.dispositivoId, scrollContainerRef])

  // Click outside to close
  useEffect(() => {
    if (!popupState.isOpen) return
    const handler = (e: MouseEvent) => {
      if (popupRef.current?.contains(e.target as Node)) return
      // Don't close if clicking inside the popup
      grifoPopupStore.close()
      setShowMore(false)
    }
    // Delay so the opening click doesn't immediately close
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [popupState.isOpen])

  // Escape + Delete shortcuts
  useEffect(() => {
    if (!popupState.isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { grifoPopupStore.close(); setShowMore(false) }
      if ((e.key === 'Delete' || e.key === 'Backspace') && popupState.existingGrifo) {
        e.preventDefault()
        handleDelete()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [popupState.isOpen, popupState.existingGrifo])

  const handleColorClick = useCallback((color: GrifoColor) => {
    grifoPopupStore.setLastColor(color)
    if (popupState.existingGrifo) {
      onUpdateColor(popupState.existingGrifo.id, color)
    } else {
      onCreateGrifo(color)
    }
    grifoPopupStore.close()
  }, [popupState.existingGrifo, onCreateGrifo, onUpdateColor])

  const handleDelete = useCallback(() => {
    if (popupState.existingGrifo) onDeleteGrifo(popupState.existingGrifo.id)
    grifoPopupStore.close()
    setShowMore(false)
  }, [popupState.existingGrifo, onDeleteGrifo])

  if (!popupState.isOpen || !pos || !scrollContainerRef.current) return null

  const sortedColors = [
    popupState.lastColor,
    ...COLOR_ORDER.filter(c => c !== popupState.lastColor),
  ]
  const isEditing = !!popupState.existingGrifo

  // Render directly inside scroll container with absolute positioning
  // No FloatingPortal, no floating-ui — pure CSS positioning, scrolls naturally
  return createPortal(
    <div
      ref={popupRef}
      role="toolbar"
      aria-label="Opções de grifo"
      style={{
        position: 'absolute',
        top: pos.top,
        left: pos.left,
        transform: 'translateX(-50%) translateZ(0)',
        zIndex: 60,
      }}
      className="bg-white/95 rounded-[10px] border border-black/[0.06] shadow-[0_4px_16px_rgba(0,0,0,0.08)] font-[Outfit,sans-serif] select-none"
    >
      <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2">
        {sortedColors.map((color, i) => {
          const isActive = isEditing && popupState.existingGrifo?.color === color
          const dotSize = i === 0 ? 18 : 14
          return (
            <button
              key={color}
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => handleColorClick(color)}
              className="rounded-full cursor-pointer transition-transform hover:scale-125 flex items-center justify-center p-2 sm:p-1"
              aria-label={GRIFO_COLOR_NAMES[color]}
              title={GRIFO_COLOR_NAMES[color]}
            >
              <div
                className={`rounded-full ${isActive ? 'ring-2 ring-offset-1 ring-black/20' : ''}`}
                style={{
                  width: dotSize,
                  height: dotSize,
                  background: GRIFO_COLORS[color].replace(/[\d.]+\)$/, '0.7)'),
                }}
              />
            </button>
          )
        })}

        {/* Delete button — only when editing existing grifo */}
        {isEditing && (
          <>
            <div className="w-px h-4 bg-black/[0.06] mx-0.5" />
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={handleDelete}
              className="rounded-full cursor-pointer transition-colors hover:bg-red-50 flex items-center justify-center p-1.5 sm:p-1"
              aria-label="Apagar grifo"
              title="Apagar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </>
        )}

        <div className="w-px h-4 bg-black/[0.06] mx-0.5" />

        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => onOpenNote()}
          className="text-[13px] text-[#8a9a8f] hover:text-[#3a5540] transition-colors p-2 sm:p-1 flex items-center justify-center"
          aria-label="Adicionar nota"
        >
          📝
        </button>

        <div className="relative">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setShowMore(!showMore)}
            className="text-[13px] text-[#8a9a8f] hover:text-[#3a5540] transition-colors p-2 sm:p-1 flex items-center justify-center"
            aria-label="Mais opções"
          >
            ···
          </button>

          {showMore && (
            <div className="absolute top-full right-0 mt-1 bg-white rounded-lg border border-black/[0.06] shadow-lg py-1 min-w-[160px] z-10">
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="w-full text-left px-3 py-2 text-[12px] text-red-500 hover:bg-red-50 transition-colors"
                >
                  Apagar grifo
                </button>
              )}
              <button
                disabled
                className="w-full text-left px-3 py-2 text-[12px] text-[#ccc] cursor-not-allowed"
              >
                Adicionar tags — Em breve
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    scrollContainerRef.current
  )
}
