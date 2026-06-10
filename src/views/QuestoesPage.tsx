import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { QuestoesFilterDraftProvider } from "@/contexts/QuestoesFilterDraftContext";
import { QuestoesSearchBar } from "@/components/questoes/QuestoesSearchBar";
import { QuestoesFilterCard } from "@/components/questoes/filtros/QuestoesFilterCard";
import { SemanticScopeToggle } from "@/components/questoes/objetivo/SemanticScopeToggle";
import { QuestoesListaView } from "@/components/questoes/lista/QuestoesListaView";
import { Search } from "lucide-react";
import "./questoes-paper-bg.css";

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
    {/* Fundo Grafite 2B — SÓ desta página (Auth/Home seguem com o AuroraBackground azul) */}
    <div aria-hidden className="questoes-aurora pointer-events-none fixed inset-0 -z-10 overflow-hidden" />
    <div className="flex flex-col h-full w-full">
      {/* ─── Header (sem container — flutua sobre aurora) ─── */}
      <section className="mx-6 mt-4">
        <div className={`${filterView === 'questoes' ? 'max-w-[60rem]' : 'max-w-6xl'} mx-auto w-full py-3`}>
          <div className="flex items-center gap-5">
            <div className="shrink-0">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-0.5">
                Acervo
              </span>
              <h1
                className="m-0 leading-none"
                style={{
                  fontFamily: "'Source Serif 4', Georgia, serif",
                  fontSize: '18px',
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: '#0f172a',
                }}
              >
                Banco de Questões
                <span style={{ color: '#2563eb' }}>.</span>
              </h1>
            </div>

            <nav
              className="ml-auto inline-flex items-center gap-6"
              aria-label="Modo de filtro"
            >
              {(['filtros', 'semantico', 'cadernos', 'questoes'] as FilterView[]).map((view) => {
                const active = filterView === view;
                return (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setFilterView(view)}
                    className={[
                      'relative pb-1.5 text-[13px] transition-colors',
                      active
                        ? 'text-[#0f172a] font-semibold'
                        : 'text-[#64748b] font-medium hover:text-[#0f172a]',
                    ].join(' ')}
                  >
                    {FILTER_VIEW_LABELS[view]}
                    {active && (
                      <span className="absolute left-0 right-0 bottom-0 h-[2px] rounded-full bg-[#2563eb]" />
                    )}
                  </button>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={() => setCtrlKOpen(true)}
              aria-label="Buscar questões"
              className="shrink-0 inline-flex items-center gap-2 h-[34px] px-3 rounded-[9px] bg-white/60 border border-white/70 backdrop-blur-md text-[12.5px] text-slate-500 hover:bg-white hover:text-slate-700 transition-colors"
            >
              <Search className="h-4 w-4" />
              <span>Buscar</span>
              <kbd className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 border-b-2 rounded-[5px] px-1.5 py-px leading-none">
                Ctrl K
              </kbd>
            </button>
          </div>
        </div>
      </section>

      {/* ─── View content (cards separados sobre aurora) ─── */}
      <section className="mx-6 mt-4 mb-6">
        <div className={`${filterView === 'questoes' ? 'max-w-[60rem]' : 'max-w-6xl'} mx-auto w-full`}>
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
