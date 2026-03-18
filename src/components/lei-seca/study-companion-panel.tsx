'use client';

import { X } from 'lucide-react';
import { useLeiSeca } from '@/contexts/LeiSecaContext';

const ROLE_LABELS: Record<string, string> = {
  artigo: 'Artigo',
  paragrafo: 'Parágrafo',
  paragrafo_unico: 'Parágrafo único',
  inciso: 'Inciso',
  alinea: 'Alínea',
  item: 'Item',
  pena: 'Pena',
  epigrafe: 'Epígrafe',
};

export function StudyCompanionPanel() {
  const { setCompanionOpen, focusedProvision } = useLeiSeca();

  return (
    <div className="h-full flex flex-col bg-background border rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h3 className="text-sm font-medium">Dispositivo</h3>
        <button
          onClick={() => setCompanionOpen(false)}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Fechar painel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      {focusedProvision ? (
        <div className="flex-1 overflow-auto p-3">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                {ROLE_LABELS[focusedProvision.role] || focusedProvision.role}
              </span>
              {focusedProvision.slug && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {focusedProvision.slug}
                </span>
              )}
            </div>
            <div className="text-sm leading-relaxed text-foreground">
              {focusedProvision.text}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center">
            Clique em um dispositivo para ver seus detalhes.
          </p>
        </div>
      )}
    </div>
  );
}
