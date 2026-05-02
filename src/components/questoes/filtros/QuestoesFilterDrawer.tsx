'use client';
import React from 'react';

export interface QuestoesFilterDrawerProps {
  left: React.ReactNode;
  right: React.ReactNode;
}

export function QuestoesFilterDrawer({
  left,
  right,
}: QuestoesFilterDrawerProps) {
  return (
    <div
      data-testid="drawer-grid"
      className="grid"
      style={{ gridTemplateColumns: '3fr 2fr' }}
    >
      <div className="border-r border-slate-200">{left}</div>
      <div>{right}</div>
    </div>
  );
}
