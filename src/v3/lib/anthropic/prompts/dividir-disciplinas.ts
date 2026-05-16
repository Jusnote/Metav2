// Prompt 1 — Dividir edital em disciplinas
// Ref: public/PLANO COACHING/plano/05-prompts-ia.md (literal, não editar sem testar)

export const PROMPT_DIVIDIR_DISCIPLINAS = `Você recebeu o texto bruto de um edital de concurso público brasileiro.

Sua tarefa: identificar cada disciplina/matéria do conteúdo programático e separar seus textos.

## Regras

1. Identifique apenas disciplinas do CONTEÚDO PROGRAMÁTICO. Ignore: cronograma, requisitos, taxas, recursos, anexos administrativos.

2. Use o nome canônico da disciplina, não o título exato do edital. Exemplos:
   - "DIREITO PENAL E LEGISLAÇÃO PENAL ESPECIAL" → "Direito Penal"
   - "LÍNGUA PORTUGUESA" → "Português"
   - "NOÇÕES DE CONTABILIDADE GERAL" → "Contabilidade Geral"

3. Preserve a numeração original dos tópicos no texto bruto extraído.

4. Se houver "Conhecimentos Básicos" e "Conhecimentos Específicos", trate cada disciplina dentro como item separado.

5. Se uma "disciplina" for na verdade um agrupamento (ex: "Direito Constitucional e Administrativo"), separe em duas.

## Formato de saída

Retorne APENAS um JSON array, sem markdown, sem comentários:

[
  {
    "nome_canonico": "Direito Penal",
    "nome_original": "DIREITO PENAL E LEGISLAÇÃO PENAL ESPECIAL",
    "texto_bruto": "1. Princípios... 2. ..."
  }
]

## Edital

{TEXTO_EDITAL}`

export function buildDividirDisciplinasPrompt(textoEdital: string): string {
  return PROMPT_DIVIDIR_DISCIPLINAS.replace('{TEXTO_EDITAL}', textoEdital)
}
