'use client'

// Modal "X alertas da IA" — mostra observacoes_globais agregadas + alertas
// agrupados por disciplina. Ref: doc 08-telas-admin.md (seção "Modal de alertas da IA")

import { useState } from 'react'

export interface AlertaItem {
  disciplina: string
  texto: string
}

interface Props {
  alertas: AlertaItem[]
}

export function AlertasIaModal({ alertas }: Props) {
  const [aberto, setAberto] = useState(false)

  if (alertas.length === 0) {
    return (
      <span className="text-xs" style={{ color: 'var(--fg-tertiary)' }}>
        Nenhum alerta
      </span>
    )
  }

  // Agrupa por disciplina
  const porDisciplina = alertas.reduce<Record<string, string[]>>((acc, a) => {
    if (!acc[a.disciplina]) acc[a.disciplina] = []
    acc[a.disciplina].push(a.texto)
    return acc
  }, {})

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors"
        style={{
          backgroundColor: 'var(--color-atencao-bg)',
          color: 'var(--color-atencao-text)',
          border: '1px solid rgba(239,159,39,0.4)',
        }}
      >
        <span aria-hidden>⚠</span>
        {alertas.length} {alertas.length === 1 ? 'alerta da IA' : 'alertas da IA'}
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => setAberto(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="alertas-ia-titulo"
        >
          <div
            className="rounded-lg max-w-xl w-full max-h-[80vh] overflow-y-auto"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-strong)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <header
              className="px-5 py-4 border-b"
              style={{ borderColor: 'var(--border-default)' }}
            >
              <h2
                id="alertas-ia-titulo"
                className="text-base font-medium flex items-center gap-2"
                style={{ color: 'var(--fg-primary)' }}
              >
                <span aria-hidden style={{ color: 'var(--color-atencao-text)' }}>
                  ⚠
                </span>
                Pontos para sua atenção
              </h2>
              <p className="text-xs mt-1" style={{ color: 'var(--fg-secondary)' }}>
                A IA sinalizou {alertas.length} {alertas.length === 1 ? 'item' : 'itens'} que
                merecem validação manual.
              </p>
            </header>

            <div className="px-5 py-4 space-y-5">
              {Object.entries(porDisciplina).map(([disc, lista]) => (
                <section key={disc}>
                  <h3
                    className="text-sm font-medium mb-2"
                    style={{ color: 'var(--fg-primary)' }}
                  >
                    {disc}
                  </h3>
                  <ol
                    className="list-decimal list-inside space-y-1.5 text-sm"
                    style={{ color: 'var(--fg-secondary)' }}
                  >
                    {lista.map((txt, i) => (
                      <li key={i}>{txt}</li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>

            <footer
              className="px-5 py-3 border-t flex justify-end"
              style={{ borderColor: 'var(--border-default)' }}
            >
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="px-3 py-1.5 rounded-md text-sm transition-colors"
                style={{
                  backgroundColor: 'rgba(127,119,221,0.2)',
                  border: '1px solid rgba(127,119,221,0.4)',
                  color: 'var(--color-revisao-text)',
                }}
              >
                Marcar como lido
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  )
}
