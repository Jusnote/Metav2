import { createHash } from 'node:crypto'

export type DisciplinaForHash = { id: string | number; nome: string }
export type TopicoForHash = { id: string | number; disciplina_id: string | number; nome: string }

/**
 * Hash composto do edital. Mesma entrada → mesmo hash. Ordem-independente.
 * Spec §5.3.
 */
export function computeEditalPayloadHash(input: {
  disciplinas: DisciplinaForHash[]
  topicos: TopicoForHash[]
}): string {
  const disciplinasPart = input.disciplinas
    .map(d => `${d.id}:${d.nome}`)
    .sort()
    .join('|')

  const topicosPart = input.topicos
    .map(t => `${t.id}:${t.disciplina_id}:${t.nome.slice(0, 50)}`)
    .sort()
    .join('|')

  return createHash('md5').update(`${disciplinasPart}||${topicosPart}`).digest('hex')
}
