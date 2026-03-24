import type { Dispositivo } from '@/types/lei-api'
import { DispositivoRenderer } from './DispositivoRenderer'
import { useFontSize } from '@/stores/fontSizeStore'

interface DispositivoListProps {
  dispositivos: Dispositivo[]
  leiSecaMode?: boolean
  showRevogados?: boolean
}

export function DispositivoList({
  dispositivos,
  leiSecaMode,
  showRevogados,
}: DispositivoListProps) {
  const fontSize = useFontSize()

  return (
    <div
      className="max-w-[820px] mx-auto px-5 font-[Literata,Georgia,serif] leading-[1.9] text-[rgb(67,80,92)]"
      style={{ fontSize: `${fontSize}px` }}
    >
      {dispositivos.map(item => (
        <div
          key={item.id}
          style={{ contentVisibility: 'auto', containIntrinsicSize: '0 50px' }}
        >
          <DispositivoRenderer
            item={item}
            leiSecaMode={leiSecaMode}
            showRevogados={showRevogados}
          />
        </div>
      ))}
    </div>
  )
}
