'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { useReports } from '@/hooks/moderation/useReports';
import { ModerationDataTable, type Column } from '../shared/ModerationDataTable';
import { StatusDot } from '../shared/StatusDot';
import { ReportDrawer } from './ReportDrawer';
import { ReportFilters } from './ReportFilters';
import type { ReportWithContext } from '@/types/moderation';

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  offensive: 'Ofensivo',
  incorrect: 'Incorreto',
  other: 'Outro',
};

const columns: Column<ReportWithContext>[] = [
  {
    key: 'content',
    label: 'Conteúdo',
    width: '1fr',
    render: (row) => (
      <div className="flex items-center gap-3">
        <StatusDot
          severity={
            row.status === 'pending'
              ? row.reason === 'offensive' ? 'high' : 'medium'
              : 'resolved'
          }
        />
        <span
          className={`truncate text-[13px] ${
            row.status === 'pending' ? 'font-medium text-zinc-900' : 'text-zinc-400'
          }`}
        >
          {row.comment_content_text?.slice(0, 80) || 'Sem texto'}
        </span>
      </div>
    ),
  },
  {
    key: 'reason',
    label: 'Motivo',
    width: '90px',
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
        {row.reporter_name ?? row.reporter_email ?? 'Anônimo'}
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

export function ReportsPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(0);
  const { data, isLoading } = useReports(statusFilter, page);
  const reports = data?.reports;
  const totalCount = data?.totalCount ?? 0;
  const [selectedReport, setSelectedReport] = useState<ReportWithContext | null>(null);

  return (
    <>
      <div className="border-b border-zinc-100 bg-white px-8 pb-5 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.5px] text-zinc-900">
              Reports
            </h1>
            <p className="mt-1 text-[13px] text-zinc-400">
              Fila de reports de comentários
            </p>
          </div>
          <ReportFilters status={statusFilter} onStatusChange={setStatusFilter} />
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
              emptyMessage="Nenhum report encontrado"
              emptyIcon={<Flag className="h-8 w-8" />}
              pageSize={100}
            />
            {totalCount > 20 && (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[12px] text-zinc-400">
                  {page * 20 + 1}–{Math.min((page + 1) * 20, totalCount)} de {totalCount}
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
                    Próximo
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedReport && (
        <ReportDrawer
          report={selectedReport}
          open={!!selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </>
  );
}
