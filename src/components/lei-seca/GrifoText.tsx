"use client"

import { useMemo, memo, useCallback } from 'react'
import type { Grifo, GrifoSegment } from '@/types/grifo'
import { GRIFO_COLORS, GRIFO_COLOR_NAMES } from '@/types/grifo'
import { buildSegments, getBoldPrefixEnd } from '@/lib/grifo-anchoring'

interface GrifoTextProps {
  texto: string
  tipo?: string
  grifos: Grifo[]
  onGrifoClick?: (grifo: Grifo, rect: DOMRect) => void
  renderMark?: (props: { grifo: Grifo; children: React.ReactNode }) => React.ReactNode
}

export const GrifoText = memo(function GrifoText({
  texto,
  tipo,
  grifos,
  onGrifoClick,
  renderMark,
}: GrifoTextProps) {
  const { segments } = useMemo(
    () => buildSegments(texto, grifos),
    [texto, grifos]
  )

  const boldEnd = useMemo(
    () => tipo ? getBoldPrefixEnd(texto, tipo) : 0,
    [texto, tipo]
  )

  const handleMarkClick = useCallback((grifo: Grifo, e: React.MouseEvent) => {
    if (!onGrifoClick) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    onGrifoClick(grifo, rect)
  }, [onGrifoClick])

  // Debug: track when grifos are received
  if (grifos.length > 0) {
    console.log('[GrifoText] rendering with', grifos.length, 'grifos, segments:', segments.length)
  }

  // If no grifos, render with BoldPrefix logic only (fast path)
  if (grifos.length === 0) {
    if (boldEnd > 0) {
      return <><strong>{texto.slice(0, boldEnd)}</strong>{texto.slice(boldEnd)}</>
    }
    return <>{texto}</>
  }

  return (
    <>
      {segments.map((seg, i) => {
        const content = renderSegmentContent(seg, boldEnd)

        if (seg.grifo) {
          if (renderMark) {
            return <span key={i}>{renderMark({ grifo: seg.grifo, children: content })}</span>
          }

          return (
            <mark
              key={i}
              className="grifo cursor-pointer rounded-sm"
              data-grifo-id={seg.grifo.id}
              aria-label={`grifo ${GRIFO_COLOR_NAMES[seg.grifo.color]}`}
              style={{
                background: GRIFO_COLORS[seg.grifo.color],
                padding: '1px 0',
              }}
              onClick={(e) => handleMarkClick(seg.grifo!, e)}
            >
              {content}
            </mark>
          )
        }

        return <span key={i}>{content}</span>
      })}
    </>
  )
})

function renderSegmentContent(seg: GrifoSegment, boldEnd: number): React.ReactNode {
  if (boldEnd <= 0) return seg.text

  const segStart = seg.startOffset
  const segEnd = seg.endOffset

  if (segEnd <= boldEnd) {
    return <strong>{seg.text}</strong>
  }

  if (segStart >= boldEnd) {
    return seg.text
  }

  const boldChars = boldEnd - segStart
  return (
    <>
      <strong>{seg.text.slice(0, boldChars)}</strong>
      {seg.text.slice(boldChars)}
    </>
  )
}
