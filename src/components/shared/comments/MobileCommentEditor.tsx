'use client';

import { useState, useCallback } from 'react';
import { MobileSheet } from '@/components/ui/MobileSheet';
import { SheetToggle } from '@/components/ui/SheetToggle';
import { MobileEditorToolbar } from './MobileEditorToolbar';

interface MobileCommentEditorProps {
  open: boolean;
  onClose: () => void;
  onPublish: () => void;
  /** Label shown in the header (e.g. "Questão #42", "Art. 5º") */
  entityLabel?: string;
  /** Callback to get current editor text length for draft protection */
  getTextLength?: () => number;
  /** Callback when a toolbar tool is activated */
  onTool?: (tool: string) => void;
  /** The Plate editor JSX to render inside the sheet */
  editorContent: React.ReactNode;
  isSubmitting?: boolean;
}

export function MobileCommentEditor({
  open,
  onClose,
  onPublish,
  entityLabel,
  getTextLength,
  onTool,
  editorContent,
  isSubmitting,
}: MobileCommentEditorProps) {
  const [peekingQuestion, setPeekingQuestion] = useState(false);

  // Determine sheet height based on mode
  // Phone (<768px): 82dvh writing, 30dvh peeking
  // Tablet (768-1024px): 60dvh writing, 25dvh peeking
  const isPhone = typeof window !== 'undefined' && window.innerWidth < 768;
  const writingHeight = isPhone ? '82dvh' : '60dvh';
  const peekingHeight = isPhone ? '30dvh' : '25dvh';

  const hasContent = useCallback(() => {
    return (getTextLength?.() ?? 0) > 5;
  }, [getTextLength]);

  return (
    <MobileSheet
      open={open}
      onClose={onClose}
      confirmClose={hasContent}
      height={peekingQuestion ? peekingHeight : writingHeight}
      header={
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <SheetToggle
              active={peekingQuestion}
              labelA="Ver questão"
              labelB="Voltar ao editor"
              iconA="👁"
              iconB="✏️"
              onToggle={() => setPeekingQuestion((p) => !p)}
            />
            {entityLabel && (
              <span className="text-[10px] text-zinc-400">
                {entityLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-[13px] text-zinc-400 hover:text-zinc-600"
            >
              ✕
            </button>
            <button
              onClick={onPublish}
              disabled={isSubmitting}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Publicando...' : 'Publicar'}
            </button>
          </div>
        </div>
      }
      footer={
        peekingQuestion ? undefined : (
          <MobileEditorToolbar onTool={onTool ?? (() => {})} />
        )
      }
    >
      {peekingQuestion ? (
        <div className="px-4 py-3">
          <p className="text-[11px] font-medium text-zinc-400">Seu rascunho</p>
          <p className="mt-1 text-[12px] leading-relaxed text-zinc-500 opacity-70">
            (Continue editando ao voltar)
          </p>
        </div>
      ) : (
        <div className="flex-1 px-3 py-2">
          {editorContent}
        </div>
      )}
    </MobileSheet>
  );
}
