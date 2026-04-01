'use client';

import { useCallback } from 'react';
import { Copy, PenLine, Highlighter, Flag } from 'lucide-react';
import { toast } from 'sonner';

interface DispositivoFooterProps {
  texto: string;
  dispositivoId: string;
  leiId: string;
  dispositivoTipo: string;
  dispositivoPosicao: number | string;
  onAnnotate?: () => void;
  onHighlight?: () => void;
  onReport?: () => void;
}

export function DispositivoFooter({ texto, onAnnotate, onHighlight, onReport }: DispositivoFooterProps) {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(texto).then(() => toast.success('Texto copiado')).catch(() => toast.error('Erro ao copiar'));
  }, [texto]);

  const btnClass = "flex items-center gap-[6px] px-3 py-[6px] rounded-[7px] border-none bg-transparent font-[Inter,sans-serif] text-[11.5px] font-medium text-[#b0b0b0] cursor-pointer transition-all duration-[120ms] hover:bg-[#f5f5f4] hover:text-[#555] [&_svg]:opacity-50 [&:hover_svg]:opacity-80";

  return (
    <div className="flex items-center gap-0 py-[6px]" style={{ animation: 'dispFootSlide 0.18s ease-out' }}>
      <style>{`@keyframes dispFootSlide { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }`}</style>
      <button onClick={handleCopy} className={btnClass}><Copy className="h-[13px] w-[13px]" />Copiar</button>
      <button onClick={onAnnotate} className={btnClass}><PenLine className="h-[13px] w-[13px]" />Anotar</button>
      <button onClick={onHighlight} className={btnClass}><Highlighter className="h-[13px] w-[13px]" />Grifar</button>
      <div className="w-px h-[14px] bg-[#eee] mx-[2px]" />
      <button onClick={onReport} className={btnClass}><Flag className="h-[13px] w-[13px]" />Reportar</button>
    </div>
  );
}
