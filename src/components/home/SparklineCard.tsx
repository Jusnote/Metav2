import { SSRSafeNavLink } from '../SSRSafeNavLink';

// TODO: ligar dado real (volume de estudo dos últimos 14 dias)
// Alturas e labels de dia exatamente como no mock (última barra = hoje, destacada).
const BARRAS: { altura: string; dia: string; hoje?: boolean }[] = [
  { altura: '40%', dia: 'Q' },
  { altura: '55%', dia: 'S' },
  { altura: '35%', dia: 'S' },
  { altura: '60%', dia: 'D' },
  { altura: '70%', dia: 'S' },
  { altura: '52%', dia: 'T' },
  { altura: '65%', dia: 'Q' },
  { altura: '75%', dia: 'Q' },
  { altura: '58%', dia: 'S' },
  { altura: '80%', dia: 'S' },
  { altura: '68%', dia: 'D' },
  { altura: '85%', dia: 'S' },
  { altura: '92%', dia: 'T' },
  { altura: '96%', dia: 'Q', hoje: true },
];

/**
 * Card "Últimos 14 dias" da Home v4 — sparkline de 14 barras com labels de dia,
 * barra de hoje destacada e footer com total da semana + link de estatísticas.
 * 1:1 com o mock docs/superpowers/specs/2026-06-11-home-v4-perfeita.html.
 */
export function SparklineCard() {
  return (
    <div className="card pad r d6">
      <span className="lbl">Últimos 14 dias</span>
      <div className="spark">
        {BARRAS.map((b, idx) => (
          <span key={idx} className={b.hoje ? 'hoje' : undefined}>
            <i style={{ height: b.altura }} />
            <em>{b.dia}</em>
          </span>
        ))}
      </div>
      {/* TODO: ligar dado real (horas estudadas na semana) */}
      <div className="sft">
        18h40 esta semana · <SSRSafeNavLink to="/questoes">estatísticas →</SSRSafeNavLink>
      </div>
    </div>
  );
}
