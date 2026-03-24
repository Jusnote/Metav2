import { useMemo } from 'react'
import type { Dispositivo } from '@/types/lei-api'
import { normalizeOrdinals } from '@/lib/lei-text-normalizer'
import { EstruturaHeader } from './EstruturaHeader'
import { Epigrafe } from './Epigrafe'
import { Artigo } from './Artigo'
import { Paragrafo } from './Paragrafo'
import { Inciso } from './Inciso'
import { Alinea } from './Alinea'
import { Pena } from './Pena'
import { RevogadoCollapsed } from './RevogadoCollapsed'
import { GenericDispositivo } from './GenericDispositivo'

const STRUCTURAL = ['PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO', 'SUBTITULO']

interface Props {
  item: Dispositivo
  leiSecaMode?: boolean
  showRevogados?: boolean
}

export function DispositivoRenderer({ item: rawItem, leiSecaMode, showRevogados }: Props) {
  // Normalize ordinals once per render (§ 2 o → § 2º, Art. 3 o → Art. 3º)
  const item = useMemo<Dispositivo>(() => ({
    ...rawItem,
    texto: normalizeOrdinals(rawItem.texto),
    epigrafe: rawItem.epigrafe ? normalizeOrdinals(rawItem.epigrafe) : null,
    pena: rawItem.pena ? normalizeOrdinals(rawItem.pena) : null,
  }), [rawItem])

  if (item.revogado && !showRevogados) return <RevogadoCollapsed item={item} />

  if (STRUCTURAL.includes(item.tipo)) return <EstruturaHeader item={item} />
  if (item.tipo === 'EPIGRAFE') return <Epigrafe item={item} />
  if (item.tipo === 'ARTIGO') return <Artigo item={item} leiSecaMode={leiSecaMode} />
  if (item.tipo === 'PARAGRAFO' || item.tipo === 'CAPUT') return <Paragrafo item={item} leiSecaMode={leiSecaMode} />
  if (item.tipo === 'INCISO') return <Inciso item={item} leiSecaMode={leiSecaMode} />
  if (item.tipo === 'ALINEA') return <Alinea item={item} leiSecaMode={leiSecaMode} />
  if (item.tipo === 'PENA') return <Pena item={item} />
  // EMENTA, PREAMBULO, and junk EPIGRAFEs ("ÍNDICE", ".", "*") — hide from reader
  if (item.tipo === 'EMENTA' || item.tipo === 'PREAMBULO') return null
  if (item.tipo === 'EPIGRAFE' && /^(ÍNDICE|índice|\.|[*])$/i.test(item.texto.trim())) return null

  return <GenericDispositivo item={item} />
}
