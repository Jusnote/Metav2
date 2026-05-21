import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PapiroTrilhaData, PapiroTemaComStatus, PapiroPrereqResolvido } from '@/lib/papiro/types';

interface RawMacroAreaTrilha {
  id: string;
  nome: string;
  slug: string;
  disciplina: { slug: string; nome: string } | null;
  tema: Array<{
    id: string;
    macro_area_id: string;
    slug_hierarquico: string;
    nome: string;
    descricao_breve: string | null;
    objetivo_pedagogico: string | null;
    ordem_curricular: number;
    tempo_estudo_min: number | null;
    profundidade_estrat: string | null;
    profundidade_gran: string | null;
    conceitos_principais: unknown;
    mapeamento_paginas: unknown;
    criado_em: string;
    resumo: Array<{ status: string }>;
  }>;
}

interface RawPrereq {
  tema_id: string;
  prereq: { id: string; slug_hierarquico: string; nome: string } | null;
}

export function usePapiroTrilha(macroAreaSlug: string | undefined) {
  return useQuery<PapiroTrilhaData | null>({
    queryKey: ['papiro', 'trilha', macroAreaSlug],
    staleTime: 5 * 60 * 1000,
    enabled: !!macroAreaSlug,
    queryFn: async () => {
      // Q1: macro_area + disciplina + temas (com flag de resumo publicado via embed RLS)
      const { data: macroArea, error: e1 } = await supabase
        .schema('papiro')
        .from('macro_area')
        .select(`
          id, nome, slug,
          disciplina:disciplina!disciplina_id ( slug, nome ),
          tema:tema!macro_area_id (
            id, macro_area_id, slug_hierarquico, nome, descricao_breve,
            objetivo_pedagogico, ordem_curricular, tempo_estudo_min,
            profundidade_estrat, profundidade_gran,
            conceitos_principais, mapeamento_paginas, criado_em,
            resumo:resumo!tema_id ( status )
          )
        `)
        .eq('slug', macroAreaSlug!)
        .maybeSingle();

      if (e1) throw e1;
      if (!macroArea) return null;
      const ma = macroArea as unknown as RawMacroAreaTrilha;

      // Q2: prereqs (todos os temas dessa macro_area)
      const temaIds = ma.tema.map((t) => t.id);
      const prereqsByTema = new Map<string, PapiroPrereqResolvido[]>();
      if (temaIds.length > 0) {
        const { data: rawPrereqs, error: e2 } = await supabase
          .schema('papiro')
          .from('tema_prereq')
          .select(`
            tema_id,
            prereq:tema!prereq_tema_id ( id, slug_hierarquico, nome )
          `)
          .in('tema_id', temaIds);
        if (e2) throw e2;
        for (const p of (rawPrereqs ?? []) as unknown as RawPrereq[]) {
          if (!p.prereq) continue;
          const arr = prereqsByTema.get(p.tema_id) ?? [];
          arr.push({ slug_hierarquico: p.prereq.slug_hierarquico, nome: p.prereq.nome });
          prereqsByTema.set(p.tema_id, arr);
        }
      }

      const temas: PapiroTemaComStatus[] = ma.tema
        .sort((a, b) => a.ordem_curricular - b.ordem_curricular)
        .map((t) => ({
          ...t,
          conceitos_principais: t.conceitos_principais as never,
          mapeamento_paginas: t.mapeamento_paginas as never,
          temResumoPublicado: t.resumo.length > 0,
          prereqs: prereqsByTema.get(t.id) ?? [],
        }));

      const temasTotal = temas.length;
      const tempoTotalMin = temas.reduce((acc, t) => acc + (t.tempo_estudo_min ?? 0), 0);
      const temasDisponiveis = temas.filter((t) => t.temResumoPublicado).length;

      return {
        id: ma.id,
        slug: ma.slug,
        nome: ma.nome,
        disciplinaSlug: ma.disciplina?.slug ?? '',
        disciplinaNome: ma.disciplina?.nome ?? '',
        stats: { temasTotal, tempoTotalMin, temasDisponiveis },
        temas,
      };
    },
  });
}
