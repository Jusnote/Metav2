/**
 * Normalizes ordinal formatting in law text.
 *
 * JusBrasil data sometimes renders º (ordinal) as space + lowercase "o":
 *   "§ 2 o " → "§ 2º "
 *   "Art. 3 o " → "Art. 3º"
 *   "Lei n o " → "Lei nº"
 *   "1 o de janeiro" → "1º de janeiro"
 *
 * This function fixes these patterns for display only (never modifies source data).
 */
export function normalizeOrdinals(text: string): string {
  return text
    // § X o → § Xº (paragraph symbol + number + space + o)
    .replace(/§\s*(\d+)\s+o\b/g, '§ $1º')
    // Art. X o → Art. Xº
    .replace(/Art\.\s*(\d+[\-A-Z]*)\s+o\b/g, 'Art. $1º')
    // n o → nº (in "Lei nº", "Decreto nº", etc.)
    .replace(/\bn\s+o\b/g, 'nº')
    // X o de → Xº de (dates: "1 o de janeiro")
    .replace(/(\d+)\s+o\s+de\b/g, '$1º de')
}
