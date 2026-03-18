'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { useLeiSeca } from '@/contexts/LeiSecaContext';
import { useCadernosOptional } from '@/contexts/CadernosContext';

const ROLE_LABELS: Record<string, string> = {
  artigo: 'Art.',
  paragrafo: '§',
  paragrafo_unico: '§ único',
  inciso: 'Inciso',
  alinea: 'Alínea',
  item: 'Item',
  pena: 'Pena',
};

interface AnnotationSheetProps {
  editorColumnRef: React.RefObject<HTMLDivElement | null>;
}

export function AnnotationSheet({ editorColumnRef }: AnnotationSheetProps) {
  const {
    noteBarProvision, closeNoteBar,
    currentLeiId, currentArtigo, currentLeiInfo,
  } = useLeiSeca();
  const cadernosCtx = useCadernosOptional();

  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track the actual TipTap content element bounds (max-width: 768px, centered)
  const [bounds, setBounds] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const col = editorColumnRef?.current;
    if (!col) return;

    // Find the actual .lei-seca-tiptap-content inside the editor column
    const findContentEl = () => col.querySelector<HTMLElement>('.lei-seca-tiptap-content');

    const update = () => {
      const contentEl = findContentEl();
      if (!contentEl) return;
      const rect = contentEl.getBoundingClientRect();
      // Account for the content's own horizontal padding (4rem = 64px each side)
      const padLeft = parseFloat(getComputedStyle(contentEl).paddingLeft) || 0;
      const padRight = parseFloat(getComputedStyle(contentEl).paddingRight) || 0;
      setBounds({
        left: rect.left + padLeft,
        width: rect.width - padLeft - padRight,
      });
    };

    // Retry until TipTap renders
    const interval = setInterval(() => {
      if (findContentEl()) {
        clearInterval(interval);
        update();
      }
    }, 100);

    const ro = new ResizeObserver(update);
    const tryObserve = () => {
      const el = findContentEl();
      if (el) ro.observe(el);
    };
    tryObserve();
    window.addEventListener('resize', update);
    return () => {
      clearInterval(interval);
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [editorColumnRef]);

  // Load existing note when sheet opens
  useEffect(() => {
    if (!noteBarProvision || !cadernosCtx) { setText(''); return; }
    const item = cadernosCtx.items.find(i => i.provision_slug === noteBarProvision.slug);
    setText(item?.note || '');
  }, [noteBarProvision, cadernosCtx]);

  // Auto-focus
  useEffect(() => {
    if (noteBarProvision) {
      setTimeout(() => textareaRef.current?.focus(), 200);
    }
  }, [noteBarProvision]);

  const handleSave = useCallback(async () => {
    if (!noteBarProvision || !cadernosCtx || !text.trim()) {
      closeNoteBar();
      return;
    }
    setSaving(true);

    if (!cadernosCtx.isSaved(noteBarProvision.slug)) {
      await cadernosCtx.saveProvision({
        lei_id: currentLeiId,
        artigo_numero: currentArtigo?.numero || '',
        provision_slug: noteBarProvision.slug,
        provision_role: noteBarProvision.role,
        provision_text: noteBarProvision.text,
        lei_sigla: currentLeiInfo?.sigla || null,
        lei_nome: currentLeiInfo?.nome || null,
        artigo_contexto: currentArtigo?.contexto || null,
        context_chain: [],
      });
    }

    await cadernosCtx.updateNote(noteBarProvision.slug, text.trim());
    setSaving(false);
    closeNoteBar();
  }, [noteBarProvision, cadernosCtx, text, closeNoteBar, currentLeiId, currentArtigo, currentLeiInfo]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') closeNoteBar();
  }, [handleSave, closeNoteBar]);

  const isOpen = !!noteBarProvision;
  const roleLabel = noteBarProvision ? (ROLE_LABELS[noteBarProvision.role] || noteBarProvision.role) : '';

  return (
    <>
      {/* No backdrop — user can keep scrolling the law text while sheet is open */}

      {/* Sheet — fixed, constrained to editor column, non-blocking */}
      <div
        className="fixed z-50 transition-transform duration-300 ease-out"
        style={{
          left: bounds.left,
          width: bounds.width || '100%',
          bottom: 0,
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        <div className="bg-background rounded-t-xl shadow-[0_-4px_24px_rgba(0,0,0,0.08)] border-t border-border/50">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-8 h-1 rounded-full bg-border" />
          </div>

          {/* Close button */}
          <button
            onClick={closeNoteBar}
            className="absolute top-3 right-3 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="px-5 pb-5">
            {/* Context badge + text preview */}
            {noteBarProvision && (
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary shrink-0">
                  {roleLabel}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {noteBarProvision.text.substring(0, 100)}
                  {noteBarProvision.text.length > 100 ? '...' : ''}
                </span>
              </div>
            )}

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escreva sua anotação..."
              disabled={saving}
              rows={4}
              className="w-full text-sm bg-transparent border border-border rounded-lg px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40 disabled:opacity-50 leading-relaxed"
            />

            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-muted-foreground/50">
                Enter salva · Shift+Enter nova linha · Esc fecha
              </span>
              {text.trim() && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
