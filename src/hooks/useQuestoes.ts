import { useState, useEffect } from 'react';

interface QuestaoMetadata {
  materia?: string;
  assunto?: string;
  banca?: string;
  orgao?: string;
  orgao_sigla?: string;
  cargo?: string;
  ano?: number;
}

interface QuestaoEstatisticas {
  views?: number;
  taxa_acerto?: number;
  created_at?: string;
}

interface QuestaoCaracteristicas {
  tipo?: string;
  formato?: string;
  anulada?: boolean;
  desatualizada?: boolean;
  tem_comentario?: boolean;
  gabarito_preliminar?: boolean;
  data_publicacao?: string | null;
}

interface Questao {
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

export const useQuestoes = () => {
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuestoes = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('https://api.projetopapiro.com.br/api/v1/questoes/search?include_html=true&include_facets=false&page=1&limit=20', {
          headers: {
            'accept': 'application/json'
          }
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setQuestoes(data.questoes || data.results || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar questões');
        console.error('Erro ao buscar questões:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestoes();
  }, []);

  return { questoes, loading, error };
};
