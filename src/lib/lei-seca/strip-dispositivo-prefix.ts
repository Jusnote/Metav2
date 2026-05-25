import type { Grifo } from '@/types/grifo';

// Remove o prefixo redundante do início do texto de cada tipo de dispositivo,
// porque o marker visual ("§ 1", "I", "a)", "art. 5") já aparece na coluna de
// marker — não precisa repetir no texto.
//
// Cobre variações de hífen/traço/em-dash/num-com-letra e ordinais (1º, 1°, 1ª).
// Se o regex não casar, retorna o texto/grifos intactos (removed: 0).
const PREFIX_REGEXES: Partial<Record<string, RegExp>> = {
  ARTIGO:    /^Art\.?\s+\d+(?:[-–—]?[A-Za-z]?)?(?:\s*[º°ª])?\s*[-–—]?\s*/i,
  CAPUT:     /^Art\.?\s+\d+(?:[-–—]?[A-Za-z]?)?(?:\s*[º°ª])?\s*[-–—]?\s*/i,
  PARAGRAFO: /^(?:§\s*\d+(?:[-–—]?[A-Za-z]?)?(?:\s*[º°ª])?|Par[áa]grafo\s+[úu]nico)\s*[-–—]?\s*/i,
  INCISO:    /^[IVXLCDM]+\s*[-–—]\s*/,
  ALINEA:    /^[a-z]\s*\)\s*/i,
};

export interface StripResult {
  texto: string;
  grifos: Grifo[];
  removed: number;
}

export function stripDispositivoPrefix(
  tipo: string,
  texto: string,
  grifos: Grifo[],
): StripResult {
  const safeTexto = texto ?? '';
  const regex = PREFIX_REGEXES[tipo];
  if (!regex) return { texto: safeTexto, grifos, removed: 0 };

  const match = safeTexto.match(regex);
  if (!match || match[0].length === 0) return { texto: safeTexto, grifos, removed: 0 };

  const removed = match[0].length;
  const newTexto = safeTexto.slice(removed);

  const newGrifos: Grifo[] = [];
  for (const g of grifos) {
    const newEnd = g.end_offset - removed;
    if (newEnd <= 0) continue; // grifo inteiramente no prefixo descartado
    const newStart = Math.max(0, g.start_offset - removed);
    newGrifos.push({ ...g, start_offset: newStart, end_offset: newEnd });
  }

  return { texto: newTexto, grifos: newGrifos, removed };
}
