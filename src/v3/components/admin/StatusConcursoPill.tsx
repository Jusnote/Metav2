// Pill visual de status do concurso — usa tokens semânticos do design system
// rascunho | revisao | publicado | arquivado

interface Props {
  status: string
}

const CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  rascunho: {
    label: 'Rascunho',
    bg: 'var(--bg-surface-3)',
    text: 'var(--fg-secondary)',
    border: 'var(--border-default)',
  },
  revisao: {
    label: 'Em revisão',
    bg: 'var(--color-atencao-bg)',
    text: 'var(--color-atencao-text)',
    border: 'rgba(239,159,39,0.4)',
  },
  publicado: {
    label: 'Publicado',
    bg: 'var(--color-teoria-bg)',
    text: 'var(--color-teoria-text)',
    border: 'var(--color-teoria-border)',
  },
  arquivado: {
    label: 'Arquivado',
    bg: 'var(--bg-surface-2)',
    text: 'var(--fg-tertiary)',
    border: 'var(--border-subtle)',
  },
}

export function StatusConcursoPill({ status }: Props) {
  const cfg = CONFIG[status] ?? CONFIG.rascunho

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{
        backgroundColor: cfg.bg,
        color: cfg.text,
        border: `1px solid ${cfg.border}`,
      }}
    >
      {cfg.label}
    </span>
  )
}
