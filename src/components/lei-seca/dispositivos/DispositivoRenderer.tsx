import type { Dispositivo } from '@/types/lei-api'
import { EstruturaHeader } from './EstruturaHeader'
import { Epigrafe } from './Epigrafe'
import { Artigo } from './Artigo'
import { Paragrafo } from './Paragrafo'
import { Inciso } from './Inciso'
import { Alinea } from './Alinea'
import { Pena } from './Pena'
import { RevogadoCollapsed } from './RevogadoCollapsed'
import { GenericDispositivo } from './GenericDispositivo'

const STRUCTURAL = ['PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO']

interface Props {
  item: Dispositivo
  leiSecaMode?: boolean
  showRevogados?: boolean
}

export function DispositivoRenderer({ item, leiSecaMode, showRevogados }: Props) {
  if (item.revogado && !showRevogados) return <RevogadoCollapsed item={item} />

  if (STRUCTURAL.includes(item.tipo)) return <EstruturaHeader item={item} />
  if (item.tipo === 'EPIGRAFE') return <Epigrafe item={item} />
  if (item.tipo === 'ARTIGO') return <Artigo item={item} leiSecaMode={leiSecaMode} />
  if (item.tipo === 'PARAGRAFO' || item.tipo === 'CAPUT') return <Paragrafo item={item} leiSecaMode={leiSecaMode} />
  if (item.tipo === 'INCISO') return <Inciso item={item} leiSecaMode={leiSecaMode} />
  if (item.tipo === 'ALINEA') return <Alinea item={item} leiSecaMode={leiSecaMode} />
  if (item.tipo === 'PENA') return <Pena item={item} />
  if (item.tipo === 'EMENTA' || item.tipo === 'PREAMBULO') return <GenericDispositivo item={item} />

  return <GenericDispositivo item={item} />
}
