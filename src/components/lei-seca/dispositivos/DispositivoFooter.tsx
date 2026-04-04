'use client';

import { useState, useCallback } from 'react';
import { MessageCircle, PenLine, Flag, Copy, Highlighter, Heart, Flame } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DispositivoCommentsSection } from '@/components/lei-seca/comments/DispositivoCommentsSection';

interface DispositivoFooterProps {
  texto: string;
  dispositivoId: string;
  leiId: string;
  dispositivoTipo: string;
  dispositivoPosicao: number | string;
  commentsCount?: number;
  hasNote?: boolean;
  likesCount?: number;
  incidencia?: number | null;
  leiUpdatedAt?: string;
  onAnnotate?: () => void;
  onHighlight?: () => void;
  onReport?: () => void;
}

type ActiveTab = 'comunidade' | 'nota' | null;

const btnBase = "qc-footer-btn inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-md transition-all duration-200";
const btnInactive = `${btnBase} text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-zinc-100 dark:hover:bg-zinc-800`;
const infoPill = "inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold text-zinc-400 cursor-default";

function getIncidenceLevel(n: number | null | undefined): number {
  if (!n || n === 0) return 0;
  if (n <= 10) return 1;
  if (n <= 50) return 2;
  return 3;
}

export function DispositivoFooter({
  texto,
  dispositivoId,
  leiId,
  commentsCount = 0,
  hasNote = false,
  likesCount = 0,
  incidencia = null,
  leiUpdatedAt,
  onHighlight,
  onReport,
}: DispositivoFooterProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>(null);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(texto).then(() => toast.success('Texto copiado')).catch(() => toast.error('Erro ao copiar'));
  }, [texto]);

  const toggleTab = (tab: ActiveTab) => {
    setActiveTab(prev => prev === tab ? null : tab);
  };

  const comunidadeActive = activeTab === 'comunidade';
  const notaActive = activeTab === 'nota';
  const level = getIncidenceLevel(incidencia);

  return (
    <div style={{ animation: 'dispFootSlide 0.18s ease-out' }}>
      <style>{`@keyframes dispFootSlide { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }`}</style>

      <footer className="border-t border-zinc-100 dark:border-zinc-800/50">
        <div className="px-4 py-1.5 flex items-center gap-2">
          {/* Info pills: likes + incidence */}
          <span className={infoPill}>
            <Heart className="w-[13px] h-[13px] text-red-400" />
            <span className="tabular-nums">{likesCount}</span>
          </span>

          <span className={cn(infoPill, "gap-[2px]")}>
            {[1, 2, 3].map(i => (
              <Flame
                key={i}
                className={cn(
                  "w-[11px] h-[11px]",
                  i <= level ? "text-orange-500 fill-orange-500" : "text-zinc-200 dark:text-zinc-700"
                )}
              />
            ))}
            {incidencia != null && incidencia > 0 && (
              <span className="text-[10px] tabular-nums ml-[2px]">{incidencia}</span>
            )}
          </span>

          {/* Divider */}
          <div className="w-0.5 h-3 bg-zinc-200 dark:bg-zinc-700 mx-1 rounded-full" />

          {/* Comunidade */}
          <button
            onClick={() => toggleTab('comunidade')}
            className={comunidadeActive
              ? `${btnBase} text-[#2563EB] bg-[#EFF6FF] dark:text-blue-400 dark:bg-blue-950/30`
              : btnInactive
            }
          >
            <MessageCircle className="w-[15px] h-[15px]" />
            Comunidade
            {commentsCount > 0 && <span>{commentsCount}</span>}
          </button>

          {/* Nota */}
          <button
            onClick={() => toggleTab('nota')}
            className={`relative ${notaActive
              ? `${btnBase} text-[#D97706] bg-[#FFFBEB] dark:text-amber-400 dark:bg-amber-950/30`
              : btnInactive
            }`}
          >
            <PenLine className="w-[15px] h-[15px]" />
            Nota
            {hasNote && !notaActive && (
              <span className="absolute -top-0.5 -right-0.5 h-[6px] w-[6px] rounded-full bg-amber-500" />
            )}
          </button>

          <div className="flex-1" />

          {/* Actions */}
          <button onClick={handleCopy} className={btnInactive}>
            <Copy className="w-[15px] h-[15px]" />
            Copiar
          </button>

          <button onClick={onHighlight} className={btnInactive}>
            <Highlighter className="w-[15px] h-[15px]" />
            Grifar
          </button>

          <button onClick={onReport} className={btnInactive}>
            <Flag className="w-[15px] h-[15px]" />
            Reportar
          </button>
        </div>
      </footer>

      {/* Tab content */}
      {activeTab && (
        <div className="mt-1">
          <DispositivoCommentsSection
            dispositivoId={dispositivoId}
            leiId={leiId}
            activeSection={activeTab}
            leiUpdatedAt={leiUpdatedAt}
          />
        </div>
      )}
    </div>
  );
}
