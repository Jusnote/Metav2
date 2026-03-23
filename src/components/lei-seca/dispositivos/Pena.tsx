import type { Dispositivo } from '@/types/lei-api'

export function Pena({ item }: { item: Dispositivo }) {
  return (
    <div className="pl-8 font-light italic text-[#aaa] text-[15px] mb-0.5" data-posicao={item.posicao}>
      {item.texto}
    </div>
  )
}
