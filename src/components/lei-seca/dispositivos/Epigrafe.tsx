import type { Dispositivo } from '@/types/lei-api'

export function Epigrafe({ item }: { item: Dispositivo }) {
  return (
    <div className="mt-7 mb-2 pb-1 border-b-2 border-indigo-100" data-posicao={item.posicao}>
      <span className="font-bold text-slate-900 text-sm">{item.texto}</span>
    </div>
  )
}
