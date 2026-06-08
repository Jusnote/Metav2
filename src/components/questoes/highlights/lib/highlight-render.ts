export interface RelRect { left: number; top: number; width: number; height: number; }

/** Retângulos de um Range relativos ao container (para desenhar o fundo). */
export function rangeRects(range: Range, container: HTMLElement): RelRect[] {
  const base = container.getBoundingClientRect();
  return Array.from(range.getClientRects()).map(r => ({
    left: r.left - base.left,
    top: r.top - base.top,
    width: r.width,
    height: r.height,
  }));
}

/** Posição do triângulo: canto sup-esq do primeiro retângulo. */
export function trianglePos(range: Range, container: HTMLElement): { left: number; top: number } | null {
  const rects = rangeRects(range, container);
  if (!rects.length) return null;
  return { left: rects[0].left, top: rects[0].top };
}

/** Qual marca (índice) contém o ponto do clique — hit-test pelos rects. */
export function hitTest(point: { x: number; y: number }, rectsByIndex: RelRect[][], container: HTMLElement): number {
  const base = container.getBoundingClientRect();
  const x = point.x - base.left;
  const y = point.y - base.top;
  for (let i = 0; i < rectsByIndex.length; i++) {
    for (const r of rectsByIndex[i]) {
      if (x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height) return i;
    }
  }
  return -1;
}
