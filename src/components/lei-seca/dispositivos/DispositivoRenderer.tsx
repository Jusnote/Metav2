import { useMemo } from 'react'
import type { Dispositivo } from '@/types/lei-api'
import type { Grifo } from '@/types/grifo'
import { normalizeOrdinals } from '@/lib/lei-text-normalizer'
import { grifoPopupStore } from '@/stores/grifoPopupStore'
import { GrifoNoteInline } from '@/components/lei-seca/GrifoNoteInline'
import { GRIFO_COLORS } from '@/types/grifo'
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
  grifos?: Grifo[]
  onGrifoClick?: (grifo: Grifo, rect: DOMRect) => void
  onSaveNote?: (grifoId: string, note: string) => void
  noteOpenGrifoId?: string | null
}

export function DispositivoRenderer({ item: rawItem, leiSecaMode, showRevogados, grifos = [], onGrifoClick, onSaveNote, noteOpenGrifoId }: Props) {
  const item = useMemo<Dispositivo>(() => ({
    ...rawItem,
    texto: normalizeOrdinals(rawItem.texto),
    epigrafe: rawItem.epigrafe ? normalizeOrdinals(rawItem.epigrafe) : null,
    pena: rawItem.pena ? normalizeOrdinals(rawItem.pena) : null,
  }), [rawItem])

  if (item.tipo === 'EMENTA' || item.tipo === 'PREAMBULO') return null
  if (item.tipo === 'EPIGRAFE' && /^(ÍNDICE|índice|\.|[*])$/i.test(item.texto.trim())) return null

  if (item.revogado && !showRevogados) return <RevogadoCollapsed item={item} />

  if (STRUCTURAL.includes(item.tipo)) return <EstruturaHeader item={item} />
  if (item.tipo === 'EPIGRAFE') return <Epigrafe item={item} />

  // Find grifos with notes for this dispositivo (for saved note display)
  const grifosWithNotes = grifos.filter(g => g.note)
  // Find grifo with note editor open
  const noteOpenGrifo = grifos.find(g => g.id === noteOpenGrifoId)

  let content: React.ReactNode = null
  if (item.tipo === 'ARTIGO') content = <Artigo item={item} leiSecaMode={leiSecaMode} grifos={grifos} onGrifoClick={onGrifoClick} />
  else if (item.tipo === 'PARAGRAFO' || item.tipo === 'CAPUT') content = <Paragrafo item={item} leiSecaMode={leiSecaMode} grifos={grifos} onGrifoClick={onGrifoClick} />
  else if (item.tipo === 'INCISO') content = <Inciso item={item} leiSecaMode={leiSecaMode} grifos={grifos} onGrifoClick={onGrifoClick} />
  else if (item.tipo === 'ALINEA') content = <Alinea item={item} leiSecaMode={leiSecaMode} grifos={grifos} onGrifoClick={onGrifoClick} />
  else if (item.tipo === 'PENA') content = <Pena item={item} grifos={grifos} onGrifoClick={onGrifoClick} />
  else content = <GenericDispositivo item={item} grifos={grifos} onGrifoClick={onGrifoClick} />

  return (
    <>
      {content}

      {/* Note editor (open) */}
      {noteOpenGrifo && onSaveNote && (
        <GrifoNoteInline
          grifoId={noteOpenGrifo.id}
          color={noteOpenGrifo.color}
          initialNote={noteOpenGrifo.note}
          onSave={onSaveNote}
          onCancel={() => grifoPopupStore.closeNote()}
        />
      )}

      {/* Saved notes (collapsed) — each in its own card */}
      {!noteOpenGrifo && grifosWithNotes.map(g => (
        <button
          key={g.id}
          onClick={() => grifoPopupStore.openNote(g.id)}
          className="w-full text-left flex items-start gap-2 px-3 py-2 mt-1 text-[11.5px] text-[#5a6a60] leading-[1.5] font-[Outfit,sans-serif] bg-[#fafcfb] rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.03)] transition-colors hover:bg-[#f3f6f4]"
          style={{ borderLeft: `3px solid ${GRIFO_COLORS[g.color].replace(/[\d.]+\)$/, '0.5)')}` }}
        >
          <span className="text-[11px] text-[#8a9a8f] mt-[1px] shrink-0">📝</span>
          <span className="flex-1">{g.note}</span>
          <span className="text-[9px] text-[#b0c0b5] shrink-0 mt-[2px]">
            {formatTimeAgo(g.updated_at)}
          </span>
        </button>
      ))}
    </>
  )
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}
