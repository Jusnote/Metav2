import type { Dispositivo } from '@/types/lei-api'

export function GenericDispositivo({ item }: { item: Dispositivo }) {
  return (
    <div className="mb-1.5 pl-7 text-zinc-500" data-posicao={item.posicao}>
      {item.texto}
    </div>
  )
}
