'use client';

import { useEffect, useRef } from 'react';

const REACTIONS = [
  { emoji: '🔥', label: 'Cai em prova' },
  { emoji: '📌', label: 'Decorar' },
  { emoji: '⚠️', label: 'Pegadinha' },
  { emoji: '💡', label: 'Insight' },
  { emoji: '❤️', label: 'Importante' },
];

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function ReactionPicker({ onSelect, onClose }: ReactionPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 bottom-[calc(100%+4px)] flex gap-0 bg-white border border-[#eee] rounded-[24px] px-1 py-[3px] z-10"
      style={{
        boxShadow: '0 8px 24px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.03)',
        animation: 'reactionPickerPop 0.18s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <style>{`@keyframes reactionPickerPop { from { opacity:0; transform:scale(0.85); } to { opacity:1; transform:scale(1); } }`}</style>
      {REACTIONS.map((r) => (
        <button
          key={r.emoji}
          onClick={() => onSelect(r.emoji)}
          title={r.label}
          className="w-8 h-8 flex items-center justify-center border-none bg-transparent rounded-[18px] cursor-pointer text-[16px] transition-all duration-[120ms] hover:bg-[#f8f8f7] hover:scale-[1.2]"
        >
          {r.emoji}
        </button>
      ))}
    </div>
  );
}
