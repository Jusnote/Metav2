import { ReactNode } from 'react';
import { Book, Check, Flame, Lightbulb, Target } from 'lucide-react';

interface MedalsBoardProps {
  /** Quantidade de medalhas desbloqueadas (vem do array real de medalhas). */
  unlockedCount: number;
  /** Total de medalhas (vem do array real de medalhas). */
  totalCount: number;
  /** Abre o Dialog "Ver todas" existente na HomePage. */
  onVerTodas: () => void;
}

type Metal = 'gold' | 'silver' | 'bronze' | 'lock';

const GRADIENT_POR_METAL: Record<Metal, string> = {
  gold: 'url(#gGold)',
  silver: 'url(#gSilver)',
  bronze: 'url(#gBronze)',
  lock: 'url(#gLock)',
};

/**
 * Hexágono de medalha 1:1 com o mock (46×52): preenchimento metálico via
 * gradiente compartilhado, stroke interno branco .35 e shine no topo nas
 * desbloqueadas. O ícone lucide entra como <svg> aninhado em (13,16) 20×20 —
 * mesma caixa dos paths do mock.
 */
function Hexagono({ metal, children }: { metal: Metal; children: ReactNode }) {
  return (
    <svg className="hx" viewBox="0 0 46 52">
      <polygon points="23,0 43.7,13 43.7,39 23,52 2.3,39 2.3,13" fill={GRADIENT_POR_METAL[metal]} />
      {metal !== 'lock' && (
        <>
          <polygon
            points="23,2 41.9,14 41.9,38 23,50 4.1,38 4.1,14"
            fill="none"
            stroke="rgba(255,255,255,.35)"
            strokeWidth="1"
          />
          <polygon points="23,0 43.7,13 43.7,18 2.3,18 2.3,13" fill="url(#gShine)" />
        </>
      )}
      {children}
    </svg>
  );
}

/**
 * Quadro de conquistas da Home v4 — grid de 5 medalhas (3 desbloqueadas com
 * hexágonos metálicos claros + 2 travadas flat com barra e "faltam X"),
 * rodapé "Próxima: ..." com pgdots e link "Ver todas →" (abre o Dialog existente).
 * Tiles 1:1 com o mock docs/superpowers/specs/2026-06-11-home-v4-perfeita.html.
 */
export function MedalsBoard({ unlockedCount, totalCount, onVerTodas }: MedalsBoardProps) {
  return (
    <div className="card med">
      <div className="medhd">
        <span className="lbl">Quadro de conquistas</span>
        <span className="sub">
          {unlockedCount} de {totalCount} · medalhas que marcam seu progresso
        </span>
        <span className="all" onClick={onVerTodas}>
          Ver todas →
        </span>
      </div>

      {/* TODO: ligar dado real (medalhas em destaque + progresso das travadas) */}
      <div className="mgrid">
        <div className="mi bronze">
          <Hexagono metal="bronze">
            <Check x={13} y={16} width={20} height={20} color="#fff" strokeWidth={2.4} />
          </Hexagono>
          <div className="mn">Primeiros passos</div>
          <div className="mdsc">Complete 5 questões</div>
        </div>
        <div className="mi bronze">
          <Hexagono metal="bronze">
            <Target x={13} y={16} width={20} height={20} color="#fff" strokeWidth={2} />
          </Hexagono>
          <div className="mn">Foco inicial</div>
          <div className="mdsc">1h de estudo num dia</div>
        </div>
        <div className="mi bronze">
          <Hexagono metal="bronze">
            <Book x={13} y={15} width={20} height={20} color="#fff" strokeWidth={1.9} />
          </Hexagono>
          <div className="mn">Estudioso</div>
          <div className="mdsc">25 questões completas</div>
        </div>
        <div className="mi lk">
          <Hexagono metal="lock">
            <Flame x={13} y={16} width={20} height={20} color="#B6C2D0" strokeWidth={1.6} />
          </Hexagono>
          <div className="mn">Sequência iniciante</div>
          <div className="mdsc">3 semanas seguidas</div>
          <div className="mbar">
            <i style={{ width: '55%' }} />
          </div>
          <div className="mleft">faltam 9 dias</div>
        </div>
        <div className="mi lk">
          <Hexagono metal="lock">
            <Lightbulb x={13} y={16} width={20} height={20} color="#B6C2D0" strokeWidth={1.6} />
          </Hexagono>
          <div className="mn">Mente ativa</div>
          <div className="mdsc">50 questões completas</div>
          <div className="mbar">
            <i style={{ width: '72%' }} />
          </div>
          <div className="mleft">faltam 14 questões</div>
        </div>
      </div>

      <div className="medft">
        {/* TODO: ligar dado real (próxima medalha) */}
        <span className="nx">
          Próxima: <b>Sequência iniciante</b> · faltam 9 dias
        </span>
        <span className="pgdots">
          <i className="on" />
          <i />
          <i />
        </span>
      </div>
    </div>
  );
}
