import type { Dispositivo } from '@/types/lei-api'

export function RevogadoCollapsed({ item }: { item: Dispositivo }) {
  return (
    <div className="pl-8 mb-0.5 line-through text-[#ddd]" data-posicao={item.posicao}>
      {item.texto}
    </div>
  )
}
