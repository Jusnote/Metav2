import type { Dispositivo } from '@/types/lei-api'

const CENTERED_BOLD_LARGE = ['PARTE', 'LIVRO', 'TITULO']
const CENTERED_BOLD = ['CAPITULO', 'SECAO']

export function EstruturaHeader({ item }: { item: Dispositivo }) {
  const isLarge = CENTERED_BOLD_LARGE.includes(item.tipo)
  const isBold = CENTERED_BOLD.includes(item.tipo)
  const isSubsecao = item.tipo === 'SUBSECAO'

  return (
    <div className="text-center py-3" data-posicao={item.posicao}>
      {isLarge && (
        <div className="text-xs uppercase tracking-widest text-red-400 font-bold">
          {item.texto}
        </div>
      )}
      {isBold && (
        <div className="text-sm font-bold text-slate-300">
          {item.texto}
        </div>
      )}
      {isSubsecao && (
        <div className="text-sm italic text-slate-400">
          {item.texto}
        </div>
      )}
      {item.epigrafe && (
        <div className="text-xs italic text-slate-500 mt-1">
          {item.epigrafe}
        </div>
      )}
    </div>
  )
}
