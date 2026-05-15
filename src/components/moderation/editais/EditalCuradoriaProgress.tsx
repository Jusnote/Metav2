'use client'
// src/components/moderation/editais/EditalCuradoriaProgress.tsx
// Emerald progress bar for streaming AI curation — mirrors RevealActions pattern.

import type { CurarEditalProgress } from '@/hooks/moderation/useCurarEdital'

interface Props {
  progress: CurarEditalProgress | null
}

export function EditalCuradoriaProgress({ progress }: Props) {
  const hasCounts = progress?.done !== undefined && progress?.total !== undefined && progress.total > 0
  const pct = hasCounts ? Math.round((progress!.done! / progress!.total!) * 100) : null

  return (
    <div className="space-y-2">
      <p className="text-sm text-zinc-600">
        {progress?.message ?? 'Aguardando IA…'}
      </p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-2 rounded-full bg-emerald-500 transition-all duration-300"
          style={{ width: pct !== null ? `${pct}%` : '10%' }}
        />
      </div>
      {hasCounts && (
        <p className="text-xs text-zinc-400">
          {progress!.done} / {progress!.total} tópicos ({pct}%)
        </p>
      )}
    </div>
  )
}
