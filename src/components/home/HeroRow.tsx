import { Flame, Info } from 'lucide-react';

interface HeroRowProps {
  userName: string;
}

/**
 * Fileira hero da Home v4: saudação + card Nível (anel SVG animado, chip de XP,
 * popover "Como ganho XP" no hover do info) + card Sequência (chama + dots da semana).
 * Layout/valores 1:1 com o mock docs/superpowers/specs/2026-06-11-home-v4-perfeita.html.
 */
export function HeroRow({ userName }: HeroRowProps) {
  // Data real do dia no formato do mock ("Quinta-feira, 11 de junho")
  const dataLonga = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  const dataFmt = dataLonga.charAt(0).toUpperCase() + dataLonga.slice(1);

  return (
    <div className="hero row1 r d1">
      <div className="greet">
        <h1>
          Olá
          {userName && (
            <>
              , <b>{userName}</b>
            </>
          )}
          .
        </h1>
        {/* TODO: ligar dado real (questões restantes da meta do dia) */}
        <div className="sub">{dataFmt} · faltam 3 questões pra fechar o dia</div>
      </div>

      {/* TODO: ligar dado real (nível, XP e progresso) */}
      <div className="card lvl">
        <span className="ringwrap">
          <svg className="ringsvg" width="52" height="52" viewBox="0 0 52 52">
            <circle className="trk" cx="26" cy="26" r="23.5" fill="none" strokeWidth="5" />
            <circle
              className="prg"
              cx="26"
              cy="26"
              r="23.5"
              fill="none"
              strokeWidth="5"
              transform="rotate(-90 26 26)"
            />
          </svg>
          <span className="num">12</span>
        </span>
        <div>
          <div className="t">
            Nível 12 <span className="xpchip">+40 XP hoje</span>
          </div>
          <div className="s">820 / 1.500 XP pro nível 13</div>
          <div className="xpbar">
            <i />
          </div>
        </div>
        <span className="info">
          <Info strokeWidth={2} />
        </span>
        <div className="pop">
          <h4>Como ganho XP</h4>
          <div>
            <span>Questão certa</span>
            <b>+3</b>
          </div>
          <div>
            <span>Questão errada</span>
            <b>+1</b>
          </div>
          <div>
            <span>Revisão FSRS</span>
            <b>+5</b>
          </div>
          <div>
            <span>Sessão concluída</span>
            <b>+20</b>
          </div>
          <div>
            <span>Meta do dia</span>
            <b>+50</b>
          </div>
          <div>
            <span>Medalha</span>
            <b>+100–250</b>
          </div>
        </div>
      </div>

      {/* TODO: ligar dado real (sequência, recorde e dias da semana) */}
      <div className="card stk">
        <span className="flame">
          <Flame strokeWidth={1.7} />
        </span>
        <div>
          <div className="v">14 dias</div>
          <div className="s">sequência · recorde: 21</div>
          <div className="wk">
            <i />
            <i />
            <i />
            <i />
            <i className="today" />
            <i className="off" />
            <i className="off" />
          </div>
        </div>
      </div>
    </div>
  );
}
