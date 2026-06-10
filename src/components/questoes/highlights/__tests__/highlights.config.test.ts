import { describe, it, expect } from 'vitest';
import { COLORS, MARK_TYPES, MARK_COLORS, DEFAULT_LAST_COLORS, TOOLS, bgFor, typeLabel } from '../highlights.config';
import { TOOL_TO_KIND } from '../types';

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

  it('MARK_COLORS são as 8 do mock (a 8ª é o cinza)', () => {
    expect(MARK_COLORS).toHaveLength(8);
    MARK_COLORS.forEach(c => expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/));
    expect(new Set(MARK_COLORS).size).toBe(8);
    expect(MARK_COLORS[7]).toBe('#8A8F98');
  });

  it('TOOL_TO_KIND mapeia as 4 ferramentas pros 4 kinds', () => {
    expect(TOOL_TO_KIND).toEqual({ peg: 'attention', comum: 'plain', sub: 'underline', tax: 'strike' });
  });

  it('DEFAULT_LAST_COLORS tem os defaults do mock, todos dentro de MARK_COLORS', () => {
    expect(DEFAULT_LAST_COLORS).toEqual({ comum: '#F2C231', peg: '#E0484D', sub: '#4F86E0', tax: '#E0484D' });
    Object.values(DEFAULT_LAST_COLORS).forEach(c => expect(MARK_COLORS).toContain(c));
  });

  it('TOOLS tem as 4 ferramentas com label e tecla', () => {
    expect(TOOLS.map(t => t.id)).toEqual(['peg', 'comum', 'sub', 'tax']);
    expect(TOOLS.map(t => t.key)).toEqual(['A', 'G', 'S', 'T']);
    expect(TOOLS.map(t => t.label)).toEqual(['Pegadinha', 'Grifar', 'Sublinhar', 'Tachar']);
  });
});
