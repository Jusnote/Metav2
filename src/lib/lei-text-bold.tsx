import React from 'react'

/**
 * Renders law text with the prefix marker (Art., §, I -, a)) in bold.
 * The texto from the API already contains the prefix as part of the string.
 */
export function BoldPrefix({ texto, tipo }: { texto: string; tipo: string }) {
  let match: RegExpMatchArray | null = null

  if (tipo === 'ARTIGO') {
    match = texto.match(/^(Art\.\s*\d+[\-A-Z]*[\.\s]*)(.*)$/s)
  } else if (tipo === 'PARAGRAFO' || tipo === 'CAPUT') {
    match = texto.match(/^(§\s*\d+[ºo°]?[\-A-Z]*[\s\.\-]*)(.*)$/s)
  } else if (tipo === 'INCISO') {
    match = texto.match(/^([IVXLCDM]+\s*[\-–—]\s*)(.*)$/s)
  } else if (tipo === 'ALINEA') {
    match = texto.match(/^([a-z]\)\s*)(.*)$/s)
  }

  if (match) {
    return <><strong className="underline">{match[1]}</strong>{match[2]}</>
  }

  return <>{texto}</>
}
