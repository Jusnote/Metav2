import type { Dispositivo } from '@/types/lei-api'
import { BoldPrefix } from '@/lib/lei-text-bold'

export function Paragrafo({ item, leiSecaMode }: { item: Dispositivo; leiSecaMode?: boolean }) {
  return (
    <div className="pl-[34px] mb-2 relative" data-posicao={item.posicao}>
      <span className="absolute left-[20px] text-[14px] text-[#d0d0d0]">›</span>
      <BoldPrefix texto={item.texto} tipo={item.tipo} />
      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <span className="text-[12px] font-light text-[#ccc] ml-1.5 hover:text-[#888] transition-colors">
          {item.anotacoes.map(a => a.texto ?? `(${a.tipo})`).join(' ')}
        </span>
      )}
    </div>
  )
}
