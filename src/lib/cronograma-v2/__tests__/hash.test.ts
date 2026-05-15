import { describe, it, expect } from 'vitest'
import { computeEditalPayloadHash } from '../hash'

describe('computeEditalPayloadHash', () => {
  it('produces deterministic output for the same input', () => {
    const input = {
      disciplinas: [{ id: 1, nome: 'Constitucional' }, { id: 2, nome: 'Administrativo' }],
      topicos: [{ id: 11, disciplina_id: 1, nome: 'Princípios' }],
    }
    expect(computeEditalPayloadHash(input)).toBe(computeEditalPayloadHash(input))
  })

  it('is order-independent for disciplinas', () => {
    const a = computeEditalPayloadHash({
      disciplinas: [{ id: 1, nome: 'Constitucional' }, { id: 2, nome: 'Administrativo' }],
      topicos: [],
    })
    const b = computeEditalPayloadHash({
      disciplinas: [{ id: 2, nome: 'Administrativo' }, { id: 1, nome: 'Constitucional' }],
      topicos: [],
    })
    expect(a).toBe(b)
  })

  it('changes when a discipline name changes', () => {
    const a = computeEditalPayloadHash({
      disciplinas: [{ id: 1, nome: 'Constitucional' }],
      topicos: [],
    })
    const b = computeEditalPayloadHash({
      disciplinas: [{ id: 1, nome: 'Constitucional II' }],
      topicos: [],
    })
    expect(a).not.toBe(b)
  })

  it('truncates topico nome to 50 chars (avoids hash explosions)', () => {
    const longName = 'A'.repeat(100)
    const a = computeEditalPayloadHash({
      disciplinas: [],
      topicos: [{ id: 1, disciplina_id: 1, nome: longName }],
    })
    const b = computeEditalPayloadHash({
      disciplinas: [],
      topicos: [{ id: 1, disciplina_id: 1, nome: longName + 'extra' }],
    })
    // Como os primeiros 50 chars são idênticos, hashes devem bater
    expect(a).toBe(b)
  })
})
