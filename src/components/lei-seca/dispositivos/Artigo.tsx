import type { Dispositivo } from '@/types/lei-api'
import type { Grifo } from '@/types/grifo'
import { AnotacaoInline } from './AnotacaoInline'
import { GrifoText } from '@/components/lei-seca/GrifoText'

interface ArtigoProps {
  item: Dispositivo
  leiSecaMode?: boolean
  grifos?: Grifo[]
  onGrifoClick?: (grifo: Grifo, rect: DOMRect) => void
}

export function Artigo({ item, leiSecaMode, grifos = [], onGrifoClick }: ArtigoProps) {
  return (
    <div className="mb-2" data-id={item.id} data-posicao={item.posicao}>
      <span data-texto><GrifoText texto={item.texto} tipo={item.tipo} grifos={grifos} onGrifoClick={onGrifoClick} /></span>
      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <span className="text-[12px] font-light text-[#ccc] ml-1.5 hover:text-[#888] transition-colors">
          {item.anotacoes.map(a => a.texto ?? `(${a.tipo})`).join(' ')}
        </span>
      )}
    </div>
  )
}
