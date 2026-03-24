import type { Dispositivo } from '@/types/lei-api'
import type { Grifo } from '@/types/grifo'
import { GrifoText } from '@/components/lei-seca/GrifoText'

interface ParagrafoProps {
  item: Dispositivo
  leiSecaMode?: boolean
  grifos?: Grifo[]
  onGrifoClick?: (grifo: Grifo, rect: DOMRect) => void
}

export function Paragrafo({ item, leiSecaMode, grifos = [], onGrifoClick }: ParagrafoProps) {
  return (
    <div className="pl-[34px] mb-2 relative" data-id={item.id} data-posicao={item.posicao}>
      <span className="absolute left-[20px] text-[14px] text-[#d0d0d0]">›</span>
      <span data-texto><GrifoText texto={item.texto} tipo={item.tipo} grifos={grifos} onGrifoClick={onGrifoClick} /></span>
      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <span className="text-[12px] font-light text-[#ccc] ml-1.5 hover:text-[#888] transition-colors">
          {item.anotacoes.map(a => a.texto ?? `(${a.tipo})`).join(' ')}
        </span>
      )}
    </div>
  )
}
