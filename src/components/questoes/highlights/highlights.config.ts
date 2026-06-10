import type { MarkKind, MarkTypeId, ToolId } from './types';

export const COLORS = [
  '#E0484D', '#E8703A', '#F2C231', '#4CAF6E', '#2BB7A3', '#4F86E0',
  '#8B5CF6', '#D6589E', '#6E4A28', '#8A8F98', '#0F7B5F', '#C2410C',
] as const;

/** Cores no quick-row da seleção (subset). */
export const QUICK_COLORS = COLORS.slice(0, 8);

/** Marcação v2: as 8 cores do mock aprovado (a 8ª é o cinza). */
export const MARK_COLORS = [
  '#E0484D', '#E8703A', '#F2C231', '#4CAF6E', '#2BB7A3', '#4F86E0', '#8B5CF6', '#8A8F98',
] as const;

/** Memória de cor POR ferramenta (defaults do mock). */
export const DEFAULT_LAST_COLORS: Record<ToolId, string> = {
  comum: '#F2C231',
  peg: '#E0484D',
  sub: '#4F86E0',
  tax: '#E0484D',
};

/** Metadados das 4 ferramentas (label + tecla com seleção). */
export const TOOLS: { id: ToolId; label: string; key: string }[] = [
  { id: 'peg', label: 'Pegadinha', key: 'A' },
  { id: 'comum', label: 'Grifar', key: 'G' },
  { id: 'sub', label: 'Sublinhar', key: 'S' },
  { id: 'tax', label: 'Tachar', key: 'T' },
];

export const MARK_TYPES: { id: MarkTypeId; label: string }[] = [
  { id: 'pegadinha', label: 'Pegadinha' },
  { id: 'chave', label: 'Palavra-chave' },
  { id: 'cuidado', label: 'Cuidado' },
  { id: 'sacada', label: 'Sacada' },
  { id: 'revisar', label: 'Revisar depois' },
];

export function typeLabel(id: MarkTypeId | null): string {
  return MARK_TYPES.find(t => t.id === id)?.label ?? 'Pegadinha';
}

/**
 * Fundo do destaque. No claro: alpha ~17% (atenção) / ~24% (comum).
 * No escuro o mesmo alpha some sobre a tinta clara, então sobe (~25% / ~36%).
 */
export function bgFor(color: string, kind: MarkKind): string {
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  if (dark) return color + (kind === 'plain' ? '5c' : '40');
  return color + (kind === 'plain' ? '3d' : '2b');
}
