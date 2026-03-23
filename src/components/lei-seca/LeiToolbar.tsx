"use client"

import { fontSizeStore, useFontSize } from '@/stores/fontSizeStore'
import { useLeiSeca } from '@/contexts/LeiSecaContext'

export function LeiToolbar() {
  const { leiSecaMode, toggleLeiSecaMode, showRevogados, toggleRevogados } = useLeiSeca()
  const fontSize = useFontSize()

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-[#eee] bg-white font-[Outfit,sans-serif] text-[12px]">
      <button
        onClick={toggleLeiSecaMode}
        className={`px-3 py-1 rounded-full transition-colors ${
          leiSecaMode
            ? 'bg-[rgb(67,80,92)] text-white'
            : 'bg-[#f4f4f4] text-[#666] hover:bg-[#eee]'
        }`}
      >
        {leiSecaMode ? 'Lei Seca \u2713' : 'Lei Seca'}
      </button>

      <button
        onClick={toggleRevogados}
        className={`px-3 py-1 rounded-full transition-colors ${
          showRevogados
            ? 'bg-[rgb(67,80,92)] text-white'
            : 'bg-[#f4f4f4] text-[#666] hover:bg-[#eee]'
        }`}
      >
        {showRevogados ? 'Revogados \u2713' : 'Revogados'}
      </button>

      <div className="flex items-center gap-1 ml-auto">
        <button onClick={fontSizeStore.decrease} className="w-7 h-7 rounded-full bg-[#f4f4f4] text-[#666] hover:bg-[#eee] flex items-center justify-center text-[11px] font-bold">A-</button>
        <span className="text-[11px] text-[#999] w-6 text-center">{fontSize}</span>
        <button onClick={fontSizeStore.increase} className="w-7 h-7 rounded-full bg-[#f4f4f4] text-[#666] hover:bg-[#eee] flex items-center justify-center text-[13px] font-bold">A+</button>
      </div>
    </div>
  )
}
