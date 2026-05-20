// /v3/admin/concursos/[id]/resumos/[blocoId] — editor refinado.
// Server Component: faz fetch dos dados e renderiza EditorAdminClient,
// que cuida da interatividade (Plate, TL;DR, takeaways, drawer, actions).

import { notFound } from 'next/navigation'
import type { Value } from 'platejs'

import { EditorAdminClient } from '@/v3/components/resumos/EditorAdminClient'
import { carregarContextoBloco } from '@/v3/lib/resumos/arvore-resumos'
import {
  getResumoPorBloco,
  type Resumo,
} from '@/app/v3/(admin)/admin/concursos/[id]/resumos/actions'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string; blocoId: string }>
}

export default async function EditorResumoAdminPage({ params }: Props) {
  const { id, blocoId } = await params

  const [contexto, resumo] = await Promise.all([
    carregarContextoBloco(id, blocoId),
    getResumoPorBloco(blocoId),
  ])

  if (!contexto) notFound()

  const statusInicial = resumo
    ? (resumo.status as 'rascunho' | 'publicado')
    : 'nao-existe'
  const conteudoInicial = extrairConteudo(resumo)
  const tldrInicial = resumo?.tldr ?? ''
  const takeawaysInicial = extrairTakeaways(resumo)

  return (
    <EditorAdminClient
      concursoId={id}
      blocoId={blocoId}
      contexto={contexto}
      conteudoInicial={conteudoInicial}
      statusInicial={statusInicial}
      tldrInicial={tldrInicial}
      takeawaysInicial={takeawaysInicial}
    />
  )
}

function extrairConteudo(resumo: Resumo | null): Value | null {
  if (!resumo) return null
  const c = resumo.conteudo_plate
  if (Array.isArray(c) && c.length > 0) {
    return c as unknown as Value
  }
  return null
}

function extrairTakeaways(resumo: Resumo | null): string[] {
  if (!resumo) return []
  const t = resumo.takeaways
  if (Array.isArray(t)) {
    return t.filter((x): x is string => typeof x === 'string')
  }
  return []
}
