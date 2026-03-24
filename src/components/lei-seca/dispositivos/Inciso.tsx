import type { Dispositivo } from '@/types/lei-api'
import type { Grifo } from '@/types/grifo'
import { GrifoText } from '@/components/lei-seca/GrifoText'

interface IncisoProps {
  item: Dispositivo
  leiSecaMode?: boolean
  grifos?: Grifo[]
  onGrifoClick?: (grifo: Grifo, rect: DOMRect) => void
}

export function Inciso({ item, leiSecaMode, grifos = [], onGrifoClick }: IncisoProps) {
  return (
    <div className="pl-[58px] mb-1.5 relative" data-id={item.id} data-posicao={item.posicao}>
      <span className="absolute left-[44px] text-[13px] text-[#d8d8d8]">›</span>
      <span data-texto><GrifoText texto={item.texto} tipo={item.tipo} grifos={grifos} onGrifoClick={onGrifoClick} /></span>
      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <span className="text-[12px] font-light text-[#ccc] ml-1.5 hover:text-[#888] transition-colors">
          {item.anotacoes.map(a => a.texto ?? `(${a.tipo})`).join(' ')}
        </span>
      )}
    </div>
  )
}
