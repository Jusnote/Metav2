// Cálculo de custo estimado e logger de eventos de chamada IA
// Ref: public/PLANO COACHING/plano/05-prompts-ia.md (seção "Custo estimado")

import { createServerClient } from '@/v3/lib/supabase/server'

// Preços públicos Anthropic claude-sonnet-4-5 (USD por 1M tokens) — set/2025
// Input: $3 / 1M | Output: $15 / 1M
// (Atualizar se Anthropic publicar nova tabela)
const PRECO_INPUT_USD_POR_MTOKEN = 3
const PRECO_OUTPUT_USD_POR_MTOKEN = 15

// Câmbio USD→BRL conservador para exibição em tela
const CAMBIO_USD_BRL = 5.5

export interface CustoChamada {
  input_tokens: number
  output_tokens: number
  cost_usd: number
  cost_brl: number
}

export function calcularCusto(input_tokens: number, output_tokens: number): CustoChamada {
  const cost_usd =
    (input_tokens / 1_000_000) * PRECO_INPUT_USD_POR_MTOKEN +
    (output_tokens / 1_000_000) * PRECO_OUTPUT_USD_POR_MTOKEN

  return {
    input_tokens,
    output_tokens,
    cost_usd: Number(cost_usd.toFixed(6)),
    cost_brl: Number((cost_usd * CAMBIO_USD_BRL).toFixed(4)),
  }
}

export interface IaCallEventPayload {
  etapa: 'dividir' | 'estimar' | 'estruturar'
  model: string
  concurso_id?: string
  disciplina?: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  cost_brl: number
  duracao_ms: number
  status: 'ok' | 'erro'
  erro?: string
}

/**
 * Loga evento `ia_call` em coaching.eventos
 * Em caso de falha de persistência apenas warn — não interrompe pipeline
 */
export async function registrarEventoIaCall(payload: IaCallEventPayload): Promise<void> {
  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('eventos').insert({
      tipo: 'ia_call',
      payload: payload as unknown as Record<string, unknown>,
    })
    if (error) {
      console.warn('[v3/custo] Falha ao registrar evento ia_call:', error.message)
    }
  } catch (e) {
    console.warn('[v3/custo] Exceção ao registrar evento ia_call:', e)
  }
}
