import type { PapiroStats } from '@/lib/papiro/types';

interface Props {
  kicker?: string;
  title: string;
  sub?: string;
  stats: PapiroStats;
}

function formatTempo(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export function TrilhaHeader({ kicker, title, sub, stats }: Props) {
  const pct = stats.temasTotal > 0
    ? Math.round((stats.temasDisponiveis / stats.temasTotal) * 100)
    : 0;

  return (
    <header className="mb-8">
      {kicker && (
        <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
          {kicker}
        </div>
      )}
      <h1 className="m-0 mb-3 text-3xl font-semibold leading-tight tracking-tight text-stone-950">
        {title}
      </h1>
      {sub && <p className="mb-6 max-w-lg text-sm leading-relaxed text-stone-600">{sub}</p>}

      <div className="mb-3 flex flex-wrap gap-6 text-[13px] text-stone-500">
        <div><span className="font-semibold text-stone-900">{stats.temasTotal}</span> temas</div>
        <div><span className="font-semibold text-stone-900">{formatTempo(stats.tempoTotalMin)}</span> de conteúdo</div>
        <div><span className="font-semibold text-stone-900">{stats.temasDisponiveis}</span> disponível agora</div>
      </div>
      <div className="mb-2 h-[3px] w-full overflow-hidden rounded-full bg-stone-100">
        <span className="block h-full rounded-full bg-[#6b8e5a]" style={{ width: `${pct}%` }} />
      </div>
      <p className="m-0 text-xs text-stone-400">
        {stats.temasDisponiveis} de {stats.temasTotal} publicados · a trilha cresce conforme novos resumos saem
      </p>
    </header>
  );
}
