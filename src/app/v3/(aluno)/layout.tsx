import { ReactNode } from 'react'

// Layout do grupo (aluno) — protegido por autenticação
// Autenticação será implementada na Fase 4
export default function AlunoGroupLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
