"use client";

import React from 'react';

interface QuestoesFilterOverlayProps {
  visible: boolean;
  children: React.ReactNode;
}

export function QuestoesFilterOverlay({ visible, children }: QuestoesFilterOverlayProps) {
  return (
    <div
      style={{
        opacity: visible ? 0.35 : 1,
        filter: visible ? 'blur(1px)' : 'none',
        pointerEvents: visible ? 'none' : 'auto',
        transition: 'opacity 0.2s ease, filter 0.2s ease',
      }}
    >
      {children}
    </div>
  );
}
