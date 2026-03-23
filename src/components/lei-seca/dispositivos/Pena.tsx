import type { Dispositivo } from '@/types/lei-api'

export function Pena({ item }: { item: Dispositivo }) {
  return (
    <div className="text-slate-400 italic ml-6 mb-3 text-[13px]" data-posicao={item.posicao}>
      {item.texto}
    </div>
  )
}
