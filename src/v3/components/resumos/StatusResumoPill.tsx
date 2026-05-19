// Pill semântica de status de resumo (sem-resumo / rascunho / publicado).
// Usa tokens de design — zero hardcode de cor.

import type { StatusResumo } from '@/v3/lib/resumos/arvore-resumos'

interface Props {
  status: StatusResumo
  className?: string
}

export function StatusResumoPill({ status, className }: Props) {
  const config = STATUS_CONFIG[status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className ?? ''}`}
      style={{
        backgroundColor: config.bg,
        color: config.fg,
        border: `1px solid ${config.border}`,
      }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: config.dot }}
      />
      {config.label}
    </span>
  )
}

const STATUS_CONFIG: Record<
  StatusResumo,
  { label: string; bg: string; fg: string; border: string; dot: string }
> = {
  'sem-resumo': {
    label: 'sem resumo',
    bg: 'var(--bg-surface-2, rgba(127,127,127,0.08))',
    fg: 'var(--fg-tertiary, #888)',
    border: 'var(--border-default, rgba(127,127,127,0.2))',
    dot: 'var(--fg-tertiary, #888)',
  },
  rascunho: {
    label: 'rascunho',
    bg: 'rgba(212,154,42,0.12)',
    fg: 'rgb(170,120,30)',
    border: 'rgba(212,154,42,0.4)',
    dot: 'rgb(212,154,42)',
  },
  publicado: {
    label: 'publicado',
    bg: 'rgba(70,160,90,0.12)',
    fg: 'rgb(50,130,70)',
    border: 'rgba(70,160,90,0.4)',
    dot: 'rgb(70,160,90)',
  },
}
