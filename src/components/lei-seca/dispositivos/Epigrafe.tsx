import type { Dispositivo } from '@/types/lei-api'

export function Epigrafe({ item }: { item: Dispositivo }) {
  return (
    <div className="mt-7 mb-1.5" data-posicao={item.posicao}>
      <span className="font-[Outfit,sans-serif] text-[13px] font-medium text-[#666]">
        {item.texto}
      </span>
    </div>
  )
}
