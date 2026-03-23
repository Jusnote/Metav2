import type { Dispositivo } from '@/types/lei-api'
import { AnotacaoInline } from './AnotacaoInline'

interface ArtigoProps {
  item: Dispositivo
  leiSecaMode?: boolean
}

export function Artigo({ item, leiSecaMode }: ArtigoProps) {
  return (
    <div
      className="mb-4 py-2 pl-3 border-l-3 border-blue-900/50"
      data-id={item.id}
      data-posicao={item.posicao}
    >
      <div className="mb-1">
        <span className="font-bold text-red-400">
          {item.numero ? `Art. ${item.numero}.` : 'Art.'}
        </span>
        <span className="ml-1">{item.texto}</span>
      </div>

      {item.pena && (
        <div className="text-muted-foreground italic ml-4 mb-2 text-xs">
          {item.pena}
        </div>
      )}

      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <div className="ml-4 space-y-1">
          {item.anotacoes.map((a, i) => (
            <AnotacaoInline key={i} anotacao={a} />
          ))}
        </div>
      )}
    </div>
  )
}
