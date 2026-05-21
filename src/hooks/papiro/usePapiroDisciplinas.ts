import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PapiroDisciplinasData, PapiroDisciplinaResumo } from '@/lib/papiro/types';

interface RawDisciplina {
  id: string;
  nome: string;
  slug: string;
  ordem: number;
  macro_area: Array<{
    id: string;
    tema: Array<{
      id: string;
      tempo_estudo_min: number | null;
      resumo: Array<{ status: string }>;
    }>;
  }>;
}

export function usePapiroDisciplinas() {
  return useQuery<PapiroDisciplinasData>({
    queryKey: ['papiro', 'disciplinas'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('papiro')
        .from('disciplina')
        .select(`
          id, nome, slug, ordem,
          macro_area:macro_area!disciplina_id (
            id,
            tema:tema!macro_area_id (
              id,
              tempo_estudo_min,
              resumo:resumo!tema_id ( status )
            )
          )
        `)
        .order('ordem');

      if (error) throw error;
      const rows = (data ?? []) as RawDisciplina[];

      const disponiveis: PapiroDisciplinaResumo[] = [];
      const emProducao: PapiroDisciplinaResumo[] = [];

      for (const d of rows) {
        let temasTotal = 0;
        let tempoTotalMin = 0;
        let temasDisponiveis = 0;
        for (const ma of d.macro_area) {
          for (const t of ma.tema) {
            temasTotal++;
            tempoTotalMin += t.tempo_estudo_min ?? 0;
            // RLS já filtra status='publicado'; embed vem [] se bloqueado.
            if (t.resumo.length > 0) temasDisponiveis++;
          }
        }
        const resumo: PapiroDisciplinaResumo = {
          id: d.id,
          nome: d.nome,
          slug: d.slug,
          ordem: d.ordem,
          macroAreasCount: d.macro_area.length,
          stats: { temasTotal, tempoTotalMin, temasDisponiveis },
        };
        if (temasDisponiveis > 0) disponiveis.push(resumo);
        else emProducao.push(resumo);
      }

      return { disponiveis, emProducao };
    },
  });
}
