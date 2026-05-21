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

const SLUG_PATTERN = /^[a-z0-9_.]+$/;

export function isValidSlug(slug: string): boolean {
  return typeof slug === 'string' && slug.length > 0 && SLUG_PATTERN.test(slug);
}

export function validateSlug(slug: string): void {
  if (!isValidSlug(slug)) {
    throw new Error(`PAPIRO: slug inválido "${slug}" (esperado /^[a-z0-9_.]+$/)`);
  }
}

export function buildMacroAreaSlug(disciplinaSlug: string, macroAreaTail: string): string {
  validateSlug(disciplinaSlug);
  validateSlug(macroAreaTail);
  return `${disciplinaSlug}.${macroAreaTail}`;
}

export function buildTemaSlug(disciplinaSlug: string, macroAreaTail: string, temaTail: string): string {
  validateSlug(disciplinaSlug);
  validateSlug(macroAreaTail);
  validateSlug(temaTail);
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
