import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { QuestoesFilters, StatusTab, SortOption } from '@/contexts/QuestoesContext';

// ============ TIPOS ============

export interface QuestaoMetadata {
  materia?: string;
  assunto?: string;
  banca?: string;
  orgao?: string;
  orgao_sigla?: string;
  cargo?: string;
  ano?: number;
}

export interface QuestaoEstatisticas {
  views?: number;
  taxa_acerto?: number;
  created_at?: string;
}

export interface QuestaoCaracteristicas {
  tipo?: string;
  formato?: string;
  anulada?: boolean;
  desatualizada?: boolean;
  tem_comentario?: boolean;
  gabarito_preliminar?: boolean;
  data_publicacao?: string | null;
}

export interface Questao {
  id: number;
  enunciado: string;
  alternativas: string[];
  metadata?: QuestaoMetadata;
  concurso?: {
    id?: string | null;
    area?: string | null;
    especialidade?: string | null;
  };
  caracteristicas?: QuestaoCaracteristicas;
  estatisticas?: QuestaoEstatisticas;
  enunciado_html?: string;
  alternativas_html?: string[];
  gabarito_correto?: number;
}

export interface QuestoesPageResponse {
  questoes?: Questao[];
  results?: Questao[];
  total?: number;
  page?: number;
  limit?: number;
  total_pages?: number;
  facets?: Record<string, Record<string, number>>;
}

// ============ API ============

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.projetopapiro.com.br';
const DEFAULT_LIMIT = 20;

interface FetchParams {
  filters: QuestoesFilters;
  query?: string;
  tab?: StatusTab;
  sortBy?: SortOption;
  page: number;
  limit: number;
}

/** Detecta busca exata: query entre aspas como "Art. 157" */
function parseSearchMode(query?: string): { mode: 'semantic' | 'textual' | 'exact'; cleanQuery: string } {
  if (!query || !query.trim()) return { mode: 'textual', cleanQuery: '' };
  const trimmed = query.trim();
  if (/^".*"$/.test(trimmed)) {
    return { mode: 'exact', cleanQuery: trimmed.slice(1, -1) };
  }
  return { mode: 'semantic', cleanQuery: trimmed };
}

async function fetchQuestoes(params: FetchParams): Promise<QuestoesPageResponse> {
  const sp = new URLSearchParams();
  sp.set('page', String(params.page));
  sp.set('limit', String(params.limit));
  sp.set('include_html', 'true');

  // Array filters
  params.filters.materias.forEach(v => sp.append('materia', v));
  params.filters.assuntos.forEach(v => sp.append('assunto', v));
  params.filters.bancas.forEach(v => sp.append('banca', v));
  params.filters.anos.forEach(v => sp.append('ano', String(v)));
  params.filters.orgaos.forEach(v => sp.append('orgao', v));
  params.filters.cargos.forEach(v => sp.append('cargo', v));

  // Boolean filters
  if (params.filters.excluirAnuladas) sp.set('excluir_anuladas', '1');
  if (params.filters.excluirDesatualizadas) sp.set('excluir_desatualizadas', '1');
  if (params.filters.excluirResolvidas) sp.set('excluir_resolvidas', '1');

  // Search query
  if (params.query) sp.set('q', params.query);

  // Tab filter
  if (params.tab && params.tab !== 'todas') sp.set('status', params.tab);

  // Sort
  if (params.sortBy && params.sortBy !== 'recentes') sp.set('order_by', params.sortBy);

  const res = await fetch(`${API_BASE}/api/v1/questoes/search?${sp.toString()}`, {
    headers: {
      'accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

/** Busca semântica via POST /buscar-semantica (Voyage AI + reranker) */
async function fetchSemanticQuestoes(params: FetchParams): Promise<QuestoesPageResponse> {
  const body: Record<string, unknown> = {
    query: params.query,
    limit: params.limit,
  };

  // Mapeia filtros multi-select (arrays) para single values do BuscaSemanticaRequest
  if (params.filters.bancas[0]) body.banca = params.filters.bancas[0];
  if (params.filters.materias[0]) body.materia = params.filters.materias[0];
  if (params.filters.assuntos[0]) body.assunto = params.filters.assuntos[0];
  if (params.filters.orgaos[0]) body.orgao = params.filters.orgaos[0];
  if (params.filters.cargos[0]) body.cargo = params.filters.cargos[0];
  if (params.filters.anos[0]) body.ano = params.filters.anos[0];

  const res = await fetch(`${API_BASE}/api/v1/questoes/buscar-semantica`, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();

  // Normaliza resposta semântica para QuestoesPageResponse
  return {
    questoes: data.questoes,
    total: data.total,
    page: 1,
    limit: params.limit,
    total_pages: 1,
  };
}

// ============ HOOK ============

interface UseQuestoesV2Options {
  query?: string;
  tab?: StatusTab;
  sortBy?: SortOption;
  page?: number;
  limit?: number;
  enabled?: boolean;
}

export function useQuestoesV2(filters: QuestoesFilters, options?: UseQuestoesV2Options) {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const page = options?.page ?? 1;

  const { mode, cleanQuery } = parseSearchMode(options?.query);
  const isSemantic = mode === 'semantic';
  const isExactSearch = mode === 'exact';

  const query = useQuery({
    queryKey: ['questoes-v2', mode, filters, cleanQuery, options?.tab, options?.sortBy, page, limit],
    queryFn: () => {
      if (isSemantic) {
        return fetchSemanticQuestoes({
          filters,
          query: cleanQuery,
          tab: options?.tab,
          sortBy: options?.sortBy,
          page,
          limit,
        });
      }
      // Textual: filtros puros (sem query) ou busca exata (aspas removidas)
      return fetchQuestoes({
        filters,
        query: cleanQuery || undefined,
        tab: options?.tab,
        sortBy: options?.sortBy,
        page,
        limit,
      });
    },
    staleTime: 2 * 60 * 1000, // 2 min
    placeholderData: keepPreviousData,
    enabled: options?.enabled !== false,
  });

  return { ...query, isSemantic, isExactSearch };
}
