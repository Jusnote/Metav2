import { useQuery } from '@tanstack/react-query';
import { editaisQuery } from '@/lib/editais-client';
import type { IntelligenceData } from '@/components/documents-organization/TopicoIntelligence';

const EDITAIS_POR_DISCIPLINA = `
  query EditaisPorDisciplina($nome: String!) {
    editaisPorDisciplina(nome: $nome) { id nome sigla esfera }
  }
`;

const RANKING_DISCIPLINAS = `
  query RankingDisciplinas($esfera: String, $limite: Int) {
    rankingDisciplinas(esfera: $esfera, limite: $limite) { nome totalEditais totalCargos }
  }
`;

export function useTopicoIntelligence(
  disciplinaNome: string | null,
  topicoNome: string | null,
  editalEsfera: string | null,
) {
  return useQuery({
    queryKey: ['topico-intelligence', disciplinaNome, topicoNome],
    queryFn: async (): Promise<IntelligenceData> => {
      if (!disciplinaNome) {
        return { subtopicosFrequentes: [], editaisQueCobram: [], legislacao: [], bancas: [], frequenciaProvas: 0, rankingEdital: { posicao: 0, total: 0 } };
      }

      const [editaisRes, rankingRes] = await Promise.all([
        editaisQuery<{ editaisPorDisciplina: Array<{ id: number; nome: string; sigla: string }> }>(
          EDITAIS_POR_DISCIPLINA, { nome: disciplinaNome }
        ),
        editaisQuery<{ rankingDisciplinas: Array<{ nome: string; totalEditais: number }> }>(
          RANKING_DISCIPLINAS, { esfera: editalEsfera, limite: 50 }
        ),
      ]);

      const editais = editaisRes.data?.editaisPorDisciplina || [];
      const ranking = rankingRes.data?.rankingDisciplinas || [];
      const rankPos = ranking.findIndex(r => r.nome === disciplinaNome) + 1;

      return {
        subtopicosFrequentes: [], // TODO: needs API enrichment
        editaisQueCobram: editais.map(e => ({ nome: e.nome, sigla: e.sigla })),
        legislacao: [], // TODO: needs manual/AI mapping
        bancas: [], // TODO: needs API enrichment
        frequenciaProvas: editais.length > 0 ? Math.round((editais.length / 167) * 100) : 0,
        rankingEdital: { posicao: rankPos, total: ranking.length },
      };
    },
    enabled: !!disciplinaNome,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });
}
