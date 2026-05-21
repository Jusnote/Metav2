import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PapiroDisciplinaData, PapiroMacroAreaResumo } from '@/lib/papiro/types';

interface RawDisciplina {
  id: string;
  nome: string;
  slug: string;
  ordem: number;
  criado_em: string;
  macro_area: Array<{
    id: string;
    nome: string;
    slug: string;
    ordem: number;
    tema: Array<{
      id: string;
      tempo_estudo_min: number | null;
      // FK UNIQUE → PostgREST 1-1: single object | null
      resumo: { status: string } | null;
    }>;
  }>;
}

export function usePapiroDisciplina(disciplinaSlug: string | undefined) {
  return useQuery<PapiroDisciplinaData | null>({
    queryKey: ['papiro', 'disciplina', disciplinaSlug],
    staleTime: 5 * 60 * 1000,
    enabled: !!disciplinaSlug,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('papiro')
        .from('disciplina')
        .select(`
          id, nome, slug, ordem, criado_em,
          macro_area:macro_area!disciplina_id (
            id, nome, slug, ordem,
            tema:tema!macro_area_id (
              id,
              tempo_estudo_min,
              resumo:resumo!tema_id ( status )
            )
          )
        `)
        .eq('slug', disciplinaSlug!)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      const d = data as unknown as RawDisciplina;

      const macroAreasDisponiveis: PapiroMacroAreaResumo[] = [];
      const macroAreasEmProducao: PapiroMacroAreaResumo[] = [];

      for (const ma of d.macro_area.sort((a, b) => a.ordem - b.ordem)) {
        let temasTotal = 0;
        let tempoTotalMin = 0;
        let temasDisponiveis = 0;
        for (const t of ma.tema) {
          temasTotal++;
          tempoTotalMin += t.tempo_estudo_min ?? 0;
          if (t.resumo !== null) temasDisponiveis++;
        }
        const resumo: PapiroMacroAreaResumo = {
          id: ma.id,
          nome: ma.nome,
          slug: ma.slug,
          ordem: ma.ordem,
          stats: { temasTotal, tempoTotalMin, temasDisponiveis },
        };
        if (temasDisponiveis > 0) macroAreasDisponiveis.push(resumo);
        else macroAreasEmProducao.push(resumo);
      }

      return {
        disciplina: { id: d.id, nome: d.nome, slug: d.slug, ordem: d.ordem, criado_em: d.criado_em },
        macroAreasDisponiveis,
        macroAreasEmProducao,
      };
    },
  });
}
