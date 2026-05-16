// /v3/admin/concursos/[id]/revisar — tela MAIS importante do admin
// Carrega árvore completa server-side, delega edição ao ArvoreEditor (client)

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArvoreEditor } from '@/v3/components/admin/ArvoreEditor'
import { AlertasIaModal } from '@/v3/components/admin/AlertasIaModal'
import { StatusConcursoPill } from '@/v3/components/admin/StatusConcursoPill'
import { carregarConcursoComArvore, carregarAlertasIa } from '@/v3/lib/arvore-edital'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function RevisarConcursoPage({ params }: Props) {
  const { id } = await params
  const concurso = await carregarConcursoComArvore(id)
  if (!concurso) notFound()

  const alertas = await carregarAlertasIa(id)
  const totalDisciplinas = concurso.disciplinas.length
  const totalTopicos = concurso.disciplinas.reduce(
    (s, d) => s + d.blocos.reduce((s2, b) => s2 + b.topicos.length, 0),
    0,
  )

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header
        className="px-6 py-3 border-b"
        style={{ borderColor: 'var(--border-default)' }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs mb-1" style={{ color: 'var(--fg-secondary)' }}>
              <Link href="/v3/admin/concursos" className="hover:underline">
                Concursos
              </Link>{' '}
              ›{' '}
              <span style={{ color: 'var(--fg-tertiary)' }}>{concurso.nome}</span>
            </div>
            <div className="flex items-center gap-3">
              <h1
                className="text-lg font-medium"
                style={{ color: 'var(--fg-primary)' }}
              >
                Revisar estrutura
              </h1>
              <StatusConcursoPill status={concurso.status} />
            </div>
            <div
              className="text-xs mt-1"
              style={{ color: 'var(--fg-tertiary)' }}
            >
              {concurso.banca} · {concurso.cargo} · {totalDisciplinas} disciplinas ·{' '}
              {totalTopicos} tópicos
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AlertasIaModal alertas={alertas} />
          </div>
        </div>
      </header>

      {/* Árvore editor */}
      {totalDisciplinas === 0 ? (
        <EmptyArvore />
      ) : (
        <ArvoreEditor concurso={concurso} />
      )}
    </div>
  )
}

function EmptyArvore() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md">
        <h2
          className="text-base font-medium mb-2"
          style={{ color: 'var(--fg-primary)' }}
        >
          Nenhuma disciplina processada
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--fg-secondary)' }}>
          O parsing pode ter falhado, ou o edital ainda não foi enviado.
        </p>
        <Link
          href="/v3/admin/concursos/novo"
          className="inline-block px-3 py-2 rounded-md text-sm"
          style={{
            backgroundColor: 'rgba(127,119,221,0.2)',
            border: '1px solid rgba(127,119,221,0.4)',
            color: 'var(--color-revisao-text)',
          }}
        >
          Reprocessar
        </Link>
      </div>
    </div>
  )
}
