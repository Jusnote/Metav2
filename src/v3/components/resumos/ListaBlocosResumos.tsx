// Server Component. Renderiza árvore disciplina → aula → bloco (subtopico)
// com pill de status do resumo + link "Criar" ou "Editar".

import Link from 'next/link'
import { StatusResumoPill } from './StatusResumoPill'
import type { ConcursoComResumos } from '@/v3/lib/resumos/arvore-resumos'

interface Props {
  concurso: ConcursoComResumos
}

export function ListaBlocosResumos({ concurso }: Props) {
  if (concurso.disciplinas.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl">
      {concurso.disciplinas.map((disc) => (
        <section
          key={disc.id}
          className="rounded-lg border"
          style={{
            borderColor: 'var(--border-default)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <header
            className="px-4 py-3 border-b flex items-center gap-3"
            style={{ borderColor: 'var(--border-default)' }}
          >
            {disc.cor && (
              <span
                aria-hidden
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: disc.cor }}
              />
            )}
            <h2
              className="text-sm font-medium tracking-tight"
              style={{ color: 'var(--fg-primary)' }}
            >
              {disc.nome}
            </h2>
            <span
              className="text-xs"
              style={{ color: 'var(--fg-tertiary)' }}
            >
              {disc.aulas.length} aulas
            </span>
          </header>
          <ul className="divide-y" style={{ borderColor: 'var(--border-default)' }}>
            {disc.aulas.map((aula) => (
              <li key={aula.id}>
                <details className="group" open>
                  <summary
                    className="px-4 py-2 cursor-pointer flex items-center gap-3 hover:bg-[var(--bg-surface-2)] transition-colors list-none"
                  >
                    <ChevronIcon />
                    <span
                      className="text-sm font-medium flex-1"
                      style={{ color: 'var(--fg-primary)' }}
                    >
                      Aula {String(aula.ordem).padStart(2, '0')} —{' '}
                      {aula.nome}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: 'var(--fg-tertiary)' }}
                    >
                      {aula.blocos.length} blocos
                    </span>
                  </summary>
                  <ul
                    className="border-t"
                    style={{ borderColor: 'var(--border-subtle, rgba(127,127,127,0.15))' }}
                  >
                    {aula.blocos.length === 0 ? (
                      <li
                        className="px-10 py-2 text-xs italic"
                        style={{ color: 'var(--fg-tertiary)' }}
                      >
                        Esta aula não tem blocos cadastrados.
                      </li>
                    ) : (
                      aula.blocos.map((bloco) => (
                        <li
                          key={bloco.id}
                          className="px-10 py-2 flex items-center gap-3 hover:bg-[var(--bg-surface-2)] transition-colors"
                        >
                          <span
                            className="text-sm flex-1 min-w-0 truncate"
                            style={{ color: 'var(--fg-secondary)' }}
                          >
                            <span
                              className="font-medium mr-1"
                              style={{ color: 'var(--fg-primary)' }}
                            >
                              Bloco {bloco.ordem}:
                            </span>
                            {bloco.nome}
                          </span>
                          <StatusResumoPill status={bloco.statusResumo} />
                          <Link
                            href={`/v3/admin/concursos/${concurso.id}/resumos/${bloco.id}`}
                            className="text-xs px-2 py-1 rounded-md transition-colors"
                            style={{
                              backgroundColor: 'var(--bg-surface-2)',
                              color: 'var(--fg-secondary)',
                              border: '1px solid var(--border-default)',
                            }}
                          >
                            {bloco.statusResumo === 'sem-resumo'
                              ? 'Criar'
                              : 'Editar'}
                          </Link>
                        </li>
                      ))
                    )}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function ChevronIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className="text-current group-open:rotate-90 transition-transform"
      style={{ color: 'var(--fg-tertiary)' }}
      aria-hidden
    >
      <path
        d="M4 2l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="text-center max-w-md">
        <h2
          className="text-base font-medium mb-2"
          style={{ color: 'var(--fg-primary)' }}
        >
          Sem conteúdo
        </h2>
        <p className="text-sm" style={{ color: 'var(--fg-secondary)' }}>
          Este concurso ainda não tem disciplinas/aulas cadastradas.
          Volte para a tela de revisão para processar o edital.
        </p>
      </div>
    </div>
  )
}
