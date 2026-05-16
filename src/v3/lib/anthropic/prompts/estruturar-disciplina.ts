// Prompt 2 — Estruturar disciplina em árvore JSON
// Ref: public/PLANO COACHING/plano/05-prompts-ia.md (literal, não editar sem testar)

export const PROMPT_ESTRUTURAR_DISCIPLINA = `Você é um especialista em concursos públicos brasileiros, com foco em estruturação pedagógica de editais. Sua tarefa é transformar o texto bruto de uma disciplina de edital em uma árvore JSON normalizada, pronta para gerar cronograma de estudos com repetição espaçada.

## Contexto da prova
- Concurso: {CONCURSO_NOME}
- Banca: {BANCA}
- Cargo: {CARGO}
- Nível de profundidade esperado: {NIVEL}
- Horas totais alocadas para esta disciplina: {HORAS_TOTAIS}h

## Texto bruto da disciplina
{TEXTO_DISCIPLINA}

## Instruções de estruturação

### 1. Agrupe os tópicos em BLOCOS TEMÁTICOS (3 a 6 blocos por disciplina)
Não use os números do edital como blocos — crie agrupamentos pedagógicos coerentes. Por exemplo, em Contabilidade: "Fundamentos", "Mecânica Contábil", "Operações Específicas", "Demonstrações", "Legislação".

### 2. Para cada TÓPICO, identifique
- \`natureza\`: uma de [doutrina, doutrina_pratica, pratica, pratica_intensiva, lei_seca, lei_seca_mais_doutrina, jurisprudencia, misto]
- \`peso_incidencia\`: 1 (cai raramente) a 5 (cai quase sempre), baseado no histórico da banca
- \`horas_sugeridas\`: proporcional ao peso e à densidade do conteúdo
- \`tipo_revisao\`: uma de [leitura_unica_mais_questoes, resumo_mais_questoes, tabela_mais_questoes, exercicio_repetido, exercicio_intensivo, exercicio_montagem, leitura_lei_mais_questoes, leitura_norma_mais_questoes, mapa_mental]

### 3. EXPANDA tópicos amontoados
Se um item do edital lista várias coisas separadas por vírgula ou ponto-e-vírgula, abra cada uma como subtópico. Se uma operação/lei/tema tem densidade própria, atribua horas próprias a ela.

Exemplo: "Contabilização de operações: juros, descontos, tributos, folha de pagamento, compras, vendas" — separe em 6 subtópicos com pesos individuais. Folha de pagamento é mais densa que descontos.

### 4. Sinalize ambiguidades
No campo \`alertas_para_validacao_humana\`, liste:
- Trechos do edital que pareceram truncados ou ambíguos
- Temas clássicos da disciplina que NÃO apareceram no edital (e que normalmente caem)
- Decisões de granularidade que você tomou e que merecem revisão

### 5. Adicione observações estratégicas
No campo \`observacao\` de cada tópico, quando relevante: o que a banca costuma cobrar, qual a pegadinha frequente, qual a melhor abordagem de estudo.

### 6. Calibre pela banca
- **Cebraspe/CESPE**: cobra muito "certo/errado", pegadinhas, casos práticos. Peso maior em interpretação e aplicação.
- **FGV**: muito raciocínio, dados, atualidades. Peso em jurisprudência recente.
- **FCC**: cobra letra de lei, lei seca pesada. Peso maior em "lei_seca".
- **Vunesp**: mais clássica, doutrina sólida.

### 7. Valide a soma de horas
A soma das \`horas_sugeridas\` de todos os tópicos deve bater com \`horas_totais_sugeridas\`.

## Formato de saída

Retorne APENAS o JSON, sem markdown, sem backticks, sem comentários.

## Schema esperado

{
  "disciplina": string,
  "horas_totais_sugeridas": number,
  "nivel": "basico" | "intermediario" | "avancado",
  "observacoes_globais": string[],
  "blocos": [
    {
      "nome": string,
      "horas_bloco": number,
      "ordem": number,
      "topicos": [
        {
          "nome": string,
          "natureza": string,
          "peso_incidencia": number (1-5),
          "horas_sugeridas": number,
          "tipo_revisao": string,
          "observacao": string,
          "ordem": number,
          "subtopicos": [
            {
              "nome": string,
              "horas_sugeridas": number,
              "ordem": number
            }
          ]
        }
      ]
    }
  ],
  "alertas_para_validacao_humana": string[]
}

## Exemplo de referência (few-shot)

Para disciplina "Contabilidade Geral" do concurso Agente PF / Cebraspe / 24h totais:

{
  "disciplina": "Contabilidade Geral",
  "horas_totais_sugeridas": 24,
  "nivel": "intermediario",
  "observacoes_globais": [
    "Disciplina de peso médio na prova de Agente PF — priorizar lançamentos, balanço e DRE.",
    "Cebraspe explora muito 'certo/errado' em classificação de contas e natureza de fatos administrativos."
  ],
  "blocos": [
    {
      "nome": "Fundamentos",
      "horas_bloco": 3,
      "ordem": 1,
      "topicos": [
        {
          "nome": "Conceitos, objetivos e finalidades da contabilidade",
          "natureza": "doutrina",
          "peso_incidencia": 2,
          "horas_sugeridas": 1.5,
          "tipo_revisao": "leitura_unica_mais_questoes",
          "observacao": "Conteúdo introdutório, cai pouco mas é base. Não aprofundar.",
          "ordem": 1,
          "subtopicos": []
        },
        {
          "nome": "Patrimônio",
          "natureza": "doutrina",
          "peso_incidencia": 3,
          "horas_sugeridas": 1.5,
          "tipo_revisao": "resumo_mais_questoes",
          "observacao": "Cebraspe gosta de cobrar classificação de situação líquida em casos numéricos.",
          "ordem": 2,
          "subtopicos": [
            { "nome": "Componentes do patrimônio", "horas_sugeridas": 0.4, "ordem": 1 },
            { "nome": "Equação fundamental", "horas_sugeridas": 0.4, "ordem": 2 },
            { "nome": "Situação líquida", "horas_sugeridas": 0.4, "ordem": 3 },
            { "nome": "Representação gráfica", "horas_sugeridas": 0.3, "ordem": 4 }
          ]
        }
      ]
    },
    {
      "nome": "Mecânica Contábil",
      "horas_bloco": 7,
      "ordem": 2,
      "topicos": [
        {
          "nome": "Escrituração",
          "natureza": "doutrina_pratica",
          "peso_incidencia": 5,
          "horas_sugeridas": 3,
          "tipo_revisao": "exercicio_intensivo",
          "observacao": "Tópico denso. Regime de competência x caixa é pegadinha frequente.",
          "ordem": 3,
          "subtopicos": [
            { "nome": "Conceito de escrituração", "horas_sugeridas": 0.3, "ordem": 1 },
            { "nome": "Lançamentos contábeis", "horas_sugeridas": 0.5, "ordem": 2 },
            { "nome": "Fórmulas de lançamento", "horas_sugeridas": 0.5, "ordem": 3 },
            { "nome": "Livros de escrituração", "horas_sugeridas": 0.4, "ordem": 4 },
            { "nome": "Regime de competência", "horas_sugeridas": 0.7, "ordem": 5 },
            { "nome": "Regime de caixa", "horas_sugeridas": 0.6, "ordem": 6 }
          ]
        }
      ]
    }
  ],
  "alertas_para_validacao_humana": [
    "Não há menção explícita a DFC ou DLPA — confirmar se ficaram de fora, pois costumam aparecer em edital Cebraspe.",
    "Pesos foram estimados pelo padrão histórico — recomenda-se cruzar com banco de questões reais das últimas 3 edições."
  ]
}

Agora processe a disciplina solicitada acima e retorne o JSON completo.`

export interface EstruturarDisciplinaParams {
  concursoNome: string
  banca: string
  cargo: string
  nivel: 'basico' | 'intermediario' | 'avancado'
  horasTotais: number
  textoDisciplina: string
}

export function buildEstruturarDisciplinaPrompt(params: EstruturarDisciplinaParams): string {
  return PROMPT_ESTRUTURAR_DISCIPLINA
    .replace('{CONCURSO_NOME}', params.concursoNome)
    .replace('{BANCA}', params.banca)
    .replace('{CARGO}', params.cargo)
    .replace('{NIVEL}', params.nivel)
    .replace('{HORAS_TOTAIS}', String(params.horasTotais))
    .replace('{TEXTO_DISCIPLINA}', params.textoDisciplina)
}
