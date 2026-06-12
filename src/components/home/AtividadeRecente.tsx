import { Award, Book, ListChecks, TriangleAlert, WalletCards } from 'lucide-react';
import { SSRSafeNavLink } from '../SSRSafeNavLink';

/**
 * Card Atividade recente da Home v4 — timeline com fio vertical, tiles tonais
 * (30px, ícone 15px) e 5 itens exatos do mock, incluindo o link "Rever as 7 →";
 * rodapé "Ver histórico →".
 * 1:1 com o mock docs/superpowers/specs/2026-06-11-home-v4-perfeita.html.
 */
export function AtividadeRecente() {
  return (
    <div className="card act">
      <span className="lbl">Atividade recente</span>
      {/* TODO: ligar dado real (histórico de atividade do usuário) */}
      <div className="tl">
        <div className="ti">
          <span className="tic" style={{ background: '#EFF6FF', color: '#2563eb' }}>
            <ListChecks strokeWidth={1.8} />
          </span>
          <div>
            <div className="tt">23 questões · Dir. Administrativo</div>
            <div className="ss">78% de acerto (↑5 vs sua média)</div>
          </div>
          <span className="tm">há 2h</span>
        </div>
        <div className="ti">
          <span className="tic" style={{ background: '#F5F3FF', color: '#7C3AED' }}>
            <WalletCards strokeWidth={1.8} />
          </span>
          <div>
            <div className="tt">15 flashcards revisados</div>
            <div className="ss">92% lembrados · FSRS em dia</div>
          </div>
          <span className="tm">há 5h</span>
        </div>
        <div className="ti">
          <span className="tic" style={{ background: '#FEF2F2', color: '#DC2626' }}>
            <TriangleAlert strokeWidth={1.8} />
          </span>
          <div>
            <div className="tt">4 pegadinhas marcadas</div>
            <div className="ss">
              Controle de constitucionalidade · <SSRSafeNavLink to="/flashcards">Rever as 7 →</SSRSafeNavLink>
            </div>
          </div>
          <span className="tm">ontem</span>
        </div>
        <div className="ti">
          <span className="tic" style={{ background: '#FFFBEB', color: '#D97706' }}>
            <Award strokeWidth={1.8} />
          </span>
          <div>
            <div className="tt">Medalha &quot;Estudioso&quot; desbloqueada</div>
            <div className="ss">25 questões completas</div>
          </div>
          <span className="tm">ontem</span>
        </div>
        <div className="ti">
          <span className="tic" style={{ background: '#ECFDF5', color: '#0F7B5F' }}>
            <Book strokeWidth={1.8} />
          </span>
          <div>
            <div className="tt">Lei Seca: arts. 37–41 CF lidos</div>
            <div className="ss">12 grifos novos</div>
          </div>
          <span className="tm">ter</span>
        </div>
      </div>
      <div className="actft">
        <SSRSafeNavLink to="/questoes">Ver histórico →</SSRSafeNavLink>
      </div>
    </div>
  );
}
