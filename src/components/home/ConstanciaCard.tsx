/**
 * Card Constância da Home v4 — mini-heatmap 12 semanas × 7 dias (células 9px,
 * hover scale) + contexto "84 dias ativos no trimestre · melhor: 21".
 * Padrão de células 1:1 com o mock docs/superpowers/specs/2026-06-11-home-v4-perfeita.html.
 */

// TODO: ligar dado real (atividade diária dos últimos 84 dias)
// Padrão exatamente como no mock — 12 colunas (semanas) × 7 linhas (dias),
// em ordem de coluna ('' = sem atividade, l1..l4 = intensidade).
const CELULAS: string[] = [
  'l1', 'l2', '', 'l3', 'l2', 'l1', '',
  'l2', 'l3', 'l2', 'l1', '', 'l2', 'l1',
  'l3', 'l4', 'l2', 'l3', 'l1', '', 'l2',
  'l2', 'l1', 'l3', 'l4', 'l2', 'l3', '',
  'l4', 'l3', 'l4', 'l2', 'l3', 'l1', 'l2',
  'l3', 'l4', 'l4', 'l3', 'l4', 'l2', 'l3',
  'l4', 'l4', 'l3', 'l4', 'l4', 'l3', 'l4',
  'l4', 'l3', 'l4', 'l4', 'l4', 'l4', '',
  'l2', 'l4', 'l4', 'l3', 'l4', 'l4', 'l4',
  'l4', 'l4', 'l4', 'l4', 'l3', 'l4', 'l4',
  'l4', 'l4', 'l4', 'l4', 'l4', 'l4', 'l4',
  'l4', 'l4', 'l4', 'l4', 'l4', '', '',
];

export function ConstanciaCard() {
  return (
    <div className="card heatcard lift">
      <span className="lbl">Constância · 12 semanas</span>
      <span className="minihm">
        {CELULAS.map((nivel, idx) => (
          <i key={idx} className={nivel || undefined} />
        ))}
      </span>
      {/* TODO: ligar dado real (dias ativos e melhor sequência) */}
      <span className="ctx">
        <b>84 dias ativos</b> no trimestre · melhor: 21
      </span>
    </div>
  );
}
