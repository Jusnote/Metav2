import type { Dispositivo } from '@/types/lei-api'

const LARGE = ['PARTE', 'LIVRO', 'TITULO']
const MEDIUM = ['CAPITULO', 'SECAO']

export function EstruturaHeader({ item }: { item: Dispositivo }) {
  if (LARGE.includes(item.tipo)) {
    return (
      <div className="text-center py-5" data-posicao={item.posicao}>
        {item.tipo === 'PARTE' ? (
          <div className="text-[10px] tracking-[5px] uppercase text-indigo-600 font-bold border-y border-slate-200 py-4">
            {item.texto}
          </div>
        ) : (
          <>
            <div className="text-sm font-bold text-slate-900 tracking-wide">{item.texto}</div>
            {item.epigrafe && (
              <div className="text-[13px] text-slate-500 italic mt-1">{item.epigrafe}</div>
            )}
          </>
        )}
      </div>
    )
  }

  if (MEDIUM.includes(item.tipo)) {
    return (
      <div className="text-center py-4" data-posicao={item.posicao}>
        <div className="text-[13px] font-semibold text-slate-800">{item.texto}</div>
        {item.epigrafe && (
          <div className="text-[13px] text-slate-500 italic mt-1">{item.epigrafe}</div>
        )}
      </div>
    )
  }

  // SUBSECAO
  return (
    <div className="text-center py-3" data-posicao={item.posicao}>
      <div className="text-[13px] italic text-slate-500">{item.texto}</div>
    </div>
  )
}
