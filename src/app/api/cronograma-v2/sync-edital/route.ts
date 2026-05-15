import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncEdital } from '@/lib/cronograma-v2/sync-edital'
import { editalGraphQLSchema } from '@/lib/cronograma-v2/schemas'
import { z } from 'zod'

const requestSchema = z.object({
  edital_payload: editalGraphQLSchema,
  force_refresh: z.boolean().optional().default(false),
})

export async function POST(req: NextRequest) {
  // Auth header (Bearer JWT from supabase session)
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const accessToken = authHeader.slice(7)

  const body = await req.json().catch(() => null)
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido', issues: parsed.error.issues }, { status: 400 })
  }

  // Cliente autenticado como o user (RLS aplica em edital_cache — mas a tabela é pública pra read; gravação só service_role)
  // Pra upsert no cache precisamos do service role.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Service role não configurada' }, { status: 500 })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  // Validar o JWT do user antes de prosseguir (defesa em profundidade)
  const { data: userData, error: userErr } = await adminClient.auth.getUser(accessToken)
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  }

  try {
    const result = await syncEdital(adminClient, parsed.data.edital_payload, {
      forceRefresh: parsed.data.force_refresh,
    })
    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    console.error('[sync-edital] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 },
    )
  }
}
