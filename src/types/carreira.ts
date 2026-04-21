// src/types/carreira.ts

export const AREAS = [
  'policial',
  'fiscal',
  'juridica',
  'tribunais',
  'saude',
  'controle',
  'legislativo',
  'bancaria',
  'militar',
] as const;

export type Area = (typeof AREAS)[number];

export const AREA_LABELS: Record<Area, string> = {
  policial: 'Policial',
  fiscal: 'Fiscal',
  juridica: 'Jurídica',
  tribunais: 'Tribunais',
  saude: 'Saúde',
  controle: 'Controle',
  legislativo: 'Legislativo',
  bancaria: 'Bancária',
  militar: 'Militar',
};

export interface Carreira {
  id: string;
  area: Area;
  nome: string;
  slug: string;
  foto_url: string | null;
  ordem: number;
  ativa: boolean;
  created_at: string;
  updated_at: string;
}
