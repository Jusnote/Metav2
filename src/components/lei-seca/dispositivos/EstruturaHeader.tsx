import type { Dispositivo } from '@/types/lei-api'

const LARGE = ['PARTE', 'LIVRO', 'TITULO']
const MEDIUM = ['CAPITULO', 'SECAO']

export function EstruturaHeader({ item }: { item: Dispositivo }) {
  if (item.tipo === 'PARTE') {
    return (
      <div className="text-center my-10 relative" data-posicao={item.posicao}>
        <div className="absolute left-0 right-0 top-1/2 h-px bg-zinc-100" />
        <span className="relative bg-white px-6 text-[10px] tracking-[7px] uppercase text-zinc-400 font-semibold">
          {item.texto}
        </span>
      </div>
    )
  }

  if (item.tipo === 'LIVRO' || item.tipo === 'TITULO') {
    return (
      <div className="text-center mb-9 mt-9" data-posicao={item.posicao}>
        <div className="text-sm font-bold text-zinc-700 tracking-[2px] uppercase">{item.texto}</div>
        {item.epigrafe && (
          <div className="text-sm text-zinc-400 mt-1">{item.epigrafe}</div>
        )}
      </div>
    )
  }

  if (MEDIUM.includes(item.tipo)) {
    return (
      <div className="text-center mb-8 mt-7" data-posicao={item.posicao}>
        <div className="text-xs font-semibold text-zinc-600 tracking-[1.5px] uppercase">{item.texto}</div>
        {item.epigrafe && (
          <div className="text-[13px] text-zinc-400 italic mt-1">{item.epigrafe}</div>
        )}
      </div>
    )
  }

  // SUBTITULO — colado ao header acima (pouco margin-top)
  if (item.tipo === 'SUBTITULO') {
    return (
      <div className="text-center mb-7 -mt-6" data-posicao={item.posicao}>
        <div className="text-[13px] text-zinc-400 italic">{item.texto}</div>
      </div>
    )
  }

  // SUBSECAO
  return (
    <div className="text-center mb-7 mt-6" data-posicao={item.posicao}>
      <div className="text-[13px] text-zinc-400 italic">{item.texto}</div>
    </div>
  )
}
