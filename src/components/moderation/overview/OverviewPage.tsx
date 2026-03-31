'use client';

import { useNavigate } from 'react-router-dom';
import { useReports, useModerationStats } from '@/hooks/moderation/useReports';
import { StatsCards } from './StatsCards';
import { ModerationDataTable, type Column } from '../shared/ModerationDataTable';
import { StatusDot } from '../shared/StatusDot';
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
    key: 'type',
    label: 'Tipo',
    width: '90px',
    render: () => <span className="text-[12px] text-zinc-500">Comentário</span>,
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
        {row.status === 'pending' ? 'Pendente' : 'Resolvido'}
      </span>
    ),
  },
];

export function OverviewPage() {
  const { data: stats, isLoading: statsLoading } = useModerationStats();
  const { data: reports, isLoading: reportsLoading } = useReports();
  const navigate = useNavigate();

  const recentReports = (reports ?? []).slice(0, 5);

  return (
    <>
      {/* Header */}
      <div className="border-b border-zinc-100 bg-white px-8 pb-5 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.5px] text-zinc-900">
              Overview
            </h1>
            <p className="mt-1 text-[13px] text-zinc-400">
              Atividade dos últimos 7 dias
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-8">
        <StatsCards stats={stats} isLoading={statsLoading} />

        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[14px] font-bold tracking-[-0.2px] text-zinc-900">
              Reports recentes
            </span>
            <button
              onClick={() => navigate('/moderacao/reports')}
              className="text-[12px] font-semibold text-violet-600 hover:text-violet-700"
            >
              Ver todos →
            </button>
          </div>
          {reportsLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            </div>
          ) : (
            <ModerationDataTable
              columns={columns}
              data={recentReports}
              onRowClick={() => navigate('/moderacao/reports')}
              rowKey={(r) => r.id}
              emptyMessage="Nenhum report encontrado"
            />
          )}
        </div>
      </div>
    </>
  );
}
