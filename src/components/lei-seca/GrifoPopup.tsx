"use client"

import { useCallback, useEffect, useState, useLayoutEffect, useRef } from 'react'
import {
  useFloating,
  flip,
  shift,
  offset,
  hide,
  autoUpdate,
  useDismiss,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react'
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
  const rangeRef = useRef<Range | null>(null)
  const [hasRange, setHasRange] = useState(false)

  // Capture cloned Range on open
  useLayoutEffect(() => {
    if (!popupState.isOpen) {
      rangeRef.current = null
      setHasRange(false)
      return
    }
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      try {
        rangeRef.current = sel.getRangeAt(0).cloneRange()
      } catch {
        rangeRef.current = null
      }
      setHasRange(!!rangeRef.current)
    }
  }, [popupState.isOpen, popupState.dispositivoId])

  // Virtual element with live getBoundingClientRect + contextElement = scroll container
  const virtualElement = hasRange ? {
    getBoundingClientRect: () => {
      if (!rangeRef.current) return new DOMRect()
      return rangeRef.current.getBoundingClientRect()
    },
    getClientRects: () => {
      if (!rangeRef.current) return [] as unknown as DOMRectList
      return rangeRef.current.getClientRects()
    },
    contextElement: scrollContainerRef.current ?? undefined,
  } : undefined

  const { refs, floatingStyles, context, middlewareData } = useFloating({
    open: popupState.isOpen && hasRange,
    onOpenChange: (open) => { if (!open) grifoPopupStore.close() },
    strategy: 'absolute',  // position relative to containing block, not viewport
    placement: 'top',
    middleware: [
      offset(8),
      flip({ fallbackPlacements: ['bottom'] }),
      shift({ padding: 8 }),
      hide(),
    ],
    whileElementsMounted: (...args) => autoUpdate(...args, {
      animationFrame: true,  // 60fps — frame-perfect like TipTap
    }),
    elements: {
      reference: virtualElement as any,
    },
  })

  const isReferenceHidden = middlewareData.hide?.referenceHidden

  const dismiss = useDismiss(context, {
    escapeKey: true,
    outsidePress: true,
  })

  const { getFloatingProps } = useInteractions([dismiss])

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

  useEffect(() => {
    if (!popupState.isOpen) return
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && popupState.existingGrifo) {
        e.preventDefault()
        handleDelete()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [popupState.isOpen, popupState.existingGrifo, handleDelete])

  if (!popupState.isOpen || !hasRange) return null

  const sortedColors = [
    popupState.lastColor,
    ...COLOR_ORDER.filter(c => c !== popupState.lastColor),
  ]
  const isEditing = !!popupState.existingGrifo

  return (
    <FloatingPortal root={scrollContainerRef}>
      <div
        ref={refs.setFloating}
        style={{
          ...floatingStyles,
          zIndex: 60,
          visibility: isReferenceHidden ? 'hidden' : 'visible',
        }}
        {...getFloatingProps()}
        className="bg-white/95 rounded-[10px] border border-black/[0.06] shadow-[0_4px_16px_rgba(0,0,0,0.08)] font-[Outfit,sans-serif] select-none"
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
      </div>
    </FloatingPortal>
  )
}
