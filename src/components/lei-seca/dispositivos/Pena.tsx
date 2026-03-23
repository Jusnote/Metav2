import type { Dispositivo } from '@/types/lei-api'

export function Pena({ item }: { item: Dispositivo }) {
  return (
    <div className="text-muted-foreground italic ml-4 mb-2 text-xs" data-posicao={item.posicao}>
      {item.texto}
    </div>
  )
}
