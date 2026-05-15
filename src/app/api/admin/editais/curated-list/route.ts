import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { listEditaisCurados } from '@/lib/cronograma-v2/edital-cache'

export async function GET(req: NextRequest) {
  // 1. Auth
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const accessToken = authHeader.slice(7)

  // 2. Admin client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Service role não configurada' }, { status: 500 })
  }
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  // 3. Validate user JWT
  const { data: userData, error: userErr } = await adminClient.auth.getUser(accessToken)
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  }
  const userId = userData.user.id

  // 4. Role check — admin or moderator only
  const { data: roleData } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  if (roleData?.role !== 'admin' && roleData?.role !== 'moderator') {
    return NextResponse.json({ error: 'Acesso negado (admin only)' }, { status: 403 })
  }

  // 5. Return list
  try {
    const items = await listEditaisCurados(adminClient)
    return NextResponse.json({ items })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao listar' },
      { status: 500 },
    )
  }
}
