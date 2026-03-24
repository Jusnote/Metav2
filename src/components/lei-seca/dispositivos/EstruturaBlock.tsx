import type { Dispositivo } from '@/types/lei-api'

/**
 * Renders a group of consecutive structural items as a compact block.
 *
 * Examples:
 *   LIVRO I + TITULO I + CAPITULO I + SUBTITULO →
 *     "LIVRO I — TÍTULO I"
 *     "CAPÍTULO I"
 *     "Da Personalidade e da Capacidade"
 *
 *   CAPITULO II + SUBTITULO →
 *     "CAPÍTULO II"
 *     "Das Lesões Corporais"
 *
 *   TITULO II + SUBTITULO →
 *     "TÍTULO II — Do Crime"
 */

const HIGH_LEVEL = new Set(['PARTE', 'LIVRO', 'TITULO'])
const MID_LEVEL = new Set(['CAPITULO', 'SECAO', 'SUBSECAO'])

export function EstruturaBlock({ items }: { items: Dispositivo[] }) {
  // Separate by role
  const highItems = items.filter(d => HIGH_LEVEL.has(d.tipo))
  const midItems = items.filter(d => MID_LEVEL.has(d.tipo))
  const subtitulos = items.filter(d => d.tipo === 'SUBTITULO')

  // Build high-level line: "LIVRO I — TÍTULO I" or just "TÍTULO II"
  const highLine = highItems.map(d => d.texto).join(' — ')

  // Build mid-level line: "CAPÍTULO I" or "SEÇÃO I"
  const midLine = midItems.map(d => d.texto).join(' — ')

  // Subtitle: "Da Personalidade e da Capacidade"
  const subLine = subtitulos.map(d => d.texto).join(' · ')

  // If only a PARTE, render it specially
  if (items.length === 1 && items[0].tipo === 'PARTE') {
    return (
      <div className="text-center my-[52px] py-4 border-t border-b border-[#eee]" data-posicao={items[0].posicao}>
        <div className="font-[Outfit,sans-serif] text-[13px] font-semibold text-[#444] tracking-[1.5px] uppercase">
          {items[0].texto}
        </div>
      </div>
    )
  }

  return (
    <div className="text-center mt-10 mb-7" data-posicao={items[0].posicao}>
      {/* High level: LIVRO — TÍTULO (smaller, lighter) */}
      {highLine && (
        <div className="font-[Outfit,sans-serif] text-[11px] font-medium text-[#aaa] tracking-[1.5px] uppercase">
          {highLine}
        </div>
      )}

      {/* Mid level: CAPÍTULO (main, bolder) */}
      {midLine && (
        <div className="font-[Outfit,sans-serif] text-[13px] font-semibold text-[#444] tracking-[1.5px] uppercase mt-0.5">
          {midLine}
        </div>
      )}

      {/* Subtitle: Da Personalidade... (description, italic) */}
      {subLine && (
        <div className="font-[Outfit,sans-serif] text-[13px] text-[#999] italic mt-0.5">
          {subLine}
        </div>
      )}

      {/* If no mid/sub, just show high level as main */}
      {!midLine && !subLine && highLine && (
        <div className="sr-only">structural block</div>
      )}

      {/* All data-posicao markers for each item in the group */}
      {items.slice(1).map(d => (
        <span key={d.id} data-posicao={d.posicao} className="hidden" />
      ))}
    </div>
  )
}
