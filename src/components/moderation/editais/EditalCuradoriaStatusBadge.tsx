'use client'
// src/components/moderation/editais/EditalCuradoriaStatusBadge.tsx
// Pill badge for the curation workflow status.

interface Props {
  status: 'no_cache' | 'draft' | 'published' | 'archived'
}

const CONFIG: Record<Props['status'], { label: string; className: string }> = {
  no_cache: {
    label: 'Sem cache',
    className: 'border border-slate-300 text-slate-500 bg-white',
  },
  draft: {
    label: 'Rascunho',
    className: 'border border-amber-300 text-amber-700 bg-amber-50',
  },
  published: {
    label: 'Publicado',
    className: 'border border-emerald-300 text-emerald-700 bg-emerald-50',
  },
  archived: {
    label: 'Arquivado',
    className: 'border border-slate-200 text-slate-400 bg-slate-50',
  },
}

export function EditalCuradoriaStatusBadge({ status }: Props) {
  const { label, className } = CONFIG[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
