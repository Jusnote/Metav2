"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useQuestoesContext } from "@/contexts/QuestoesContext";
import { useQuestoesV2 } from "@/hooks/useQuestoesV2";
import { QuestionCard } from "@/components/QuestionCard";
import { Loader2, SearchX, ChevronLeft, ChevronRight, Sparkles, Quote } from "lucide-react";

const LIMIT = 20;

function PaginationBar({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  // Build page numbers: 1 ... p-1 p p+1 ... last
  const pages = useMemo(() => {
    const items: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) items.push(i);
      return items;
    }

    items.push(1);
    if (page > 3) items.push("ellipsis");

    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) items.push(i);

    if (page < totalPages - 2) items.push("ellipsis");
    items.push(totalPages);

    return items;
  }, [page, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-center gap-1 py-4" aria-label="Paginação">
      {/* Previous */}
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground rounded-md hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Anterior
      </button>

      {/* Page numbers */}
      {pages.map((item, i) =>
        item === "ellipsis" ? (
          <span key={`e-${i}`} className="w-8 text-center text-muted-foreground/50 text-xs">
            ...
          </span>
        ) : (
          <button
            key={item}
            onClick={() => onPageChange(item)}
            className={`w-8 h-8 rounded-md text-xs font-medium transition-colors ${
              item === page
                ? "bg-blue-600 text-white shadow-sm"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {item}
          </button>
        )
      )}

      {/* Next */}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground rounded-md hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        Próxima
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </nav>
  );
}

export function VirtualizedQuestionList() {
  const { filters, searchQuery, statusTab, sortBy, page, setPage, viewMode } = useQuestoesContext();
  const [currentIndex, setCurrentIndex] = useState(0);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    isPlaceholderData,
    isSemantic,
    isExactSearch,
  } = useQuestoesV2(filters, {
    query: searchQuery || undefined,
    tab: statusTab,
    sortBy,
    page,
  });

  const questoes = data?.questoes || data?.results || [];
  const total = data?.total ?? 0;
  const totalPages = data?.total_pages ?? Math.ceil(total / LIMIT);

  // Pre-compute alternatives — stable references for React.memo
  const alternativesMap = useMemo(() => {
    const map = new Map<number, { letter: string; text: string }[]>();
    for (const q of questoes) {
      const alts = (q.alternativas_html || q.alternativas).map(
        (text: string, i: number) => ({
          letter: String.fromCharCode(65 + i),
          text,
        })
      );
      map.set(q.id, alts);
    }
    return map;
  }, [questoes]);

  // In individual mode, clamp index to valid range
  const safeIndex = Math.min(currentIndex, Math.max(questoes.length - 1, 0));
  const globalIndex = (page - 1) * LIMIT + safeIndex;
  const isFirstOverall = page === 1 && safeIndex === 0;
  const isLastOverall = page >= totalPages && safeIndex >= questoes.length - 1;

  const goNext = useCallback(() => {
    if (safeIndex < questoes.length - 1) {
      setCurrentIndex(safeIndex + 1);
    } else if (page < totalPages) {
      setPage(page + 1);
      setCurrentIndex(0);
    }
  }, [safeIndex, questoes.length, page, totalPages, setPage]);

  const goPrev = useCallback(() => {
    if (safeIndex > 0) {
      setCurrentIndex(safeIndex - 1);
    } else if (page > 1) {
      setPage(page - 1);
      setCurrentIndex(LIMIT - 1);
    }
  }, [safeIndex, page, setPage]);

  // Reset index when page data changes
  const prevPageRef = useRef(page);
  if (prevPageRef.current !== page && currentIndex === LIMIT - 1) {
    // going to previous page — keep index at end (set above)
  } else if (prevPageRef.current !== page) {
    // normal page change — reset to 0
  }
  prevPageRef.current = page;

  // Keyboard navigation for individual mode
  useEffect(() => {
    if (viewMode !== 'individual') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [viewMode, goNext, goPrev]);

  // Loading state (only first load — keepPreviousData handles transitions)
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm text-muted-foreground">Carregando questoes...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <p className="text-sm text-red-500">Erro ao carregar questoes</p>
          <p className="text-xs text-muted-foreground">{error?.message}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (questoes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <SearchX className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Nenhuma questao encontrada</p>
          <p className="text-xs text-muted-foreground/70">
            Tente ajustar seus filtros ou busca
          </p>
        </div>
      </div>
    );
  }

  const renderQuestionCard = (questao: (typeof questoes)[number], index: number) => (
    <QuestionCard
      key={questao.id}
      id={String(questao.id).padStart(8, '0').toUpperCase()}
      questaoId={questao.id}
      year={String(questao.metadata?.ano || '')}
      institution={questao.metadata?.banca || ''}
      exam={questao.metadata?.orgao || ''}
      subject={questao.metadata?.materia || ''}
      subtopic={questao.metadata?.assunto || ''}
      questionNumber={(page - 1) * LIMIT + index + 1}
      totalQuestions={total}
      questionText={questao.enunciado_html || questao.enunciado}
      alternatives={alternativesMap.get(questao.id) ?? []}
      commentsCount={0}
      caracteristicas={questao.caracteristicas}
      taxaAcertoGlobal={questao.estatisticas?.taxa_acerto}
    />
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Results count + loading indicator */}
      <div className="flex items-center justify-between px-1 py-1.5">
        <p className="text-xs text-muted-foreground">
          {total.toLocaleString('pt-BR')} questoes encontradas
          {viewMode === 'individual' ? (
            <span className="ml-1 text-muted-foreground/60">
              · Questao {globalIndex + 1} de {total.toLocaleString('pt-BR')}
            </span>
          ) : totalPages > 1 ? (
            <span className="ml-1 text-muted-foreground/60">
              · Pagina {page} de {totalPages.toLocaleString('pt-BR')}
            </span>
          ) : null}
        </p>
        <div className="flex items-center gap-2">
          {isSemantic && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-500">
              <Sparkles className="h-3 w-3" />
              Busca IA
            </span>
          )}
          {isExactSearch && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600">
              <Quote className="h-3 w-3" />
              Busca exata
            </span>
          )}
          {isFetching && isPlaceholderData && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
          )}
        </div>
      </div>

      {viewMode === 'individual' ? (
        /* ── Individual mode: one question at a time ── */
        <div className={`flex-1 overflow-y-auto ${isPlaceholderData ? 'opacity-60 pointer-events-none' : ''}`}>
          {questoes[safeIndex] && renderQuestionCard(questoes[safeIndex], safeIndex)}

          {/* Navigation */}
          <nav className="flex items-center justify-between py-4 px-1" aria-label="Navegacao entre questoes">
            <button
              onClick={goPrev}
              disabled={isFirstOverall}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-muted-foreground rounded-md hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Anterior
            </button>

            <span className="text-xs text-muted-foreground tabular-nums">
              {globalIndex + 1} / {total.toLocaleString('pt-BR')}
            </span>

            <button
              onClick={goNext}
              disabled={isLastOverall}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-muted-foreground rounded-md hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              Proxima
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </nav>
        </div>
      ) : (
        /* ── List mode (default) ── */
        <div className={`flex-1 overflow-y-auto space-y-12 ${isPlaceholderData ? 'opacity-60 pointer-events-none' : ''}`}>
          {questoes.map((questao, index) => renderQuestionCard(questao, index))}

          {/* Pagination */}
          <PaginationBar
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
