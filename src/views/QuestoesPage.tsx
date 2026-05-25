import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { QuestoesFilterDraftProvider } from "@/contexts/QuestoesFilterDraftContext";
import { QuestoesSearchBar } from "@/components/questoes/QuestoesSearchBar";
import { QuestoesFilterCard } from "@/components/questoes/filtros/QuestoesFilterCard";
import { SemanticScopeToggle } from "@/components/questoes/objetivo/SemanticScopeToggle";
import { QuestoesListaView } from "@/components/questoes/lista/QuestoesListaView";
import { AuroraBackground } from "@/components/ui/aurora-background";

type FilterView = 'filtros' | 'semantico' | 'cadernos' | 'questoes';

const headerCardGlass =
  'bg-white border border-slate-200/70 rounded-xl shadow-[0_10px_30px_-10px_rgba(30,41,59,0.10),0_2px_8px_-2px_rgba(30,41,59,0.04)]';

const FILTER_VIEW_LABELS: Record<FilterView, string> = {
  filtros: 'Filtros',
  semantico: 'Filtro semântico',
  cadernos: 'Cadernos',
  questoes: 'Questões',
};

const VALID_VIEWS: readonly FilterView[] = ['filtros', 'semantico', 'cadernos', 'questoes'];

function parseViewParam(raw: string | null): FilterView {
  if (raw && (VALID_VIEWS as readonly string[]).includes(raw)) {
    return raw as FilterView;
  }
  return 'filtros';
}

export default function QuestoesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterView = parseViewParam(searchParams.get('view'));

  const setFilterView = useCallback((view: FilterView) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (view === 'filtros') {
        next.delete('view'); // default não polui URL
      } else {
        next.set('view', view);
      }
      return next;
    });
  }, [setSearchParams]);

  // Ctrl+K overlay (versão simplificada — só busca semântica)
  const [ctrlKOpen, setCtrlKOpen] = useState(false);

  const closeCtrlK = useCallback(() => {
    setCtrlKOpen(false);
  }, []);

  // Após Aplicar no card de filtros: a navegação pra `view=questoes` já
  // foi feita dentro do mesmo setSearchParams do apply() (evita race com
  // dois setSearchParams sequenciais). Aqui só cleanup do Ctrl+K.
  const handleApplied = useCallback(() => {
    if (ctrlKOpen) {
      closeCtrlK();
    }
  }, [ctrlKOpen, closeCtrlK]);

  const editFilters = useCallback(() => {
    setFilterView('filtros');
  }, [setFilterView]);

  // Global Ctrl+K listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCtrlKOpen(true);
      }
      if (e.key === "Escape" && ctrlKOpen) {
        e.preventDefault();
        closeCtrlK();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [ctrlKOpen, closeCtrlK]);

  return (
    <QuestoesFilterDraftProvider>
    <AuroraBackground />
    <div className="flex flex-col h-full w-full">
      {/* ─── Header (sem container — flutua sobre aurora) ─── */}
      <section className="mx-6 mt-4">
        <div className={`${filterView === 'questoes' ? 'max-w-5xl' : 'max-w-6xl'} mx-auto w-full py-3`}>
          <div className="flex items-center justify-between gap-4">
            <h1
              className="m-0 leading-none shrink-0"
              style={{
                fontFamily: "'Source Serif 4', Georgia, serif",
                fontSize: '26px',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: '#0f172a',
              }}
            >
              Banco de Questões
              <span style={{ color: '#2563eb' }}>.</span>
            </h1>

            <nav
              className="inline-flex items-center gap-[8px]"
              aria-label="Modo de filtro"
            >
              <div className="inline-flex items-center rounded-full bg-white border border-[#e2e8f0] overflow-hidden">
                {(['filtros', 'semantico', 'cadernos'] as FilterView[]).map((view) => {
                  const active = filterView === view;
                  return (
                    <button
                      key={view}
                      type="button"
                      onClick={() => setFilterView(view)}
                      className={[
                        'rounded-full px-[14px] py-[6px] text-[12px] transition-all',
                        active
                          ? 'bg-[#f1f5f9] text-[#0f172a] font-semibold'
                          : 'bg-transparent text-[#64748b] font-medium hover:text-[#0f172a]',
                      ].join(' ')}
                    >
                      {FILTER_VIEW_LABELS[view]}
                    </button>
                  );
                })}
              </div>

              <div className="h-5 w-px bg-[#e2e8f0]" aria-hidden="true" />

              <button
                type="button"
                onClick={() => setFilterView('questoes')}
                className={[
                  'rounded-full px-[14px] py-[6px] text-[12px] transition-all',
                  filterView === 'questoes'
                    ? 'bg-[#0f172a] text-white font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.12)]'
                    : 'bg-white border border-[#e2e8f0] text-[#64748b] font-medium hover:text-[#0f172a]',
                ].join(' ')}
              >
                {FILTER_VIEW_LABELS.questoes}
              </button>
            </nav>
          </div>
        </div>
      </section>

      {/* ─── View content (cards separados sobre aurora) ─── */}
      <section className="mx-6 mt-4 mb-6">
        <div className={`${filterView === 'questoes' ? 'max-w-5xl' : 'max-w-6xl'} mx-auto w-full`}>
          {filterView === 'filtros' && (
            <QuestoesFilterCard onApplied={handleApplied} />
          )}

          {filterView === 'semantico' && (
            <div className={`${headerCardGlass} px-4 py-3`}>
              <QuestoesSearchBar />
              <SemanticScopeToggle
                visible={false}
                incluirFora={false}
                onToggle={() => { /* noop — Fase 2 */ }}
              />
            </div>
          )}

          {filterView === 'cadernos' && (
            <div className={`${headerCardGlass} py-8 text-center text-sm text-slate-500`}>
              Cadernos em breve.
            </div>
          )}

          {filterView === 'questoes' && (
            <QuestoesListaView onEditFilters={editFilters} />
          )}
        </div>
      </section>

      {/* Ctrl+K floating overlay (só busca semântica) */}
      {ctrlKOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}
            onClick={closeCtrlK}
          />
          <div
            className="fixed top-4 left-1/2 z-50 w-full max-w-6xl px-4"
            style={{ transform: "translateX(-50%)" }}
          >
            <div
              style={{
                background: "white",
                borderRadius: 16,
                boxShadow: "0 20px 60px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.1)",
                overflow: "hidden",
                padding: 16,
              }}
            >
              <QuestoesSearchBar autoFocus />
            </div>
          </div>
        </>
      )}
    </div>
    </QuestoesFilterDraftProvider>
  );
}
