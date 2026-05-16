import { z } from 'zod'

// ============================================================================
// Input: o que vem do GraphQL editais
// ============================================================================

export const editalGraphQLSchema = z.object({
  cargo_id: z.number().int().positive(),
  edital_id: z.number().int().positive(),
  cargo_nome: z.string().min(1),
  disciplinas: z.array(z.object({
    id: z.union([z.string(), z.number()]),
    nome: z.string().min(1),
  })),
  topicos: z.array(z.object({
    id: z.union([z.string(), z.number()]),
    disciplina_id: z.union([z.string(), z.number()]),
    nome: z.string().min(1),
  })),
})
export type EditalGraphQL = z.infer<typeof editalGraphQLSchema>

// ============================================================================
// Output: o que esperamos do Claude (spec §B do apêndice)
// ============================================================================

export const subtopicoDecomposedSchema = z.object({
  nome: z.string().min(3).max(200),
  duracao_min: z.number().int().min(15).max(120),
  conceito_pai: z.string().min(1).max(80),
  origin: z.enum(['ai', 'manual']).default('ai'),  // ⬅ novo: rastreia se foi gerado pela IA ou adicionado manualmente
})
export type SubtopicoDecomposed = z.infer<typeof subtopicoDecomposedSchema>

export const topicoDecomposedSchema = z.object({
  nome_curto: z.string().min(2).max(60),
  conceitos_pai: z.array(z.string()).min(1).max(5),
  subtopicos: z.array(subtopicoDecomposedSchema).min(1).max(20),
  referencias_legais: z.array(z.string()).default([]),
})
export type TopicoDecomposed = z.infer<typeof topicoDecomposedSchema>

// Resultado da decomposição completa de um edital (gravado em edital_cache.decomposicao)
export const editalDecomposicaoSchema = z.object({
  by_topico: z.record(z.string(), topicoDecomposedSchema),  // chave = topico_id como string
  metadata: z.object({
    ai_model: z.string(),
    decomposed_at: z.string(),  // ISO datetime
    total_topicos: z.number(),
    decomposed_count: z.number(),
    fallback_count: z.number(),
  }),
})
export type EditalDecomposicao = z.infer<typeof editalDecomposicaoSchema>
