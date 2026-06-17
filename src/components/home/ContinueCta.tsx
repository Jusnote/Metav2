import { useNavigate } from 'react-router-dom';

/**
 * CTA verde "Continuar de onde parou" da Home v4 — gradiente, highlight radial,
 * barra de progresso 45% e botão Retomar com seta deslizante.
 * 1:1 com o mock docs/superpowers/specs/2026-06-11-home-v4-perfeita.html.
 */
export function ContinueCta() {
  const navigate = useNavigate();

  return (
    <div className="cta r d2">
      {/* TODO: ligar dado real (sessão em andamento) */}
      <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
        <div className="k">Continuar de onde parou</div>
        <div className="t">
          Direito Administrativo <span>›</span> Atos Administrativos
        </div>
        <div className="s">questão 18 de 40 · 73% na sessão · ~15 min pra fechar</div>
        <div className="bar">
          <i />
        </div>
      </div>
      <button type="button" className="btn" onClick={() => navigate('/questoes')}>
        Retomar <span className="ar">→</span>
      </button>
    </div>
  );
}
