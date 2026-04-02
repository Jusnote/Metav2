import { useState, useMemo, useEffect } from 'react'
import type { Dispositivo } from '@/types/lei-api'
import type { Grifo } from '@/types/grifo'
import { useNoteOpenGrifoId } from '@/stores/grifoPopupStore'
import { DispositivoRenderer } from './DispositivoRenderer'
import { EstruturaBlock } from './EstruturaBlock'
import { useFontSize } from '@/stores/fontSizeStore'

const STRUCTURAL_TYPES = new Set(['PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO', 'SUBTITULO'])

interface DispositivoListProps {
  dispositivos: Dispositivo[]
  leiId?: string
  leiSecaMode?: boolean
  showRevogados?: boolean
  grifosByDispositivo?: Map<string, Grifo[]>
  onGrifoClick?: (grifo: Grifo, rect: DOMRect) => void
  onSaveNote?: (grifoId: string, note: string) => void
  likesSet?: Set<string>
  onToggleLike?: (dispositivoId: string) => void
  incidenciaMap?: Record<string, number>
  commentCountsMap?: Record<string, number>
  noteFlagsSet?: Set<string>
}

type RenderItem =
  | { type: 'structural-block'; items: Dispositivo[]; key: string }
  | { type: 'single'; item: Dispositivo; key: string }

/**
 * Groups consecutive structural items into blocks.
 * Non-structural items are kept as singles.
 */
function groupItems(dispositivos: Dispositivo[]): RenderItem[] {
  const result: RenderItem[] = []
  let i = 0

  while (i < dispositivos.length) {
    const item = dispositivos[i]

    if (STRUCTURAL_TYPES.has(item.tipo)) {
      // Collect consecutive structural items
      const block: Dispositivo[] = [item]
      let j = i + 1
      while (j < dispositivos.length && STRUCTURAL_TYPES.has(dispositivos[j].tipo)) {
        block.push(dispositivos[j])
        j++
      }
      result.push({
        type: 'structural-block',
        items: block,
        key: `block-${item.id}`,
      })
      i = j
    } else {
      result.push({
        type: 'single',
        item,
        key: String(item.id),
      })
      i++
    }
  }

  return result
}

export function DispositivoList({
  dispositivos,
  leiId,
  leiSecaMode,
  showRevogados,
  grifosByDispositivo,
  onGrifoClick,
  onSaveNote,
  likesSet,
  onToggleLike,
  incidenciaMap,
  commentCountsMap,
  noteFlagsSet,
}: DispositivoListProps) {
  const fontSize = useFontSize()
  const grouped = useMemo(() => groupItems(dispositivos), [dispositivos])
  const noteOpenGrifoId = useNoteOpenGrifoId()
  const [openFooterId, setOpenFooterId] = useState<string | null>(null)

  useEffect(() => {
    const hash = window.location.hash
    if (hash.startsWith('#disp_')) {
      const dispId = hash.replace('#disp_', '')
      requestAnimationFrame(() => {
        const el = document.getElementById(`disp_${dispId}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          setOpenFooterId(dispId)
        }
      })
    }
  }, [dispositivos])

  return (
    <div
      className="max-w-5xl mx-auto px-5 font-[Nunito,sans-serif] leading-[1.8] text-[#374151] text-justify"
      style={{ fontSize: `${fontSize}px` }}
    >
      {grouped.map(entry => {
        if (entry.type === 'structural-block') {
          return (
            <div
              key={entry.key}
              style={{ contentVisibility: 'auto', containIntrinsicSize: '0 80px' }}
            >
              <EstruturaBlock items={entry.items} />
            </div>
          )
        }
        return (
          <div
            key={entry.key}
            style={{ contentVisibility: 'auto', containIntrinsicSize: '0 50px' }}
          >
            <DispositivoRenderer
              item={entry.item}
              leiId={leiId}
              leiSecaMode={leiSecaMode}
              showRevogados={showRevogados}
              grifos={grifosByDispositivo?.get(entry.item.id) ?? []}
              onGrifoClick={onGrifoClick}
              onSaveNote={onSaveNote}
              noteOpenGrifoId={noteOpenGrifoId}
              // Accordion
              footerOpen={openFooterId === String(entry.item.id)}
              onToggleFooter={() => setOpenFooterId(prev =>
                prev === String(entry.item.id) ? null : String(entry.item.id)
              )}
              // Batch data
              liked={likesSet?.has(String(entry.item.id)) ?? false}
              onToggleLike={() => onToggleLike?.(String(entry.item.id))}
              commentsCount={commentCountsMap?.[String(entry.item.id)] ?? 0}
              hasNote={noteFlagsSet?.has(String(entry.item.id)) ?? false}
            />
          </div>
        )
      })}
    </div>
  )
}
