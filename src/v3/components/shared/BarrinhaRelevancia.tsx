// Barrinha de relevância (peso 1-5) — visual "sinal de wifi" do doc 03-design-system.md

interface Props {
  peso: number // 1..5
  className?: string
}

const CORES: Record<number, string> = {
  5: '#E24B4A', // vermelho
  4: '#EF9F27', // ambar forte
  3: '#EF9F27', // ambar
  2: '#888780', // cinza claro
  1: '#5A6470', // cinza
}

export function BarrinhaRelevancia({ peso, className }: Props) {
  const cor = CORES[Math.max(1, Math.min(5, peso))]
  return (
    <div
      className={'flex gap-px items-end h-3 ' + (className ?? '')}
      role="img"
      aria-label={`Peso de incidência ${peso} de 5`}
    >
      {[4, 6, 8, 10, 12].map((altura, i) => (
        <div
          key={i}
          className="w-[3px] rounded-sm"
          style={{
            height: `${altura}px`,
            background: i < peso ? cor : 'rgba(255,255,255,0.1)',
          }}
        />
      ))}
    </div>
  )
}
