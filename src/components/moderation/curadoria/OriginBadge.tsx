export function OriginBadge({ origin }: { origin: 'ai' | 'manual' }) {
  return (
    <span
      title={origin === 'ai' ? 'Gerado por IA' : 'Adicionado manualmente'}
      className={`inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 ${
        origin === 'ai' ? 'bg-emerald-500' : 'bg-slate-400'
      }`}
    />
  )
}
