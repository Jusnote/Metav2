import type { Metadata } from 'next'
import { ReactNode } from 'react'
import '@/v3/styles/tokens.css'

export const metadata: Metadata = {
  title: 'Mentoria V3 — Sistema de Cronograma para Concursos',
  description: 'Sistema inteligente de cronograma e mentoria para concursos públicos',
}

// Layout raiz do V3 — isolado do V2
// Aplica dark mode, fontes e tokens de design do doc 03-design-system.md
export default function V3Layout({ children }: { children: ReactNode }) {
  return (
    <div
      className="v3"
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--fg-primary)',
        minHeight: '100vh',
      }}
    >
      {children}
    </div>
  )
}
