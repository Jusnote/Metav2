'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Trash2, Check, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useLeiComments,
  useLeiCommentsPending,
  useLeiCommentsActiveSlug,
  leiCommentsStore,
  type LeiComment,
} from '@/stores/leiCommentsStore';

// -------- Helpers --------

const ROLE_LABELS: Record<string, string> = {
  artigo: 'Art.',
  paragrafo: '§',
  paragrafo_unico: '§ único',
  inciso: 'Inciso',
  alinea: 'Alínea',
  item: 'Item',
  pena: 'Pena',
};

function relativeTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ontem';
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// -------- Pending Comment Input (Clean UI) --------

function CommentInput({ slug, role, provisionPreview }: {
  slug: string;
  role: string;
  provisionPreview: string;
}) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  },[]);

  const handleSubmit = () => {
    if (!text.trim()) return;
    leiCommentsStore.addComment({
      slug,
      role,
      provisionPreview,
      text: text.trim(),
    });
    setText('');
  };

  return (
    <div className="mb-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/10 shadow-sm overflow-hidden focus-within:border-blue-400 dark:focus-within:border-blue-700 transition-colors">
      
      {/* Context Badge (Minimalista) */}
      <div className="px-3 pt-2.5 pb-1.5 flex items-center gap-2 border-b border-blue-100/50 dark:border-blue-900/30">
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 shrink-0">
          {ROLE_LABELS[role] || role}
        </span>
        <span className="text-[11px] text-muted-foreground truncate opacity-80">
          {provisionPreview}
        </span>
      </div>

      {/* Input de Texto (Sem Avatar) */}
      <div className="px-3 py-2">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
            if (e.key === 'Escape') leiCommentsStore.clearPending();
          }}
          placeholder="Escreva sua anotação sobre este dispositivo..."
          className="w-full text-[13px] leading-relaxed bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/40 min-h-[60px] text-foreground"
        />
        
        {/* Ações (Alinhadas à direita) */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-muted-foreground/40 hidden sm:inline-block">Enter salva · Esc cancela</span>
          <span className="text-[10px] text-muted-foreground/40 sm:hidden"></span> {/* Spacer pro mobile */}
          <div className="flex gap-1">
            <button
              onClick={() => leiCommentsStore.clearPending()}
              className="px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="px-3 py-1 text-[11px] font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-sm"
            >
              Salvar Nota
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------- Comment Card (Knowledge Card Style) --------

function CommentCard({ comment, onScrollTo }: {
  comment: LeiComment;
  onScrollTo: (slug: string) => void;
}) {
  const[hovering, setHovering] = useState(false);

  return (
    <div
      className={cn(
        "group mb-3 relative rounded-xl border border-border/60 bg-background hover:border-border hover:shadow-sm transition-all cursor-pointer overflow-hidden",
        comment.resolved ? "opacity-50 grayscale" : ""
      )}
      onClick={() => onScrollTo(comment.slug)}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Indicador de Foco Lateral Invisível */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="px-4 py-3">
        {/* Metadados Superiores (Em vez de Nome + Avatar) */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Nota Salva
          </span>
          <span className="text-[10px] text-muted-foreground/60">
            {relativeTime(comment.createdAt)}
          </span>
        </div>

        {/* O Texto da Nota (O Protagonista) */}
        <p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
          {comment.text}
        </p>

        {/* Actions (Aparecem no Hover, mas sem poluir) */}
        <div className={cn(
          "flex items-center justify-end gap-1 mt-3 transition-opacity duration-200",
          hovering || comment.resolved ? "opacity-100" : "opacity-0"
        )}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              leiCommentsStore.resolveComment(comment.id);
            }}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors",
              comment.resolved 
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            title={comment.resolved ? 'Voltar para estudos' : 'Marcar como Revisado'}
          >
            <Check className="h-3 w-3" />
            {comment.resolved ? 'Revisado' : 'Revisar'}
          </button>
          
          {!comment.resolved && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                leiCommentsStore.deleteComment(comment.id);
              }}
              className="p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
              title="Excluir nota"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// -------- Panel (filtered by active provision) --------

export function LeiCommentsPanel({ onScrollToSlug }: {
  onScrollToSlug: (slug: string) => void;
}) {
  const comments = useLeiComments();
  const pending = useLeiCommentsPending();
  const activeSlug = useLeiCommentsActiveSlug();
  const [showResolved, setShowResolved] = useState(false);

  // Filter by active provision
  const slugComments = activeSlug
    ? comments.filter(c => c.slug === activeSlug && !c.resolved)
    :[];
  const slugResolved = activeSlug
    ? comments.filter(c => c.slug === activeSlug && c.resolved)
    :[];
  const totalAll = comments.filter(c => !c.resolved).length;

  // Show pending only if it matches the active slug
  const showPending = pending && pending.slug === activeSlug;

  // Get provision info from the first comment or pending
  const provisionRole = showPending
    ? pending.role
    : slugComments[0]?.role || '';
  const provisionPreview = showPending
    ? pending.provisionPreview
    : slugComments[0]?.provisionPreview || '';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0 border-b border-border/30">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-medium text-muted-foreground">Minhas Notas</h3>
          {totalAll > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-foreground/10 text-foreground/60">
              {totalAll}
            </span>
          )}
        </div>
        <button
          onClick={() => leiCommentsStore.closePanel()}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Active provision context */}
      {activeSlug && (provisionRole || provisionPreview) && (
        <div className="px-4 py-2 border-b border-border/20 bg-[#F0F4FA] dark:bg-zinc-800/50">
          <div className="flex items-center gap-1.5">
            {provisionRole && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 shrink-0">
                {ROLE_LABELS[provisionRole] || provisionRole}
              </span>
            )}
            {provisionPreview && (
              <span className="text-[11px] text-muted-foreground truncate">
                {provisionPreview.substring(0, 60)}{provisionPreview.length > 60 ? '...' : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto py-3 mx-3">
        {/* No provision selected */}
        {!activeSlug && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <FileText className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground text-center">
              Selecione um dispositivo para ver ou criar notas.
            </p>
          </div>
        )}

        {/* Provision selected */}
        {activeSlug && (
          <>
            {/* Pending comment input */}
            {showPending && (
              <CommentInput
                slug={pending.slug}
                role={pending.role}
                provisionPreview={pending.provisionPreview}
              />
            )}

            {/* Comments for this provision */}
            {slugComments.map((c) => (
              <CommentCard key={c.id} comment={c} onScrollTo={onScrollToSlug} />
            ))}

            {/* Empty state for this provision */}
            {slugComments.length === 0 && !showPending && (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <p className="text-xs text-muted-foreground/60 text-center">
                  Nenhuma nota salva neste dispositivo.
                </p>
                <p className="text-xs text-muted-foreground/40 text-center mt-1">
                  Use o ícone de anotação no menu de ações.
                </p>
              </div>
            )}

            {/* Resolved for this provision */}
            {slugResolved.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowResolved(!showResolved)}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showResolved ? 'Ocultar' : 'Mostrar'} notas revisadas ({slugResolved.length})
                </button>
                {showResolved && (
                  <div className="mt-2">
                    {slugResolved.map((c) => (
                      <CommentCard key={c.id} comment={c} onScrollTo={onScrollToSlug} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}