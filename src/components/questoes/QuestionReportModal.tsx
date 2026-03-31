'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  useSubmitQuestionReport,
  QUESTION_REPORT_REASONS,
  type QuestionReportReason,
} from '@/hooks/useQuestionReport';

interface QuestionReportModalProps {
  open: boolean;
  onClose: () => void;
  questaoId: number;
  materia?: string;
  assunto?: string;
}

export function QuestionReportModal({
  open,
  onClose,
  questaoId,
  materia,
  assunto,
}: QuestionReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<QuestionReportReason | null>(null);
  const [details, setDetails] = useState('');
  const { mutateAsync: submitReport, isPending } = useSubmitQuestionReport();

  const handleSubmit = async () => {
    if (!selectedReason) return;

    try {
      await submitReport({
        questionId: questaoId,
        reason: selectedReason,
        details: details.trim() || undefined,
        materia,
        assunto,
      });
      toast.success('Report enviado com sucesso');
      handleClose();
    } catch {
      toast.error('Erro ao enviar report. Tente novamente.');
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDetails('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[440px] gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-[16px] font-bold tracking-tight text-zinc-900">
            Reportar questao
          </DialogTitle>
          <DialogDescription className="mt-1 text-[12px] text-zinc-400">
            Questao #{questaoId}
            {materia && <> &middot; {materia}</>}
            {assunto && <> &middot; {assunto}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.5px] text-zinc-400">
            Motivo
          </p>
          <div className="space-y-1.5">
            {QUESTION_REPORT_REASONS.map((r) => (
              <label
                key={r.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-all ${
                  selectedReason === r.value
                    ? 'border-violet-300 bg-violet-50/50 shadow-[0_0_0_1px_rgba(124,58,237,0.15)]'
                    : 'border-zinc-100 bg-white hover:border-zinc-200 hover:bg-zinc-50/50'
                }`}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r.value}
                  checked={selectedReason === r.value}
                  onChange={() => setSelectedReason(r.value)}
                  className="mt-0.5 h-3.5 w-3.5 accent-violet-600"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-[13px] font-medium text-zinc-800">
                    {r.label}
                  </span>
                  {r.desc && (
                    <p className="mt-0.5 text-[11px] text-zinc-400">{r.desc}</p>
                  )}
                </div>
              </label>
            ))}
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.5px] text-zinc-400">
              Detalhes (opcional)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Descreva o problema com mais detalhes..."
              className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-[13px] text-zinc-700 placeholder:text-zinc-300 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="border-t border-zinc-100 px-6 py-4">
          <button
            onClick={handleClose}
            className="rounded-md px-4 py-2 text-[13px] font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedReason || isPending}
            className="rounded-md bg-violet-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Enviando...' : 'Enviar report'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
