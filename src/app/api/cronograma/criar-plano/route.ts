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
    const first = parsed.error.issues[0]
    const detail = first
      ? `${first.path.join('.') || '(root)'}: ${first.message}`
      : 'sem detalhes'
    console.error('[criar-plano] Payload inválido:', parsed.error.issues)
    console.error('[criar-plano] body recebido:', JSON.stringify(body).slice(0, 800))
    return NextResponse.json(
      { error: `Payload inválido — ${detail}`, issues: parsed.error.issues },
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
    // 6.5. Arquiva plano ativo anterior (constraint: 1 plano ativo por user).
    // Falha do arquivamento não bloqueia — RPC vai gritar com constraint se houver.
    const { data: prevAtivos } = await adminClient
      .from('planos_estudo')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'ativo')
    if (prevAtivos && prevAtivos.length > 0) {
      const { error: archiveErr } = await adminClient
        .from('planos_estudo')
        .update({ status: 'arquivado' })
        .eq('user_id', userId)
        .eq('status', 'ativo')
      if (archiveErr) {
        console.warn('[criar-plano] falha ao arquivar planos ativos anteriores:', archiveErr)
      } else {
        console.log(`[criar-plano] ${prevAtivos.length} plano(s) ativo(s) arquivado(s) antes da criação`)
      }
    }

    // 7. Sync edital — best-effort com timeout duro (10s).
    // syncEdital decompõe tópicos longos via Claude Haiku (p-limit 3) e
    // pode levar minutos pra editais grandes. Aqui só queremos o que
    // estiver em cache; se demora, segue sem ele. Cache é otimização,
    // não bloqueante pra criar o plano.
    let editalDecomposicao = null
    if (payload.edital_payload) {
      try {
        editalDecomposicao = await Promise.race([
          syncEdital(adminClient, payload.edital_payload, { skipAI: true })
            .then(r => r.decomposicao),
          new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), 10_000),
          ),
        ])
      } catch (syncErr) {
        console.warn('[criar-plano] syncEdital falhou, seguindo sem decomposição:', syncErr)
      }
    }

    // 7.5. Mapeia disciplina_id da API (INT) → UUID local.
    // A RPC criar_plano_completo faz `(disciplina_id)::UUID`, então IDs
    // numéricos vindos do GraphQL precisam ser upserted em `disciplinas` local
    // (uma cópia por user, idempotente por nome). Pré-requisito: edital_payload
    // veio com a lista de disciplinas (id + nome).
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const mappedDisciplinas = await Promise.all(
      payload.disciplinas.map(async (d) => {
        const idStr = String(d.disciplina_id)
        if (UUID_RE.test(idStr)) {
          return d  // já é UUID local, passa direto
        }

        // É ID da API. Acha o nome em edital_payload.
        const apiIdNum = Number(idStr)
        const apiDisc = payload.edital_payload?.disciplinas.find(
          (x) => Number(x.id) === apiIdNum,
        )
        if (!apiDisc) {
          throw new Error(
            `Disciplina id=${idStr} não é UUID e não consta em edital_payload — ` +
            `wizard precisa enviar edital_payload pra que mapping funcione.`,
          )
        }

        // Upsert local: existe row com mesmo nome pro user?
        const { data: existing } = await adminClient
          .from('disciplinas')
          .select('id')
          .eq('user_id', userId)
          .eq('nome', apiDisc.nome)
          .maybeSingle()

        let localUuid: string
        if (existing?.id) {
          localUuid = existing.id
        } else {
          // Cria nova row local. Schema mínimo: id, user_id, nome (created_at default).
          const { data: created, error: createErr } = await adminClient
            .from('disciplinas')
            .insert({ user_id: userId, nome: apiDisc.nome })
            .select('id')
            .single()
          if (createErr || !created) {
            throw new Error(`Falha ao criar disciplina local "${apiDisc.nome}": ${createErr?.message}`)
          }
          localUuid = created.id
        }

        return { ...d, disciplina_id: localUuid }
      }),
    )

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
      p_disciplinas: mappedDisciplinas,
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
