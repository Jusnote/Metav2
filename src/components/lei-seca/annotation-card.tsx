'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Check, Plus, Loader2 } from 'lucide-react';
import { useCadernosOptional } from '@/contexts/CadernosContext';
import { useLeiSeca } from '@/contexts/LeiSecaContext';
import { cn } from '@/lib/utils';
import type { ContextChainItem } from '@/types/caderno';

const ROLE_DEPTH: Record<string, number> = {
  artigo: 0, epigrafe: 0,
  paragrafo: 1, paragrafo_unico: 1, pena: 1,
  inciso: 2, alinea: 3, item: 4,
};

function extractContextChain(targetSlug: string, container: HTMLElement): ContextChainItem[] {
  if (!targetSlug) return [];
  const allParas = Array.from(container.querySelectorAll<HTMLElement>('p[data-role]'));
  const targetIdx = allParas.findIndex(p => p.dataset.slug === targetSlug);
  if (targetIdx <= 0) return [];
  const targetRole = allParas[targetIdx].dataset.role || '';
  const targetDepth = ROLE_DEPTH[targetRole] ?? 99;
  if (targetDepth === 0) return [];
  const ancestors = new Map<number, ContextChainItem>();
  let minDepthNeeded = targetDepth;
  for (let i = targetIdx - 1; i >= 0; i--) {
    const p = allParas[i];
    const role = p.dataset.role || '';
    const depth = ROLE_DEPTH[role] ?? 99;
    if (depth < minDepthNeeded && !ancestors.has(depth)) {
      ancestors.set(depth, { role, slug: p.dataset.slug || '', text: p.textContent || '' });
      minDepthNeeded = depth;
      if (depth === 0) break;
    }
  }
  return Array.from(ancestors.entries()).sort((a, b) => a[0] - b[0]).map(([, item]) => item);
}

interface AnnotationCardProps {
  slug: string;
  onClose: () => void;
}

export function AnnotationCard({ slug, onClose }: AnnotationCardProps) {
  const cadernosCtx = useCadernosOptional();
  const { currentLeiId, currentLei } = useLeiSeca();

  const existingItem = cadernosCtx?.items.find(i => i.provision_slug === slug);

  const [noteText, setNoteText] = useState(existingItem?.note || '');
  const [markers, setMarkers] = useState<string[]>(existingItem?.markers || []);
  const [newMarker, setNewMarker] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showMarkerInput, setShowMarkerInput] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    if (existingItem?.note !== undefined && existingItem.note !== noteText) {
      setNoteText(existingItem.note || '');
    }
    if (existingItem?.markers) {
      setMarkers(existingItem.markers);
    }
  }, [existingItem?.note, existingItem?.markers]);

  const getProvisionInfo = useCallback(() => {
    const el = document.querySelector<HTMLElement>(`p[data-slug="${CSS.escape(slug)}"]`);
    return {
      role: el?.dataset.role || 'artigo',
      text: el?.textContent || '',
    };
  }, [slug]);

  const ensureSaved = useCallback(async () => {
    if (!cadernosCtx || cadernosCtx.isSaved(slug)) return;
    const { role, text } = getProvisionInfo();
    const scrollContainer = document.querySelector('.lei-seca-tiptap-content')?.parentElement;
    const contextChain = scrollContainer
      ? extractContextChain(slug, scrollContainer as HTMLElement)
      : [];
    await cadernosCtx.saveProvision({
      lei_id: currentLeiId,
      artigo_numero: '', // TODO: reconnect after React renderer migration
      provision_slug: slug,
      provision_role: role,
      provision_text: text,
      lei_sigla: currentLei?.apelido || null,
      lei_nome: currentLei?.titulo || null,
      artigo_contexto: null, // TODO: reconnect after React renderer migration
      context_chain: contextChain,
    });
  }, [cadernosCtx, slug, getProvisionInfo, currentLeiId, currentLei]);

  const handleSave = useCallback(async () => {
    if (!cadernosCtx || !noteText.trim()) return;
    setSaving(true);
    try {
      await ensureSaved();
      await cadernosCtx.updateNote(slug, noteText.trim());
      setSaved(true);
      setTimeout(() => onClose(), 500);
    } catch {
      setSaving(false);
    }
  }, [cadernosCtx, slug, noteText, ensureSaved, onClose]);

  const handleAddMarker = useCallback(async () => {
    if (!newMarker.trim() || !cadernosCtx) return;
    const tag = newMarker.trim().startsWith('#') ? newMarker.trim() : `#${newMarker.trim()}`;
    await ensureSaved();
    await cadernosCtx.addMarker(slug, tag);
    setMarkers(prev => [...prev, tag]);
    setNewMarker('');
    setShowMarkerInput(false);
  }, [newMarker, cadernosCtx, slug, ensureSaved]);

  const handleRemoveMarker = useCallback(async (tag: string) => {
    if (!cadernosCtx) return;
    await cadernosCtx.removeMarker(slug, tag);
    setMarkers(prev => prev.filter(m => m !== tag));
  }, [cadernosCtx, slug]);

  return (
    <div
      className={cn(
        "annotation-card group/card relative",
        "rounded-lg bg-white dark:bg-[#1c1c1e]",
        "border border-black/[0.06] dark:border-white/[0.08]",
        "shadow-[0_1px_8px_-1px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_8px_-1px_rgba(0,0,0,0.3)]",
        saved && "opacity-60 scale-[0.99] transition-all duration-300 ease-out",
      )}
    >
      {/* Close — invisible until card hover */}
      <button
        onClick={onClose}
        className={cn(
          "absolute top-2 right-2 z-10 p-1 rounded-md",
          "text-black/20 dark:text-white/15",
          "opacity-0 group-hover/card:opacity-100",
          "hover:text-black/50 hover:bg-black/[0.04] dark:hover:text-white/40 dark:hover:bg-white/[0.06]",
          "transition-all duration-150",
        )}
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Textarea — the main event */}
      <div className="p-3 pb-0">
        <textarea
          ref={textareaRef}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
            if (e.key === 'Escape') onClose();
          }}
          placeholder="O que você observou neste dispositivo?"
          disabled={saving}
          rows={3}
          className={cn(
            "w-full text-[13px] leading-[1.7] resize-none outline-none",
            "bg-transparent",
            "text-black/80 dark:text-white/80",
            "placeholder:text-black/20 dark:placeholder:text-white/15",
            "disabled:opacity-30",
          )}
        />
      </div>

      {/* Bottom row: tags + save */}
      <div className="flex items-end justify-between gap-3 px-3 pb-3 pt-1">
        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap min-h-[24px]">
          {markers.map((tag) => (
            <button
              key={tag}
              onClick={() => handleRemoveMarker(tag)}
              className={cn(
                "group/tag inline-flex items-center gap-1 px-2 py-[3px] rounded-full",
                "text-[10px] font-medium",
                "bg-black/[0.04] text-black/50 dark:bg-white/[0.06] dark:text-white/40",
                "hover:bg-red-500/10 hover:text-red-500/80 dark:hover:bg-red-500/15 dark:hover:text-red-400/80",
                "transition-colors duration-150",
              )}
            >
              {tag}
              <X className="h-2 w-2 opacity-0 group-hover/tag:opacity-100 transition-opacity" />
            </button>
          ))}

          {showMarkerInput ? (
            <input
              value={newMarker}
              onChange={(e) => setNewMarker(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleAddMarker(); }
                if (e.key === 'Escape') { setShowMarkerInput(false); setNewMarker(''); }
              }}
              placeholder="#tag"
              autoFocus
              className={cn(
                "w-20 text-[10px] font-medium",
                "bg-transparent border-b border-black/10 dark:border-white/10",
                "px-1 py-[3px] outline-none",
                "placeholder:text-black/20 dark:placeholder:text-white/15",
              )}
            />
          ) : (
            <button
              onClick={() => setShowMarkerInput(true)}
              className={cn(
                "inline-flex items-center gap-0.5 p-1 rounded-full",
                "text-black/15 dark:text-white/10",
                "hover:text-black/40 hover:bg-black/[0.03] dark:hover:text-white/30 dark:hover:bg-white/[0.04]",
                "transition-colors duration-150",
              )}
              title="Adicionar tag"
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Save button — only when there's text */}
        {noteText.trim() ? (
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md",
              "text-[11px] font-medium",
              "transition-all duration-200",
              saved
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : saving
                  ? "bg-black/[0.04] text-black/30 dark:bg-white/[0.04] dark:text-white/20"
                  : "bg-black/[0.06] text-black/60 hover:bg-black/[0.1] hover:text-black/80 active:scale-[0.97] dark:bg-white/[0.08] dark:text-white/50 dark:hover:bg-white/[0.12] dark:hover:text-white/70",
            )}
          >
            {saved ? (
              <><Check className="h-3 w-3" /> Salvo</>
            ) : saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              'Salvar'
            )}
          </button>
        ) : (
          <span className="text-[9px] text-black/15 dark:text-white/10 shrink-0 select-none">
            enter salva
          </span>
        )}
      </div>
    </div>
  );
}
