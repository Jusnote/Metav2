import type { Anotacao } from '@/types/lei-api'

export function AnotacaoInline({ anotacao }: { anotacao: Anotacao }) {
  return (
    <div className="text-muted-foreground/50 italic text-[11px] bg-muted/10 px-2 py-0.5 rounded">
      {anotacao.texto ?? `(${anotacao.tipo})`}
    </div>
  )
}
