import { describe, it, expect } from 'vitest'
import { resolveAnchor, buildSegments, getBoldPrefixEnd } from '../grifo-anchoring'
import type { Grifo } from '@/types/grifo'

function makeGrifo(overrides: Partial<Grifo> = {}): Grifo {
  return {
    id: 'g1',
    user_id: 'u1',
    lei_id: 'lei1',
    dispositivo_id: 'd1',
    start_offset: 0,
    end_offset: 5,
    texto_grifado: 'hello',
    color: 'yellow',
    note: null,
    tags: [],
    orphan: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('resolveAnchor', () => {
  it('returns original offsets when text matches', () => {
    const g = makeGrifo({ start_offset: 6, end_offset: 11, texto_grifado: 'world' })
    expect(resolveAnchor(g, 'hello world foo')).toEqual({ start: 6, end: 11 })
  })

  it('re-anchors when text moved (single match)', () => {
    const g = makeGrifo({ start_offset: 0, end_offset: 5, texto_grifado: 'world' })
    expect(resolveAnchor(g, 'new prefix world here')).toEqual({ start: 11, end: 16 })
  })

  it('re-anchors to closest when multiple matches', () => {
    const g = makeGrifo({ start_offset: 10, end_offset: 12, texto_grifado: 'de' })
    // occurrences of 'de' at indices: 0, 6, 9, 15, 21
    const text = 'de abcde de abcde abcde'
    const result = resolveAnchor(g, text)
    // closest to offset 10 is index 9 (distance 1)
    expect(result).toEqual({ start: 9, end: 11 })
  })

  it('returns null when texto_grifado not found (orphan)', () => {
    const g = makeGrifo({ texto_grifado: 'vanished' })
    expect(resolveAnchor(g, 'completely different text')).toBeNull()
  })
})

describe('buildSegments', () => {
  it('returns single plain segment when no grifos', () => {
    const { segments } = buildSegments('hello world', [])
    expect(segments).toEqual([{ text: 'hello world', startOffset: 0, endOffset: 11 }])
  })

  it('builds correct segments for single grifo', () => {
    const g = makeGrifo({ start_offset: 6, end_offset: 11, texto_grifado: 'world' })
    const { segments } = buildSegments('hello world', [g])
    expect(segments).toHaveLength(2)
    expect(segments[0]).toEqual({ text: 'hello ', startOffset: 0, endOffset: 6 })
    expect(segments[1]).toMatchObject({ text: 'world', startOffset: 6, endOffset: 11, grifo: g })
  })

  it('resolves overlap: latest updated_at wins', () => {
    const gA = makeGrifo({ id: 'a', start_offset: 5, end_offset: 20, texto_grifado: 'x'.repeat(15), color: 'yellow', updated_at: '2026-01-01T10:00:00Z' })
    const gB = makeGrifo({ id: 'b', start_offset: 15, end_offset: 30, texto_grifado: 'x'.repeat(15), color: 'green', updated_at: '2026-01-01T10:05:00Z' })
    const text = 'x'.repeat(35)
    const { segments } = buildSegments(text, [gA, gB])

    const grifoed = segments.filter(s => s.grifo)
    expect(grifoed[0].grifo?.color).toBe('yellow')
    expect(grifoed[0].startOffset).toBe(5)
    expect(grifoed[0].endOffset).toBe(15)
    expect(grifoed[1].grifo?.color).toBe('green')
    expect(grifoed[1].startOffset).toBe(15)
    expect(grifoed[1].endOffset).toBe(30)
  })

  it('detects orphans', () => {
    const g = makeGrifo({ texto_grifado: 'vanished' })
    const { segments, orphanIds } = buildSegments('different text', [g])
    expect(orphanIds).toContain('g1')
    expect(segments).toHaveLength(1)
  })

  it('skips already-orphaned grifos', () => {
    const g = makeGrifo({ orphan: true })
    const { orphanIds } = buildSegments('any text', [g])
    expect(orphanIds).toContain('g1')
  })

  it('tracks re-anchored grifos', () => {
    const g = makeGrifo({ start_offset: 0, end_offset: 5, texto_grifado: 'world' })
    const { reAnchored } = buildSegments('hello world', [g])
    expect(reAnchored).toHaveLength(1)
    expect(reAnchored[0]).toEqual({ id: 'g1', start_offset: 6, end_offset: 11 })
  })

  it('handles multiple non-overlapping grifos', () => {
    const g1 = makeGrifo({ id: 'g1', start_offset: 0, end_offset: 5, texto_grifado: 'hello', color: 'yellow' })
    const g2 = makeGrifo({ id: 'g2', start_offset: 6, end_offset: 11, texto_grifado: 'world', color: 'blue' })
    const { segments } = buildSegments('hello world', [g1, g2])
    expect(segments).toHaveLength(3)
  })

  it('handles grifo at start of text', () => {
    const g = makeGrifo({ start_offset: 0, end_offset: 3, texto_grifado: 'Art' })
    const { segments } = buildSegments('Art. 121.', [g])
    expect(segments[0]).toMatchObject({ text: 'Art', grifo: g })
  })

  it('handles grifo covering entire text', () => {
    const text = 'entire text'
    const g = makeGrifo({ start_offset: 0, end_offset: text.length, texto_grifado: text })
    const { segments } = buildSegments(text, [g])
    expect(segments).toHaveLength(1)
    expect(segments[0].grifo).toBe(g)
  })
})

describe('getBoldPrefixEnd', () => {
  it('detects ARTIGO prefix', () => {
    expect(getBoldPrefixEnd('Art. 121. Matar alguem', 'ARTIGO')).toBe(10)
  })

  it('detects PARAGRAFO prefix', () => {
    expect(getBoldPrefixEnd('§ 2º Se o homicídio', 'PARAGRAFO')).toBe(5)
  })

  it('detects INCISO prefix', () => {
    expect(getBoldPrefixEnd('IV — à traição', 'INCISO')).toBe(5)
  })

  it('detects ALINEA prefix', () => {
    expect(getBoldPrefixEnd('a) violência doméstica', 'ALINEA')).toBe(3)
  })

  it('returns 0 for PENA', () => {
    expect(getBoldPrefixEnd('Pena — reclusão', 'PENA')).toBe(0)
  })
})
