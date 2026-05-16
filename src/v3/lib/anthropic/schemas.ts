// Schemas Zod para validação dos outputs da IA — Fase 2
// Toda saída da IA passa por estes schemas antes de persistir no banco
// Ref: public/PLANO COACHING/plano/05-prompts-ia.md

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Prompt 1 — Dividir disciplinas
// ---------------------------------------------------------------------------

export const DisciplinaBrutaSchema = z.object({
  nome_canonico: z.string().min(1, 'nome_canonico não pode ser vazio'),
  nome_original: z.string().min(1, 'nome_original não pode ser vazio'),
  texto_bruto: z.string().min(1, 'texto_bruto não pode ser vazio'),
})

export const DisciplinasBrutasSchema = z
  .array(DisciplinaBrutaSchema)
  .min(1, 'Lista de disciplinas não pode ser vazia')

export type DisciplinaBruta = z.infer<typeof DisciplinaBrutaSchema>

// ---------------------------------------------------------------------------
// Prompt 2 — Estruturar disciplina em árvore
// ---------------------------------------------------------------------------

export const NaturezaEnum = z.enum([
  'doutrina',
  'doutrina_pratica',
  'pratica',
  'pratica_intensiva',
  'lei_seca',
  'lei_seca_mais_doutrina',
  'jurisprudencia',
  'misto',
])

export const NivelEnum = z.enum(['basico', 'intermediario', 'avancado'])

export const SubtopicoSchema = z.object({
  nome: z.string().min(1),
  horas_sugeridas: z.number().positive().optional(),
  ordem: z.number().int().nonnegative(),
})

export const TopicoSchema = z.object({
  nome: z.string().min(1),
  natureza: NaturezaEnum,
  peso_incidencia: z.number().int().min(1).max(5),
  horas_sugeridas: z.number().positive(),
  tipo_revisao: z.string().min(1),
  observacao: z.string().optional().default(''),
  ordem: z.number().int().nonnegative(),
  subtopicos: z.array(SubtopicoSchema).default([]),
})

export const BlocoSchema = z.object({
  nome: z.string().min(1),
  horas_bloco: z.number().positive().optional(),
  ordem: z.number().int().nonnegative(),
  topicos: z.array(TopicoSchema).min(1, 'Bloco precisa ter ao menos 1 tópico'),
})

export const DisciplinaEstruturadaSchema = z.object({
  disciplina: z.string().min(1),
  horas_totais_sugeridas: z.number().positive(),
  nivel: NivelEnum,
  observacoes_globais: z.array(z.string()).default([]),
  blocos: z.array(BlocoSchema).min(1, 'Disciplina precisa de ao menos 1 bloco'),
  alertas_para_validacao_humana: z.array(z.string()).default([]),
})

export type DisciplinaEstruturada = z.infer<typeof DisciplinaEstruturadaSchema>
export type BlocoEstruturado = z.infer<typeof BlocoSchema>
export type TopicoEstruturado = z.infer<typeof TopicoSchema>
export type SubtopicoEstruturado = z.infer<typeof SubtopicoSchema>

// ---------------------------------------------------------------------------
// Prompt 3 — Estimar horas por disciplina
// ---------------------------------------------------------------------------

export const HorasDisciplinaSchema = z.object({
  disciplina: z.string().min(1),
  horas: z.number().positive(),
})

export const HorasPorDisciplinaSchema = z
  .array(HorasDisciplinaSchema)
  .min(1, 'Lista de horas não pode ser vazia')

export type HorasDisciplina = z.infer<typeof HorasDisciplinaSchema>

// ---------------------------------------------------------------------------
// Erros tipados
// ---------------------------------------------------------------------------

export class IAResponseError extends Error {
  constructor(
    public etapa: 'dividir' | 'estimar' | 'estruturar',
    public raw: string,
    public causa: unknown,
    public disciplina?: string,
  ) {
    const sufixo = disciplina ? ` (disciplina: ${disciplina})` : ''
    super(
      `Falha na etapa "${etapa}"${sufixo}: ${causa instanceof Error ? causa.message : String(causa)}`,
    )
    this.name = 'IAResponseError'
  }
}
