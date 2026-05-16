import { AlertTriangle } from 'lucide-react'

export function SubtopicoLengthWarning({ length, max = 60 }: { length: number; max?: number }) {
  if (length <= max) return null
  return (
    <span
      title={`Nome muito longo (${length} chars, máx ${max}). Pode ficar truncado no cronograma.`}
      className="inline-flex items-center gap-0.5 text-[10px] text-amber-600"
    >
      <AlertTriangle className="h-3 w-3" />
      {length}/{max}
    </span>
  )
}
