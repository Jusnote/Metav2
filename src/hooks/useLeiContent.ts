import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ============ REFERÊNCIAS ESTÁVEIS (evitam re-renders) ============
const emptyArtigos: LeiArtigo[] = [];
const emptyRevokedMap: RevokedOnlyMap = {};
const emptyHierarquia = { partes: [], livros: [], titulos: [], subtitulos: [], capitulos: [], secoes: [], subsecoes: [] } as const;

// ============ CONFIGURAÇÃO ============

// Flag para alternar entre JSON local e Supabase
// true = busca do Supabase | false = busca do JSON local
const USE_SUPABASE = process.env.NEXT_PUBLIC_USE_SUPABASE === 'true';

// ============ TIPOS ============

export type LeiCategoria =
  | 'constitucional'
  | 'penal'
  | 'civil'
  | 'administrativo'
  | 'processual'
  | 'tributario'
  | 'trabalho'
  | 'eleitoral'
  | 'militar'
  | 'ambiental'
  | 'empresarial'
  | 'previdenciario'
  | 'consumidor'
  | 'transito'
  | 'crianca'
  | 'idoso'
  | 'outros';

export const LEI_CATEGORIAS: { id: LeiCategoria; label: string }[] = [
  { id: 'constitucional', label: 'CONSTIT.' },
  { id: 'penal', label: 'PENAL' },
  { id: 'civil', label: 'CIVIL' },
  { id: 'processual', label: 'PROCESS.' },
  { id: 'administrativo', label: 'ADMINIST.' },
  { id: 'tributario', label: 'TRIBUT.' },
  { id: 'trabalho', label: 'TRABALHO' },
  { id: 'empresarial', label: 'EMPRES.' },
  { id: 'consumidor', label: 'CONSUM.' },
  { id: 'ambiental', label: 'AMBIENT.' },
  { id: 'previdenciario', label: 'PREVID.' },
  { id: 'eleitoral', label: 'ELEITORAL' },
  { id: 'militar', label: 'MILITAR' },
  { id: 'transito', label: 'TRÂNSITO' },
  { id: 'crianca', label: 'ECA' },
  { id: 'idoso', label: 'IDOSO' },
  { id: 'outros', label: 'OUTROS' },
];

/** Infere categoria da lei baseado no nome/sigla */
function inferLeiCategoria(nome: string, sigla: string): LeiCategoria {
  const n = (nome + ' ' + sigla).toLowerCase();
  if (/constitui[çc][aã]o|cf|emenda constitucional|ec\b/i.test(n)) return 'constitucional';
  if (/penal|c[oó]digo penal|\bcp\b|contrave|lei de drogas|maria da penha|crimes?\b|hedi|tortura|abuso.*autoridade|arma.*fogo|desarmamento|execu[çc][aã]o penal|intercepta[çc]/i.test(n)) return 'penal';
  if (/processo|processual|\bcpc\b|\bcpp\b|juizado/i.test(n)) return 'processual';
  if (/consumidor|\bcdc\b|defesa do consumidor/i.test(n)) return 'consumidor';
  if (/c[oó]digo civil|\bcc\b|registros p[uú]blicos|fal[eê]ncia|recupera[çc][aã]o judicial|inquilinato|condom[ií]nio/i.test(n)) return 'civil';
  if (/administrativ|improbidade|licita|pregão|8\.?112|8\.?666|14\.?133|servidor|acesso.*informa/i.test(n)) return 'administrativo';
  if (/tribut|c[oó]digo tribut[aá]rio|\bctn\b|icms|iss\b|imposto/i.test(n)) return 'tributario';
  if (/trabalh|\bclt\b|consolida[çc][aã]o das leis do trabalho/i.test(n)) return 'trabalho';
  if (/empresa|societ[aá]ri|falência|recupera[çc][aã]o|s\.?a\b|sociedade/i.test(n)) return 'empresarial';
  if (/ambient|meio ambiente|fauna|flora|recurso.*h[ií]dric|saneamento|res[ií]duo/i.test(n)) return 'ambiental';
  if (/previd|aposentadoria|inss|rgps|rpps|benefício.*previdenci/i.test(n)) return 'previdenciario';
  if (/eleitoral|partidos|elei[çc]/i.test(n)) return 'eleitoral';
  if (/militar|c[oó]digo penal militar|\bcpm\b|cppm/i.test(n)) return 'militar';
  if (/tr[aâ]nsito|\bctb\b|9\.?503/i.test(n)) return 'transito';
  if (/crian[çc]a|adolescente|\beca\b|8\.?069/i.test(n)) return 'crianca';
  if (/idoso|estatuto do idoso|10\.?741/i.test(n)) return 'idoso';
  return 'outros';
}

export interface LeiIndex {
  id: string;
  nome: string;
  sigla: string;
  numero: string;
  data: string;
  ementa: string;
  total_artigos: number;
  categoria?: LeiCategoria;
}

export interface LeisIndex {
  leis: LeiIndex[];
}

export interface LeiArtigo {
  id: string;
  numero: string;
  slug: string;  // Slug canônico para referência cruzada (ex: "cc-2002-art-121-par-2-inc-iv")
  search_text: string;  // Fingerprint de busca: texto limpo sem acentos/pontuação
  vigente: boolean;  // False se revogado/vetado - para filtrar no RAG
  path: {
    parte: string | null;
    livro: string | null;
    titulo: string | null;
    subtitulo: string | null;
    capitulo: string | null;
    secao: string | null;
    subsecao: string | null;
  };
  contexto: string;
  plate_content: any[];  // Cada nó tem: id (uuid), slug, search_text, type, children, indent?
  texto_plano: string;
  epigrafe?: string; // Rubrica/Título do artigo (ex: "Homicídio")
  revoked_versions?: LeiArtigoRevogado[];
}

export interface LeiArtigoRevogado {
  id: string;
  numero: string;
  texto_plano: string;
  plate_content: any[];
  epigrafe?: string;
  contexto?: string;
}

export type RevokedOnlyMap = Record<string, LeiArtigo[]>;

export interface Lei {
  id: string;
  numero: string;
  nome: string;
  data: string;
  ementa: string;
  hierarquia: {
    partes: string[];
    livros: string[];
    titulos: string[];
    subtitulos: string[];
    capitulos: string[];
    secoes: string[];
    subsecoes: string[];
  };
  total_artigos: number;
}

export interface LeiData {
  lei: Lei;
  artigos: LeiArtigo[];
  revokedOnlyMap?: RevokedOnlyMap;
}

export type ViewMode = 1 | 'full';

// ============ HELPER: NATURAL SORT ============

function getArtigoSortValue(numero: string): [number, string] {
  // Remove caracteres não numéricos exceto traço e letras para sufixo
  // Ex: "1º" -> "1", "121-A" -> "121-A"

  // Extrair parte numérica principal
  const match = numero.match(/^(\d+)(.*)$/);
  if (!match) return [0, numero];

  const num = parseInt(match[1], 10);
  const suffix = match[2].trim(); // "-A", "º", etc

  // Normalizar sufixo para ordenação
  // "º" deve vir antes de qualquer letra/hífen? 
  // Na verdade: 1 < 1-A. E 1º é tratado como 1.

  return [num, suffix];
}

function sortArtigos(artigos: LeiArtigo[]): LeiArtigo[] {
  return [...artigos].sort((a, b) => {
    const [numA, sufA] = getArtigoSortValue(a.numero);
    const [numB, sufB] = getArtigoSortValue(b.numero);

    if (numA !== numB) {
      return numA - numB;
    }

    return sufA.localeCompare(sufB);
  });
}

export function buildCapituloPathKey(path: LeiArtigo['path']): string {
  return [
    'capitulo',
    path?.parte ?? '',
    path?.livro ?? '',
    path?.titulo ?? '',
    path?.subtitulo ?? '',
    path?.capitulo ?? ''
  ].join('|');
}

function normalizeArtigos(rows: any[]): { artigos: LeiArtigo[]; revokedOnlyMap: RevokedOnlyMap } {
  const revokedIds = new Set<string>();
  rows.forEach((row) => {
    if (row.vigente === false) return;
    const revokedList = (row.revoked_versions as LeiArtigoRevogado[]) || [];
    revokedList.forEach((rev) => {
      if (rev?.id) revokedIds.add(rev.id);
    });
  });

  const revokedOnlyMap: RevokedOnlyMap = {};
  const artigos: LeiArtigo[] = [];

  rows.forEach((row) => {
    const mapped: LeiArtigo = {
      id: row.id,
      numero: row.numero,
      slug: row.slug || '',
      search_text: row.search_text || '',
      vigente: row.vigente ?? true,
      path: (row.path as LeiArtigo['path']) || {
        parte: null, livro: null, titulo: null, subtitulo: null, capitulo: null, secao: null, subsecao: null,
      },
      contexto: row.contexto || '',
      plate_content: (row.plate_content as any[]) || [],
      texto_plano: row.texto_plano || '',
      epigrafe: row.epigrafe || '',
      revoked_versions: (row.revoked_versions as LeiArtigoRevogado[]) || [],
    };

    if (mapped.vigente === false && revokedIds.has(mapped.id)) {
      return;
    }

    if (mapped.vigente === false) {
      const key = buildCapituloPathKey(mapped.path);
      if (!revokedOnlyMap[key]) {
        revokedOnlyMap[key] = [];
      }
      revokedOnlyMap[key].push(mapped);
      return;
    }

    artigos.push(mapped);
  });

  Object.values(revokedOnlyMap).forEach(list => {
    list.sort((a, b) => {
      const [numA, sufA] = getArtigoSortValue(a.numero);
      const [numB, sufB] = getArtigoSortValue(b.numero);
      if (numA !== numB) return numA - numB;
      return sufA.localeCompare(sufB);
    });
  });

  return { artigos: sortArtigos(artigos), revokedOnlyMap };
}

// Tamanho do batch para modo 'full' (infinite scroll)
const FULL_MODE_BATCH = 30;

interface UseLeiContentOptions {
  leiId: string;
  viewMode: ViewMode;
  currentArtigoIndex: number;
}

export function useLeiContent({ leiId, viewMode, currentArtigoIndex }: UseLeiContentOptions) {
  const [leiData, setLeiData] = useState<LeiData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [fullModeCount, setFullModeCount] = useState(FULL_MODE_BATCH);

  // Carrega dados da lei (Supabase ou JSON local baseado na flag)
  useEffect(() => {
    const loadFromSupabase = async (): Promise<LeiData> => {
      // 1. Buscar dados da lei
      const { data: leiRow, error: leiError } = await supabase
        .from('leis')
        .select('*')
        .eq('id', leiId)
        .single();

      if (leiError || !leiRow) {
        throw new Error(`Lei não encontrada no Supabase: ${leiId}`);
      }

      // 2. Buscar artigos ordenados (limite alto para leis extensas como CC)
      const { data: artigosRows, error: artigosError } = await supabase
        .from('artigos')
        .select('*')
        .eq('lei_id', leiId)
        .order('ordem_numerica', { ascending: true })
        .limit(5000);

      if (artigosError) {
        throw new Error(`Erro ao buscar artigos: ${artigosError.message}`);
      }

      // 3. Montar estrutura LeiData
      const lei: Lei = {
        id: leiRow.id,
        numero: leiRow.numero || '',
        nome: leiRow.nome || '',
        data: leiRow.data_publicacao || '',
        ementa: leiRow.ementa || '',
        hierarquia: (leiRow.hierarquia as Lei['hierarquia']) || {
          partes: [], livros: [], titulos: [], subtitulos: [], capitulos: [], secoes: [], subsecoes: []
        },
        total_artigos: leiRow.total_artigos || 0,
      };

      const { artigos, revokedOnlyMap } = normalizeArtigos(artigosRows || []);
      return { lei, artigos, revokedOnlyMap };
    };

    const loadFromLocalJson = async (): Promise<LeiData> => {
      const response = await fetch(`/data/leis/${leiId}.json`);

      if (!response.ok) {
        throw new Error(`Lei não encontrada: ${leiId}`);
      }

      const json = await response.json();
      const { artigos, revokedOnlyMap } = normalizeArtigos(json.artigos || []);
      return { lei: json.lei, artigos, revokedOnlyMap };
    };

    const loadLei = async () => {
      try {
        setIsLoading(true);

        const data = USE_SUPABASE
          ? await loadFromSupabase()
          : await loadFromLocalJson();

        setLeiData(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro ao carregar lei'));
        setLeiData(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadLei();
  }, [leiId]);

  // Reset fullModeCount quando troca de lei
  const prevLeiIdRef = useRef(leiId);
  useEffect(() => {
    if (prevLeiIdRef.current !== leiId) {
      prevLeiIdRef.current = leiId;
      setFullModeCount(FULL_MODE_BATCH);
    }
  }, [leiId]);

  // Calcula artigos a serem exibidos baseado no viewMode
  const artigosExibidos = useMemo(() => {
    if (!leiData) return [];

    if (viewMode === 'full') {
      return leiData.artigos.slice(0, fullModeCount);
    }

    const count = viewMode as number;
    const start = currentArtigoIndex;
    const end = start + count;

    return leiData.artigos.slice(start, end);
  }, [leiData, viewMode, currentArtigoIndex, fullModeCount]);

  // Combina plate_content de todos artigos exibidos
  const plateContent = useMemo(() => {
    const combined: any[] = [];

    artigosExibidos.forEach((artigo, index) => {
      // Ensure the caput node (the one whose text starts with "Art.") carries
      // the artigo-level slug.  Some importers (scraper_v2) set the caput slug
      // to the generic "caput", which breaks slug-based scroll-to and scroll-spy.
      // We patch it here so the DOM element gets `data-slug="${artigo.slug}"`.
      for (const node of artigo.plate_content) {
        const firstChild = node.children?.[0];
        const text = firstChild?.text?.trimStart?.() ?? '';
        const isCaput = firstChild?.bold && /^Art\.?\s/i.test(text);

        if (isCaput && node.slug !== artigo.slug) {
          // Shallow-clone to avoid mutating cached data
          combined.push({ ...node, slug: artigo.slug });
        } else {
          combined.push(node);
        }
      }

      // Adiciona espaçamento entre artigos (exceto o último)
      if (index < artigosExibidos.length - 1) {
        combined.push({
          type: 'p',
          children: [{ text: '' }]
        });
      }
    });

    return combined;
  }, [artigosExibidos]);

  // Metadados estáveis
  const totalArtigos = leiData?.lei.total_artigos ?? 0;
  const hasNext = currentArtigoIndex + (viewMode === 'full' ? totalArtigos : (viewMode as number)) < totalArtigos;
  const hasPrev = currentArtigoIndex > 0;

  // Referências estáveis para dados derivados
  const lei = leiData?.lei ?? null;
  const allArtigos = leiData?.artigos ?? emptyArtigos;
  const revokedOnlyMap = leiData?.revokedOnlyMap ?? emptyRevokedMap;
  const hierarquia = leiData?.lei.hierarquia ?? emptyHierarquia;

  const findArtigoBySlug = useCallback((slug: string) => {
    if (!leiData) return null;
    const index = leiData.artigos.findIndex(a => a.slug === slug || a.slug.endsWith(slug));
    return index >= 0 ? { artigo: leiData.artigos[index], index } : null;
  }, [leiData]);

  // Infinite scroll para modo full
  const hasMoreFull = viewMode === 'full' && fullModeCount < (leiData?.artigos.length ?? 0);
  const loadMoreFull = useCallback(() => {
    if (!leiData) return;
    setFullModeCount(prev => Math.min(prev + FULL_MODE_BATCH, leiData.artigos.length));
  }, [leiData]);

  // Ensure artigo at given index is loaded in full mode (expand fullModeCount if needed)
  const ensureArtigoLoaded = useCallback((artigoIndex: number) => {
    if (!leiData) return;
    const needed = artigoIndex + 1;
    if (needed > fullModeCount) {
      setFullModeCount(Math.min(needed + FULL_MODE_BATCH, leiData.artigos.length));
    }
  }, [leiData, fullModeCount]);

  return useMemo(() => ({
    lei,
    artigos: artigosExibidos,
    plateContent,
    isLoading,
    error,
    totalArtigos,
    currentArtigoIndex,
    hasNext,
    hasPrev,
    hierarquia,
    findArtigoBySlug,
    allArtigos,
    revokedOnlyMap,
    hasMoreFull,
    loadMoreFull,
    ensureArtigoLoaded,
  }), [
    lei, artigosExibidos, plateContent, isLoading, error,
    totalArtigos, currentArtigoIndex, hasNext, hasPrev,
    hierarquia, findArtigoBySlug, allArtigos, revokedOnlyMap,
    hasMoreFull, loadMoreFull, ensureArtigoLoaded,
  ]);
}

// ============ HOOK: Lista de Leis ============

export function useLeis() {
  const [leisIndex, setLeisIndex] = useState<LeisIndex | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadFromSupabase = async (): Promise<LeisIndex> => {
      const { data: rows, error: dbError } = await supabase
        .from('leis')
        .select('id, nome, sigla, numero, data_publicacao, ementa, total_artigos')
        .order('nome', { ascending: true });

      if (dbError) {
        throw new Error(`Erro ao buscar leis: ${dbError.message}`);
      }

      const leis: LeiIndex[] = (rows || []).map(row => ({
        id: row.id,
        nome: row.nome || '',
        sigla: row.sigla || '',
        numero: row.numero || '',
        data: row.data_publicacao || '',
        ementa: row.ementa || '',
        total_artigos: row.total_artigos || 0,
      }));

      return { leis };
    };

    const loadFromLocalJson = async (): Promise<LeisIndex> => {
      const response = await fetch('/data/leis/index.json');

      if (!response.ok) {
        throw new Error('Índice de leis não encontrado');
      }

      return await response.json();
    };

    /** Enriquece leis com categoria inferida */
    const enrichWithCategoria = (data: LeisIndex): LeisIndex => ({
      ...data,
      leis: data.leis.map(lei => ({
        ...lei,
        categoria: lei.categoria || inferLeiCategoria(lei.nome, lei.sigla),
      })),
    });

    const loadIndex = async () => {
      try {
        setIsLoading(true);

        const raw = USE_SUPABASE
          ? await loadFromSupabase()
          : await loadFromLocalJson();

        const data = enrichWithCategoria(raw);
        setLeisIndex(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro ao carregar índice de leis'));
        setLeisIndex(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadIndex();
  }, []);

  return {
    leis: leisIndex?.leis ?? [],
    isLoading,
    error,

    // Helper para encontrar lei por ID
    findLei: (id: string) => leisIndex?.leis.find(l => l.id === id) ?? null,
  };
}
