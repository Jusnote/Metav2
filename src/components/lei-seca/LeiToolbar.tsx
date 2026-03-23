"use client"

import { fontSizeStore, useFontSize } from '@/stores/fontSizeStore'
import { useLeiSeca } from '@/contexts/LeiSecaContext'

export function LeiToolbar() {
  const {
    leis, currentLeiId, handleLeiChange,
    leiSecaMode, toggleLeiSecaMode,
    showRevogados, toggleRevogados,
  } = useLeiSeca()
  const fontSize = useFontSize()

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#eee] bg-white font-[Outfit,sans-serif] text-[12px]">
      {/* Lei selector */}
      <select
        value={currentLeiId}
        onChange={e => handleLeiChange(e.target.value)}
        className="text-[12px] py-1.5 px-2.5 border border-[#e5e5e5] rounded-lg text-[#555] bg-[#fafafa] min-w-[140px] outline-none font-[Outfit,sans-serif]"
      >
        {leis.map(l => (
          <option key={l.id} value={l.id}>{l.apelido ?? l.titulo}</option>
        ))}
      </select>

      <div className="flex-1" />

      {/* Toggles */}
      <button
        onClick={toggleLeiSecaMode}
        className={`px-3 py-1 rounded-full transition-colors flex-shrink-0 ${
          leiSecaMode ? 'bg-[#2c3338] text-white' : 'bg-[#f4f4f4] text-[#888] hover:bg-[#eee]'
        }`}
      >
        {leiSecaMode ? 'Lei Seca \u2713' : 'Lei Seca'}
      </button>

      <button
        onClick={toggleRevogados}
        className={`px-3 py-1 rounded-full transition-colors flex-shrink-0 ${
          showRevogados ? 'bg-[#2c3338] text-white' : 'bg-[#f4f4f4] text-[#888] hover:bg-[#eee]'
        }`}
      >
        {showRevogados ? 'Revogados \u2713' : 'Revogados'}
      </button>

      {/* Font size */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={fontSizeStore.decrease} className="w-7 h-7 rounded-full bg-[#f4f4f4] text-[#888] hover:bg-[#eee] flex items-center justify-center text-[11px] font-bold">A-</button>
        <span className="text-[11px] text-[#ccc] w-5 text-center">{fontSize}</span>
        <button onClick={fontSizeStore.increase} className="w-7 h-7 rounded-full bg-[#f4f4f4] text-[#888] hover:bg-[#eee] flex items-center justify-center text-[13px] font-bold">A+</button>
      </div>

      {/* Hints */}
      <span className="text-[10px] text-[#ddd] hidden lg:block flex-shrink-0">J/K · L · R</span>
    </div>
  )
}
