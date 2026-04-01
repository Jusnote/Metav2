import { useMemo, useState } from 'react'
import type { Dispositivo } from '@/types/lei-api'
import type { Grifo } from '@/types/grifo'
import { normalizeOrdinals } from '@/lib/lei-text-normalizer'
import { grifoPopupStore } from '@/stores/grifoPopupStore'
import { GrifoNoteInline } from '@/components/lei-seca/GrifoNoteInline'
import { DispositivoGutter } from './DispositivoGutter'
import { DispositivoFooter } from './DispositivoFooter'
import { LeiReportModal } from '@/components/lei-seca/LeiReportModal'
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
  leiId?: string
  leiSecaMode?: boolean
  showRevogados?: boolean
  grifos?: Grifo[]
  onGrifoClick?: (grifo: Grifo, rect: DOMRect) => void
  onSaveNote?: (grifoId: string, note: string) => void
  noteOpenGrifoId?: string | null
  footerOpen: boolean
  onToggleFooter: () => void
  liked: boolean
  onToggleLike: () => void
  incidencia: number | null
  commentsCount: number
  hasNote: boolean
}

export function DispositivoRenderer({ item: rawItem, leiId, leiSecaMode, showRevogados, grifos = [], onGrifoClick, onSaveNote, noteOpenGrifoId, footerOpen, onToggleFooter, liked, onToggleLike, incidencia, commentsCount, hasNote }: Props) {
  const [reportOpen, setReportOpen] = useState(false)

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
    <div className="group/disp" id={`disp_${item.id}`}>
      <div className="flex items-start">
        <div className="flex-1 min-w-0">{content}</div>
        {leiId && (
          <DispositivoGutter
            liked={liked}
            onToggleLike={onToggleLike}
            incidencia={incidencia}
            commentsCount={commentsCount}
            hasNote={hasNote}
            footerOpen={footerOpen}
            onToggleFooter={onToggleFooter}
          />
        )}
      </div>
      {footerOpen && (
        <DispositivoFooter
          texto={item.texto}
          dispositivoId={String(item.id)}
          leiId={leiId!}
          dispositivoTipo={item.tipo}
          dispositivoPosicao={item.posicao}
          commentsCount={commentsCount}
          hasNote={hasNote}
          onReport={() => { setReportOpen(true); onToggleFooter(); }}
        />
      )}
      {reportOpen && (
        <LeiReportModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          dispositivoId={String(item.id)}
          leiId={leiId!}
          dispositivoTipo={item.tipo}
          dispositivoNumero={String(item.posicao)}
          dispositivoTexto={item.texto}
        />
      )}
      {noteOpenGrifo && onSaveNote && (
        <GrifoNoteInline grifoId={noteOpenGrifo.id} color={noteOpenGrifo.color} initialNote={noteOpenGrifo.note} onSave={onSaveNote} onCancel={() => grifoPopupStore.closeNote()} />
      )}
      {!noteOpenGrifo && grifosWithNotes.length > 0 && <NoteBadge grifos={grifosWithNotes} />}
    </div>
  )
}

function NoteBadge({ grifos }: { grifos: Grifo[] }) {
  const [expanded, setExpanded] = useState(false)

  if (!expanded) {
    // Collapsed: pill badge with color dots
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-[6px] mt-1 mb-1 px-2 py-[3px] text-[10px] text-[#8a9a8f] font-[Outfit,sans-serif] bg-[#f5f7f6] border border-[#e8ede9] rounded-full cursor-pointer transition-colors hover:bg-[#eef2ef] hover:text-[#3a5540]"
      >
        <span>📝</span>
        <span>{grifos.length} {grifos.length === 1 ? 'nota' : 'notas'}</span>
        <span className="flex gap-[2px]">
          {grifos.map(g => (
            <span
              key={g.id}
              className="w-[5px] h-[5px] rounded-full"
              style={{ background: GRIFO_COLORS[g.color].replace(/[\d.]+\)$/, '0.6)') }}
            />
          ))}
        </span>
      </button>
    )
  }

  // Expanded: individual cards
  return (
    <div className="mt-1 mb-1 font-[Outfit,sans-serif]">
      <button
        onClick={() => setExpanded(false)}
        className="flex items-center gap-[6px] mb-1 px-2 py-[3px] text-[10px] text-[#3a5540] font-medium bg-[#eef2ef] border border-[#e8ede9] rounded-full cursor-pointer transition-colors hover:bg-[#e5ebe6]"
      >
        <span>📝</span>
        <span>{grifos.length} {grifos.length === 1 ? 'nota' : 'notas'} ▴</span>
      </button>
      {grifos.map(g => (
        <button
          key={g.id}
          onClick={() => grifoPopupStore.openNote(g.id)}
          className="w-full text-left flex items-start gap-2 px-3 py-[6px] mb-[2px] text-[11px] text-[#5a6a60] leading-[1.5] bg-[#fafcfb] rounded-md transition-colors hover:bg-[#f3f6f4] cursor-pointer"
          style={{ borderLeft: `3px solid ${GRIFO_COLORS[g.color].replace(/[\d.]+\)$/, '0.5)')}` }}
        >
          <span className="flex-1">{g.note}</span>
          <span className="text-[9px] text-[#b0c0b5] shrink-0 mt-[1px]">
            {formatTimeAgo(g.updated_at)}
          </span>
        </button>
      ))}
    </div>
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
