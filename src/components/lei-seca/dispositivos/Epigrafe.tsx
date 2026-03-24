import type { Dispositivo } from '@/types/lei-api'

export function Epigrafe({ item }: { item: Dispositivo }) {
  return (
    <div className="mt-4 mb-1" data-posicao={item.posicao}>
      <span className="font-[Outfit,sans-serif] text-[13px] font-medium text-[#666]">
        {item.texto}
      </span>
    </div>
  )
}
