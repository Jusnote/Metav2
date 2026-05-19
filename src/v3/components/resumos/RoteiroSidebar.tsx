// Sidebar do editor: lista de "subtópicos" (segmentação interna do bloco) +
// outros blocos irmãos da mesma aula como referência. Também placeholder do PDF.
//
// Como o schema atual não tem campo "subtopicos: string[] | object[]" dentro
// de coaching.subtopicos, usamos o nome do próprio bloco (`bloco.nome`) como
// item principal e listamos os blocos IRMÃOS da mesma aula como navegação rápida.

'use client'

import Link from 'next/link'
import type { BlocoEditorContexto } from '@/v3/lib/resumos/arvore-resumos'

interface Props {
  contexto: BlocoEditorContexto
}

export function RoteiroSidebar({ contexto }: Props) {
  const { aula, bloco, blocosIrmaos, concursoId } = contexto

  return (
    <aside
      className="w-72 flex-shrink-0 border-l overflow-y-auto"
      style={{
        borderColor: 'var(--border-default)',
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      <div className="px-4 py-4 space-y-6">
        <section>
          <h3
            className="text-[10px] uppercase tracking-wider font-medium mb-2"
            style={{ color: 'var(--fg-tertiary)' }}
          >
            Roteiro do bloco
          </h3>
          <ul className="space-y-1.5">
            <li
              className="text-sm px-2 py-1 rounded-md"
              style={{
                color: 'var(--fg-primary)',
                backgroundColor: 'var(--bg-surface-2)',
              }}
            >
              {bloco.nome}
            </li>
          </ul>
          {bloco.horas_sugeridas !== null && (
            <p
              className="text-xs mt-2"
              style={{ color: 'var(--fg-tertiary)' }}
            >
              {bloco.horas_sugeridas}h sugeridas
            </p>
          )}
        </section>

        {blocosIrmaos.length > 0 && (
          <section>
            <h3
              className="text-[10px] uppercase tracking-wider font-medium mb-2"
              style={{ color: 'var(--fg-tertiary)' }}
            >
              Outros blocos desta aula
            </h3>
            <ul className="space-y-1">
              {blocosIrmaos.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/v3/admin/concursos/${concursoId}/resumos/${b.id}`}
                    className="block text-sm px-2 py-1 rounded-md hover:bg-[var(--bg-surface-2)] transition-colors truncate"
                    style={{ color: 'var(--fg-secondary)' }}
                  >
                    Bloco {b.ordem}: {b.nome}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3
            className="text-[10px] uppercase tracking-wider font-medium mb-2"
            style={{ color: 'var(--fg-tertiary)' }}
          >
            Material
          </h3>
          <button
            type="button"
            disabled
            title="PDF será conectado em fase futura"
            className="w-full text-sm px-3 py-2 rounded-md cursor-not-allowed"
            style={{
              color: 'var(--fg-tertiary)',
              backgroundColor: 'var(--bg-surface-2)',
              border: '1px dashed var(--border-default)',
              opacity: 0.6,
            }}
          >
            Abrir PDF da aula
          </button>
          <p
            className="text-[11px] mt-2 leading-snug"
            style={{ color: 'var(--fg-tertiary)' }}
          >
            Upload e linkagem de PDFs serão habilitados em fase futura.
          </p>
        </section>

        <section>
          <h3
            className="text-[10px] uppercase tracking-wider font-medium mb-2"
            style={{ color: 'var(--fg-tertiary)' }}
          >
            Contexto
          </h3>
          <dl
            className="text-xs space-y-1"
            style={{ color: 'var(--fg-secondary)' }}
          >
            <div className="flex justify-between gap-2">
              <dt style={{ color: 'var(--fg-tertiary)' }}>Disciplina</dt>
              <dd
                className="text-right truncate"
                style={{ color: 'var(--fg-primary)' }}
              >
                {contexto.disciplina.nome}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt style={{ color: 'var(--fg-tertiary)' }}>Aula</dt>
              <dd
                className="text-right truncate"
                style={{ color: 'var(--fg-primary)' }}
              >
                {String(aula.ordem).padStart(2, '0')} — {aula.nome}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt style={{ color: 'var(--fg-tertiary)' }}>Aula horas</dt>
              <dd
                className="text-right"
                style={{ color: 'var(--fg-primary)' }}
              >
                {aula.horas_sugeridas}h
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </aside>
  )
}
