import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { topicoDecomposedSchema, type TopicoDecomposed } from './schemas'

const CLAUDE_HAIKU_MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM_PROMPT = `Você é um especialista em editais de concurso. Decomponha o texto bruto de um tópico do edital em subtópicos pequenos, atômicos e estudáveis isoladamente.

REGRA CRÍTICA — nome do subtópico:
- 3 a 6 palavras MÁXIMO. Apenas o conceito atômico em si.
- NUNCA inclua o contexto pai no nome — isso vai em "conceito_pai" separadamente.
- NUNCA use frases longas, listas, vírgulas ou "e" coordenando conceitos distintos.

Exemplos CORRETOS:
  nome: "Pregão", conceito_pai: "Licitações"
  nome: "Centralização", conceito_pai: "Organização administrativa"
  nome: "Princípio da legalidade", conceito_pai: "Princípios constitucionais"

Exemplos ERRADOS (não faça isso):
  nome: "Licitações - Pregão"                      ← já tem o pai colado
  nome: "Centralização e descentralização"         ← 2 conceitos distintos virariam 2 subtopicos
  nome: "Noções de organização administrativa"     ← longo demais e é o pai, não filho

Para cada subtópico produza:
1. nome: 3-6 palavras, sem contexto pai (3-60 chars)
2. duracao_min: 25-75 minutos (mais longo se denso)
3. conceito_pai: o tópico/agrupamento (1-80 chars)

No nível do tópico inteiro também produza:
- nome_curto: 2-6 palavras resumindo o tópico (3-60 chars)
- conceitos_pai: até 5 grupos conceituais identificados
- referencias_legais: leis/decretos/súmulas citados

Retorne APENAS JSON válido, sem prefácio. Schema:
{
  "nome_curto": string,
  "conceitos_pai": string[],
  "subtopicos": [
    { "nome": string, "duracao_min": number, "conceito_pai": string }
  ],
  "referencias_legais": string[]
}`

export interface DecomposeOptions {
  /** Se TRUE, força fallback regex (não chama IA). Usado em ambiente de teste. */
  skipAI?: boolean
  /** Timeout em ms para a chamada Claude. Default 30s. */
  timeoutMs?: number
}

export async function decomposeTopico(
  topicoNome: string,
  options: DecomposeOptions = {},
): Promise<{ result: TopicoDecomposed; usedFallback: boolean; aiModel: string }> {
  if (options.skipAI) {
    return { result: fallbackDecompose(topicoNome), usedFallback: true, aiModel: 'fallback-regex' }
  }

  try {
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), options.timeoutMs ?? 30000)

    const { text } = await generateText({
      model: anthropic(CLAUDE_HAIKU_MODEL),
      system: SYSTEM_PROMPT,
      prompt: `TÓPICO DO EDITAL: <<<${topicoNome}>>>`,
      abortSignal: ctrl.signal,
    })

    clearTimeout(timeoutId)

    // Claude às vezes retorna JSON dentro de ```json fences — strip-as
    const cleaned = stripJsonFences(text)
    const parsed = JSON.parse(cleaned)
    const validated = topicoDecomposedSchema.parse(parsed)

    return { result: validated, usedFallback: false, aiModel: CLAUDE_HAIKU_MODEL }
  } catch (_err) {
    // Fallback regex em qualquer falha (parse, validation, network, timeout)
    return {
      result: fallbackDecompose(topicoNome),
      usedFallback: true,
      aiModel: 'fallback-regex',
    }
  }
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim()
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/)
  return fenceMatch ? fenceMatch[1].trim() : trimmed
}

/** Decomposição "burra": trata o tópico inteiro como 1 subtópico de 45min. */
export function fallbackDecompose(topicoNome: string): TopicoDecomposed {
  const nomeCurto = topicoNome.slice(0, 60)
  return {
    nome_curto: nomeCurto,
    conceitos_pai: [nomeCurto],
    subtopicos: [{
      nome: topicoNome.slice(0, 60),
      duracao_min: 45,
      conceito_pai: nomeCurto,
    }],
    referencias_legais: [],
  }
}
