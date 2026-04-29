import { useQuery } from '@tanstack/react-query';

export type Materia = {
  slug: string;
  nome: string;
  fontes: string[];
  total_nodes: number;
  total_questoes_classificadas: number;
  last_updated: string | null;
};

export function useMaterias() {
  return useQuery<Materia[]>({
    queryKey: ['materias-taxonomia'],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/taxonomia/materias`);
      if (!res.ok) throw new Error('Falha ao carregar matérias');
      return res.json();
    },
    staleTime: 60 * 60 * 1000, // 1h
  });
}

export function useMateriaBySlug(slug: string | undefined) {
  const { data } = useMaterias();
  return data?.find(m => m.slug === slug);
}
