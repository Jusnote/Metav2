import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { setupPayloadSchema } from '@/lib/cronograma-v2/setup-payload'
import { syncEdital } from '@/lib/cronograma-v2/sync-edital'

export async function POST(req: NextRequest) {
  // 1. Auth
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const accessToken = authHeader.slice(7)

  // 2. Parse body
  const body = await req.json().catch(() => null)
  const parsed = setupPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Payload inválido', issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const payload = parsed.data

  // 3. Admin client (service role pra criar plano)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Service role não configurada' }, { status: 500 })
  }
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  // 4. Valida JWT do user
  const { data: userData, error: userErr } = await adminClient.auth.getUser(accessToken)
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  }
  const userId = userData.user.id

  // 5. Feature flag check
  const { data: flagEnabled } = await adminClient
    .rpc('is_feature_enabled', { p_flag_name: 'cronograma_v2_enabled', p_user_id: userId })

  if (flagEnabled !== true) {
    return NextResponse.json(
      { error: 'Cronograma V2 não disponível pro seu usuário ainda', feature_flag: false },
      { status: 403 },
    )
  }

  // 6. Rate limit defensivo (max 5 planos/dia/user)
  const today = new Date().toISOString().slice(0, 10)
  const { count: planosHoje } = await adminClient
    .from('planos_estudo')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', `${today}T00:00:00Z`)

  if ((planosHoje ?? 0) >= 5) {
    return NextResponse.json(
      { error: 'Limite diário de 5 planos atingido' },
      { status: 429 },
    )
  }

  try {
    // 7. Sync edital (opcional — se payload veio)
    let editalDecomposicao = null
    if (payload.edital_payload) {
      const syncResult = await syncEdital(adminClient, payload.edital_payload, { forceRefresh: false })
      editalDecomposicao = syncResult.decomposicao
    }

    // 8. Chama RPC criar_plano_completo
    const cargoSnapshot = {
      nome: payload.cargo_nome,
      cargo_id: payload.cargo_id,
      ...(payload.edital_payload && {
        edital_id: payload.edital_payload.edital_id,
        qtd_disciplinas: payload.edital_payload.disciplinas.length,
      }),
    }

    const { data: rpcResult, error: rpcErr } = await adminClient.rpc('criar_plano_completo', {
      p_user_id: userId,
      p_cargo_id: payload.cargo_id,
      p_cargo_snapshot: cargoSnapshot,
      p_data_inicio: payload.data_inicio,
      p_data_prova: payload.data_prova,
      p_weekday_minutes: payload.weekday_minutes,
      p_weekend_minutes: payload.weekend_minutes,
      p_block_duration_minutes: payload.block_duration_minutes,
      p_mix_ratio: payload.mix_ratio,
      p_simulados_freq: payload.simulados_freq,
      p_tem_redacao: payload.tem_redacao,
      p_tipo_material: payload.tipo_material,
      p_horario_preferido: payload.horario_preferido,
      p_disciplinas: payload.disciplinas,
      p_template_id: payload.template_id ?? null,
    })

    if (rpcErr) {
      console.error('[criar-plano] RPC error:', rpcErr)
      return NextResponse.json(
        { error: rpcErr.message, code: rpcErr.code, details: rpcErr.details },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ...rpcResult,
      edital_synced: !!editalDecomposicao,
      decomposicao_summary: editalDecomposicao?.metadata,
    }, { status: 200 })

  } catch (err) {
    console.error('[criar-plano] unexpected:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 },
    )
  }
}
