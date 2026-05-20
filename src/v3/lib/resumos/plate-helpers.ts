// Helpers para inspecionar conteúdo Plate sem renderizar.
// Usado pra extrair TOC (headings) no leitor.

import type { Value } from 'platejs'

export interface TocEntry {
  id: string
  texto: string
  nivel: 1 | 2 | 3
}

/** Slugify simples pt-BR — usado pra ID de heading e link de TOC. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
}

function extrairTexto(node: unknown): string {
  if (typeof node !== 'object' || node === null) return ''
  if ('text' in node && typeof (node as { text: unknown }).text === 'string') {
    return (node as { text: string }).text
  }
  if (
    'children' in node &&
    Array.isArray((node as { children: unknown }).children)
  ) {
    return (node as { children: unknown[] }).children.map(extrairTexto).join('')
  }
  return ''
}

export function extrairToc(valor: Value): TocEntry[] {
  if (!Array.isArray(valor)) return []
  const entries: TocEntry[] = []
  let counter = 0
  for (const bloco of valor) {
    if (typeof bloco !== 'object' || bloco === null) continue
    const tipo = (bloco as { type?: unknown }).type
    let nivel: 1 | 2 | 3 | null = null
    if (tipo === 'h1') nivel = 1
    else if (tipo === 'h2') nivel = 2
    else if (tipo === 'h3') nivel = 3
    if (!nivel) continue
    const texto = extrairTexto(bloco).trim()
    if (!texto) continue
    const base = slugify(texto) || `secao-${counter}`
    let id = base
    let n = 1
    while (entries.some((e) => e.id === id)) {
      n += 1
      id = `${base}-${n}`
    }
    counter += 1
    entries.push({ id, texto, nivel })
  }
  return entries
}
