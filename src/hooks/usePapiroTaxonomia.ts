import { useQuery } from '@tanstack/react-query';

export type PapiroNode = {
  id: number;
  nome: string;
  nivel: number; // 1=tema 2=subtema 3=ponto
  n: number;     // incidência cumulativa
  definicao?: string | null;
  desempate?: string | null;
  artigo?: string | null;
  children: PapiroNode[];
};

export type PapiroArvore = {
  materia: string;
  total: number;
  tree: PapiroNode[];
};

const API = () => process.env.NEXT_PUBLIC_API_URL;

export function usePapiroMaterias() {
  return useQuery<{ materia: string; nos: number }[]>({
    queryKey: ['papiro-materias'],
    queryFn: async () => {
      const res = await fetch(`${API()}/api/v1/papiro/materias`);
      if (!res.ok) throw new Error('Falha ao carregar matérias');
      return res.json();
    },
    staleTime: 60 * 60 * 1000,
  });
}

export function usePapiroArvore(materia: string | null) {
  return useQuery<PapiroArvore>({
    queryKey: ['papiro-arvore', materia],
    queryFn: async () => {
      const res = await fetch(`${API()}/api/v1/papiro/${encodeURIComponent(materia!)}/arvore`);
      if (!res.ok) throw new Error('Falha ao carregar árvore');
      return res.json();
    },
    enabled: !!materia,
    staleTime: 60 * 60 * 1000,
  });
}

export type PapiroQuestao = {
  id: number;
  enunciado: string;
  alternativas: unknown;
  banca?: string | null;
  ano?: number | null;
};

export function usePapiroQuestoes(nodeId: number | null) {
  return useQuery<{ node_id: number; total: number; questoes: PapiroQuestao[] }>({
    queryKey: ['papiro-questoes', nodeId],
    queryFn: async () => {
      const res = await fetch(`${API()}/api/v1/papiro/no/${nodeId}/questoes?limit=20`);
      if (!res.ok) throw new Error('Falha ao carregar questões');
      return res.json();
    },
    enabled: !!nodeId,
  });
}
