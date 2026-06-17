import { describe, it, expect, beforeEach } from 'vitest';
import { createAnchor, resolveAnchor } from '../lib/highlight-anchor';

function blockWith(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.innerHTML = '';
  document.body.appendChild(el);
  return el;
}

/** Cria um Range cobrindo a 1ª ocorrência de `needle` no textContent do bloco. */
function rangeFor(block: HTMLElement, needle: string): Range {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const i = node.data.indexOf(needle);
    if (i !== -1) {
      const r = document.createRange();
      r.setStart(node, i);
      r.setEnd(node, i + needle.length);
      return r;
    }
  }
  throw new Error('needle não encontrado num único nó de texto: ' + needle);
}

describe('highlight-anchor', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('createAnchor captura quote, prefix e suffix', () => {
    const block = blockWith('<p>compete privativamente à União legislar sobre tributos</p>');
    const anchor = createAnchor(block, rangeFor(block, 'privativamente à União'));
    expect(anchor.quote).toBe('privativamente à União');
    expect(anchor.prefix.endsWith('compete ')).toBe(true);
    expect(anchor.suffix.startsWith(' legislar')).toBe(true);
  });

  it('resolveAnchor reencontra o trecho e devolve um Range com o texto certo', () => {
    const block = blockWith('<p>compete privativamente à União legislar</p>');
    const anchor = createAnchor(block, rangeFor(block, 'privativamente à União'));
    const range = resolveAnchor(block, anchor);
    expect(range).not.toBeNull();
    expect(range!.toString()).toBe('privativamente à União');
  });

  it('desambigua quote repetido pelo contexto (prefix/suffix)', () => {
    const block = blockWith('<p>a lei a lei a lei</p>'); // "a lei" 3x
    const a2 = createAnchor(block, rangeFor2(block, 'a lei', 2)); // 2ª ocorrência
    const range = resolveAnchor(block, a2);
    expect(range).not.toBeNull();
    const full = (block.textContent ?? '');
    const start = full.indexOf('a lei', full.indexOf('a lei') + 1);
    expect(offsetInBlock(block, range!)).toBe(start);
  });

  it('retorna null quando o trecho some (texto mudou)', () => {
    const block = blockWith('<p>compete privativamente à União</p>');
    const anchor = createAnchor(block, rangeFor(block, 'privativamente à União'));
    block.innerHTML = '<p>texto totalmente diferente</p>';
    expect(resolveAnchor(block, anchor)).toBeNull();
  });
});

// helpers que tocam offset global no bloco
function rangeFor2(block: HTMLElement, needle: string, nth: number): Range {
  const full = block.textContent ?? '';
  let idx = -1;
  for (let k = 0; k < nth; k++) idx = full.indexOf(needle, idx + 1);
  return rangeAtGlobalOffset(block, idx, idx + needle.length);
}
function rangeAtGlobalOffset(block: HTMLElement, start: number, end: number): Range {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let acc = 0; let node: Text | null; const r = document.createRange();
  let setStart = false;
  while ((node = walker.nextNode() as Text | null)) {
    const len = node.data.length;
    if (!setStart && start <= acc + len) { r.setStart(node, start - acc); setStart = true; }
    if (end <= acc + len) { r.setEnd(node, end - acc); return r; }
    acc += len;
  }
  throw new Error('offset fora do bloco');
}
function offsetInBlock(block: HTMLElement, range: Range): number {
  const pre = document.createRange();
  pre.selectNodeContents(block);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
}
