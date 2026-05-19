// /v3/admin/concursos/[id]/resumos/[blocoId] — editor Plate de um resumo.
// Server Component carrega contexto + resumo; delega edição ao PlateEditorResumo (client).

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Value } from 'platejs'

import { PlateEditorResumo } from '@/v3/components/resumos/PlateEditorResumo'
import { RoteiroSidebar } from '@/v3/components/resumos/RoteiroSidebar'
import { StatusResumoPill } from '@/v3/components/resumos/StatusResumoPill'
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

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header do bloco */}
      <header
        className="px-6 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border-default)' }}
      >
        <div className="text-xs mb-1" style={{ color: 'var(--fg-secondary)' }}>
          <Link href="/v3/admin/concursos" className="hover:underline">
            Concursos
          </Link>{' '}
          ›{' '}
          <Link
            href={`/v3/admin/concursos/${id}/revisar`}
            className="hover:underline"
          >
            {contexto.concursoNome}
          </Link>{' '}
          ›{' '}
          <Link
            href={`/v3/admin/concursos/${id}/resumos`}
            className="hover:underline"
          >
            Resumos
          </Link>{' '}
          ›{' '}
          <span style={{ color: 'var(--fg-tertiary)' }}>
            Bloco {contexto.bloco.ordem}
          </span>
        </div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1
            className="text-base font-medium"
            style={{ color: 'var(--fg-primary)' }}
          >
            Bloco {contexto.bloco.ordem}: {contexto.bloco.nome}
          </h1>
          <StatusResumoPill
            status={
              statusInicial === 'nao-existe' ? 'sem-resumo' : statusInicial
            }
          />
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--fg-tertiary)' }}>
          Aula {String(contexto.aula.ordem).padStart(2, '0')} —{' '}
          {contexto.aula.nome} · {contexto.aula.horas_sugeridas}h
          {contexto.bloco.horas_sugeridas !== null && (
            <> · bloco {contexto.bloco.horas_sugeridas}h</>
          )}
        </p>
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0">
          <PlateEditorResumo
            subtopicoId={blocoId}
            conteudoInicial={conteudoInicial}
            statusInicial={statusInicial}
          />
        </div>
        <RoteiroSidebar contexto={contexto} />
      </div>
    </div>
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
