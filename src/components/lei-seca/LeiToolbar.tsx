"use client"

import { useState } from 'react'
import { fontSizeStore, useFontSize } from '@/stores/fontSizeStore'
import { useLeiSeca } from '@/contexts/LeiSecaContext'
import { grifoPopupStore, useActiveTool } from '@/stores/grifoPopupStore'
import type { GrifoColor } from '@/types/grifo'
import { GRIFO_COLORS, GRIFO_COLOR_NAMES } from '@/types/grifo'

const TOOL_COLORS: GrifoColor[] = ['yellow', 'green', 'blue', 'pink', 'orange']

export function LeiToolbar() {
  const {
    leis, currentLeiId, handleLeiChange,
    leiSecaMode, toggleLeiSecaMode,
    showRevogados, toggleRevogados,
  } = useLeiSeca()
  const fontSize = useFontSize()
  const activeTool = useActiveTool()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="border-b border-[#eee] bg-white font-[Outfit,sans-serif] text-[12px]">
      <div className="flex items-center gap-3 px-4 py-2.5">
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

        {/* Grifo color palette */}
        <div className="flex items-center gap-[2px] bg-[#f4f4f4] rounded-full px-1 py-[3px]">
          {/* Cursor tool (no highlighting) */}
          <button
            onClick={() => grifoPopupStore.setActiveTool('cursor')}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
              activeTool === 'cursor'
                ? 'bg-white shadow-sm scale-110'
                : 'hover:bg-white/50'
            }`}
            aria-label="Seleção normal"
            title="Seleção normal (Alt+0)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={activeTool === 'cursor' ? '#333' : '#aaa'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
            </svg>
          </button>

          {/* Color tools */}
          {TOOL_COLORS.map(color => (
            <button
              key={color}
              onClick={() => grifoPopupStore.setActiveTool(color)}
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                activeTool === color
                  ? 'bg-white shadow-sm scale-110'
                  : 'hover:bg-white/50'
              }`}
              aria-label={GRIFO_COLOR_NAMES[color]}
              title={`${GRIFO_COLOR_NAMES[color]} (Alt+${TOOL_COLORS.indexOf(color) + 1})`}
            >
              <div
                className="w-3.5 h-3.5 rounded-full"
                style={{
                  background: GRIFO_COLORS[color].replace(/[\d.]+\)$/, activeTool === color ? '0.8)' : '0.5)'),
                }}
              />
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Lei Seca toggle (always visible) */}
        <button
          onClick={toggleLeiSecaMode}
          className={`px-3 py-1 rounded-full transition-colors flex-shrink-0 ${
            leiSecaMode ? 'bg-[#2c3338] text-white' : 'bg-[#f4f4f4] text-[#888] hover:bg-[#eee]'
          }`}
        >
          {leiSecaMode ? (
            <><span className="hidden sm:inline">Lei Seca</span><span className="sm:hidden">LS</span> ✓</>
          ) : (
            <><span className="hidden sm:inline">Lei Seca</span><span className="sm:hidden">LS</span></>
          )}
        </button>

        {/* Desktop-only controls */}
        <div className="hidden sm:flex items-center gap-3">
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

        {/* Mobile overflow button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="sm:hidden w-7 h-7 flex items-center justify-center border border-[#e5e5e5] rounded-md text-[#888] text-[14px]"
        >
          ⋯
        </button>
      </div>

      {/* Mobile overflow menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden flex items-center gap-3 px-4 pb-2.5 flex-wrap">
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
        </div>
      )}
    </div>
  )
}
