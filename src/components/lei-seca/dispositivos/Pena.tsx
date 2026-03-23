import type { Dispositivo } from '@/types/lei-api'

export function Pena({ item }: { item: Dispositivo }) {
  return (
    <div className="pl-7 text-[#b4b4b4] text-[13px] mb-1.5" data-posicao={item.posicao}>
      {item.texto}
    </div>
  )
}
