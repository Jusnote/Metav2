import { describe, it, expect } from 'vitest';
import { COLORS, MARK_TYPES, bgFor, typeLabel } from '../highlights.config';

describe('highlights.config', () => {
  it('tem 12 cores hex válidas e sem repetição', () => {
    expect(COLORS).toHaveLength(12);
    COLORS.forEach(c => expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/));
    expect(new Set(COLORS).size).toBe(12);
  });

  it('tem os 5 tipos de Atenção com label', () => {
    expect(MARK_TYPES.map(t => t.id)).toEqual(['pegadinha', 'chave', 'cuidado', 'sacada', 'revisar']);
    expect(typeLabel('pegadinha')).toBe('Pegadinha');
  });

  it('bgFor aplica alpha menor p/ atenção e maior p/ comum', () => {
    expect(bgFor('#E0484D', 'attention')).toBe('#E0484D2b');
    expect(bgFor('#E0484D', 'plain')).toBe('#E0484D3d');
  });
});
