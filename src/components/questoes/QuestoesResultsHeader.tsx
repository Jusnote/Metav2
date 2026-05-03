"use client";

import { useMemo } from "react";
import { useQuestoesContext } from "@/contexts/QuestoesContext";
import { useQuestoesFilterDraft } from "@/contexts/QuestoesFilterDraftContext";
import { appliedToQuestoesFilters } from "@/lib/questoes/applied-to-questoes-filters";
import { useQuestoesV2 } from "@/hooks/useQuestoesV2";
import { Loader2, Sparkles, Quote } from "lucide-react";

const LIMIT = 20;

export function QuestoesResultsHeader() {
  const { committedQuery, statusTab, sortBy, page } = useQuestoesContext();
  const { aplicados } = useQuestoesFilterDraft();
  const filters = useMemo(() => appliedToQuestoesFilters(aplicados), [aplicados]);

  const {
    data,
    isFetching,
    isPlaceholderData,
    isSemantic,
    isExactSearch,
  } = useQuestoesV2(filters, {
    query: committedQuery || undefined,
    tab: statusTab,
    sortBy,
    page,
  });

  const total = data?.total ?? 0;
  const totalPages = data?.total_pages ?? Math.ceil(total / LIMIT);

  if (!data) return null;

  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <p className="text-xs text-muted-foreground">
        {total.toLocaleString('pt-BR')} questoes encontradas
        {totalPages > 1 && (
          <span className="ml-1 text-muted-foreground/60">
            · Pagina {page} de {totalPages.toLocaleString('pt-BR')}
          </span>
        )}
      </p>
      <div className="flex items-center gap-2">
        {isSemantic && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-500">
            <Sparkles className="h-3 w-3" />
            Busca IA
          </span>
        )}
        {isExactSearch && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600">
            <Quote className="h-3 w-3" />
            Busca exata
          </span>
        )}
        {isFetching && isPlaceholderData && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
        )}
      </div>
    </div>
  );
}
