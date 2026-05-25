'use client';

import { Check, RotateCcw, Diamond, Bookmark, Pencil, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DispositivoStatus } from '@/hooks/useDispositivoUserStatus';

interface Props {
  status: DispositivoStatus | undefined;
  bookmarked: boolean;
  commentCount: number;
  hasNote: boolean;
  onToggleStatus: (status: DispositivoStatus) => void;
  onToggleBookmark: () => void;
  onOpenNote: () => void;
  onOpenComments: () => void;
}

export function ActionPillRail({
  status,
  bookmarked,
  commentCount,
  hasNote,
  onToggleStatus,
  onToggleBookmark,
  onOpenNote,
  onOpenComments,
}: Props) {
  return (
    <div
      className="mt-4 flex items-center gap-1.5 flex-wrap"
      role="toolbar"
      aria-label="Ações do artigo"
    >
      <ActionPill
        active={status === 'estudado'}
        onClick={() => onToggleStatus('estudado')}
        Icon={Check}
        label="Estudado"
      />
      <ActionPill
        active={status === 'revisar'}
        onClick={() => onToggleStatus('revisar')}
        Icon={RotateCcw}
        label="Revisar"
      />
      <ActionPill
        active={status === 'decorar'}
        onClick={() => onToggleStatus('decorar')}
        Icon={Diamond}
        label="Decorar"
      />
      {/* Gap maior separando os 3 status dos 3 outros, sem barra divisora */}
      <div className="w-3" aria-hidden />
      <ActionPill
        active={bookmarked}
        onClick={onToggleBookmark}
        Icon={Bookmark}
        label="Favorito"
      />
      <ActionPill
        active={hasNote}
        onClick={onOpenNote}
        Icon={Pencil}
        label={hasNote ? 'Anotação' : 'Anotar'}
      />
      <ActionPill
        active={false}
        onClick={onOpenComments}
        Icon={MessageSquare}
        label={commentCount > 0 ? String(commentCount) : 'Comentar'}
        forceLabel={commentCount > 0}
      />
    </div>
  );
}

interface PillProps {
  active: boolean;
  onClick: () => void;
  Icon: LucideIcon;
  label: string;
  forceLabel?: boolean;
}

function ActionPill({ active, onClick, Icon, label, forceLabel }: PillProps) {
  // Tamanho fixo h-6 px-2: só muda cor entre estados.
  // Label só aparece em hover/focus (ou forceLabel pra count de comentários).
  // Active = só inverte cor, NÃO cresce.
  const showLabel = forceLabel;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={
        'group inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-medium transition-colors ' +
        (active
          ? 'bg-n-ink text-n-bg'
          : 'bg-transparent text-n-ink-3 hover:bg-n-rule-2 hover:text-n-ink focus-visible:bg-n-rule-2 focus-visible:text-n-accent')
      }
    >
      <Icon size={12} strokeWidth={1.6} />
      <span
        className={
          showLabel
            ? 'inline'
            : 'sr-only group-hover:not-sr-only group-hover:inline group-focus-visible:not-sr-only group-focus-visible:inline'
        }
      >
        {label}
      </span>
    </button>
  );
}
