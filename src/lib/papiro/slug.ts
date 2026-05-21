/**
 * PAPIRO — utilities de slug.
 *
 * Convenções (decisões da spec):
 *   - disciplina.slug         = 1º segmento (ex: "informatica")
 *   - macro_area.slug         = "<disciplina>.<tail>" (ex: "informatica.redes_internet")
 *   - tema.slug_hierarquico   = "<disciplina>.<tail>.<temaTail>" (ex: "informatica.redes_internet.fundamentos_redes")
 *   - URL                     = "/estudar/<disciplina>/<tail>/<temaTail>" (pontos viram barras)
 *
 * Tudo puro, sem dependência de React/router. Testado em slug.test.ts.
 */

/** Single segment: letters/digits/underscore only — no dots, no empties. */
const SEGMENT_PATTERN = /^[a-z0-9_]+$/;

/** Compound slug: 1+ segments joined by single dots (no leading/trailing/consecutive dots). */
const SLUG_PATTERN = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

export function isValidSlug(slug: string): boolean {
  return typeof slug === 'string' && slug.length > 0 && SLUG_PATTERN.test(slug);
}

export function validateSlug(slug: string): void {
  if (!isValidSlug(slug)) {
    throw new Error(`PAPIRO: slug inválido "${slug}" (esperado /^[a-z0-9_]+(\\.[a-z0-9_]+)*$/)`);
  }
}

function validateSegment(segment: string, kind: string): void {
  if (typeof segment !== 'string' || !SEGMENT_PATTERN.test(segment)) {
    throw new Error(`PAPIRO: ${kind} inválido "${segment}" (esperado /^[a-z0-9_]+$/, sem pontos)`);
  }
}

export function buildMacroAreaSlug(disciplinaSlug: string, macroAreaTail: string): string {
  validateSegment(disciplinaSlug, 'disciplinaSlug');
  validateSegment(macroAreaTail, 'macroAreaTail');
  return `${disciplinaSlug}.${macroAreaTail}`;
}

export function buildTemaSlug(disciplinaSlug: string, macroAreaTail: string, temaTail: string): string {
  validateSegment(disciplinaSlug, 'disciplinaSlug');
  validateSegment(macroAreaTail, 'macroAreaTail');
  validateSegment(temaTail, 'temaTail');
  return `${disciplinaSlug}.${macroAreaTail}.${temaTail}`;
}

export function parseMacroAreaSlug(slug: string): { disciplinaSlug: string; macroAreaTail: string } {
  validateSlug(slug);
  const parts = slug.split('.');
  if (parts.length !== 2) {
    throw new Error(`PAPIRO: macro_area.slug deve ter 2 segmentos: "${slug}"`);
  }
  return { disciplinaSlug: parts[0], macroAreaTail: parts[1] };
}

export function parseTemaSlug(slug: string): { disciplinaSlug: string; macroAreaTail: string; temaTail: string } {
  validateSlug(slug);
  const parts = slug.split('.');
  if (parts.length !== 3) {
    throw new Error(`PAPIRO: tema.slug_hierarquico deve ter 3 segmentos: "${slug}"`);
  }
  return { disciplinaSlug: parts[0], macroAreaTail: parts[1], temaTail: parts[2] };
}

export function disciplinaUrl(disciplinaSlug: string): string {
  validateSlug(disciplinaSlug);
  return `/estudar/${disciplinaSlug}`;
}

export function macroAreaUrl(macroAreaSlug: string): string {
  const { disciplinaSlug, macroAreaTail } = parseMacroAreaSlug(macroAreaSlug);
  return `/estudar/${disciplinaSlug}/${macroAreaTail}`;
}

export function temaUrl(temaSlugHierarquico: string): string {
  const { disciplinaSlug, macroAreaTail, temaTail } = parseTemaSlug(temaSlugHierarquico);
  return `/estudar/${disciplinaSlug}/${macroAreaTail}/${temaTail}`;
}
