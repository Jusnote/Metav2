import { z } from 'zod'
import { editalGraphQLSchema } from './schemas'

export const setupPayloadSchema = z.object({
  // Identificação do cargo (vem da navbar via useCargoAtivo)
  // Carreira.id é string no app (geralmente "42"); coerce pra INT pro RPC
  cargo_id: z.coerce.number().int().positive(),
  cargo_nome: z.string().min(1),

  // Datas
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD esperado'),
  data_prova: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD esperado'),

  // Capacidade
  weekday_minutes: z.number().int().min(30).max(720),
  weekend_minutes: z.number().int().min(0).max(720),
  block_duration_minutes: z.number().int().min(15).max(120).default(50),

  // Mix
  mix_ratio: z.object({
    teoria: z.number().min(0).max(1),
    questoes: z.number().min(0).max(1),
    revisao: z.number().min(0).max(1).default(0),
    flashcards: z.number().min(0).max(1).default(0),
  }).refine(
    (m) => Math.abs((m.teoria + m.questoes + m.revisao + m.flashcards) - 1) < 0.05,
    { message: 'mix_ratio deve somar ~1.0 (±0.05)' },
  ),

  // Extras
  simulados_freq: z.enum(['nenhum', 'mensal', 'quinzenal', 'semanal']).default('mensal'),
  tem_redacao: z.boolean().default(false),
  tipo_material: z.enum(['video', 'pdf', 'livro', 'questoes', 'misto']).default('misto'),
  horario_preferido: z.enum(['manha', 'tarde', 'noite', 'madrugada', 'flexivel']).default('flexivel'),

  // Disciplinas selecionadas
  // disciplina_id aceita UUID string (estoque local) OU ID numérico da API (string ou number)
  disciplinas: z.array(z.object({
    disciplina_id: z.union([z.string(), z.number()]),
    peso: z.number().int().min(1).max(10).default(5),
    nivel_conhecimento: z.enum(['iniciante', 'intermediario', 'avancado']).default('intermediario'),
    is_ponto_fraco: z.boolean().default(false),
    excluded_subtopico_ids: z.array(z.string()).default([]),
  })).min(1).refine(
    (arr) => arr.filter(d => d.is_ponto_fraco).length <= 3,
    { message: 'Máximo 3 disciplinas marcadas como ponto fraco' },
  ),

  // Edital (opcional — se omitido, endpoint busca via GraphQL)
  edital_payload: editalGraphQLSchema.optional(),

  // Template opcional
  template_id: z.string().uuid().optional().nullable(),
})

export type SetupPayload = z.infer<typeof setupPayloadSchema>
