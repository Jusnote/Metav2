// Página inicial V3 — placeholder
// Fase 0 / doc 10-fases-execucao.md
export default function V3Home() {
  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--fg-primary)' }}
    >
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-medium" style={{ color: 'var(--fg-primary)' }}>
          Mentoria V3
        </h1>
        <p className="text-sm" style={{ color: 'var(--fg-secondary)' }}>
          Em construção. Acesse /v3/admin ou /v3/app conforme seu role.
        </p>
      </div>
    </main>
  )
}
