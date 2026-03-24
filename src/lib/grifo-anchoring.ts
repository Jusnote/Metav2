import type { Grifo, GrifoSegment } from '@/types/grifo'

/**
 * Verify a grifo's offset against current text.
 * Returns re-anchored offset or null (orphan).
 */
export function resolveAnchor(
  grifo: Grifo,
  normalizedTexto: string
): { start: number; end: number } | null {
  const slice = normalizedTexto.slice(grifo.start_offset, grifo.end_offset)
  if (slice === grifo.texto_grifado) {
    return { start: grifo.start_offset, end: grifo.end_offset }
  }

  const occurrences: number[] = []
  let idx = normalizedTexto.indexOf(grifo.texto_grifado)
  while (idx !== -1) {
    occurrences.push(idx)
    idx = normalizedTexto.indexOf(grifo.texto_grifado, idx + 1)
  }

  if (occurrences.length === 0) return null

  const closest = occurrences.reduce((best, cur) =>
    Math.abs(cur - grifo.start_offset) < Math.abs(best - grifo.start_offset) ? cur : best
  )

  return { start: closest, end: closest + grifo.texto_grifado.length }
}

/**
 * Build rendered segments from texto + grifos.
 * Handles anchoring, overlap resolution (latest updated_at wins), and orphan detection.
 */
export function buildSegments(
  normalizedTexto: string,
  grifos: Grifo[]
): {
  segments: GrifoSegment[]
  orphanIds: string[]
  reAnchored: Array<{ id: string; start_offset: number; end_offset: number }>
} {
  const orphanIds: string[] = []
  const reAnchored: Array<{ id: string; start_offset: number; end_offset: number }> = []

  type Anchored = { grifo: Grifo; start: number; end: number }
  const anchored: Anchored[] = []

  for (const grifo of grifos) {
    if (grifo.orphan) {
      orphanIds.push(grifo.id)
      continue
    }

    const anchor = resolveAnchor(grifo, normalizedTexto)
    if (!anchor) {
      orphanIds.push(grifo.id)
      continue
    }

    if (anchor.start !== grifo.start_offset || anchor.end !== grifo.end_offset) {
      reAnchored.push({ id: grifo.id, start_offset: anchor.start, end_offset: anchor.end })
    }

    anchored.push({ grifo, start: anchor.start, end: anchor.end })
  }

  if (anchored.length === 0) {
    return {
      segments: [{ text: normalizedTexto, startOffset: 0, endOffset: normalizedTexto.length }],
      orphanIds,
      reAnchored,
    }
  }

  // Build character-level color map (latest updated_at wins overlaps)
  const sorted = [...anchored].sort(
    (a, b) => new Date(a.grifo.updated_at).getTime() - new Date(b.grifo.updated_at).getTime()
  )

  const charMap = new Array<Grifo | null>(normalizedTexto.length).fill(null)
  for (const { grifo, start, end } of sorted) {
    for (let i = start; i < end && i < normalizedTexto.length; i++) {
      charMap[i] = grifo
    }
  }

  const segments: GrifoSegment[] = []
  let i = 0
  while (i < normalizedTexto.length) {
    const currentGrifo = charMap[i]
    let j = i + 1
    while (j < normalizedTexto.length && charMap[j] === currentGrifo) {
      j++
    }
    segments.push({
      text: normalizedTexto.slice(i, j),
      startOffset: i,
      endOffset: j,
      grifo: currentGrifo ?? undefined,
    })
    i = j
  }

  return { segments, orphanIds, reAnchored }
}

/**
 * Get the bold prefix end offset for a given dispositivo type.
 */
export function getBoldPrefixEnd(texto: string, tipo: string): number {
  let match: RegExpMatchArray | null = null

  if (tipo === 'ARTIGO') {
    match = texto.match(/^(Art\.\s*\d+[\-A-Z]*[\.\s]*)/)
  } else if (tipo === 'PARAGRAFO' || tipo === 'CAPUT') {
    match = texto.match(/^(§\s*\d+[ºo°]?[\-A-Z]*[\s\.\-]*)/)
  } else if (tipo === 'INCISO') {
    match = texto.match(/^([IVXLCDM]+\s*[\-–—]\s*)/)
  } else if (tipo === 'ALINEA') {
    match = texto.match(/^([a-z]\)\s*)/)
  }

  return match ? match[1].length : 0
}
