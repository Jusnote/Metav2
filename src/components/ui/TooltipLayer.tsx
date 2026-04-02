'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipState {
  text: string;
  x: number;
  y: number;
  visible: boolean;
}

const DELAY_MS = 400;

/**
 * Lightweight tooltip layer — ONE instance for the entire app.
 * Buttons use `data-tip="Label"` instead of Radix <Tooltip>.
 * Zero fiber nodes per button. Zero hooks per button.
 * Uses event delegation via capture-phase pointerenter/pointerleave.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<TooltipState>({
    text: '', x: 0, y: 0, visible: false,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((e: PointerEvent) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    if (!target) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const text = target.dataset.tip!;
    const rect = target.getBoundingClientRect();
    timerRef.current = setTimeout(() => {
      setTip({
        text,
        x: rect.left + rect.width / 2,
        y: rect.top - 6,
        visible: true,
      });
    }, DELAY_MS);
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setTip(t => ({ ...t, visible: false }));
  }, []);

  useEffect(() => {
    document.addEventListener('pointerenter', show, true);
    document.addEventListener('pointerleave', hide, true);
    document.addEventListener('pointerdown', hide, true);
    return () => {
      document.removeEventListener('pointerenter', show, true);
      document.removeEventListener('pointerleave', hide, true);
      document.removeEventListener('pointerdown', hide, true);
    };
  }, [show, hide]);

  if (!tip.visible) return null;

  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 rounded-md bg-zinc-900 px-2.5 py-1 text-xs text-white shadow-md"
      style={{
        left: tip.x,
        top: tip.y,
        transform: 'translate(-50%, -100%)',
        animation: 'tooltipFadeIn 0.15s ease-out',
      }}
    >
      <style>{`@keyframes tooltipFadeIn { from { opacity:0; transform:translate(-50%,-100%) scale(0.95); } to { opacity:1; transform:translate(-50%,-100%) scale(1); } }`}</style>
      {tip.text}
    </div>,
    document.body,
  );
}
