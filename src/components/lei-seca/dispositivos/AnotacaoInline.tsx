import type { Anotacao } from '@/types/lei-api'

export function AnotacaoInline({ anotacao }: { anotacao: Anotacao }) {
  return (
    <div className="font-light text-[#ccc] text-[12px] hover:text-[#888] transition-colors">
      {anotacao.texto ?? `(${anotacao.tipo})`}
    </div>
  )
}
