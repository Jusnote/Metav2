'use client';
import '../../../index.css';
import { useState } from 'react';
import { OrgaoCargoPicker } from '@/components/questoes/filtros/pickers/OrgaoCargoPicker';
import { useFiltrosDicionario } from '@/hooks/useFiltrosDicionario';
import { useQuestoesFacets } from '@/hooks/useQuestoesFacets';
import { useOrgaoCargoState } from '@/hooks/useOrgaoCargoState';
import { stateToBackendFilters } from '@/lib/questoes/orgao-cargo-serialization';

type Tab = 'banca' | 'ano' | 'orgao_cargo' | 'materia';

function FilterPickersContent() {
  const [tab, setTab] = useState<Tab>('orgao_cargo');
  const [bancas, setBancas] = useState<string[]>([]);
  const [anos, setAnos] = useState<number[]>([]);
  const [materia, setMateria] = useState<string | null>(null);
  const [assuntos, setAssuntos] = useState<string[]>([]);
  const [nodeIds, setNodeIds] = useState<(number | string)[]>([]);

  const { state: orgaoCargoState, actions: orgaoCargoActions } = useOrgaoCargoState();
  const orgaoCargoBackend = stateToBackendFilters(orgaoCargoState);

  // Órgão atualmente sendo navegado (drilldown). Ephemeral, não afeta seleção real.
  // Usado pra augmentar a request de facets, fazendo backend filtrar cargos pelo órgão drilled.
  const [drilldownOrgao, setDrilldownOrgao] = useState<string | null>(null);

  const { dicionario } = useFiltrosDicionario();
  const { facets } = useQuestoesFacets({
    bancas,
    anos,
    // Quando drilldown está ativo, override pra só o órgão drilled (cargo facet refletirá só esse contexto).
    // Senão, usa as seleções committed do usuário.
    orgaos: drilldownOrgao ? [drilldownOrgao] : orgaoCargoBackend.orgaos,
    cargos: orgaoCargoBackend.cargos,
    org_cargo_pairs: orgaoCargoBackend.org_cargo_pairs,
  });

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Filter Pickers — Dev Preview</h1>
      <p className="text-sm text-slate-500 mb-6">
        Validação visual dos pickers do drawer (Plano 3b-bonus). Não acessível em produção.
      </p>

      <nav className="flex gap-2 mb-4">
        {(['banca', 'ano', 'orgao_cargo', 'materia'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded text-sm ${
              tab === t
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow border border-slate-200">
          {tab === 'banca' && (
            <div className="p-4 text-sm text-slate-500">
              BancaPicker — não implementado nesta branch
            </div>
          )}
          {tab === 'ano' && (
            <div className="p-4 text-sm text-slate-500">
              AnoPicker — não implementado nesta branch
            </div>
          )}
          {tab === 'orgao_cargo' && (
            <OrgaoCargoPicker
              dicionario={dicionario ?? null}
              state={orgaoCargoState}
              actions={orgaoCargoActions}
              facetsCargo={facets.cargo ?? {}}
              drilldownOrgaoTotalCount={
                drilldownOrgao ? facets.orgao?.[drilldownOrgao] : undefined
              }
              onDrilldownChange={setDrilldownOrgao}
            />
          )}
          {tab === 'materia' && (
            <div className="p-4 text-sm text-slate-500">
              MateriaAssuntosPicker — não implementado nesta branch
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Estado atual</h2>
          <pre className="text-xs text-slate-700 overflow-auto">
            {JSON.stringify(
              {
                bancas,
                anos,
                orgaoCargoState: {
                  orgaos: Object.fromEntries(orgaoCargoState.orgaos),
                  flatCargos: orgaoCargoState.flatCargos,
                },
                backendQueryParams: orgaoCargoBackend,
                materia,
                assuntos,
                nodeIds,
              },
              null,
              2,
            )}
          </pre>
        </div>
      </div>

    </div>
  );
}

export default function FilterPickersPreview() {
  return <FilterPickersContent />;
}
