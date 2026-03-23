import type { Dispositivo } from '@/types/lei-api'

export function EstruturaHeader({ item }: { item: Dispositivo }) {
  const isParte = item.tipo === 'PARTE'

  // SUBTITULO renders as description only (centered, italic, no name)
  if (item.tipo === 'SUBTITULO') {
    return (
      <div className="text-center -mt-5 mb-7" data-posicao={item.posicao}>
        <div className="font-[Outfit,sans-serif] text-[13px] text-[#999] italic">
          {item.texto}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`text-center ${isParte ? 'my-[52px] py-4 border-t border-b border-[#eee]' : 'mt-10 mb-7'}`}
      data-posicao={item.posicao}
    >
      <div className="font-[Outfit,sans-serif] text-[13px] font-semibold text-[#444] tracking-[1.5px] uppercase">
        {item.texto}
      </div>
      {item.epigrafe && (
        <div className="font-[Outfit,sans-serif] text-[13px] text-[#999] italic mt-0.5">
          {item.epigrafe}
        </div>
      )}
    </div>
  )
}
