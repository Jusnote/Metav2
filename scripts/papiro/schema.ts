/**
 * PAPIRO — Zod schema do JSON do Arquiteto.
 * Espelha o formato de `taxonomia_*.json` (v2.0).
 *
 * Validação:
 *  - Tipos e presença de campos obrigatórios.
 *  - As invariantes semânticas (slug pattern, prefixo, ciclos, ordem
 *    duplicada) ficam em `generate-seed.ts` (validateInvariants).
 */

import { z } from 'zod';

const SLUG_PATTERN = /^[a-z0-9_.]+$/;

export const ProfundidadeSchema = z.enum(['alta', 'media', 'baixa', 'ausente']);

export const FonteSchema = z.object({
  documento: z.string().nullable(),
  paginas: z.array(z.string()),
  profundidade: ProfundidadeSchema,
  observacoes: z.string().optional(),
});

export const MapeamentoFontesSchema = z.object({
  estrategia: FonteSchema,
  gran: FonteSchema,
});

export const TemaSchema = z.object({
  id: z.string().regex(SLUG_PATTERN, 'tema.id deve casar com /^[a-z0-9_.]+$/'),
  nome: z.string().min(1),
  ordem_curricular: z.number().int().positive(),
  descricao_breve: z.string().min(1),
  objetivo_pedagogico: z.string().min(1),
  tempo_estudo_estimado_minutos: z.number().int().positive(),
  pre_requisitos: z.array(z.string()).default([]),
  temas_relacionados: z.array(z.string()).default([]),
  mapeamento_fontes: MapeamentoFontesSchema,
  conceitos_principais: z.array(z.string()),
  justificativa_pedagogica: z.string().optional(),
});

export const MateriaSchema = z.object({
  id: z
    .string()
    .regex(SLUG_PATTERN, 'materia.id deve casar com /^[a-z0-9_.]+$/'),
  nome: z.string().min(1),
  disciplina: z.string().min(1),
  macro_area: z.string().min(1),
  concurso_alvo: z.string().optional(),
  versao_taxonomia: z.string().optional(),
  total_temas: z.number().int().positive().optional(),
  fontes_analisadas: z.array(z.unknown()).optional(),
});

export const TaxonomiaSchema = z.object({
  materia: MateriaSchema,
  temas_papiro: z.array(TemaSchema).min(1),
  alertas_e_observacoes: z.unknown().optional(),
});

export type Taxonomia = z.infer<typeof TaxonomiaSchema>;
export type Tema = z.infer<typeof TemaSchema>;
export type Materia = z.infer<typeof MateriaSchema>;
