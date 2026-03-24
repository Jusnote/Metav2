import type { Dispositivo } from '@/types/lei-api'
import type { Grifo } from '@/types/grifo'
import { GrifoText } from '@/components/lei-seca/GrifoText'

interface GenericDispositivoProps {
  item: Dispositivo
  grifos?: Grifo[]
  onGrifoClick?: (grifo: Grifo, rect: DOMRect) => void
}

export function GenericDispositivo({ item, grifos = [], onGrifoClick }: GenericDispositivoProps) {
  return (
    <div className="pl-8 mb-0.5 text-[#666]" data-id={item.id} data-posicao={item.posicao}>
      <span data-texto><GrifoText texto={item.texto} grifos={grifos} onGrifoClick={onGrifoClick} /></span>
    </div>
  )
}
