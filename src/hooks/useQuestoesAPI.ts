import { useState, useEffect } from 'react';

// Tipos baseados na resposta da API
interface QuestaoAPI {
  id: string;
  enunciado: string;
  alternativas: {
    letra: string;
    texto: string;
  }[];
  materia?: string;
  assunto?: string;
  banca?: string;
  ano?: number;
  prova?: string;
  gabarito?: string;
}

interface QuestoesAPIResponse {
  questoes: QuestaoAPI[];
  total: number;
  page: number;
  limit: number;
}

interface UseQuestoesAPIParams {
  materia?: string;
  assunto?: string;
  banca?: string[];
  cargo?: string[];
  prova?: string[];
  page?: number;
  limit?: number;
}

const API_BASE_URL = 'https://api.projetopapiro.com.br/api/v1';

export function useQuestoesAPI(params: UseQuestoesAPIParams = {}) {
  const [data, setData] = useState<QuestoesAPIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchQuestoes = async () => {
      setLoading(true);
      setError(null);

      try {
        // Construir query params
        const queryParams = new URLSearchParams();

        if (params.materia) queryParams.append('materia', params.materia);
        if (params.assunto) queryParams.append('assunto', params.assunto);
        if (params.page) queryParams.append('page', params.page.toString());
        if (params.limit) queryParams.append('limit', params.limit.toString());

        // Adicionar arrays como múltiplos params
        params.banca?.forEach(b => queryParams.append('banca', b));
        params.cargo?.forEach(c => queryParams.append('cargo', c));
        params.prova?.forEach(p => queryParams.append('prova', p));

        const url = `${API_BASE_URL}/preview/?${queryParams.toString()}`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Erro na API: ${response.status} ${response.statusText}`);
        }

        const jsonData = await response.json();
        setData(jsonData);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro desconhecido'));
      } finally {
        setLoading(false);
      }
    };

    fetchQuestoes();
  }, [
    params.materia,
    params.assunto,
    params.page,
    params.limit,
    JSON.stringify(params.banca),
    JSON.stringify(params.cargo),
    JSON.stringify(params.prova),
  ]);

  return {
    questoes: data?.questoes || [],
    total: data?.total || 0,
    page: data?.page || 1,
    limit: data?.limit || 20,
    loading,
    error,
  };
}
