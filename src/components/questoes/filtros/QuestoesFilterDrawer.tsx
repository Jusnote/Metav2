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
      className="grid max-h-[70vh] min-h-[480px]"
      style={{ gridTemplateColumns: '3fr 2fr', gridTemplateRows: '1fr' }}
    >
      <div className="border-r border-slate-200 overflow-y-auto min-h-0">
        {left}
      </div>
      <div className="overflow-y-auto min-h-0">{right}</div>
    </div>
  );
}
