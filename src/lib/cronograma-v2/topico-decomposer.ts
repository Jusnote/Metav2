import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { topicoDecomposedSchema, type TopicoDecomposed } from './schemas'

const CLAUDE_HAIKU_MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM_PROMPT = `Você é um especialista em editais de concurso. Dado o texto bruto de um tópico do edital, decomponha em:

1. nome_curto: nome resumido do tópico (3-6 palavras)
2. conceitos_pai: até 3 grupos conceituais (substantivos do tópico)
3. subtopicos: lista com formato "<Conceito-pai> - <Subtópico específico>"
4. referencias_legais: leis/decretos/súmulas extraídos
5. duracao_min: 25 a 75 minutos por subtópico (dependendo da densidade)

Regras estritas:
- Retorne APENAS JSON válido, sem prefácio nem comentários
- nome_curto: 2-60 caracteres
- conceitos_pai: 1 a 5 itens, cada um 1-80 chars
- subtopicos: 1 a 20 itens, nome formato "<Conceito-pai> - <Subtópico>"
- duracao_min: 15-120 minutos
- referencias_legais: array vazio se não houver

Esquema JSON:
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
      nome: topicoNome.slice(0, 200),
      duracao_min: 45,
      conceito_pai: nomeCurto,
    }],
    referencias_legais: [],
  }
}
