import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { setupPayloadSchema } from '@/lib/cronograma-v2/setup-payload'
import { syncEdital } from '@/lib/cronograma-v2/sync-edital'

// Stream NDJSON eventos pro client (progress + done + error)
type StreamEvent =
  | { type: 'progress'; stage: 'sync' | 'archive' | 'map' | 'rpc'; message: string; done?: number; total?: number }
  | { type: 'done'; plano_id: string; items_created: number; overflow_weeks: number; warnings: unknown[]; edital_synced: boolean; decomposicao_summary?: unknown }
  | { type: 'error'; status: number; message: string; details?: unknown }

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

  // 7. Stream NDJSON com progress + done/error
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      }

      try {
        // 7a. Arquiva planos ativos anteriores
        send({ type: 'progress', stage: 'archive', message: 'Arquivando planos anteriores...' })
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
            console.warn('[criar-plano] falha ao arquivar:', archiveErr)
          }
        }

        // 7b. Sync edital com IA — bloqueia, mas com progresso visível
        let editalDecomposicao: unknown = null
        if (payload.edital_payload) {
          const totalTopicos = payload.edital_payload.topicos.length
          send({
            type: 'progress',
            stage: 'sync',
            message: `Sincronizando edital com IA (${totalTopicos} tópicos)...`,
            done: 0,
            total: totalTopicos,
          })

          try {
            const result = await syncEdital(adminClient, payload.edital_payload, {
              skipAI: false,
              onProgress: (done, total) => {
                send({
                  type: 'progress',
                  stage: 'sync',
                  message: `Decompondo tópicos (${done}/${total})...`,
                  done,
                  total,
                })
              },
            })
            editalDecomposicao = result.decomposicao
            send({
              type: 'progress',
              stage: 'sync',
              message: result.cacheHit
                ? 'Edital encontrado em cache (instantâneo)'
                : `Decomposição concluída — ${result.decomposed_topicos} via IA, ${result.fallback_topicos} fallback`,
              done: totalTopicos,
              total: totalTopicos,
            })
          } catch (syncErr) {
            console.warn('[criar-plano] syncEdital falhou, segue sem decomposição:', syncErr)
            send({
              type: 'progress',
              stage: 'sync',
              message: 'IA indisponível — usando tópicos brutos do edital',
            })
          }
        }

        // 7c. Mapeia disciplina_id API → UUID local
        send({ type: 'progress', stage: 'map', message: 'Preparando disciplinas...' })
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        const mappedDisciplinas = await Promise.all(
          payload.disciplinas.map(async (d) => {
            const idStr = String(d.disciplina_id)
            if (UUID_RE.test(idStr)) return d
            const apiIdNum = Number(idStr)
            const apiDisc = payload.edital_payload?.disciplinas.find(
              (x) => Number(x.id) === apiIdNum,
            )
            if (!apiDisc) {
              throw new Error(
                `Disciplina id=${idStr} não é UUID e não consta em edital_payload`,
              )
            }
            const { data: existing } = await adminClient
              .from('disciplinas')
              .select('id')
              .eq('user_id', userId)
              .eq('nome', apiDisc.nome)
              .maybeSingle()
            if (existing?.id) {
              return { ...d, disciplina_id: existing.id }
            }
            const { data: created, error: createErr } = await adminClient
              .from('disciplinas')
              .insert({ user_id: userId, nome: apiDisc.nome })
              .select('id')
              .single()
            if (createErr || !created) {
              throw new Error(`Falha ao criar disciplina local "${apiDisc.nome}": ${createErr?.message}`)
            }
            return { ...d, disciplina_id: created.id }
          }),
        )

        // 7d. Chama RPC criar_plano_completo
        send({ type: 'progress', stage: 'rpc', message: 'Criando plano e distribuindo atividades...' })
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
          send({
            type: 'error',
            status: 500,
            message: rpcErr.message,
            details: { code: rpcErr.code, details: rpcErr.details },
          })
          controller.close()
          return
        }

        const result = rpcResult as {
          plano_id: string
          items_created: number
          overflow_weeks: number
          warnings: unknown[]
        }

        send({
          type: 'done',
          plano_id: result.plano_id,
          items_created: result.items_created,
          overflow_weeks: result.overflow_weeks,
          warnings: result.warnings ?? [],
          edital_synced: !!editalDecomposicao,
          decomposicao_summary: (editalDecomposicao as { metadata?: unknown })?.metadata,
        })
        controller.close()
      } catch (err) {
        console.error('[criar-plano] unexpected:', err)
        send({
          type: 'error',
          status: 500,
          message: err instanceof Error ? err.message : 'Erro desconhecido',
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
      'X-Accel-Buffering': 'no',  // hint pra proxies não bufferizarem
    },
  })
}
