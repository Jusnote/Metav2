'use client';

import { useReports } from '@/hooks/moderation/useReports';
import type { ReportWithContext } from '@/types/moderation';

// --- Helpers ---

function getDayLabel(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function getReportsByDay(reports: ReportWithContext[], days: number): { label: string; count: number }[] {
  const now = new Date();
  const result: { label: string; count: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayStr = date.toISOString().slice(0, 10);
    const count = reports.filter((r) => r.created_at.slice(0, 10) === dayStr).length;
    result.push({ label: getDayLabel(date), count });
  }

  return result;
}

function getTopReporters(reports: ReportWithContext[], limit: number) {
  const counts = new Map<string, { name: string; count: number }>();
  for (const r of reports) {
    const key = r.reporter_id;
    const existing = counts.get(key);
    if (existing) {
      existing.count++;
    } else {
      counts.set(key, { name: r.reporter_name ?? r.reporter_email ?? 'Anônimo', count: 1 });
    }
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function getBreakdownByReason(reports: ReportWithContext[]) {
  const counts: Record<string, number> = {};
  for (const r of reports) {
    counts[r.reason] = (counts[r.reason] ?? 0) + 1;
  }
  const total = reports.length || 1;
  return Object.entries(counts)
    .map(([reason, count]) => ({ reason, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  offensive: 'Ofensivo',
  incorrect: 'Incorreto',
  other: 'Outro',
};

const REASON_COLORS: Record<string, string> = {
  spam: 'bg-amber-400',
  offensive: 'bg-red-400',
  incorrect: 'bg-blue-400',
  other: 'bg-zinc-400',
};

// --- Components ---

function TrendChart({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="rounded-[10px] border border-zinc-100 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <h3 className="mb-4 text-[13px] font-bold tracking-[-0.2px] text-zinc-900">
        Reports por dia
      </h3>
      <div className="flex items-end gap-[3px]" style={{ height: 120 }}>
        {data.map((d, i) => (
          <div key={i} className="group flex flex-1 flex-col items-center gap-1">
            <div className="relative w-full">
              <div
                className="mx-auto w-full max-w-[24px] rounded-t-[3px] bg-violet-400 transition-colors group-hover:bg-violet-500"
                style={{ height: max > 0 ? Math.max((d.count / max) * 100, 2) : 2 }}
              />
              {d.count > 0 && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {d.count}
                </div>
              )}
            </div>
            <span className="text-[9px] tabular-nums text-zinc-400">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopReporters({ reporters }: { reporters: { name: string; count: number }[] }) {
  const max = reporters[0]?.count ?? 1;

  return (
    <div className="rounded-[10px] border border-zinc-100 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <h3 className="mb-4 text-[13px] font-bold tracking-[-0.2px] text-zinc-900">
        Top reporters
      </h3>
      {reporters.length === 0 ? (
        <p className="py-4 text-center text-[12px] text-zinc-400">Nenhum report ainda</p>
      ) : (
        <div className="space-y-3">
          {reporters.map((r, i) => (
            <div key={i}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[12px] font-medium text-zinc-700">{r.name}</span>
                <span className="text-[11px] tabular-nums text-zinc-400">{r.count}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-100">
                <div
                  className="h-1.5 rounded-full bg-violet-400"
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReasonBreakdown({ data }: { data: { reason: string; count: number; pct: number }[] }) {
  return (
    <div className="rounded-[10px] border border-zinc-100 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <h3 className="mb-4 text-[13px] font-bold tracking-[-0.2px] text-zinc-900">
        Motivos dos reports
      </h3>
      {data.length === 0 ? (
        <p className="py-4 text-center text-[12px] text-zinc-400">Nenhum report ainda</p>
      ) : (
        <>
          {/* Stacked bar */}
          <div className="mb-4 flex h-3 overflow-hidden rounded-full">
            {data.map((d) => (
              <div
                key={d.reason}
                className={`${REASON_COLORS[d.reason] ?? 'bg-zinc-300'}`}
                style={{ width: `${d.pct}%` }}
                title={`${REASON_LABELS[d.reason] ?? d.reason}: ${d.pct}%`}
              />
            ))}
          </div>
          {/* Legend */}
          <div className="space-y-2">
            {data.map((d) => (
              <div key={d.reason} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${REASON_COLORS[d.reason] ?? 'bg-zinc-300'}`} />
                  <span className="text-[12px] text-zinc-600">{REASON_LABELS[d.reason] ?? d.reason}</span>
                </div>
                <span className="text-[12px] tabular-nums text-zinc-400">{d.pct}%  ({d.count})</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- Main ---

export function OverviewAnalytics() {
  const { data: reports } = useReports();
  const allReports = reports ?? [];

  const trendData = getReportsByDay(allReports, 14);
  const topReporters = getTopReporters(allReports, 5);
  const breakdown = getBreakdownByReason(allReports);

  return (
    <div className="grid grid-cols-3 gap-4">
      <TrendChart data={trendData} />
      <TopReporters reporters={topReporters} />
      <ReasonBreakdown data={breakdown} />
    </div>
  );
}
