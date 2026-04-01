import type { Dispositivo } from '@/types/lei-api'

/**
 * Renders a group of consecutive structural items as a compact block.
 *
 * Rules:
 *   - PARTE always renders alone with borders (never groups with others)
 *   - LIVRO + TITULO join on one line: "LIVRO I — TÍTULO I"
 *   - CAPITULO/SECAO/SUBSECAO on the next line
 *   - Only the LAST subtitulo shows (most specific description)
 *
 * Examples:
 *   LIVRO I + sub + TITULO I + sub + CAPITULO I + sub →
 *     "LIVRO I — TÍTULO I"
 *     "CAPÍTULO I"
 *     "Da Personalidade e da Capacidade"   (only last sub)
 *
 *   CAPITULO II + sub →
 *     "CAPÍTULO II"
 *     "Das Lesões Corporais"
 */

export function EstruturaBlock({ items }: { items: Dispositivo[] }) {
  // PARTE always renders alone
  const hasParte = items.some(d => d.tipo === 'PARTE')
  if (hasParte) {
    const parteItem = items.find(d => d.tipo === 'PARTE')!
    const rest = items.filter(d => d.tipo !== 'PARTE')

    return (
      <>
        <div className="text-center my-[52px] py-4 border-t border-b border-[#eee]" data-posicao={parteItem.posicao}>
          <div className="font-[Outfit,sans-serif] text-[13px] font-semibold text-[#444] tracking-[1.5px] uppercase">
            {parteItem.texto}
          </div>
        </div>
        {rest.length > 0 && <EstruturaBlock items={rest} />}
      </>
    )
  }

  // Separate items by role
  const livroTitulo = items.filter(d => d.tipo === 'LIVRO' || d.tipo === 'TITULO')
  const capSecao = items.filter(d => d.tipo === 'CAPITULO' || d.tipo === 'SECAO' || d.tipo === 'SUBSECAO')
  const subtitulos = items.filter(d => d.tipo === 'SUBTITULO')

  // High line: "LIVRO I — TÍTULO I" (without their subtitles)
  const highLine = livroTitulo.map(d => d.texto).join(' — ')

  // Mid line: "CAPÍTULO I"
  const midLine = capSecao.map(d => d.texto).join(' — ')

  // Only the LAST subtitulo (most specific description)
  const lastSub = subtitulos.length > 0 ? subtitulos[subtitulos.length - 1].texto : null

  // Edge case: only subtitulo(s), no structural parent
  if (!highLine && !midLine && lastSub) {
    return (
      <div className="text-center mb-7" data-posicao={items[0].posicao}>
        <div className="font-[Outfit,sans-serif] text-[13px] text-[#999] italic">
          {lastSub}
        </div>
        {items.slice(1).map(d => (
          <span key={d.id} data-posicao={d.posicao} className="hidden" />
        ))}
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
        <div className={`font-[Outfit,sans-serif] text-[13px] font-semibold text-[#444] tracking-[1.5px] uppercase ${highLine ? 'mt-0.5' : ''}`}>
          {midLine}
        </div>
      )}

      {/* Last subtitle only (most specific description) */}
      {lastSub && (
        <div className="font-[Outfit,sans-serif] text-[13px] text-[#999] italic mt-0.5">
          {lastSub}
        </div>
      )}

      {/* Hidden data-posicao markers for all items in the group */}
      {items.slice(1).map(d => (
        <span key={d.id} data-posicao={d.posicao} className="hidden" />
      ))}
    </div>
  )
}
