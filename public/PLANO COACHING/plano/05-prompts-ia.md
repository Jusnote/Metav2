# 05 — Prompts da IA (Anthropic API)

> Todos os prompts usados no sistema. Copiados literalmente para `/lib/anthropic/prompts/`. Não editar sem testar.

## Modelo

```ts
const MODEL = 'claude-sonnet-4-5'
const MAX_TOKENS = 8000
```

## Prompt 1 — Dividir edital em disciplinas

**Arquivo:** `/lib/anthropic/prompts/dividir-disciplinas.ts`

**Propósito:** receber texto bruto do edital e separar em disciplinas, sem ainda estruturar.

**Input:** texto bruto completo do edital  
**Output:** JSON array de disciplinas com seu texto bruto isolado

```ts
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
```

## Prompt 2 — Estruturar disciplina em árvore

**Arquivo:** `/lib/anthropic/prompts/estruturar-disciplina.ts`

**Propósito:** receber uma disciplina (texto bruto) e devolver árvore JSON estruturada com blocos, tópicos, subtópicos, pesos, naturezas e horas.

**Input:** texto bruto da disciplina + contexto do concurso  
**Output:** JSON da árvore estruturada

```ts
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
```

## Prompt 3 — Estimar horas totais por disciplina

**Arquivo:** `/lib/anthropic/prompts/estimar-horas.ts`

**Propósito:** após dividir disciplinas, estimar quantas horas cada uma deve receber proporcionalmente ao peso geral da disciplina no concurso.

```ts
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
```

## Prompt 4 — Gerar comentário pedagógico de questão (opcional, V2)

**Arquivo:** `/lib/anthropic/prompts/comentar-questao.ts`

**Propósito:** dado uma questão e gabarito, gerar análise no estilo do Aldemir (conversacional, com mnemonics).

```ts
export const PROMPT_COMENTAR_QUESTAO = `Você é um mentor experiente em concursos jurídicos brasileiros. Sua função é comentar questões no estilo de aulas particulares: conversacional, estratégico, com mnemônicos quando úteis, sem academicismo excessivo.

## Tom de voz
- Use "Note que...", "Cuidado com...", "Repare que..."
- Markdown leve (negrito em conceitos-chave, listas quando ajudam)
- Tabelas comparativas quando há mais de uma alternativa que poderia confundir
- Mnemônicos opcionais quando o conteúdo permite

## Estrutura da resposta
1. **Gabarito comentado** — explicação direta da alternativa correta
2. **Análise cirúrgica das demais** — por que cada uma está errada
3. **Memorização** — mnemônico, tabela ou esquema visual

## Questão
{QUESTAO}

## Alternativas
{ALTERNATIVAS}

## Gabarito
{GABARITO}

Retorne o comentário em JSON do Tiptap (estrutura ProseMirror).`
```

## Validação dos outputs

**Arquivo:** `/lib/anthropic/parse-edital.ts`

Toda saída da IA passa por validação Zod antes de salvar no banco:

```ts
import { z } from 'zod'

export const SubtopicoSchema = z.object({
  nome: z.string().min(1),
  horas_sugeridas: z.number().positive().optional(),
  ordem: z.number().int().nonnegative()
})

export const TopicoSchema = z.object({
  nome: z.string().min(1),
  natureza: z.enum([
    'doutrina', 'doutrina_pratica', 'pratica', 'pratica_intensiva',
    'lei_seca', 'lei_seca_mais_doutrina', 'jurisprudencia', 'misto'
  ]),
  peso_incidencia: z.number().int().min(1).max(5),
  horas_sugeridas: z.number().positive(),
  tipo_revisao: z.string(),
  observacao: z.string().optional(),
  ordem: z.number().int().nonnegative(),
  subtopicos: z.array(SubtopicoSchema)
})

export const BlocoSchema = z.object({
  nome: z.string().min(1),
  horas_bloco: z.number().positive().optional(),
  ordem: z.number().int().nonnegative(),
  topicos: z.array(TopicoSchema)
})

export const DisciplinaEstruturadaSchema = z.object({
  disciplina: z.string().min(1),
  horas_totais_sugeridas: z.number().positive(),
  nivel: z.enum(['basico', 'intermediario', 'avancado']),
  observacoes_globais: z.array(z.string()),
  blocos: z.array(BlocoSchema),
  alertas_para_validacao_humana: z.array(z.string())
})

export type DisciplinaEstruturada = z.infer<typeof DisciplinaEstruturadaSchema>
```

## Orquestrador

**Arquivo:** `/lib/anthropic/parse-edital.ts`

```ts
import Anthropic from '@anthropic-ai/sdk'
import pLimit from 'p-limit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const limit = pLimit(3) // máximo 3 requests simultâneos

export async function processarEdital(textoEdital: string, contexto: ContextoConcurso) {
  // Etapa 1: dividir em disciplinas
  const disciplinas = await dividirDisciplinas(textoEdital)
  
  // Etapa 2: estimar horas
  const horasPorDisciplina = await estimarHoras(disciplinas, contexto)
  
  // Etapa 3: estruturar cada disciplina em paralelo (com limite)
  const estruturadas = await Promise.all(
    disciplinas.map((d, i) =>
      limit(() => estruturarDisciplina({
        ...contexto,
        textoDisciplina: d.texto_bruto,
        horasTotais: horasPorDisciplina[i].horas
      }))
    )
  )
  
  return {
    disciplinas: estruturadas,
    contexto
  }
}

async function chamarClaude(prompt: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }]
  })
  
  const text = response.content[0]
  if (text.type !== 'text') throw new Error('Resposta inesperada da IA')
  return text.text
}
```

## Tratamento de erros

```ts
export class IAResponseError extends Error {
  constructor(public etapa: string, public raw: string, public erro: unknown) {
    super(`Falha na etapa "${etapa}": ${erro}`)
  }
}

async function estruturarDisciplina(params: EstruturarDisciplinaParams) {
  const prompt = buildEstruturarDisciplinaPrompt(params)
  const raw = await chamarClaude(prompt)
  
  try {
    const json = JSON.parse(raw)
    const validated = DisciplinaEstruturadaSchema.parse(json)
    return validated
  } catch (erro) {
    throw new IAResponseError('estruturar_disciplina', raw, erro)
  }
}
```

## Custo estimado

Por edital completo (10 disciplinas, ~500 tópicos):

- Dividir: 1 call, ~5k tokens input + 2k output = ~R$0,10
- Estimar horas: 1 call, ~2k tokens = ~R$0,03
- Estruturar (×10): ~3k input + 4k output cada = ~R$1,50
- **Total: R$ 1,60-2,00 por edital**

Caching de prompt do system message ajuda muito em produção (Anthropic suporta).

## Decisões em aberto

1. **Caching do prompt:** ativar `cache_control: ephemeral` nos few-shots? **Sim, economiza ~50% nas chamadas subsequentes.**
2. **Modelo:** Sonnet 4.5 ou Opus? **Sonnet 4.5 é suficiente; Opus só se acertividade do parsing for crítica em casos complexos.**
3. **Validação humana obrigatória:** sempre? **Sim — concurso não publica sem aprovação manual.**
