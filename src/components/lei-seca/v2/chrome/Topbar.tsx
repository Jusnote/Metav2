'use client';

import { MenuButton } from './MenuButton';

interface Props {
  megaMenuOpen: boolean;
  onToggleMegaMenu: () => void;
}

export function Topbar({ megaMenuOpen, onToggleMegaMenu }: Props) {
  return (
    <div className="border-b border-n-rule px-9 flex items-center justify-between bg-n-surface">
      <div className="flex items-center gap-8">
        <MenuButton open={megaMenuOpen} onToggle={onToggleMegaMenu} />
        <div className="text-[14px] font-semibold tracking-n-snug">
          <span className="text-n-accent">●</span>
          <span>&nbsp;&nbsp;letra·lei</span>
        </div>
        <nav className="flex gap-[22px] text-[13px] text-n-ink-2">
          <span className="text-n-ink font-medium">Estudo</span>
          <span>Resumos</span>
          <span>Questões</span>
          <span>Estatísticas</span>
        </nav>
      </div>
      <div className="flex items-center gap-[14px]">
        <div className="flex items-center gap-2 px-2.5 py-[5px] bg-n-rule-2 rounded-md text-[12px] text-n-ink-3 w-60">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="5" cy="5" r="3.5" />
            <path d="M8 8l3 3" strokeLinecap="round" />
          </svg>
          <span className="flex-1">Buscar artigo, palavra-chave</span>
          <kbd className="text-[10px] px-[5px] py-[1px] bg-n-surface border border-n-rule rounded-[3px] text-n-ink-2">⌘K</kbd>
        </div>
      </div>
    </div>
  );
}
