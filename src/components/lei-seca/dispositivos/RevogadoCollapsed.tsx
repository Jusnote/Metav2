import type { Dispositivo } from '@/types/lei-api'

export function RevogadoCollapsed({ item }: { item: Dispositivo }) {
  return (
    <div className="opacity-40 ml-6 py-1 flex items-center gap-2" data-posicao={item.posicao}>
      <span className="text-red-500 text-[10px]">▶</span>
      <span className="line-through text-sm">{item.texto}</span>
      <span className="bg-red-950 text-red-300 text-[9px] px-1.5 py-0.5 rounded">
        Revogado
      </span>
    </div>
  )
}
