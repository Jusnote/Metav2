'use client';

import type { ModerationStats } from '@/types/moderation';

interface StatsCardsProps {
  stats: ModerationStats | undefined;
  isLoading: boolean;
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-[10px] border bg-white p-[18px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${
        highlight ? 'border-violet-200' : 'border-zinc-100'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-400">
          {label}
        </span>
        {highlight && (
          <div className="h-2 w-2 rounded-full bg-violet-600" />
        )}
      </div>
      <div className="mt-2 text-[36px] font-extrabold leading-none tracking-[-1.5px] tabular-nums text-zinc-900">
        {value}
      </div>
      {sub && <div className="mt-1">{sub}</div>}
    </div>
  );
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-[110px] animate-pulse rounded-[10px] border border-zinc-100 bg-white"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3">
      <StatCard
        label="Pendentes"
        value={String(stats.pending_reports)}
        highlight
        sub={
          <span className="text-[12px] text-zinc-400">aguardando ação</span>
        }
      />
      <StatCard
        label="Resolvidos"
        value={String(stats.resolved_reports_period)}
        sub={
          <span className="text-[12px] text-emerald-500">nos últimos 7 dias</span>
        }
      />
      <StatCard
        label="Tempo médio"
        value={`${stats.avg_resolution_time_hours}`}
        sub={
          <span className="text-[12px] text-zinc-400">horas p/ resolução</span>
        }
      />
      <StatCard
        label="Banidos ativos"
        value={String(stats.active_bans)}
        sub={
          <span className="text-[12px] text-zinc-400">este período</span>
        }
      />
    </div>
  );
}
