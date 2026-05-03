import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { QuestoesFilterDraftProvider } from "@/contexts/QuestoesFilterDraftContext";
import { QuestoesSearchBar } from "@/components/questoes/QuestoesSearchBar";
import { QuestoesFilterCard } from "@/components/questoes/filtros/QuestoesFilterCard";
import { ObjetivoSection } from "@/components/questoes/objetivo/ObjetivoSection";
import { SemanticScopeToggle } from "@/components/questoes/objetivo/SemanticScopeToggle";
import { QuestoesListaView } from "@/components/questoes/lista/QuestoesListaView";

type FilterView = 'filtros' | 'semantico' | 'cadernos' | 'questoes';

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
    <div className="flex flex-col h-full w-full">
      {/* ─── Filters section (light blue background) ─── */}
      <section className="bg-white mx-4 mt-4 overflow-hidden">
        <div className="max-w-5xl mx-auto w-full px-2">
          {/* Header refinado: título serifa + tabs como segmented control */}
          <div className="flex items-center justify-between gap-5 pt-[18px] pb-[14px] border-b border-[#f1f5f9]">
            <h1
              className="m-0 leading-none"
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
              <div className="inline-flex items-center gap-[2px] rounded-full bg-[#f1f5f9] p-[3px]">
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
                          ? 'bg-white text-[#0f172a] shadow-[0_1px_2px_rgba(15,23,42,0.06),0_0_0_1px_rgba(15,23,42,0.04)] font-semibold'
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
                    : 'bg-[#f1f5f9] text-[#64748b] font-medium hover:text-[#0f172a]',
                ].join(' ')}
              >
                {FILTER_VIEW_LABELS.questoes}
              </button>
            </nav>
          </div>

          {/* View content */}
          {filterView === 'filtros' && (
            <>
              {/* Seção OBJETIVO — só na aba Filtros */}
              <ObjetivoSection />
              <div className="pt-2 pb-2">
                <QuestoesFilterCard onApplied={handleApplied} />
              </div>
            </>
          )}

          {filterView === 'semantico' && (
            <div className="pt-2 pb-2">
              <QuestoesSearchBar />
              {/* Fase 1A: visible=false → não renderiza. Fase 2 ativa baseado em foco+query. */}
              <SemanticScopeToggle
                visible={false}
                incluirFora={false}
                onToggle={() => { /* noop — Fase 2 */ }}
              />
            </div>
          )}

          {filterView === 'cadernos' && (
            <div className="py-8 text-center text-sm text-slate-500">
              Cadernos em breve.
            </div>
          )}

          {filterView === 'questoes' && (
            <div className="pt-2 pb-2">
              <QuestoesListaView onEditFilters={editFilters} />
            </div>
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
            className="fixed top-4 left-1/2 z-50 w-full max-w-5xl px-4"
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
