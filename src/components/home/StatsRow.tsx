import { useNavigate } from 'react-router-dom';

/**
 * Fileira de stats da Home v4 — 3 cards (Desempenho geral, Evolução, Hoje) com
 * baselines, micro-trend de 4 barrinhas, hairline da meta (94%) e
 * "ver detalhes →" que aparece só no hover.
 * Valores 1:1 com o mock docs/superpowers/specs/2026-06-11-home-v4-perfeita.html.
 */
export function StatsRow() {
  const navigate = useNavigate();
  // Rota /estatisticas não existe — detalhes apontam pra /questoes
  const verDetalhes = () => navigate('/questoes');

  return (
    <div className="grid3 r d4">
      {/* TODO: ligar dado real (desempenho geral do mês) */}
      <div className="card stat lift">
        <span className="lbl">Desempenho geral</span>
        <span className="see" onClick={verDetalhes}>ver detalhes →</span>
        <div className="num">
          73%<span className="delta">↑ 3 pts</span>
        </div>
        <div className="cap">acerto · 1.248 questões no mês</div>
        <div className="mtrend">
          <i style={{ height: '76%' }} />
          <i style={{ height: '79%' }} />
          <i style={{ height: '82%' }} />
          <i style={{ height: '86%' }} />
        </div>
      </div>

      {/* TODO: ligar dado real (evolução semanal) */}
      <div className="card stat lift">
        <span className="lbl">Evolução</span>
        <span className="see" onClick={verDetalhes}>ver detalhes →</span>
        <div className="duo">
          <div>
            <div className="num">↑18%</div>
            <div className="cap">questões</div>
          </div>
          <div>
            <div className="num">↑12%</div>
            <div className="cap">horas</div>
          </div>
        </div>
        <div className="cap">vs semana passada</div>
        <div className="sup">melhor semana das últimas 8</div>
      </div>

      {/* TODO: ligar dado real (meta do dia e revisões) */}
      <div className="card stat lift">
        <span className="lbl">Hoje</span>
        <span className="see" onClick={verDetalhes}>ver detalhes →</span>
        <div className="duo">
          <div>
            <div className="num">
              47<small>/50</small>
            </div>
            <div className="cap">questões</div>
          </div>
          <div>
            <div className="num">12</div>
            <div className="cap">revisões · ~9 min</div>
          </div>
        </div>
        <div className="hair">
          <i />
        </div>
        <div className="cap" style={{ color: 'var(--accent)', fontWeight: 700 }}>
          faltam 3 pra bater a meta
        </div>
      </div>
    </div>
  );
}
