'use client';

import { forwardRef } from 'react';

interface Props {
  // Cosmética nesta fase — busca real virá em A7.
}

export const SearchColumn = forwardRef<HTMLInputElement, Props>(function SearchColumn(_props, ref) {
  return (
    <div>
      <div className="text-[10.5px] text-n-ink-3 tracking-[0.12em] uppercase mb-2.5">
        Buscar
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5 bg-n-rule-2 rounded-md text-[13px] text-n-ink">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-n-ink-3 shrink-0">
          <circle cx="5.5" cy="5.5" r="3.5" />
          <path d="M9 9l3 3" strokeLinecap="round" />
        </svg>
        <input
          ref={ref}
          type="text"
          placeholder="artigo, palavra-chave…"
          className="flex-1 bg-transparent border-0 outline-none text-[13px] placeholder:text-n-ink-3 font-n-sans"
        />
        <kbd className="text-[10.5px] px-1.5 py-0.5 bg-n-surface border border-n-rule rounded-[3px] text-n-ink-2 font-n-mono">⌘K</kbd>
      </div>

      <div className="mt-6">
        <div className="text-[10.5px] text-n-ink-3 tracking-[0.12em] uppercase mb-2.5">
          Atalhos
        </div>
        <ShortcutRow label="Hoje · revisão" hint="⌘1" />
        <ShortcutRow label="Cadernos" hint="⌘2" />
        <ShortcutRow label="Estatísticas" hint="⌘3" />
      </div>
    </div>
  );
});

function ShortcutRow({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 text-[13px] text-n-ink">
      <span className="text-n-accent text-[7px]">●</span>
      <span className="flex-1">{label}</span>
      <kbd className="text-[10px] px-[5px] py-[1px] bg-n-rule-2 rounded-[3px] text-n-ink-3 font-n-mono">{hint}</kbd>
    </div>
  );
}
