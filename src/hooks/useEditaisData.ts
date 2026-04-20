import { useQuery } from '@tanstack/react-query';
import { editaisQuery } from '@/lib/editais-client';

// ---- Types ----

export interface ApiDisciplina {
  id: number;
  fonteId: number | null;
  nome: string;
  nomeEdital: string | null;
  totalTopicos: number;
}

export interface ApiTopico {
  id: number;
  fonteId: number | null;
  nome: string;
  ordem: number;
}

export interface ApiCargo {
  id: number;
  nome: string;
  vagas: number;
  remuneracao: number;
  qtdDisciplinas: number;
  qtdTopicos: number;
  edital: {
    id: number;
    nome: string;
    sigla: string;
    esfera: string;
    dataPublicacao: string;
    logoUrl: string | null;
  };
}

// ---- GraphQL Queries ----

const CARGOS_QUERY = `
  query Cargos($editalId: Int!) {
    cargos(editalId: $editalId) {
      id nome vagas remuneracao qtdDisciplinas qtdTopicos
      edital { id nome sigla esfera dataPublicacao logoUrl }
    }
  }
`;

const DISCIPLINAS_QUERY = `
  query Disciplinas($cargoId: Int!) {
    disciplinas(cargoId: $cargoId) { id fonteId nome nomeEdital totalTopicos }
  }
`;

const TOPICOS_QUERY = `
  query Topicos($disciplinaId: Int!) {
    topicos(disciplinaId: $disciplinaId) { id fonteId nome ordem }
  }
`;

// ---- Hooks ----

export function useCargoData(editalId: number | null, cargoId: number | null) {
  return useQuery({
    queryKey: ['cargo', editalId, cargoId],
    queryFn: async () => {
      if (!editalId) return null;
      const { data } = await editaisQuery<{ cargos: ApiCargo[] }>(CARGOS_QUERY, { editalId });
      return data?.cargos.find(c => c.id === cargoId) || null;
    },
    enabled: !!editalId && !!cargoId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useDisciplinasApi(cargoId: number | null) {
  return useQuery({
    queryKey: ['disciplinas-api', cargoId],
    queryFn: async () => {
      if (!cargoId) return [];
      const { data } = await editaisQuery<{ disciplinas: ApiDisciplina[] }>(DISCIPLINAS_QUERY, { cargoId });
      return data?.disciplinas || [];
    },
    enabled: !!cargoId,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });
}

export function useTopicosApi(disciplinaId: number | null) {
  return useQuery({
    queryKey: ['topicos-api', disciplinaId],
    queryFn: async () => {
      if (!disciplinaId) return [];
      const { data } = await editaisQuery<{ topicos: ApiTopico[] }>(TOPICOS_QUERY, { disciplinaId });
      return data?.topicos || [];
    },
    enabled: !!disciplinaId,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });
}
