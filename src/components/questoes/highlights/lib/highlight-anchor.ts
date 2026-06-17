import type { Anchor } from '../types';

const CONTEXT = 32;

function fullText(block: HTMLElement): string {
  return block.textContent ?? '';
}

function startOffset(block: HTMLElement, range: Range): number {
  const pre = document.createRange();
  pre.selectNodeContents(block);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
}

export function createAnchor(block: HTMLElement, range: Range): Anchor {
  const quote = range.toString();
  const start = startOffset(block, range);
  const full = fullText(block);
  return {
    quote,
    prefix: full.slice(Math.max(0, start - CONTEXT), start),
    suffix: full.slice(start + quote.length, start + quote.length + CONTEXT),
  };
}

function rangeAtOffset(block: HTMLElement, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let acc = 0;
  let node: Text | null;
  const range = document.createRange();
  let startSet = false;
  while ((node = walker.nextNode() as Text | null)) {
    const len = node.data.length;
    if (!startSet && start <= acc + len) { range.setStart(node, start - acc); startSet = true; }
    if (startSet && end <= acc + len) { range.setEnd(node, end - acc); return range; }
    acc += len;
  }
  return null;
}

/**
 * Acha a melhor ocorrência de `quote` no bloco, pontuando pela quantidade de
 * contexto (prefix/suffix) que casa. Retorna o Range ou null.
 */
export function resolveAnchor(block: HTMLElement, anchor: Anchor): Range | null {
  const full = fullText(block);
  const { quote, prefix, suffix } = anchor;
  if (!quote) return null;

  let best = -1;
  let bestScore = -1;
  let from = 0;
  for (;;) {
    const idx = full.indexOf(quote, from);
    if (idx === -1) break;
    const pre = full.slice(Math.max(0, idx - prefix.length), idx);
    const suf = full.slice(idx + quote.length, idx + quote.length + suffix.length);
    const score = commonSuffixLen(pre, prefix) + commonPrefixLen(suf, suffix);
    if (score > bestScore) { bestScore = score; best = idx; }
    from = idx + 1;
  }
  if (best === -1) return null;
  return rangeAtOffset(block, best, best + quote.length);
}

function commonSuffixLen(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}
function commonPrefixLen(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}
