import type { Dispositivo } from '@/types/lei-api'

export function GenericDispositivo({ item }: { item: Dispositivo }) {
  return (
    <div className="pl-8 mb-0.5 text-[#666]" data-posicao={item.posicao}>
      {item.texto}
    </div>
  )
}
