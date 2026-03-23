import type { Dispositivo } from '@/types/lei-api'

export function GenericDispositivo({ item }: { item: Dispositivo }) {
  return (
    <div className="mb-2 pl-6 text-slate-500" data-posicao={item.posicao}>
      {item.texto}
    </div>
  )
}
