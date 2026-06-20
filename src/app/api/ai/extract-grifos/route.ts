// Rota on-demand do extrator de grifo ("comentários do professor").
//
// Fluxo: valida body → cache-check (service-role, schema public) → hit devolve;
// miss chama Opus (prompt validado) via a lib pura `extractGrifos` (que valida o
// casamento literal de cada trecho), salva no cache e devolve.
//
// Segredos só via process.env — nunca hardcodar/imprimir.

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import {
  extractGrifos,
} from '@/server/grifos/extract-grifos';
import {
  GRIFO_MODEL,
  PROMPT_VERSION,
  type GrifoQuestion,
  type GrifoAlternativa,
} from '@/server/grifos/grifos.types';

interface ExtractGrifosBody {
  questaoId?: number;
  enunciado?: string;
  alternativas?: GrifoAlternativa[];
  correta?: string;
  banca?: string;
  ano?: string | number;
  tipoQuestao?: string;
}

export async function POST(req: NextRequest) {
  // 1. Body
  const body = (await req.json().catch(() => null)) as ExtractGrifosBody | null;
  if (!body) {
    return NextResponse.json({ error: 'Body inválido (JSON esperado)' }, { status: 400 });
  }

  const { questaoId, enunciado, alternativas, correta, banca, ano, tipoQuestao } = body;

  // 2. Validação dos campos obrigatórios
  if (
    typeof questaoId !== 'number' ||
    !Number.isFinite(questaoId) ||
    typeof enunciado !== 'string' ||
    enunciado.length === 0 ||
    !Array.isArray(alternativas) ||
    typeof correta !== 'string' ||
    correta.length === 0
  ) {
    return NextResponse.json(
      { error: 'Campos obrigatórios: questaoId (number), enunciado (string), alternativas (array), correta (string)' },
      { status: 400 },
    );
  }

  // 3. Segredos
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing ANTHROPIC_API_KEY.' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Service role não configurada' }, { status: 500 });
  }

  // 4. Service-role client no schema PUBLIC (não o createServerClient que é coaching).
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 5. Cache-check
  const { data: cached } = await supabase
    .from('question_grifos_cache')
    .select('grifos,tipo_estrutura')
    .eq('question_id', questaoId)
    .eq('model', GRIFO_MODEL)
    .eq('prompt_version', PROMPT_VERSION)
    .maybeSingle();

  if (cached) {
    return NextResponse.json({
      grifos: cached.grifos,
      tipoEstrutura: cached.tipo_estrutura,
      cached: true,
    });
  }

  // 6. Miss → chama Opus via a lib pura (que valida o casamento literal).
  const question: GrifoQuestion = {
    enunciado,
    alternativas,
    correta,
    banca,
    ano,
    tipoQuestao,
  };

  const anthropic = new Anthropic({ apiKey });
  const callOpus = async (system: string, userMsg: string): Promise<string> => {
    const response = await anthropic.messages.create({
      model: GRIFO_MODEL,
      max_tokens: 4000,
      system,
      messages: [{ role: 'user', content: userMsg }],
    });
    return response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('');
  };

  let result;
  try {
    result = await extractGrifos(question, callOpus);
  } catch (err) {
    // Não vaza chave/segredo — mensagem curta no corpo; detalhe só no log do servidor.
    console.error('[extract-grifos] falha no Opus/parse:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Falha ao extrair grifos.' }, { status: 502 });
  }

  // 7. Salva no cache (ignora corrida de unique-violation).
  const { error: insertErr } = await supabase.from('question_grifos_cache').insert({
    question_id: questaoId,
    model: GRIFO_MODEL,
    prompt_version: PROMPT_VERSION,
    tipo_estrutura: result.tipoEstrutura,
    grifos: result.grifos,
  });
  // 23505 = unique_violation (outra request gravou primeiro) → ok, segue.
  if (insertErr && insertErr.code !== '23505') {
    console.error('[extract-grifos] falha ao gravar cache:', insertErr.message);
  }

  return NextResponse.json({
    grifos: result.grifos,
    tipoEstrutura: result.tipoEstrutura,
    cached: false,
  });
}
