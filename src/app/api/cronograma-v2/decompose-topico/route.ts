import { NextResponse, type NextRequest } from 'next/server'
import { decomposeTopico } from '@/lib/cronograma-v2/topico-decomposer'
import { z } from 'zod'

const requestSchema = z.object({
  topico_nome: z.string().min(3).max(2000),
  skip_ai: z.boolean().optional().default(false),
})

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido', issues: parsed.error.issues }, { status: 400 })
  }

  try {
    const r = await decomposeTopico(parsed.data.topico_nome, { skipAI: parsed.data.skip_ai })
    return NextResponse.json(r, { status: 200 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    )
  }
}
