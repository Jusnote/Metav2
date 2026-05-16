// Prompt 3 — Estimar horas totais por disciplina
// Ref: public/PLANO COACHING/plano/05-prompts-ia.md (literal, não editar sem testar)

export const PROMPT_ESTIMAR_HORAS = `Você é especialista em concursos brasileiros. Recebeu uma lista de disciplinas de um concurso e o total de horas disponíveis no cronograma.

Estime quantas horas cada disciplina deve receber, baseado em:
1. Peso histórico no edital da banca {BANCA} para o cargo {CARGO}
2. Densidade do conteúdo programático (mais tópicos = mais horas)
3. Dificuldade típica da disciplina

## Lista de disciplinas
{LISTA_DISCIPLINAS}

## Horas totais disponíveis
{HORAS_TOTAIS}h

## Formato de saída
JSON com nome da disciplina e horas alocadas. Soma deve bater com horas totais.

[
  { "disciplina": "Direito Penal", "horas": 60 },
  { "disciplina": "Português", "horas": 40 }
]`

export interface EstimarHorasParams {
  banca: string
  cargo: string
  disciplinas: Array<{ nome_canonico: string; texto_bruto: string }>
  horasTotais: number
}

export function buildEstimarHorasPrompt(params: EstimarHorasParams): string {
  // Lista as disciplinas com indicador grosseiro de densidade (caracteres do texto bruto)
  const lista = params.disciplinas
    .map(
      (d, i) =>
        `${i + 1}. ${d.nome_canonico} (≈${d.texto_bruto.length} caracteres no edital)`,
    )
    .join('\n')

  return PROMPT_ESTIMAR_HORAS
    .replace('{BANCA}', params.banca)
    .replace('{CARGO}', params.cargo)
    .replace('{LISTA_DISCIPLINAS}', lista)
    .replace('{HORAS_TOTAIS}', String(params.horasTotais))
}
