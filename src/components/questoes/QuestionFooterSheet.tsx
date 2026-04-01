'use client';

import { MobileSheet } from '@/components/ui/MobileSheet';
import { PenLine, Flag, Sparkles, Bookmark } from 'lucide-react';

interface QuestionFooterSheetProps {
  open: boolean;
  onClose: () => void;
  questaoId: number;
  subject?: string;
  subtopic?: string;
  onAction: (action: 'nota' | 'report' | 'explain' | 'bookmark') => void;
}

const ACTIONS = [
  {
    key: 'nota' as const,
    icon: PenLine,
    label: 'Anotação pessoal',
    desc: 'Salvar nota privada sobre esta questão',
    bg: '#faf8ff',
  },
  {
    key: 'report' as const,
    icon: Flag,
    label: 'Reportar erro',
    desc: 'Gabarito, enunciado ou classificação errada',
    bg: '#fef2f2',
  },
  {
    key: 'explain' as const,
    icon: Sparkles,
    label: 'Explicar com IA',
    desc: 'Análise detalhada de cada alternativa',
    bg: '#ede9fe',
  },
  {
    key: 'bookmark' as const,
    icon: Bookmark,
    label: 'Salvar questão',
    desc: 'Adicionar aos favoritos',
    bg: '#f0fdf4',
  },
];

export function QuestionFooterSheet({
  open,
  onClose,
  questaoId,
  subject,
  subtopic,
  onAction,
}: QuestionFooterSheetProps) {
  return (
    <MobileSheet
      open={open}
      onClose={onClose}
      height="auto"
      header={
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <span className="text-[11px] text-zinc-400">Questão #{questaoId}</span>
            {subject && (
              <span className="text-[11px] text-zinc-400"> · {subject}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[13px] text-zinc-400 hover:text-zinc-600"
          >
            ✕
          </button>
        </div>
      }
    >
      <div className="px-3 pb-4">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            onClick={() => {
              onAction(a.key);
              onClose();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-[#faf8ff]"
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ background: a.bg }}
            >
              <a.icon className="h-[18px] w-[18px] text-zinc-600" />
            </div>
            <div>
              <span className="block text-[13px] font-semibold text-zinc-900">
                {a.label}
              </span>
              <span className="block text-[11px] text-zinc-400">{a.desc}</span>
            </div>
          </button>
        ))}
      </div>
    </MobileSheet>
  );
}
