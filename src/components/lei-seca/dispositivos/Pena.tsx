import type { Dispositivo } from '@/types/lei-api'
import type { Grifo } from '@/types/grifo'
import { GrifoText } from '@/components/lei-seca/GrifoText'

interface PenaProps {
  item: Dispositivo
  grifos?: Grifo[]
  onGrifoClick?: (grifo: Grifo, rect: DOMRect) => void
}

export function Pena({ item, grifos = [], onGrifoClick }: PenaProps) {
  return (
    <div className="pl-[34px] font-light italic text-[#aaa] text-[15px] mb-2.5" data-id={item.id} data-posicao={item.posicao}>
      <span data-texto><GrifoText texto={item.texto} grifos={grifos} onGrifoClick={onGrifoClick} /></span>
    </div>
  )
}
