'use client';

import type { ModerationLogEntry } from '@/types/moderation';

const ACTION_LABELS: Record<string, string> = {
  ban: 'Baniu o usuário',
  shadowban: 'Aplicou shadowban',
  unban: 'Removeu banimento',
  unshadowban: 'Removeu shadowban',
  role_change: 'Alterou role',
  report_resolve: 'Resolveu report (procedente)',
  report_dismiss: 'Resolveu report (improcedente)',
  delete_content: 'Deletou conteúdo',
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d atrás`;
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

interface TimelineProps {
  entries: ModerationLogEntry[];
}

export function Timeline({ entries }: TimelineProps) {
  if (entries.length === 0) {
    return (
      <p className="py-4 text-center text-[12px] text-zinc-400">
        Nenhuma ação registrada
      </p>
    );
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, i) => (
        <div key={entry.id} className="flex gap-3 py-2.5">
          <div className="flex flex-col items-center">
            <div className="h-2 w-2 rounded-full bg-violet-300" />
            {i < entries.length - 1 && (
              <div className="w-px flex-1 bg-zinc-100" />
            )}
          </div>
          <div className="-mt-0.5 min-w-0 flex-1">
            <p className="text-[12px] text-zinc-600">
              <span className="font-semibold text-zinc-900">
                {entry.actor_name ?? entry.actor_email ?? 'Sistema'}
              </span>{' '}
              {ACTION_LABELS[entry.action] ?? entry.action}
            </p>
            {entry.details && Object.keys(entry.details).length > 0 && (
              <p className="mt-0.5 text-[11px] text-zinc-400">
                {(entry.details.reason as string) ??
                  (entry.details.role_from
                    ? `${entry.details.role_from} → ${entry.details.role_to}`
                    : null)}
              </p>
            )}
            <p className="mt-0.5 text-[11px] text-zinc-300">
              {relativeTime(entry.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
