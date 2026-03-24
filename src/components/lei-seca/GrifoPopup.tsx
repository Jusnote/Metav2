"use client"

import { useCallback, useEffect, useState, useLayoutEffect, useRef } from 'react'
import { useGrifoPopupState, grifoPopupStore } from '@/stores/grifoPopupStore'
import type { GrifoColor } from '@/types/grifo'
import { GRIFO_COLORS, GRIFO_COLOR_NAMES } from '@/types/grifo'

const COLOR_ORDER: GrifoColor[] = ['yellow', 'green', 'blue', 'pink', 'orange']

interface GrifoPopupProps {
  onCreateGrifo: (color: GrifoColor) => void
  onUpdateColor: (grifoId: string, color: GrifoColor) => void
  onDeleteGrifo: (grifoId: string) => void
  onOpenNote: () => void
}

/**
 * Grifo popup rendered via DOM portal inside the dispositivo container.
 * Uses position:absolute so it scrolls naturally with content — no JS repositioning.
 */
export function GrifoPopup({ onCreateGrifo, onUpdateColor, onDeleteGrifo, onOpenNote }: GrifoPopupProps) {
  const popupState = useGrifoPopupState()
  const [showMore, setShowMore] = useState(false)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const popupRef = useRef<HTMLDivElement>(null)

  // On open: find the dispositivo container, compute position, create portal target
  useLayoutEffect(() => {
    if (!popupState.isOpen) {
      setPortalTarget(null)
      return
    }

    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) {
      setPortalTarget(null)
      return
    }

    const range = sel.getRangeAt(0)
    const rangeRect = range.getBoundingClientRect()

    // Find the dispositivo container [data-id]
    const startEl = range.startContainer instanceof HTMLElement
      ? range.startContainer
      : range.startContainer.parentElement
    const dispEl = startEl?.closest('[data-id]') as HTMLElement | null
    if (!dispEl) {
      setPortalTarget(null)
      return
    }

    // Ensure dispositivo has position:relative for absolute child
    if (getComputedStyle(dispEl).position === 'static') {
      dispEl.style.position = 'relative'
    }

    // Calculate position relative to the dispositivo container
    const dispRect = dispEl.getBoundingClientRect()
    const top = rangeRect.top - dispRect.top - 44 // 44px = popup height + gap
    const left = rangeRect.left - dispRect.left + (rangeRect.width / 2)

    setPosition({ top: Math.max(-44, top), left: Math.max(0, left) })
    setPortalTarget(dispEl)
  }, [popupState.isOpen, popupState.dispositivoId])

  // Click outside to close
  useEffect(() => {
    if (!popupState.isOpen) return
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        grifoPopupStore.close()
        setShowMore(false)
      }
    }
    // Delay to avoid closing on the same click that opened
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler)
    }, 10)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [popupState.isOpen])

  // Escape to close
  useEffect(() => {
    if (!popupState.isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        grifoPopupStore.close()
        setShowMore(false)
      }
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
    if (popupState.existingGrifo) {
      onDeleteGrifo(popupState.existingGrifo.id)
    }
    grifoPopupStore.close()
    setShowMore(false)
  }, [popupState.existingGrifo, onDeleteGrifo])

  const handleNote = useCallback(() => {
    onOpenNote()
    setShowMore(false)
  }, [onOpenNote])

  if (!popupState.isOpen || !portalTarget) return null

  const sortedColors = [
    popupState.lastColor,
    ...COLOR_ORDER.filter(c => c !== popupState.lastColor),
  ]
  const isEditing = !!popupState.existingGrifo

  // Render via React portal into the dispositivo container
  const { createPortal } = require('react-dom')

  return createPortal(
    <div
      ref={popupRef}
      className="absolute bg-white/95 rounded-[10px] border border-black/[0.06] shadow-[0_4px_16px_rgba(0,0,0,0.08)] font-[Outfit,sans-serif] select-none"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)',
        zIndex: 60,
      }}
      role="toolbar"
      aria-label="Opções de grifo"
    >
      <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2">
        {sortedColors.map((color, i) => {
          const isActive = isEditing && popupState.existingGrifo?.color === color
          const dotSize = i === 0 ? 18 : 14
          return (
            <button
              key={color}
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

        <div className="w-px h-4 bg-black/[0.06] mx-0.5" />

        <button
          onClick={handleNote}
          className="text-[13px] text-[#8a9a8f] hover:text-[#3a5540] transition-colors p-2 sm:p-1 flex items-center justify-center"
          aria-label="Adicionar nota"
          title="Nota"
        >
          📝
        </button>

        <div className="relative">
          <button
            onClick={() => setShowMore(!showMore)}
            className="text-[13px] text-[#8a9a8f] hover:text-[#3a5540] transition-colors p-2 sm:p-1 flex items-center justify-center"
            aria-label="Mais opções"
            title="Mais"
          >
            ···
          </button>

          {showMore && (
            <div className="absolute top-full right-0 mt-1 bg-white rounded-lg border border-black/[0.06] shadow-lg py-1 min-w-[160px] z-10">
              {isEditing && (
                <button
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
    portalTarget
  )
}
