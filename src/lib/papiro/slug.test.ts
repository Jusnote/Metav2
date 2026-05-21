import { describe, it, expect } from 'vitest';
import {
  isValidSlug,
  validateSlug,
  buildMacroAreaSlug,
  buildTemaSlug,
  parseMacroAreaSlug,
  parseTemaSlug,
  disciplinaUrl,
  macroAreaUrl,
  temaUrl,
} from './slug';

describe('isValidSlug', () => {
  it('aceita slug com letras minúsculas, dígitos, ponto e underscore', () => {
    expect(isValidSlug('informatica')).toBe(true);
    expect(isValidSlug('informatica.redes_internet')).toBe(true);
    expect(isValidSlug('informatica.redes_internet.fundamentos_redes')).toBe(true);
    expect(isValidSlug('a1.b2_c3')).toBe(true);
  });

  it('rejeita slug com maiúscula, espaço, acento ou caractere especial', () => {
    expect(isValidSlug('Informatica')).toBe(false);
    expect(isValidSlug('informática')).toBe(false);
    expect(isValidSlug('redes internet')).toBe(false);
    expect(isValidSlug('redes-internet')).toBe(false);
    expect(isValidSlug('redes/internet')).toBe(false);
    expect(isValidSlug('')).toBe(false);
  });
});

describe('validateSlug', () => {
  it('joga Error quando inválido', () => {
    expect(() => validateSlug('Foo')).toThrow();
    expect(() => validateSlug('')).toThrow();
  });
  it('não joga quando válido', () => {
    expect(() => validateSlug('informatica.redes_internet')).not.toThrow();
  });
});

describe('buildMacroAreaSlug', () => {
  it('concatena disciplina + macroAreaTail com ponto', () => {
    expect(buildMacroAreaSlug('informatica', 'redes_internet'))
      .toBe('informatica.redes_internet');
  });
});

describe('buildTemaSlug', () => {
  it('concatena os 3 segmentos com pontos', () => {
    expect(buildTemaSlug('informatica', 'redes_internet', 'fundamentos_redes'))
      .toBe('informatica.redes_internet.fundamentos_redes');
  });
});

describe('parseMacroAreaSlug', () => {
  it('faz split em 2 partes pelos pontos', () => {
    expect(parseMacroAreaSlug('informatica.redes_internet'))
      .toEqual({ disciplinaSlug: 'informatica', macroAreaTail: 'redes_internet' });
  });
  it('joga Error se não tiver exatamente 2 segmentos', () => {
    expect(() => parseMacroAreaSlug('informatica')).toThrow();
    expect(() => parseMacroAreaSlug('a.b.c')).toThrow();
  });
});

describe('parseTemaSlug', () => {
  it('faz split em 3 partes', () => {
    expect(parseTemaSlug('informatica.redes_internet.fundamentos_redes'))
      .toEqual({
        disciplinaSlug: 'informatica',
        macroAreaTail: 'redes_internet',
        temaTail: 'fundamentos_redes',
      });
  });
  it('joga Error se não tiver exatamente 3 segmentos', () => {
    expect(() => parseTemaSlug('informatica.redes_internet')).toThrow();
  });
});

describe('URL helpers', () => {
  it('disciplinaUrl gera /estudar/<slug>', () => {
    expect(disciplinaUrl('informatica')).toBe('/estudar/informatica');
  });
  it('macroAreaUrl converte ponto → barra', () => {
    expect(macroAreaUrl('informatica.redes_internet'))
      .toBe('/estudar/informatica/redes_internet');
  });
  it('temaUrl converte 2 pontos → 2 barras', () => {
    expect(temaUrl('informatica.redes_internet.fundamentos_redes'))
      .toBe('/estudar/informatica/redes_internet/fundamentos_redes');
  });
});

describe('roundtrip', () => {
  it('buildTemaSlug ↔ parseTemaSlug invertem-se', () => {
    const original = { disciplinaSlug: 'informatica', macroAreaTail: 'redes_internet', temaTail: 'fundamentos_redes' };
    const slug = buildTemaSlug(original.disciplinaSlug, original.macroAreaTail, original.temaTail);
    expect(parseTemaSlug(slug)).toEqual(original);
  });
});
