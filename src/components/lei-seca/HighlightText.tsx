"use client"

import { memo } from 'react'

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

interface HighlightTextProps {
  text: string
  query: string
  className?: string
}

export const HighlightText = memo(function HighlightText({ text, query, className }: HighlightTextProps) {
  if (!query || query.length < 2) {
    return <span className={className}>{text}</span>
  }

  const escaped = escapeRegex(query)
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-gradient-to-r from-[#fff8e1] to-[#fff3c4] px-[3px] py-[1px] rounded-sm">{part}</mark>
          : part
      )}
    </span>
  )
})

// Sanitize API highlight HTML (ts_headline uses <b> tags)
// Strip everything except <b> and </b>
export function sanitizeHighlight(html: string): string {
  return html.replace(/<(?!\/?b>)[^>]*>/g, '')
}
