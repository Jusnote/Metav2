// /v3/admin/concursos/[id]/resumos — lista de blocos com status de resumo.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ListaBlocosResumos } from '@/v3/components/resumos/ListaBlocosResumos'
import { carregarConcursoComResumos } from '@/v3/lib/resumos/arvore-resumos'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ResumosListPage({ params }: Props) {
  const { id } = await params
  const concurso = await carregarConcursoComResumos(id)
  if (!concurso) notFound()

  const { stats } = concurso

  return (
    <div className="flex flex-col min-h-screen">
      <header
        className="px-6 py-4 border-b"
        style={{ borderColor: 'var(--border-default)' }}
      >
        <div className="text-xs mb-1" style={{ color: 'var(--fg-secondary)' }}>
          <Link href="/v3/admin/concursos" className="hover:underline">
            Concursos
          </Link>{' '}
          ›{' '}
          <Link
            href={`/v3/admin/concursos/${concurso.id}/revisar`}
            className="hover:underline"
          >
            {concurso.nome}
          </Link>{' '}
          › <span style={{ color: 'var(--fg-tertiary)' }}>Resumos</span>
        </div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1
            className="text-lg font-medium"
            style={{ color: 'var(--fg-primary)' }}
          >
            Resumos por bloco
          </h1>
          <p className="text-xs" style={{ color: 'var(--fg-tertiary)' }}>
            {concurso.banca} · {concurso.cargo}
          </p>
        </div>
        <div
          className="text-xs mt-2 flex items-center gap-4"
          style={{ color: 'var(--fg-secondary)' }}
        >
          <span>
            <strong style={{ color: 'var(--fg-primary)' }}>
              {stats.publicados}
            </strong>{' '}
            de {stats.totalBlocos} blocos publicados
          </span>
          <span aria-hidden>·</span>
          <span>{stats.rascunhos} rascunhos</span>
          <span aria-hidden>·</span>
          <span>{stats.semResumo} sem resumo</span>
        </div>
      </header>

      <ListaBlocosResumos concurso={concurso} />
    </div>
  )
}
