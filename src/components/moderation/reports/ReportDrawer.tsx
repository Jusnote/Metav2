'use client';

import { ModerationDrawer } from '../shared/ModerationDrawer';
import { ActionBar } from '../shared/ActionBar';
import { ContentPreview } from '../shared/ContentPreview';
import { Timeline } from '../shared/Timeline';
import { StatusDot } from '../shared/StatusDot';
import { useReportMutations } from '@/hooks/moderation/useReports';
import { useModerationLog } from '@/hooks/moderation/useModerationLog';
import type { ReportWithContext } from '@/types/moderation';
import { toast } from 'sonner';
import { Trash2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  offensive: 'Ofensivo',
  incorrect: 'Incorreto',
  other: 'Outro',
};

interface ReportDrawerProps {
  report: ReportWithContext;
  open: boolean;
  onClose: () => void;
}

export function ReportDrawer({ report, open, onClose }: ReportDrawerProps) {
  const { resolveReport, isResolving } = useReportMutations();
  const { data: logEntries } = useModerationLog('comment', report.comment_id);

  const isPending = report.status === 'pending';

  const handleResolve = async (resolution: 'resolve' | 'dismiss') => {
    await resolveReport({ reportId: report.id, resolution });
    toast.success(resolution === 'resolve' ? 'Report resolvido' : 'Report descartado');
    onClose();
  };

  const handleDeleteContent = async () => {
    if (!window.confirm('Tem certeza que deseja deletar este comentário? Esta ação segue LGPD (soft delete).')) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await (supabase as any).rpc('handle_soft_delete', {
      p_comment_id: report.comment_id,
      p_user_id: user.id,
    });
    if (error) {
      toast.error('Erro ao deletar comentário');
      return;
    }

    await supabase.from('moderation_log').insert({
      actor_id: user.id,
      target_type: 'comment' as any,
      target_id: report.comment_id,
      action: 'delete_content' as any,
    });

    toast.success('Comentário deletado (LGPD)');
    onClose();
  };

  return (
    <ModerationDrawer
      open={open}
      onClose={onClose}
      title="Detalhes do Report"
      subtitle={`Questão #${report.comment_question_id}`}
      footer={
        isPending ? (
          <ActionBar>
            <button
              onClick={() => handleResolve('resolve')}
              disabled={isResolving}
              className="rounded-md bg-violet-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
            >
              Procedente
            </button>
            <button
              onClick={() => handleResolve('dismiss')}
              disabled={isResolving}
              className="rounded-md bg-zinc-100 px-4 py-2 text-[13px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-200 disabled:opacity-50"
            >
              Improcedente
            </button>
            <div className="flex-1" />
            <button
              onClick={handleDeleteContent}
              className="rounded-md bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600 transition-colors hover:bg-red-100"
              title="Deletar comentário (LGPD soft delete)"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </ActionBar>
        ) : undefined
      }
    >
      {/* Status */}
      <div className="mb-5 flex items-center gap-2">
        <StatusDot
          severity={isPending ? (report.reason === 'offensive' ? 'high' : 'medium') : 'resolved'}
        />
        <span className="text-[13px] font-semibold text-zinc-900">
          {isPending ? 'Pendente' : 'Resolvido'}
        </span>
        <span className="text-[12px] text-zinc-400">
          — {REASON_LABELS[report.reason] ?? report.reason}
        </span>
      </div>

      {/* Content preview */}
      <div className="mb-5">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-400">
          Conteúdo reportado
        </h3>
        <ContentPreview
          type="comment"
          contentJson={report.comment_content_json}
          contentText={report.comment_content_text}
          authorName={report.comment_author_name}
          authorEmail={report.comment_author_email}
          questionId={report.comment_question_id}
        />
      </div>

      {/* Context link */}
      <div className="mb-5">
        <a
          href={`/questoes?id=${report.comment_question_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-violet-600 transition-colors hover:text-violet-700"
        >
          <ExternalLink className="h-3 w-3" />
          Ver questão #{report.comment_question_id} no contexto
        </a>
      </div>

      {/* Reporter info */}
      <div className="mb-5">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-400">
          Reportado por
        </h3>
        <div className="rounded-lg border border-zinc-100 bg-[#fafafa] p-3">
          <p className="text-[13px] font-medium text-zinc-700">
            {report.reporter_name ?? report.reporter_email ?? 'Anônimo'}
          </p>
          <p className="mt-0.5 text-[12px] text-zinc-400">
            {report.report_count_by_reporter} reports feitos no total
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-400">
          Timeline
        </h3>
        <Timeline entries={logEntries ?? []} />
      </div>
    </ModerationDrawer>
  );
}
