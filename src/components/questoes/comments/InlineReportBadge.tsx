'use client';

interface InlineReportBadgeProps {
  commentId: string;
  pendingCount?: number;
}

export function InlineReportBadge({ commentId, pendingCount }: InlineReportBadgeProps) {
  if (!pendingCount || pendingCount === 0) return null;

  return (
    <span
      className="flex items-center gap-1 text-[11px] tabular-nums text-violet-600"
      title={`${pendingCount} report(s) pendente(s)`}
    >
      <span className="h-[6px] w-[6px] rounded-full bg-violet-600" />
      {pendingCount}
    </span>
  );
}
