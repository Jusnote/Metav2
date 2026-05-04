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
      className="grid h-[70vh] min-h-[480px]"
      style={{ gridTemplateColumns: '13fr 7fr', gridTemplateRows: '1fr' }}
    >
      {/* Picker e panel são filhos DIRETOS do grid — sem wrapper de flex
          intermediário, que estava quebrando a propagação de altura
          (grid cell → flex container → flex-1 child).
          Cada um já é um flex column próprio e como grid item com
          align-self: stretch padrão, herdam a altura da cell (70vh).
          Border-r vive dentro do picker (não no wrapper) — divider
          vertical começa no horizontal. */}
      {left}
      {right}
    </div>
  );
}
