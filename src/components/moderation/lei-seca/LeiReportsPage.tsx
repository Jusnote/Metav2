'use client';

import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useLawReports, type LawReportRow } from '@/hooks/moderation/useLawReports';
import { ModerationDataTable, type Column } from '../shared/ModerationDataTable';
import { StatusDot } from '../shared/StatusDot';
import { LeiReportDrawer } from './LeiReportDrawer';
import { cn } from '@/lib/utils';

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `${minutes}min atras`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atras`;
  const days = Math.floor(hours / 24);
  return `${days}d atras`;
}

const REASON_LABELS: Record<string, string> = {
  texto_desatualizado: 'Texto desatualizado',
  texto_errado: 'Texto errado',
  dispositivo_revogado: 'Revogado',
  referencia_errada: 'Referencia errada',
  outro: 'Outro',
};

const STATUS_OPTIONS = [
  { value: undefined, label: 'Todos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'resolved', label: 'Resolvidos' },
  { value: 'dismissed', label: 'Descartados' },
];

const columns: Column<LawReportRow>[] = [
  {
    key: 'dispositivo',
    label: 'Dispositivo',
    width: '1fr',
    render: (row) => (
      <div className="flex items-center gap-3">
        <StatusDot
          severity={
            row.status === 'pending'
              ? row.reason === 'dispositivo_revogado' ? 'high' : 'medium'
              : 'resolved'
          }
        />
        <div className="min-w-0">
          <span
            className={`block truncate text-[13px] ${
              row.status === 'pending' ? 'font-medium text-zinc-900' : 'text-zinc-400'
            }`}
          >
            {row.dispositivo_tipo && row.dispositivo_tipo !== ''
              ? `${row.dispositivo_tipo}`
              : 'Dispositivo'}
          </span>
          <span className="block truncate text-[11px] text-zinc-400">
            {row.dispositivo_texto?.slice(0, 60)}
            {(row.dispositivo_texto?.length ?? 0) > 60 ? '...' : ''}
          </span>
        </div>
      </div>
    ),
  },
  {
    key: 'reason',
    label: 'Motivo',
    width: '130px',
    render: (row) => (
      <span className="text-[12px] text-zinc-500">
        {REASON_LABELS[row.reason] ?? row.reason}
      </span>
    ),
  },
  {
    key: 'reporter',
    label: 'Reporter',
    width: '120px',
    render: (row) => (
      <span className="truncate text-[12px] text-zinc-500">
        {row.reporter_name ?? row.reporter_email ?? 'Anonimo'}
      </span>
    ),
  },
  {
    key: 'when',
    label: 'Quando',
    width: '90px',
    render: (row) => (
      <span className="text-[12px] tabular-nums text-zinc-500">
        {relativeTime(row.created_at)}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    width: '80px',
    render: (row) => (
      <span
        className={`text-[11px] font-semibold ${
          row.status === 'pending' ? 'text-zinc-900' : 'text-zinc-400'
        }`}
      >
        {row.status === 'pending'
          ? 'Pendente'
          : row.status === 'resolved'
            ? 'Resolvido'
            : 'Descartado'}
      </span>
    ),
  },
];

export function LeiReportsPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(0);
  const { data, isLoading } = useLawReports(statusFilter, undefined, page);
  const reports = data?.reports;
  const totalCount = data?.totalCount ?? 0;
  const [selectedReport, setSelectedReport] = useState<LawReportRow | null>(null);

  return (
    <>
      <div className="border-b border-zinc-100 bg-white px-8 pb-5 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.5px] text-zinc-900">
              Reports de Lei Seca
            </h1>
            <p className="mt-1 text-[13px] text-zinc-400">
              Dispositivos legais reportados por usuarios
            </p>
          </div>
          <div className="flex gap-1">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.label}
                onClick={() => { setStatusFilter(s.value); setPage(0); }}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                  statusFilter === s.value
                    ? 'bg-violet-100 text-violet-700'
                    : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-8">
        {isLoading ? (
          <div className="overflow-hidden rounded-[10px] border border-zinc-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="border-b border-zinc-100 bg-[#fafafa] px-[18px] py-[10px]">
              <div className="h-3 w-40 animate-pulse rounded bg-zinc-200" />
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 border-b border-[#fafafa] px-[18px] py-[15px]">
                <div className="h-[7px] w-[7px] animate-pulse rounded-full bg-zinc-200" />
                <div className="h-3 flex-1 animate-pulse rounded bg-zinc-100" />
                <div className="h-3 w-16 animate-pulse rounded bg-zinc-100" />
                <div className="h-3 w-14 animate-pulse rounded bg-zinc-100" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <ModerationDataTable
              columns={columns}
              data={reports ?? []}
              onRowClick={setSelectedReport}
              rowKey={(r) => r.id}
              emptyMessage="Nenhum report de dispositivo encontrado"
              emptyIcon={<BookOpen className="h-8 w-8" />}
              pageSize={20}
            />
            {totalCount > 20 && (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[12px] text-zinc-400">
                  {page * 20 + 1}--{Math.min((page + 1) * 20, totalCount)} de {totalCount}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="rounded-md px-3 py-1.5 text-[12px] font-medium text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={(page + 1) * 20 >= totalCount}
                    className="rounded-md px-3 py-1.5 text-[12px] font-medium text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
                  >
                    Proximo
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedReport && (
        <LeiReportDrawer
          report={selectedReport}
          open={!!selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </>
  );
}
