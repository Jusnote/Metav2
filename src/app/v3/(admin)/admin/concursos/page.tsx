// /v3/admin/concursos — lista de concursos com status pill e contagem de disciplinas
// Server Component (fetch direto via service role)

import Link from 'next/link'
import { createServerClient } from '@/v3/lib/supabase/server'
import { StatusConcursoPill } from '@/v3/components/admin/StatusConcursoPill'

export const dynamic = 'force-dynamic'

interface ConcursoLinha {
  id: string
  nome: string
  banca: string
  cargo: string
  status: string
  data_prova: string | null
  publicado_em: string | null
  criado_em: string | null
  disciplinas_count: number
}

async function carregarConcursos(): Promise<ConcursoLinha[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('concursos')
    .select('id, nome, banca, cargo, status, data_prova, publicado_em, criado_em, disciplinas(id)')
    .order('criado_em', { ascending: false })

  if (error) {
    console.error('[admin/concursos] Falha ao listar:', error.message)
    return []
  }

  return (data ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    banca: c.banca,
    cargo: c.cargo,
    status: c.status,
    data_prova: c.data_prova,
    publicado_em: c.publicado_em,
    criado_em: c.criado_em,
    disciplinas_count: Array.isArray(c.disciplinas) ? c.disciplinas.length : 0,
  }))
}

export default async function ConcursosPage() {
  const concursos = await carregarConcursos()

  return (
    <div className="px-8 py-6 max-w-6xl mx-auto">
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium" style={{ color: 'var(--fg-primary)' }}>
            Concursos
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-secondary)' }}>
            {concursos.length} {concursos.length === 1 ? 'concurso cadastrado' : 'concursos cadastrados'}
          </p>
        </div>
        <Link
          href="/v3/admin/concursos/novo"
          className="px-3.5 py-2 rounded-md text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'rgba(127,119,221,0.2)',
            border: '1px solid rgba(127,119,221,0.4)',
            color: 'var(--color-revisao-text)',
          }}
        >
          Novo concurso
        </Link>
      </header>

      {concursos.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          className="rounded-lg overflow-hidden border"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: 'var(--bg-surface)' }}>
              <tr style={{ color: 'var(--fg-secondary)' }}>
                <Th>Nome</Th>
                <Th>Banca</Th>
                <Th>Cargo</Th>
                <Th align="center">Disciplinas</Th>
                <Th>Status</Th>
                <Th align="right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {concursos.map((c) => (
                <tr
                  key={c.id}
                  className="border-t transition-colors hover:bg-[var(--bg-surface-2)]"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <Td>
                    <Link
                      href={`/v3/admin/concursos/${c.id}/revisar`}
                      className="font-medium hover:underline"
                      style={{ color: 'var(--fg-primary)' }}
                    >
                      {c.nome}
                    </Link>
                  </Td>
                  <Td>{c.banca}</Td>
                  <Td>{c.cargo}</Td>
                  <Td align="center">
                    <span
                      className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded text-xs font-mono"
                      style={{
                        backgroundColor: 'var(--bg-surface-3)',
                        color: 'var(--fg-primary)',
                      }}
                    >
                      {c.disciplinas_count}
                    </span>
                  </Td>
                  <Td>
                    <StatusConcursoPill status={c.status} />
                  </Td>
                  <Td align="right">
                    <Link
                      href={`/v3/admin/concursos/${c.id}/revisar`}
                      className="text-xs hover:underline"
                      style={{ color: 'var(--color-revisao-text)' }}
                    >
                      Revisar →
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div
      className="rounded-lg p-12 text-center border border-dashed"
      style={{ borderColor: 'var(--border-default)' }}
    >
      <h2 className="text-base font-medium mb-1" style={{ color: 'var(--fg-primary)' }}>
        Nenhum concurso ainda
      </h2>
      <p className="text-sm mb-5" style={{ color: 'var(--fg-secondary)' }}>
        Comece colando o edital do primeiro concurso. A IA estrutura, você revisa e publica.
      </p>
      <Link
        href="/v3/admin/concursos/novo"
        className="inline-block px-4 py-2 rounded-md text-sm font-medium transition-colors"
        style={{
          backgroundColor: 'rgba(127,119,221,0.2)',
          border: '1px solid rgba(127,119,221,0.4)',
          color: 'var(--color-revisao-text)',
        }}
      >
        Criar primeiro concurso
      </Link>
    </div>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'center' | 'right' }) {
  return (
    <th
      className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide"
      style={{ textAlign: align, letterSpacing: '0.06em' }}
    >
      {children}
    </th>
  )
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'center' | 'right' }) {
  return (
    <td className="px-4 py-3" style={{ textAlign: align, color: 'var(--fg-secondary)' }}>
      {children}
    </td>
  )
}
