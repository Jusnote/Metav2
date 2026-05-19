// /v3/cursos/[id]/resumos/[blocoId] — leitor de resumo (aluno, read-only).
// 404 se resumo não está publicado.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Value } from 'platejs'

import { ResumoLeitor } from '@/v3/components/resumos/ResumoLeitor'
import { carregarContextoBloco } from '@/v3/lib/resumos/arvore-resumos'
import { createServerClient } from '@/v3/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string; blocoId: string }>
}

export default async function ResumoLeitorPage({ params }: Props) {
  const { id, blocoId } = await params

  const contexto = await carregarContextoBloco(id, blocoId)
  if (!contexto) notFound()

  // Para o aluno: só interessa o resumo se estiver publicado
  const supabase = createServerClient()
  const { data: resumo } = await supabase
    .from('resumos')
    .select('conteudo_plate, status, publicado_em')
    .eq('subtopico_id', blocoId)
    .maybeSingle()

  const publicado = resumo?.status === 'publicado'

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <header
        className="px-6 py-4 border-b"
        style={{
          borderColor: 'var(--border-default)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div className="text-xs mb-1" style={{ color: 'var(--fg-secondary)' }}>
          <Link
            href={`/v3/cursos/${id}`}
            className="hover:underline"
          >
            Cronograma
          </Link>{' '}
          ›{' '}
          <span style={{ color: 'var(--fg-tertiary)' }}>
            Aula {String(contexto.aula.ordem).padStart(2, '0')} · Bloco{' '}
            {contexto.bloco.ordem}
          </span>
        </div>
        <h1
          className="text-lg font-medium"
          style={{ color: 'var(--fg-primary)' }}
        >
          Bloco {contexto.bloco.ordem}: {contexto.bloco.nome}
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--fg-tertiary)' }}>
          {contexto.disciplina.nome} · Aula{' '}
          {String(contexto.aula.ordem).padStart(2, '0')}: {contexto.aula.nome}
        </p>
      </header>

      <main className="flex-1 flex">
        <div className="flex-1 min-w-0">
          {publicado && resumo ? (
            <ResumoLeitor conteudo={extrair(resumo.conteudo_plate)} />
          ) : (
            <EstadoVazio />
          )}
        </div>
        {publicado && resumo && (
          <SidebarLeitor
            cronogramaHref={`/v3/cursos/${id}`}
            publicadoEm={resumo.publicado_em}
          />
        )}
      </main>
    </div>
  )
}

function extrair(conteudo: unknown): Value {
  if (Array.isArray(conteudo) && conteudo.length > 0) {
    return conteudo as unknown as Value
  }
  return [{ type: 'p', children: [{ text: '' }] }]
}

function EstadoVazio() {
  return (
    <div className="flex items-center justify-center h-full p-12">
      <div className="text-center max-w-md">
        <h2
          className="text-base font-medium mb-2"
          style={{ color: 'var(--fg-primary)' }}
        >
          Resumo ainda não publicado
        </h2>
        <p className="text-sm" style={{ color: 'var(--fg-secondary)' }}>
          O conteúdo deste bloco está sendo preparado. Volte em breve.
        </p>
      </div>
    </div>
  )
}

function SidebarLeitor({
  cronogramaHref,
  publicadoEm,
}: {
  cronogramaHref: string
  publicadoEm: string | null
}) {
  return (
    <aside
      className="w-64 flex-shrink-0 border-l p-4"
      style={{
        borderColor: 'var(--border-default)',
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      <Link
        href={cronogramaHref}
        className="text-xs inline-flex items-center gap-1 hover:underline"
        style={{ color: 'var(--fg-secondary)' }}
      >
        ← Voltar ao cronograma
      </Link>
      {publicadoEm && (
        <p
          className="text-[11px] mt-4"
          style={{ color: 'var(--fg-tertiary)' }}
        >
          Publicado em{' '}
          {new Date(publicadoEm).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </p>
      )}
    </aside>
  )
}
