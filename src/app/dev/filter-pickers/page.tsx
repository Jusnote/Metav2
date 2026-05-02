'use client';
import '../../../index.css';
import { MemoryRouter } from 'react-router-dom';
import { QuestoesFilterDraftProvider } from '@/contexts/QuestoesFilterDraftContext';
import { QuestoesFilterCard } from '@/components/questoes/filtros/QuestoesFilterCard';
import { useFiltrosPendentes } from '@/hooks/useFiltrosPendentes';

function DebugPanel() {
  const { pendentes, aplicados, isDirty } = useFiltrosPendentes();
  return (
    <div className="mt-6 bg-white rounded-lg shadow border border-slate-200 p-4">
      <h2 className="text-sm font-semibold text-slate-900 mb-3">
        Debug — Estado do contexto
      </h2>
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <div className="font-semibold text-slate-700 mb-1">pendentes</div>
          <pre className="overflow-auto text-slate-600">
            {JSON.stringify(pendentes, null, 2)}
          </pre>
        </div>
        <div>
          <div className="font-semibold text-slate-700 mb-1">
            aplicados {isDirty && <span className="text-amber-600">(dirty!)</span>}
          </div>
          <pre className="overflow-auto text-slate-600">
            {JSON.stringify(aplicados, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function FilterPickersPreview() {
  return (
    <MemoryRouter initialEntries={['/dev/filter-pickers?view=filtros']}>
      <QuestoesFilterDraftProvider>
        <div className="min-h-screen bg-slate-50 p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            QuestoesFilterCard — Dev Preview
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            Validação visual do card completo (3c-2). Painel direito vem no 3c-3.
          </p>

          <QuestoesFilterCard />
          <DebugPanel />
        </div>
      </QuestoesFilterDraftProvider>
    </MemoryRouter>
  );
}
