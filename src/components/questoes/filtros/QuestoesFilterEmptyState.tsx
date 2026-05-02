'use client';
import React from 'react';

export function QuestoesFilterEmptyState() {
  return (
    <div className="flex items-center justify-center py-12 px-4">
      <p className="text-sm text-slate-400 text-center">
        Nenhum filtro selecionado.
      </p>
    </div>
  );
}
