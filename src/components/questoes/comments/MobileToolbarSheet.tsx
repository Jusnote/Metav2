'use client';

import { MobileSheet } from '@/components/ui/MobileSheet';
import {
  Heading3,
  Quote,
  SquareCode,
  Palette,
  PaintBucket,
  Table,
  Sigma,
  Film,
  Undo2,
  Redo2,
} from 'lucide-react';

interface MobileToolbarSheetProps {
  open: boolean;
  onClose: () => void;
  onTool: (tool: string) => void;
}

const TOOLS = [
  { key: 'h3', icon: Heading3, label: 'Título' },
  { key: 'blockquote', icon: Quote, label: 'Citação' },
  { key: 'code_block', icon: SquareCode, label: 'Bloco de código' },
  { key: 'font_color', icon: Palette, label: 'Cor do texto' },
  { key: 'bg_color', icon: PaintBucket, label: 'Cor de fundo' },
  { key: 'table', icon: Table, label: 'Tabela' },
  { key: 'equation', icon: Sigma, label: 'Equação' },
  { key: 'video', icon: Film, label: 'Vídeo embed' },
  { key: 'undo', icon: Undo2, label: 'Desfazer' },
  { key: 'redo', icon: Redo2, label: 'Refazer' },
];

export function MobileToolbarSheet({ open, onClose, onTool }: MobileToolbarSheetProps) {
  return (
    <MobileSheet
      open={open}
      onClose={onClose}
      height="auto"
      header={
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[13px] font-semibold text-zinc-900">Ferramentas</span>
          <button onClick={onClose} className="text-[13px] text-zinc-400">✕</button>
        </div>
      }
    >
      <div className="grid grid-cols-4 gap-2 px-4 pb-4">
        {TOOLS.map((t) => (
          <button
            key={t.key}
            onClick={() => { onTool(t.key); onClose(); }}
            className="flex flex-col items-center gap-1.5 rounded-xl py-3 text-zinc-600 transition-colors hover:bg-zinc-50"
          >
            <t.icon className="h-5 w-5" />
            <span className="text-[10px] text-zinc-500">{t.label}</span>
          </button>
        ))}
      </div>
    </MobileSheet>
  );
}
