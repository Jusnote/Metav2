import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { setupPayloadSchema } from '@/lib/cronograma-v2/setup-payload'
import { getPublishedDecomposicao } from '@/lib/cronograma-v2/edital-cache'

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

        // 7b. Lê cache curado (published) — IA foi removida do hot path (Sub-plan 5, Task 11)
        let editalDecomposicao: unknown = null
        if (payload.edital_payload) {
          send({
            type: 'progress',
            stage: 'sync',
            message: 'Lendo cache curado...',
            done: 1,
            total: 1,
          })

          const cached = await getPublishedDecomposicao(
            adminClient,
            payload.edital_payload.cargo_id,
            payload.edital_payload.edital_id,
          )
          if (!cached) {
            send({
              type: 'error',
              status: 400,
              message: `Cargo "${payload.cargo_nome}" ainda não foi curado pelo admin. Solicite a curadoria antes de criar um plano.`,
            })
            controller.close()
            return
          }
          editalDecomposicao = cached.decomposicao
        }

        // 7c. Mapeia disciplina_id API → UUID local + popula topicos/subtopicos
        // Sem isso, _v2_carrega_contexto retorna 0 subtopicos e gerar_cronograma_v2
        // sai com status 'no_subtopics' → plano criado com 0 items.
        send({ type: 'progress', stage: 'map', message: 'Preparando disciplinas...' })
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

        // Mapeia disciplinas + guarda apiId pra hidratação de topicos abaixo
        type MappedDisc = (typeof payload.disciplinas)[number] & { _apiDiscId?: number }
        const mappedDisciplinas: MappedDisc[] = await Promise.all(
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
            const localUuid = existing?.id ?? (await (async () => {
              const { data: created, error: createErr } = await adminClient
                .from('disciplinas')
                .insert({ user_id: userId, nome: apiDisc.nome })
                .select('id')
                .single()
              if (createErr || !created) {
                throw new Error(`Falha ao criar disciplina local "${apiDisc.nome}": ${createErr?.message}`)
              }
              return created.id as string
            })())
            return { ...d, disciplina_id: localUuid, _apiDiscId: apiIdNum }
          }),
        )

        // 7d. Hidrata topicos + subtopicos locais a partir do edital_payload + decomposicao
        if (payload.edital_payload) {
          send({ type: 'progress', stage: 'map', message: 'Hidratando tópicos do edital...' })
          const decomp = (editalDecomposicao as { by_topico?: Record<string, {
            subtopicos: Array<{ nome: string; duracao_min: number; conceito_pai?: string }>
          }> } | null)?.by_topico ?? {}

          for (const md of mappedDisciplinas) {
            if (!md._apiDiscId) continue  // disciplina já era local

            const apiTopicos = payload.edital_payload.topicos.filter(
              (t) => Number(t.disciplina_id) === md._apiDiscId,
            )
            if (apiTopicos.length === 0) continue

            for (const apiTopico of apiTopicos) {
              // Upsert topico local idempotente por (user_id, disciplina_id, nome)
              const { data: existingTopico } = await adminClient
                .from('topicos')
                .select('id')
                .eq('user_id', userId)
                .eq('disciplina_id', md.disciplina_id)
                .eq('nome', apiTopico.nome)
                .maybeSingle()

              const topicoLocalId = existingTopico?.id ?? (await (async () => {
                const { data: created, error } = await adminClient
                  .from('topicos')
                  .insert({
                    user_id: userId,
                    disciplina_id: md.disciplina_id,
                    nome: apiTopico.nome,
                  })
                  .select('id')
                  .single()
                if (error || !created) {
                  console.warn('[criar-plano] falha ao criar topico', apiTopico.nome, error)
                  return null
                }
                return created.id as string
              })())
              if (!topicoLocalId) continue

              // Subtopicos vindos da decomposição IA, ou fallback: 1 subtopico = nome do topico
              const apiTopicoIdStr = String(apiTopico.id)
              const decomposed = decomp[apiTopicoIdStr]
              const subtopicos = decomposed?.subtopicos.length
                ? decomposed.subtopicos.map((s) => ({
                    nome: s.nome.slice(0, 200),
                    estimated_duration_minutes: s.duracao_min ?? 45,
                  }))
                : [{ nome: apiTopico.nome.slice(0, 200), estimated_duration_minutes: 45 }]

              // Lê subtopicos existentes desse topico pro user — evita N selects
              const { data: existingSubs } = await adminClient
                .from('subtopicos')
                .select('nome')
                .eq('user_id', userId)
                .eq('topico_id', topicoLocalId)
              const existingNomes = new Set((existingSubs ?? []).map((s) => s.nome))

              const toInsert = subtopicos
                .filter((s) => !existingNomes.has(s.nome))
                .map((s) => ({
                  user_id: userId,
                  topico_id: topicoLocalId,
                  nome: s.nome,
                  estimated_duration_minutes: s.estimated_duration_minutes,
                }))

              if (toInsert.length > 0) {
                const { error: subErr } = await adminClient
                  .from('subtopicos')
                  .insert(toInsert)
                if (subErr) {
                  console.warn(`[criar-plano] falha ao inserir ${toInsert.length} subtopicos:`, subErr)
                }
              }
            }
          }
        }

        // Remove o campo helper antes de enviar pra RPC (não faz parte do schema)
        const cleanDisciplinas = mappedDisciplinas.map(({ _apiDiscId, ...rest }) => rest)

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
          p_disciplinas: cleanDisciplinas,
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
