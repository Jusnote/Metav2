'use client';

import { useState, useCallback, useRef } from 'react';
import { ReactionPicker } from './ReactionPicker';
import { CommunityPopover } from './CommunityPopover';
import { DispositivoFooter } from './DispositivoFooter';
import { LeiReportModal } from '@/components/lei-seca/LeiReportModal';
import type { DispositivoReaction } from '@/hooks/useDispositivoReactions';

interface DispositivoActionsProps {
  dispositivoId: string;
  leiId: string;
  texto: string;
  tipo: string;
  posicao: number | string;
  reaction?: DispositivoReaction;
  onToggleReaction: (emoji: string) => void;
  onAnnotate?: () => void;
  onHighlight?: () => void;
  commentsCount?: number;
  hasNote?: boolean;
}

export function DispositivoActions({
  dispositivoId, leiId, texto, tipo, posicao,
  reaction, onToggleReaction, onAnnotate, onHighlight,
  commentsCount = 0, hasNote = false,
}: DispositivoActionsProps) {
  const heartBtnRef = useRef<HTMLButtonElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [footerOpen, setFooterOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const userEmoji = reaction?.userEmoji;
  const hasReacted = !!userEmoji;
  const topEmoji = reaction?.topEmoji;
  const totalCount = reaction?.totalCount ?? 0;
  const breakdown = reaction?.breakdown ?? {};

  const handleSelectEmoji = useCallback((emoji: string) => {
    onToggleReaction(emoji);
    setPickerOpen(false);
  }, [onToggleReaction]);

  const handleToggleFooter = useCallback(() => {
    setFooterOpen(prev => !prev);
    setPickerOpen(false);
    setPopoverOpen(false);
  }, []);

  return (
    <>
      <div
        className={`flex items-center flex-shrink-0 ml-3 pt-[6px] transition-opacity duration-200 ${
          hasReacted || commentsCount > 0 || hasNote ? 'opacity-100' : 'opacity-0 group-hover/disp:opacity-100'
        }`}
      >
        {/* Zone 1: Personal */}
        <div className="flex items-center gap-[3px] px-[5px] relative">
          <button
            ref={heartBtnRef}
            onClick={() => { setPickerOpen(!pickerOpen); setPopoverOpen(false); }}
            className={`w-[26px] h-[26px] flex items-center justify-center rounded-[7px] border-none bg-transparent cursor-pointer transition-all duration-150 ${
              hasReacted ? 'text-[15px] hover:bg-[#f5f5f4] hover:scale-110' : 'text-[#d4d4d4] hover:bg-[#f5f5f4] hover:text-[#dc7c7c]'
            }`}
          >
            {hasReacted ? userEmoji : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            )}
          </button>
          {pickerOpen && <ReactionPicker anchorRef={heartBtnRef} onSelect={handleSelectEmoji} onClose={() => setPickerOpen(false)} />}
        </div>

        <div className="w-px h-4 bg-[#eceae7] flex-shrink-0" />

        {/* Zone 2: Community */}
        <div className="flex items-center gap-[3px] px-[5px] relative">
          {totalCount > 0 ? (
            <button
              onClick={() => { setPopoverOpen(!popoverOpen); setPickerOpen(false); }}
              className="flex items-center gap-[2px] px-[5px] py-[2px] rounded-lg text-[12px] font-[Inter,sans-serif] cursor-pointer transition-colors hover:bg-[#f5f5f4]"
            >
              {topEmoji} <span className="text-[9px] text-[#bbb] font-semibold">{totalCount}</span>
            </button>
          ) : (
            <span className="text-[9px] text-[#ddd] font-[Inter,sans-serif] px-[2px]">—</span>
          )}
          {popoverOpen && totalCount > 0 && <CommunityPopover breakdown={breakdown} onClose={() => setPopoverOpen(false)} />}
        </div>

        <div className="w-px h-4 bg-[#eceae7] flex-shrink-0" />

        {/* Zone 3: More + badges */}
        <div className="flex items-center px-[5px]">
          <button
            onClick={handleToggleFooter}
            className={`h-[26px] flex items-center gap-[3px] px-[5px] rounded-[7px] border-none bg-transparent cursor-pointer transition-all duration-150 ${
              footerOpen ? 'bg-[#f0f0ef] text-[#555]' : 'text-[#d4d4d4] hover:bg-[#f5f5f4] hover:text-[#888]'
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
            </svg>
            {(commentsCount > 0 || hasNote) && (
              <span className="flex items-center gap-[2px] ml-[1px]">
                {commentsCount > 0 && (
                  <span className="flex items-center gap-[1px] text-[9px] font-[Inter,sans-serif] text-[#7c3aed]">
                    💬<span className="text-[8px] font-bold">{commentsCount}</span>
                  </span>
                )}
                {commentsCount > 0 && hasNote && (
                  <span className="w-px h-[8px] bg-[#e8e8e6]" />
                )}
                {hasNote && (
                  <span className="text-[9px] text-[#d97706]">✏️</span>
                )}
              </span>
            )}
          </button>
        </div>
      </div>

      {footerOpen && (
        <DispositivoFooter
          texto={texto} dispositivoId={dispositivoId} leiId={leiId}
          dispositivoTipo={tipo} dispositivoPosicao={posicao}
          commentsCount={commentsCount} hasNote={hasNote}
          onAnnotate={onAnnotate} onHighlight={onHighlight}
          onReport={() => { setReportOpen(true); setFooterOpen(false); }}
        />
      )}

      {reportOpen && (
        <LeiReportModal
          open={reportOpen} onClose={() => setReportOpen(false)}
          dispositivoId={String(dispositivoId)} leiId={leiId}
          dispositivoTipo={tipo} dispositivoNumero={String(posicao)} dispositivoTexto={texto}
        />
      )}
    </>
  );
}
