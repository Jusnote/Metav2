'use client';

import React, { useState, useEffect, useCallback, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MobileSheetProps {
  open: boolean;
  onClose: () => void;
  confirmClose?: () => boolean;
  height: string; // e.g. '82dvh', '30dvh', 'auto'
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  overlay?: boolean; // default true
  animationDuration?: number; // default 300
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MobileSheet({
  open,
  onClose,
  confirmClose,
  height,
  header,
  footer,
  children,
  overlay = true,
  animationDuration = 300,
}: MobileSheetProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Animation lifecycle: open → setVisible(true) → double-raf → setAnimating(true)
  // Close → setAnimating(false) → after timeout → setVisible(false)
  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true));
      });
      document.body.style.overflow = 'hidden';
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), animationDuration);
      document.body.style.overflow = '';
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open, animationDuration]);

  const handleClose = useCallback(() => {
    if (confirmClose?.()) {
      setShowConfirm(true);
      return;
    }
    onClose();
  }, [confirmClose, onClose]);

  const handleConfirmDiscard = useCallback(() => {
    setShowConfirm(false);
    onClose();
  }, [onClose]);

  if (!visible) return null;

  // Height: 'auto' → maxHeight 85dvh so content doesn't exceed viewport
  const isAuto = height === 'auto';
  const heightStyle: React.CSSProperties = isAuto
    ? { maxHeight: '85dvh' }
    : { height };

  return (
    <>
      {/* Overlay */}
      {overlay && (
        <div
          onClick={handleClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 50,
            opacity: animating ? 1 : 0,
            transition: `opacity ${animationDuration}ms ease`,
          }}
        />
      )}

      {/* Sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          ...heightStyle,
          borderRadius: '16px 16px 0 0',
          background: 'white',
          zIndex: 51,
          boxShadow: '0 -8px 30px rgba(0,0,0,0.12)',
          transform: animating ? 'translateY(0)' : 'translateY(100%)',
          transition: `transform ${animationDuration}ms cubic-bezier(0.32, 0.72, 0, 1), height ${animationDuration}ms cubic-bezier(0.32, 0.72, 0, 1)`,
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 'max(0px, env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Header */}
        {header && (
          <div className="shrink-0 border-b border-zinc-100">
            {header}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 border-t border-zinc-100">
            {footer}
          </div>
        )}
      </div>

      {/* Confirm discard dialog */}
      {showConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-4 w-full max-w-[320px] rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-[15px] font-semibold text-zinc-900">
              Texto não salvo
            </p>
            <p className="mt-1.5 text-[13px] text-zinc-500">
              Você tem um texto não salvo. Deseja realmente descartar?
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-violet-700"
              >
                Continuar editando
              </button>
              <button
                onClick={handleConfirmDiscard}
                className="flex-1 rounded-lg bg-zinc-100 px-4 py-2.5 text-[13px] font-semibold text-red-600 transition-colors hover:bg-zinc-200"
              >
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
