'use client';

import { useState, useCallback } from 'react';
import { Copy, Highlighter, Flag, GraduationCap, BarChart3, MessageCircle, PenLine } from 'lucide-react';
import { toast } from 'sonner';

interface DispositivoFooterProps {
  texto: string;
  dispositivoId: string;
  leiId: string;
  dispositivoTipo: string;
  dispositivoPosicao: number | string;
  commentsCount?: number;
  hasNote?: boolean;
  onAnnotate?: () => void;
  onHighlight?: () => void;
  onReport?: () => void;
}

type ActiveTab = 'comunidade' | 'nota' | null;

export function DispositivoFooter({
  texto,
  commentsCount = 0,
  hasNote = false,
  onAnnotate,
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

  const tabClass = (tab: ActiveTab, isActive: boolean) => {
    const base = "flex items-center gap-[5px] px-[10px] py-[6px] rounded-[8px] border-none font-[Inter,sans-serif] text-[11px] font-medium cursor-pointer transition-all duration-[120ms]";
    if (!isActive) return `${base} bg-transparent text-[#a0a0a0] hover:bg-white hover:text-[#555]`;
    if (tab === 'comunidade') return `${base} bg-white text-[#2563eb] shadow-[0_1px_2px_rgba(0,0,0,0.04)]`;
    return `${base} bg-white text-[#d97706] shadow-[0_1px_2px_rgba(0,0,0,0.04)]`;
  };

  const actionClass = "flex items-center gap-[4px] px-[8px] py-[5px] rounded-[7px] border-none bg-transparent font-[Inter,sans-serif] text-[10px] font-medium text-[#bbb] cursor-pointer transition-all duration-[120ms] hover:bg-white hover:text-[#555] [&_svg]:opacity-40 [&:hover_svg]:opacity-70";

  return (
    <div style={{ animation: 'dispFootSlide 0.18s ease-out' }}>
      <style>{`@keyframes dispFootSlide { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Footer bar */}
      <div className="flex items-center gap-[1px] px-1 py-[5px] mt-1 bg-[#fafafa] rounded-[8px]">
        {/* Tabs */}
        <button onClick={() => toggleTab('comunidade')} className={tabClass('comunidade', activeTab === 'comunidade')}>
          💬 Comunidade
          {commentsCount > 0 && (
            <span className={`text-[9px] font-bold ${activeTab === 'comunidade' ? 'text-[#2563eb]' : 'text-[#a0a0a0]'}`}>
              {commentsCount}
            </span>
          )}
        </button>
        <button onClick={() => toggleTab('nota')} className={tabClass('nota', activeTab === 'nota')}>
          ✏️ Nota
          {hasNote && (
            <span className="w-[5px] h-[5px] rounded-full bg-[#d97706]" />
          )}
        </button>

        <div className="flex-1" />

        {/* Actions */}
        <button onClick={handleCopy} className={actionClass}>
          <Copy className="h-[11px] w-[11px]" /> Copiar
        </button>
        <button onClick={onHighlight} className={actionClass}>
          <Highlighter className="h-[11px] w-[11px]" /> Grifar
        </button>
        <button onClick={onReport} className={actionClass}>
          <Flag className="h-[11px] w-[11px]" /> Reportar
        </button>
      </div>

      {/* Tab content placeholder — will be wired to real comments/notes in future */}
      {activeTab === 'comunidade' && (
        <div className="mt-1 px-3 py-3 bg-[#fafafa] rounded-[8px] font-[Inter,sans-serif] text-[12px] text-[#999]" style={{ animation: 'dispFootSlide 0.18s ease-out' }}>
          {commentsCount > 0
            ? `${commentsCount} comentários — sistema completo em breve`
            : 'Nenhum comentário ainda. Sistema completo em breve.'
          }
        </div>
      )}
      {activeTab === 'nota' && (
        <div className="mt-1 px-3 py-3 bg-[#fffdf5] border border-[#fef3c7] rounded-[8px] font-[Inter,sans-serif] text-[12px] text-[#92400e]" style={{ animation: 'dispFootSlide 0.18s ease-out' }}>
          {hasNote
            ? 'Sua anotação aparecerá aqui — sistema completo em breve.'
            : 'Escreva uma anotação pessoal — sistema completo em breve.'
          }
        </div>
      )}
    </div>
  );
}
