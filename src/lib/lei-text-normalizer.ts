/**
 * Normalizes ordinal formatting in law text.
 *
 * JusBrasil data sometimes renders º (ordinal) as space + lowercase "o".
 * Only patterns that are 100% unambiguous are corrected:
 *
 *   "§ 2 o " → "§ 2º "    (always ordinal after §)
 *   "Art. 3 o " → "Art. 3º" (always ordinal after Art.)
 *   "Lei n o " → "Lei nº"   (always ordinal after n in "Lei n")
 *
 * Does NOT touch "X o" in the middle of sentences (could be false positive).
 */
export function normalizeOrdinals(text: string): string {
  return text
    // § followed by number + space + o → always ordinal
    .replace(/§\s*(\d+)\s+o\b/g, '§ $1º')
    // Art. followed by number + space + o → always ordinal
    .replace(/Art\.\s*(\d+[-A-Z]*)\s+o\b/g, 'Art. $1º')
    // "n o" preceded by Lei/Decreto/Medida/Emenda → always ordinal
    .replace(/(Lei|Decreto|Medida|Emenda|Complementar)\s+n\s+o\b/g, '$1 nº')
}
