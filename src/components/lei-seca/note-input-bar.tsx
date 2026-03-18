'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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

const MAX_HEIGHT = 120; // ~6 lines

export function NoteInputBar() {
  const {
    noteBarProvision, closeNoteBar,
    currentLeiId, currentArtigo, currentLeiInfo,
  } = useLeiSeca();
  const cadernosCtx = useCadernosOptional();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load existing note when bar opens
  useEffect(() => {
    if (!noteBarProvision || !cadernosCtx) {
      setText('');
      return;
    }
    const item = cadernosCtx.items.find(i => i.provision_slug === noteBarProvision.slug);
    setText(item?.note || '');
  }, [noteBarProvision, cadernosCtx]);

  // Auto-focus
  useEffect(() => {
    if (noteBarProvision) {
      // Small delay for DOM mount
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [noteBarProvision]);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT)}px`;
  }, []);

  useEffect(() => { autoResize(); }, [text, autoResize]);

  const handleSave = useCallback(async () => {
    if (!noteBarProvision || !cadernosCtx || !text.trim()) {
      closeNoteBar();
      return;
    }

    setSaving(true);

    // If not saved yet, save provision first
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      closeNoteBar();
    }
  }, [handleSave, closeNoteBar]);

  if (!noteBarProvision) return null;

  const roleLabel = ROLE_LABELS[noteBarProvision.role] || noteBarProvision.role;

  return (
    <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-2.5 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
      <div className="flex items-start gap-3 max-w-3xl mx-auto">
        <div className="flex-1 min-w-0">
          {/* Context badge */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary shrink-0">
              {roleLabel}
            </span>
            <span className="text-[11px] text-muted-foreground truncate">
              {noteBarProvision.text.substring(0, 80)}
              {noteBarProvision.text.length > 80 ? '...' : ''}
            </span>
          </div>

          {/* Auto-growing textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Sua anotação... (Enter salva, Shift+Enter quebra linha)"
            disabled={saving}
            rows={1}
            className="w-full text-sm bg-transparent border border-border rounded-lg px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40 disabled:opacity-50 overflow-y-auto leading-5"
            style={{ minHeight: '36px' }}
          />

          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-muted-foreground/50">
              Enter salva · Shift+Enter nova linha · Esc cancela
            </span>
            {text.trim() && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-[10px] text-primary hover:text-primary/80 font-medium transition-colors disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar ↵'}
              </button>
            )}
          </div>
        </div>

        <button
          onClick={closeNoteBar}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-5"
          title="Fechar (Esc)"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
