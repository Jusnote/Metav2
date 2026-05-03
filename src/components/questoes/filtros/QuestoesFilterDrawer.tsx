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
      {/* Colunas NÃO têm overflow-y aqui — cada filho (picker / panel) faz
          seu próprio scroll só no body, deixando o header fixo. */}
      <div className="border-r border-slate-200 min-h-0 flex flex-col">
        {left}
      </div>
      <div className="min-h-0 flex flex-col">{right}</div>
    </div>
  );
}
