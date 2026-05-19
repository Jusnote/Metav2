import { ReactNode } from 'react'
import Link from 'next/link'

// Layout do grupo (admin) — protegido por role admin
// Autenticação e verificação de role serão implementadas na Fase 4.
// Por ora: shell visual mínimo + nav lateral pra navegar entre seções.
export default function AdminGroupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      {/* Sidebar minimalista */}
      <aside
        className="w-56 flex-shrink-0 border-r"
        style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="px-4 py-5">
          <Link
            href="/v3/admin/concursos"
            className="block text-base font-medium tracking-tight"
            style={{ color: 'var(--fg-primary)' }}
          >
            Mentoria · admin
          </Link>
        </div>
        <nav className="px-2 space-y-0.5" aria-label="Navegação admin">
          <AdminNavLink href="/v3/admin/concursos" label="Concursos" />
          <AdminNavLink href="/v3/admin/concursos/novo" label="Novo concurso" />
        </nav>
        <p
          className="px-3 mt-6 text-[10px] uppercase tracking-wider"
          style={{ color: 'var(--fg-tertiary)' }}
        >
          Por concurso: abra um concurso publicado para acessar Resumos.
        </p>
      </aside>

      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  )
}

function AdminNavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 rounded-md text-sm transition-colors hover:bg-[var(--bg-surface-2)]"
      style={{ color: 'var(--fg-secondary)' }}
    >
      {label}
    </Link>
  )
}
