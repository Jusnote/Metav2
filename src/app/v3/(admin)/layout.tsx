import { ReactNode } from 'react'

// Layout do grupo (admin) — protegido por role admin
// Autenticação e verificação de role serão implementadas na Fase 4
export default function AdminGroupLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
