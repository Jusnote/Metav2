import { useNavigate } from 'react-router-dom';

/**
 * Card Pontos de atenção da Home v4 — 3 linhas com dot colorido, diagnóstico,
 * percentual e ação "Treinar →" (navega pra /questoes).
 * Valores/cores 1:1 com o mock docs/superpowers/specs/2026-06-11-home-v4-perfeita.html.
 */
export function PontosAtencao() {
  const navigate = useNavigate();

  return (
    <div className="card pad lift">
      <span className="lbl">Pontos de atenção</span>
      {/* TODO: ligar dado real (diagnóstico por tópico) */}
      <ul className="rad" style={{ marginTop: 4 }}>
        <li>
          <span className="dot" style={{ background: '#E8919B' }} />
          <div>
            <div className="n">Controle de constitucionalidade</div>
            <div className="dg">41% em 52 questões · caiu 7 pts em 30 dias</div>
          </div>
          <span className="pct" style={{ color: '#C25E6A' }}>41%</span>
          <span className="tr" onClick={() => navigate('/questoes')}>Treinar →</span>
        </li>
        <li>
          <span className="dot" style={{ background: '#E8C083' }} />
          <div>
            <div className="n">Licitações (Lei 14.133)</div>
            <div className="dg">58% em 38 questões · estável</div>
          </div>
          <span className="pct" style={{ color: '#B98A3F' }}>58%</span>
          <span className="tr" onClick={() => navigate('/questoes')}>Treinar →</span>
        </li>
        <li>
          <span className="dot" style={{ background: '#8FD0B4' }} />
          <div>
            <div className="n">Atos administrativos</div>
            <div className="dg">84% em 214 questões · seu ponto forte</div>
          </div>
          <span className="pct" style={{ color: '#0F7B5F' }}>84%</span>
          <span style={{ width: 58 }} />
        </li>
      </ul>
    </div>
  );
}
