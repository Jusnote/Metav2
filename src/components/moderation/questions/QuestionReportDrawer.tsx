'use client';

import { ModerationDrawer } from '../shared/ModerationDrawer';
import { ActionBar } from '../shared/ActionBar';
import { StatusDot } from '../shared/StatusDot';
import { Timeline } from '../shared/Timeline';
import { useQuestionReportMutations, type QuestionReportRow } from '@/hooks/moderation/useQuestionReports';
import { useModerationLog } from '@/hooks/moderation/useModerationLog';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';

const REASON_LABELS: Record<string, string> = {
  desatualizada: 'Desatualizada',
  gabarito_errado: 'Gabarito errado',
  enunciado_incompleto: 'Enunciado incompleto',
  classificacao_errada: 'Classificacao errada',
  outro: 'Outro',
};

interface QuestionReportDrawerProps {
  report: QuestionReportRow;
  open: boolean;
  onClose: () => void;
}

export function QuestionReportDrawer({ report, open, onClose }: QuestionReportDrawerProps) {
  const { resolveReport, isResolving } = useQuestionReportMutations();
  const { data: logEntries } = useModerationLog('question', report.id);

  const isPending = report.status === 'pending';

  const handleResolve = async (resolution: 'resolve' | 'dismiss') => {
    try {
      await resolveReport({ reportId: report.id, resolution });
      toast.success(resolution === 'resolve' ? 'Report resolvido' : 'Report descartado');
      onClose();
    } catch {
      toast.error('Erro ao resolver report. Tente novamente.');
    }
  };

  return (
    <ModerationDrawer
      open={open}
      onClose={onClose}
      title="Report de Questao"
      subtitle={`Questao #${report.question_id}`}
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
            <a
              href={`/questoes?id=${report.question_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-50 px-3 py-2 text-[12px] font-semibold text-zinc-600 transition-colors hover:bg-zinc-100"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver questao
            </a>
          </ActionBar>
        ) : undefined
      }
    >
      {/* Status */}
      <div className="mb-5 flex items-center gap-2">
        <StatusDot
          severity={isPending ? (report.reason === 'gabarito_errado' ? 'high' : 'medium') : 'resolved'}
        />
        <span className="text-[13px] font-semibold text-zinc-900">
          {isPending ? 'Pendente' : report.status === 'resolved' ? 'Resolvido' : 'Descartado'}
        </span>
        <span className="text-[12px] text-zinc-400">
          -- {REASON_LABELS[report.reason] ?? report.reason}
        </span>
      </div>

      {/* Question info */}
      <div className="mb-5">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-400">
          Questao
        </h3>
        <div className="rounded-lg border border-zinc-100 bg-[#fafafa] p-3">
          <p className="text-[13px] font-medium text-zinc-700">
            Questao #{report.question_id}
          </p>
          {(report.materia || report.assunto) && (
            <p className="mt-0.5 text-[12px] text-zinc-400">
              {report.materia}
              {report.assunto && ` / ${report.assunto}`}
            </p>
          )}
        </div>
      </div>

      {/* Details */}
      {report.details && (
        <div className="mb-5">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-400">
            Detalhes
          </h3>
          <p className="rounded-lg border border-zinc-100 bg-[#fafafa] p-3 text-[13px] leading-[1.55] text-zinc-600">
            {report.details}
          </p>
        </div>
      )}

      {/* Context link */}
      <div className="mb-5">
        <a
          href={`/questoes?id=${report.question_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-violet-600 transition-colors hover:text-violet-700"
        >
          <ExternalLink className="h-3 w-3" />
          Ver questao #{report.question_id} no contexto
        </a>
      </div>

      {/* Reporter info */}
      <div className="mb-5">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-400">
          Reportado por
        </h3>
        <div className="rounded-lg border border-zinc-100 bg-[#fafafa] p-3">
          <p className="text-[13px] font-medium text-zinc-700">
            {report.reporter_name ?? report.reporter_email ?? 'Anonimo'}
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
