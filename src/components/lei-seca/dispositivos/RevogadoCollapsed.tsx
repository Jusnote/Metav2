import type { Dispositivo } from '@/types/lei-api'

export function RevogadoCollapsed({ item }: { item: Dispositivo }) {
  return (
    <div className="pl-7 py-0.5 opacity-20" data-posicao={item.posicao}>
      <span className="line-through">{item.texto}</span>
    </div>
  )
}
