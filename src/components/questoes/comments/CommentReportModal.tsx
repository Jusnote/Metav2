'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'ofensivo', label: 'Conteúdo ofensivo' },
  { value: 'errado', label: 'Informação errada' },
  { value: 'outro', label: 'Outro' },
] as const;

type ReportReason = (typeof REPORT_REASONS)[number]['value'];

interface CommentReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commentId: string | null;
}

export function CommentReportModal({ open, onOpenChange, commentId }: CommentReportModalProps) {
  const [reason, setReason] = React.useState<ReportReason>('spam');
  const [details, setDetails] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      setReason('spam');
      setDetails('');
    }
  }, [open]);

  const handleSubmit = React.useCallback(async () => {
    if (!commentId) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('question_comment_reports')
        .insert({
          comment_id: commentId,
          reporter_id: user.id,
          reason,
          details: reason === 'outro' ? details || null : null,
        });
      if (error) throw error;

      toast.success('Denúncia enviada');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao enviar denúncia. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }, [commentId, reason, details, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Denunciar comentário</DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            Selecione o motivo da denúncia.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2">
          {REPORT_REASONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            >
              <input
                type="radio"
                name="report-reason"
                value={opt.value}
                checked={reason === opt.value}
                onChange={() => setReason(opt.value)}
                className="accent-zinc-900 dark:accent-zinc-100"
              />
              <span className="text-zinc-700 dark:text-zinc-300">{opt.label}</span>
            </label>
          ))}

          {reason === 'outro' && (
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Descreva o problema (opcional)"
              rows={3}
              className="mt-1 w-full resize-none rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:text-zinc-300 dark:placeholder:text-zinc-500"
            />
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="rounded-md px-4 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {submitting ? 'Enviando...' : 'Enviar denúncia'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
