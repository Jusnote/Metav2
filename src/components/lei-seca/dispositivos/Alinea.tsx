import type { Dispositivo } from '@/types/lei-api'

export function Alinea({ item, leiSecaMode }: { item: Dispositivo; leiSecaMode?: boolean }) {
  return (
    <div className="pl-[82px] mb-[5px] text-[#333] relative" data-posicao={item.posicao}>
      <span className="absolute left-[68px] text-[12px] text-[#e0e0e0]">›</span>
      {item.texto}
      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <span className="text-[12px] font-light text-[#ccc] ml-1.5 hover:text-[#888] transition-colors">
          {item.anotacoes.map(a => a.texto ?? `(${a.tipo})`).join(' ')}
        </span>
      )}
    </div>
  )
}
