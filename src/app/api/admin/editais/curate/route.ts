import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncEdital } from '@/lib/cronograma-v2/sync-edital'
import { editalGraphQLSchema } from '@/lib/cronograma-v2/schemas'

export async function POST(req: NextRequest) {
  // 1. Auth
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const accessToken = authHeader.slice(7)

  // 2. Parse + validate body
  const body = await req.json().catch(() => null)
  const parsed = editalGraphQLSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Payload inválido', issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const edital = parsed.data

  // 3. Admin client (service role)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Service role não configurada' }, { status: 500 })
  }
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  // 4. Validate user JWT
  const { data: userData, error: userErr } = await adminClient.auth.getUser(accessToken)
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  }
  const userId = userData.user.id

  // 5. Role check — admin or moderator only
  const { data: roleData } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  if (roleData?.role !== 'admin' && roleData?.role !== 'moderator') {
    return NextResponse.json({ error: 'Acesso negado (admin only)' }, { status: 403 })
  }

  // 6. Stream NDJSON progress
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'))

      try {
        send({
          type: 'progress',
          stage: 'sync',
          message: `Iniciando IA (${edital.topicos.length} tópicos)...`,
          done: 0,
          total: edital.topicos.length,
        })

        const result = await syncEdital(adminClient, edital, {
          skipAI: false,
          forceRefresh: true,
          onProgress: (done, total) =>
            send({
              type: 'progress',
              stage: 'sync',
              message: `Decompondo tópicos (${done}/${total})...`,
              done,
              total,
            }),
        })

        // syncEdital já upsertou em edital_cache; status default = 'draft' (Task 1 migration)
        send({
          type: 'done',
          cargo_id: edital.cargo_id,
          edital_id: edital.edital_id,
          decomposed_topicos: result.decomposed_topicos,
          fallback_topicos: result.fallback_topicos,
          total_topicos: result.total_topicos,
          cache_hit: result.cacheHit,
          status: 'draft',
        })
        controller.close()
      } catch (err) {
        send({
          type: 'error',
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
      'X-Accel-Buffering': 'no',
    },
  })
}
