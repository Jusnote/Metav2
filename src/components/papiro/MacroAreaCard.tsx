import { Link } from 'react-router-dom';
import { macroAreaUrl } from '@/lib/papiro/slug';
import type { PapiroMacroAreaResumo } from '@/lib/papiro/types';

interface Props {
  macroArea: PapiroMacroAreaResumo;
  coming?: boolean;
}

function formatTempo(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export function MacroAreaCard({ macroArea, coming = false }: Props) {
  const { stats } = macroArea;
  const pct = stats.temasTotal > 0
    ? Math.round((stats.temasDisponiveis / stats.temasTotal) * 100)
    : 0;

  const inner = (
    <>
      <div className="flex-1">
        <h4 className="m-0 text-[16px] font-semibold tracking-tight text-stone-950">
          {macroArea.nome}
        </h4>
        {coming ? (
          <div className="mt-1 text-[11.5px] text-stone-500">curadoria em andamento</div>
        ) : (
          <>
            <div className="mt-1.5 flex flex-wrap gap-2.5 text-[11px] text-stone-500">
              <span><strong className="font-semibold text-stone-950">{stats.temasTotal}</strong> temas</span>
              <span className="text-stone-300">·</span>
              <span><strong className="font-semibold text-stone-950">{formatTempo(stats.tempoTotalMin)}</strong></span>
              <span className="text-stone-300">·</span>
              <span><strong className="font-semibold text-[#4a7050]">{stats.temasDisponiveis}</strong> disponível</span>
            </div>
            <div className="mt-2.5 h-0.5 w-full overflow-hidden rounded-full bg-stone-100">
              <span className="block h-full bg-[#6b8e5a]" style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
      </div>
      {coming ? (
        <span className="ml-3 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[10.5px] font-medium text-stone-500">em breve</span>
      ) : (
        <span className="ml-3.5 text-base text-stone-300">›</span>
      )}
    </>
  );

  const base = 'flex items-center justify-between rounded-lg border px-[22px] py-[18px] transition-all';
  if (coming) {
    return <div className={`${base} cursor-default border-dashed border-stone-200 bg-stone-50`}>{inner}</div>;
  }
  return (
    <Link
      to={macroAreaUrl(macroArea.slug)}
      className={`${base} border-[#ece8de] bg-white hover:-translate-y-px hover:border-[#c8d6c3] hover:shadow-sm`}
    >
      {inner}
    </Link>
  );
}
