import type { Anotacao } from '@/types/lei-api'

export function AnotacaoInline({ anotacao }: { anotacao: Anotacao }) {
  return (
    <div className="text-[#d4d4d8] italic text-[11px]">
      {anotacao.texto ?? `(${anotacao.tipo})`}
    </div>
  )
}
