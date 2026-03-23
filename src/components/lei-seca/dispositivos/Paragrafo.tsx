import type { Dispositivo } from '@/types/lei-api'
import { AnotacaoInline } from './AnotacaoInline'

export function Paragrafo({ item, leiSecaMode }: { item: Dispositivo; leiSecaMode?: boolean }) {
  return (
    <div className="mb-2 ml-6 py-1" data-posicao={item.posicao}>
      <span className="font-bold text-red-400">
        {item.numero ? `§ ${item.numero}` : '§'}
      </span>
      <span className="ml-1">{item.texto}</span>

      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <div className="ml-4 mt-1 space-y-1">
          {item.anotacoes.map((a, i) => <AnotacaoInline key={i} anotacao={a} />)}
        </div>
      )}
    </div>
  )
}
