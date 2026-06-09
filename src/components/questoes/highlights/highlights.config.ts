import type { MarkKind, MarkTypeId } from './types';

export const COLORS = [
  '#E0484D', '#E8703A', '#F2C231', '#4CAF6E', '#2BB7A3', '#4F86E0',
  '#8B5CF6', '#D6589E', '#6E4A28', '#8A8F98', '#0F7B5F', '#C2410C',
] as const;

/** Cores no quick-row da seleção (subset). */
export const QUICK_COLORS = COLORS.slice(0, 8);

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
