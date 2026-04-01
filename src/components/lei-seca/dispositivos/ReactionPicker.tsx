'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const REACTIONS = [
  { emoji: '🔥', label: 'Cai em prova' },
  { emoji: '📌', label: 'Decorar' },
  { emoji: '⚠️', label: 'Pegadinha' },
  { emoji: '💡', label: 'Insight' },
  { emoji: '❤️', label: 'Importante' },
];

interface ReactionPickerProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function ReactionPicker({ anchorRef, onSelect, onClose }: ReactionPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({
        top: rect.top - 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [anchorRef]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    // Use setTimeout to avoid the opening click triggering immediate close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose, anchorRef]);

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: pos.top,
        right: pos.right,
        transform: 'translateY(-100%)',
        zIndex: 100,
        display: 'flex',
        gap: 0,
        background: 'white',
        border: '1px solid #eee',
        borderRadius: 24,
        padding: '3px 4px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
        animation: 'reactionPickerPop 0.18s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <style>{`@keyframes reactionPickerPop { from { opacity:0; transform:translateY(-100%) scale(0.85); } to { opacity:1; transform:translateY(-100%) scale(1); } }`}</style>
      {REACTIONS.map((r) => (
        <button
          key={r.emoji}
          onClick={() => onSelect(r.emoji)}
          title={r.label}
          style={{
            width: 34,
            height: 34,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'transparent',
            borderRadius: 18,
            cursor: 'pointer',
            fontSize: 18,
            transition: 'all 0.12s',
            lineHeight: 1,
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.background = '#f5f5f4';
            (e.target as HTMLElement).style.transform = 'scale(1.2)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.background = 'transparent';
            (e.target as HTMLElement).style.transform = 'scale(1)';
          }}
        >
          {r.emoji}
        </button>
      ))}
    </div>,
    document.body,
  );
}
