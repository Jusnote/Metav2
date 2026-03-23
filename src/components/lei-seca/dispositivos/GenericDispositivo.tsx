import type { Dispositivo } from '@/types/lei-api'

export function GenericDispositivo({ item }: { item: Dispositivo }) {
  return (
    <div className="mb-2 ml-6 py-1 text-muted-foreground" data-posicao={item.posicao}>
      {item.texto}
    </div>
  )
}
