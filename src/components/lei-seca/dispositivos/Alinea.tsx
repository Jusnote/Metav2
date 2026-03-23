import type { Dispositivo } from '@/types/lei-api'
import { AnotacaoInline } from './AnotacaoInline'

export function Alinea({ item, leiSecaMode }: { item: Dispositivo; leiSecaMode?: boolean }) {
  return (
    <div className="mb-1 ml-18 py-0.5" data-posicao={item.posicao}>
      {item.texto}
      {!leiSecaMode && item.anotacoes && item.anotacoes.length > 0 && (
        <div className="ml-4 mt-1 space-y-1">
          {item.anotacoes.map((a, i) => <AnotacaoInline key={i} anotacao={a} />)}
        </div>
      )}
    </div>
  )
}
