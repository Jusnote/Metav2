'use client';
import '../../../index.css';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BancaPicker } from '@/components/questoes/filtros/pickers/BancaPicker';
import { AnoPicker } from '@/components/questoes/filtros/pickers/AnoPicker';
import { OrgaoCargoPicker } from '@/components/questoes/filtros/pickers/OrgaoCargoPicker';
import { MateriaAssuntosPicker } from '@/components/questoes/filtros/pickers/MateriaAssuntosPicker';
import { useFiltrosDicionario } from '@/hooks/useFiltrosDicionario';
import { useQuestoesFacets } from '@/hooks/useQuestoesFacets';

type Tab = 'banca' | 'ano' | 'orgao_cargo' | 'materia';

const queryClient = new QueryClient();

export default function FilterPickersPreview() {
  // Mounted guard pra evitar hydration mismatch — pickers consomem dicionário
  // que muda do estado SSR (vazio) pro estado client (carregado).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Filter Pickers — Dev Preview</h1>
        <p className="text-sm text-slate-500">Carregando…</p>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <FilterPickersContent />
    </QueryClientProvider>
  );
}

function FilterPickersContent() {
  const [tab, setTab] = useState<Tab>('banca');
  const [bancas, setBancas] = useState<string[]>([]);
  const [anos, setAnos] = useState<number[]>([]);
  const [orgaos, setOrgaos] = useState<string[]>([]);
  const [cargos, setCargos] = useState<string[]>([]);
  const [materia, setMateria] = useState<string | null>(null);
  const [assuntos, setAssuntos] = useState<string[]>([]);
  const [nodeIds, setNodeIds] = useState<(number | 'outros')[]>([]);

  const { dicionario } = useFiltrosDicionario();
  const { facets, loading: facetsLoading } = useQuestoesFacets({ bancas, anos, orgaos, cargos });

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Filter Pickers — Dev Preview</h1>
      <p className="text-sm text-slate-500 mb-6">
        Validação visual dos 4 pickers do drawer (Plano 3b). Não acessível em produção.
        {facetsLoading && <span className="ml-2 text-blue-600">· carregando counts…</span>}
      </p>

      <nav className="flex gap-2 mb-4">
        {(['banca', 'ano', 'orgao_cargo', 'materia'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded text-sm ${
              tab === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow border border-slate-200">
          {tab === 'banca' && (
            <BancaPicker dicionario={dicionario ?? null} facets={facets.banca} selected={bancas} onChange={setBancas} />
          )}
          {tab === 'ano' && (
            <AnoPicker dicionario={dicionario ?? null} facets={facets.ano} selected={anos} onChange={setAnos} />
          )}
          {tab === 'orgao_cargo' && (
            <OrgaoCargoPicker
              dicionario={dicionario ?? null}
              facetsOrgao={facets.orgao} facetsCargo={facets.cargo}
              selectedOrgaos={orgaos} selectedCargos={cargos}
              onChangeOrgaos={setOrgaos} onChangeCargos={setCargos}
            />
          )}
          {tab === 'materia' && (
            <MateriaAssuntosPicker
              dicionario={dicionario ?? null}
              materia={materia} selectedAssuntos={assuntos} selectedNodeIds={nodeIds}
              onMateriaChange={setMateria} onAssuntosChange={setAssuntos} onNodeIdsChange={setNodeIds}
            />
          )}
        </div>

        <div className="bg-white rounded-lg shadow border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Estado atual</h2>
          <pre className="text-xs text-slate-700 overflow-auto">
            {JSON.stringify(
              { bancas, anos, orgaos, cargos, materia, assuntos, nodeIds },
              null,
              2,
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
