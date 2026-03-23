import type { Dispositivo } from '@/types/lei-api'

export function Epigrafe({ item }: { item: Dispositivo }) {
  return (
    <div className="font-bold text-red-400 mt-5 mb-1 text-sm" data-posicao={item.posicao}>
      {item.texto}
    </div>
  )
}
