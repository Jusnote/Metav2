import type { Dispositivo } from '@/types/lei-api'

export function Inciso({ item, leiSecaMode }: { item: Dispositivo; leiSecaMode?: boolean }) {
  return (
    <div className="pl-[58px] mb-1.5 relative" data-posicao={item.posicao}>
      <span className="absolute left-[44px] text-[13px] text-[#d8d8d8]">›</span>
      {item.texto}
      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <span className="text-[12px] font-light text-[#ccc] ml-1.5 hover:text-[#888] transition-colors">
          {item.anotacoes.map(a => a.texto ?? `(${a.tipo})`).join(' ')}
        </span>
      )}
    </div>
  )
}
