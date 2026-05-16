// /v3/admin/concursos/novo — wizard de criação + parsing IA
// Server Component: renderiza o cliente NovoConcursoForm

import Link from 'next/link'
import { NovoConcursoForm } from './NovoConcursoForm'

export default function NovoConcursoPage() {
  return (
    <div className="px-8 py-6 max-w-3xl mx-auto">
      <header className="mb-6">
        <Link
          href="/v3/admin/concursos"
          className="text-xs hover:underline mb-2 inline-block"
          style={{ color: 'var(--fg-secondary)' }}
        >
          ← Voltar para concursos
        </Link>
        <h1 className="text-2xl font-medium" style={{ color: 'var(--fg-primary)' }}>
          Novo concurso
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--fg-secondary)' }}>
          Identifique o concurso e cole o conteúdo programático. A IA divide em disciplinas,
          estrutura em blocos e tópicos.
        </p>
      </header>

      <NovoConcursoForm />
    </div>
  )
}
