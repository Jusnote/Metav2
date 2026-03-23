import type { Dispositivo } from '@/types/lei-api'

export function Epigrafe({ item }: { item: Dispositivo }) {
  return (
    <div className="mt-7 mb-1.5" data-posicao={item.posicao}>
      <span className="text-[11px] text-zinc-400 italic">{item.texto}</span>
    </div>
  )
}
