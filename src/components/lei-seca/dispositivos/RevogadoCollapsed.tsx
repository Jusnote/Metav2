import type { Dispositivo } from '@/types/lei-api'

export function RevogadoCollapsed({ item }: { item: Dispositivo }) {
  return (
    <div className="opacity-35 pl-6 py-1 flex items-center gap-2" data-posicao={item.posicao}>
      <span className="line-through text-slate-400 text-sm">{item.texto}</span>
      <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
        revogado
      </span>
    </div>
  )
}
