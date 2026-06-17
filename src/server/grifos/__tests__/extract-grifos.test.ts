import { describe, it, expect } from 'vitest';
import {
  buildUserMessage,
  parseGrifos,
  mapLocalToTarget,
  computeContext,
  extractGrifos,
} from '../extract-grifos';
import type { GrifoQuestion, GrifoRaw } from '../grifos.types';

/**
 * Replica EXATAMENTE o casamento do front-end `resolveAnchor`:
 * indexOf estrito de `trecho` no textContent do bloco. Se este helper
 * acha o trecho, o resolver real também acha — é o nosso contrato.
 */
function resolverFinds(trecho: string, targetText: string): boolean {
  return targetText.indexOf(trecho) !== -1;
}

describe('mapLocalToTarget', () => {
  it('mapeia "alternativa C" → alt:C (uppercase)', () => {
    expect(mapLocalToTarget('alternativa C')).toBe('alt:C');
  });

  it('mapeia "alternativa c" minúsculo → alt:C', () => {
    expect(mapLocalToTarget('alternativa c')).toBe('alt:C');
  });

  it('mapeia "item II" → enunciado', () => {
    expect(mapLocalToTarget('item II')).toBe('enunciado');
  });

  it('mapeia "enunciado" → enunciado', () => {
    expect(mapLocalToTarget('enunciado')).toBe('enunciado');
  });

  it('mapeia local desconhecido → enunciado', () => {
    expect(mapLocalToTarget('comando da questão')).toBe('enunciado');
  });
});

describe('computeContext', () => {
  it('corta prefix/suffix em no máximo 32 chars', () => {
    const before = 'x'.repeat(40);
    const after = 'y'.repeat(40);
    const text = `${before}ALVO${after}`;
    const { prefix, suffix } = computeContext(text, 'ALVO');
    expect(prefix.length).toBe(32);
    expect(suffix.length).toBe(32);
    expect(prefix).toBe('x'.repeat(32));
    expect(suffix).toBe('y'.repeat(32));
  });

  it('retorna vazios nas bordas (início/fim do texto)', () => {
    const text = 'ALVO';
    const { prefix, suffix } = computeContext(text, 'ALVO');
    expect(prefix).toBe('');
    expect(suffix).toBe('');
  });

  it('usa a primeira ocorrência (prefix = antes da 1ª, suffix = até 32 chars depois)', () => {
    const text = 'aaaALVObbbALVOccc';
    const { prefix, suffix } = computeContext(text, 'ALVO');
    expect(prefix).toBe('aaa'); // ancorado na 1ª ocorrência (idx 3)
    expect(suffix).toBe('bbbALVOccc'); // 32 chars após a 1ª, atravessa a 2ª
  });

  it('retorna vazios quando o trecho não existe', () => {
    expect(computeContext('texto qualquer', 'inexistente')).toEqual({ prefix: '', suffix: '' });
  });
});

describe('parseGrifos', () => {
  it('faz parse de JSON puro', () => {
    const raw = '{"tipo_estrutura":"MC","grifos":[{"local":"alternativa A","trecho":"x","tipo_armadilha":"t","tooltip":"tt"}]}';
    const out = parseGrifos(raw);
    expect(out.tipo_estrutura).toBe('MC');
    expect(out.grifos).toHaveLength(1);
    expect(out.grifos[0].trecho).toBe('x');
  });

  it('remove cercas ```json ... ```', () => {
    const raw = '```json\n{"tipo_estrutura":"CE","grifos":[]}\n```';
    const out = parseGrifos(raw);
    expect(out.tipo_estrutura).toBe('CE');
    expect(out.grifos).toEqual([]);
  });

  it('remove cercas ``` ... ``` sem a tag json', () => {
    const raw = '```\n{"tipo_estrutura":null,"grifos":[]}\n```';
    const out = parseGrifos(raw);
    expect(out.tipo_estrutura).toBeNull();
  });

  it('tolera campos faltando (defaults para arrays/strings)', () => {
    const raw = '{"grifos":[{"local":"enunciado"}]}';
    const out = parseGrifos(raw);
    expect(out.tipo_estrutura).toBeNull();
    expect(out.grifos[0]).toEqual({ local: 'enunciado', trecho: '', tipo_armadilha: '', tooltip: '' });
  });

  it('tolera grifos ausente → array vazio', () => {
    const out = parseGrifos('{"tipo_estrutura":"X"}');
    expect(out.grifos).toEqual([]);
  });

  it('lança erro claro quando não é JSON válido', () => {
    expect(() => parseGrifos('isto não é json {{{')).toThrow();
  });
});

describe('buildUserMessage', () => {
  it('formata enunciado, alternativas pipe-joined e gabarito', () => {
    const q: GrifoQuestion = {
      enunciado: 'Sobre tributos:',
      alternativas: [
        { letter: 'A', text: 'primeira' },
        { letter: 'B', text: 'segunda' },
      ],
      correta: 'B',
      banca: 'CESPE',
      ano: 2022,
    };
    const msg = buildUserMessage(q);
    expect(msg).toContain('banca CESPE');
    expect(msg).toContain('2022');
    expect(msg).toContain('ENUNCIADO:\nSobre tributos:');
    expect(msg).toContain('A) primeira | B) segunda');
    expect(msg).toContain('GABARITO (correta): B');
  });
});

// --- O GUARD (o coração da feature) -------------------------------------

function fakeCallOpus(json: string) {
  return async () => json;
}

describe('extractGrifos — guard literal (espelha resolveAnchor)', () => {
  it('DESCARTA um trecho que não existe no texto do target', async () => {
    const q: GrifoQuestion = {
      enunciado: 'O prazo prescricional é de três anos.',
      alternativas: [{ letter: 'A', text: 'O prazo é de cinco anos.' }],
      correta: 'A',
    };
    const grifos: GrifoRaw[] = [
      { local: 'alternativa A', trecho: 'dez anos', tipo_armadilha: 'prazo', tooltip: 'errado' },
    ];
    const raw = JSON.stringify({ tipo_estrutura: 'MC', grifos });
    const res = await extractGrifos(q, fakeCallOpus(raw));
    expect(res.grifos).toHaveLength(0);
  });

  it('MANTÉM um trecho que casa literal e calcula prefix/suffix', async () => {
    const q: GrifoQuestion = {
      enunciado: 'O prazo prescricional é de três anos contados do fato.',
      alternativas: [{ letter: 'A', text: 'cinco anos' }],
      correta: 'A',
    };
    const grifos: GrifoRaw[] = [
      { local: 'enunciado', trecho: 'três anos', tipo_armadilha: 'prazo', tooltip: 'na verdade são cinco' },
    ];
    const raw = JSON.stringify({ tipo_estrutura: 'CE', grifos });
    const res = await extractGrifos(q, fakeCallOpus(raw));
    expect(res.grifos).toHaveLength(1);
    const g = res.grifos[0];
    expect(g.target).toBe('enunciado');
    expect(g.trecho).toBe('três anos');
    expect(g.tipoArmadilha).toBe('prazo');
    expect(g.tooltip).toBe('na verdade são cinco');
    // o trecho guardado é achável pelo resolver (indexOf estrito)
    expect(resolverFinds(g.trecho, q.enunciado)).toBe(true);
    expect(q.enunciado.indexOf(g.prefix + g.trecho + g.suffix)).toBeGreaterThanOrEqual(0);
  });

  it('SNAP: trecho com espaços variantes vira a substring EXATA da fonte', async () => {
    // Fonte tem espaço duplo; o modelo devolveu espaço simples.
    const q: GrifoQuestion = {
      enunciado: 'compete  privativamente  à União legislar',
      alternativas: [],
      correta: 'A',
    };
    const grifos: GrifoRaw[] = [
      { local: 'enunciado', trecho: 'privativamente à União', tipo_armadilha: 'comp', tooltip: 'x' },
    ];
    const raw = JSON.stringify({ tipo_estrutura: 'CE', grifos });
    const res = await extractGrifos(q, fakeCallOpus(raw));
    expect(res.grifos).toHaveLength(1);
    const g = res.grifos[0];
    // trecho original NÃO casa literal; após snap, DEVE casar
    expect(q.enunciado.indexOf('privativamente à União')).toBe(-1);
    expect(g.trecho).toBe('privativamente  à União'); // espaço duplo da fonte
    expect(resolverFinds(g.trecho, q.enunciado)).toBe(true);
  });

  it('roteia "item II" para o enunciado (item-based)', async () => {
    const q: GrifoQuestion = {
      enunciado: 'I - correto; II - a posse se adquire pela mera detenção; III - certo',
      alternativas: [{ letter: 'A', text: 'apenas I e III' }],
      correta: 'A',
    };
    const grifos: GrifoRaw[] = [
      { local: 'item II', trecho: 'a posse se adquire pela mera detenção', tipo_armadilha: 'conceito', tooltip: 'errado' },
    ];
    const raw = JSON.stringify({ tipo_estrutura: 'itens', grifos });
    const res = await extractGrifos(q, fakeCallOpus(raw));
    expect(res.grifos).toHaveLength(1);
    expect(res.grifos[0].target).toBe('enunciado');
    expect(resolverFinds(res.grifos[0].trecho, q.enunciado)).toBe(true);
  });

  it('roteia "alternativa C" para alt:C e acha na alternativa', async () => {
    const q: GrifoQuestion = {
      enunciado: 'Assinale:',
      alternativas: [
        { letter: 'A', text: 'certa' },
        { letter: 'C', text: 'o prazo é decadencial de dez anos' },
      ],
      correta: 'A',
    };
    const grifos: GrifoRaw[] = [
      { local: 'alternativa C', trecho: 'decadencial de dez anos', tipo_armadilha: 'prazo', tooltip: 'é prescricional' },
    ];
    const raw = JSON.stringify({ tipo_estrutura: 'MC', grifos });
    const res = await extractGrifos(q, fakeCallOpus(raw));
    expect(res.grifos).toHaveLength(1);
    expect(res.grifos[0].target).toBe('alt:C');
    expect(resolverFinds(res.grifos[0].trecho, q.alternativas[1].text)).toBe(true);
  });

  it('descarta grifo cujo target (alt:Z) não existe', async () => {
    const q: GrifoQuestion = {
      enunciado: 'Assinale:',
      alternativas: [{ letter: 'A', text: 'algo' }],
      correta: 'A',
    };
    const grifos: GrifoRaw[] = [
      { local: 'alternativa Z', trecho: 'algo', tipo_armadilha: 't', tooltip: 'tt' },
    ];
    const raw = JSON.stringify({ tipo_estrutura: 'MC', grifos });
    const res = await extractGrifos(q, fakeCallOpus(raw));
    expect(res.grifos).toHaveLength(0);
  });

  it('propaga tipoEstrutura', async () => {
    const q: GrifoQuestion = { enunciado: 'x', alternativas: [], correta: 'A' };
    const raw = JSON.stringify({ tipo_estrutura: 'certo/errado', grifos: [] });
    const res = await extractGrifos(q, fakeCallOpus(raw));
    expect(res.tipoEstrutura).toBe('certo/errado');
    expect(res.grifos).toEqual([]);
  });
});
