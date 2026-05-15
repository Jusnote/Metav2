import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { updateDecomposicao } from '@/lib/cronograma-v2/edital-cache'
import { editalDecomposicaoSchema } from '@/lib/cronograma-v2/schemas'
import { z } from 'zod'

const bodySchema = z.object({
  cargo_id: z.number().int().positive(),
  edital_id: z.number().int().positive(),
  decomposicao: editalDecomposicaoSchema,
})

export async function POST(req: NextRequest) {
  // 1. Auth
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const accessToken = authHeader.slice(7)

  // 2. Parse + validate body (including deep Zod validation of decomposicao)
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Payload inválido', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  // 3. Admin client
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

  // 6. Update decomposicao
  try {
    await updateDecomposicao(
      adminClient,
      parsed.data.cargo_id,
      parsed.data.edital_id,
      parsed.data.decomposicao,
    )
    return NextResponse.json({
      ok: true,
      cargo_id: parsed.data.cargo_id,
      edital_id: parsed.data.edital_id,
      updated_at: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao atualizar' },
      { status: 500 },
    )
  }
}
