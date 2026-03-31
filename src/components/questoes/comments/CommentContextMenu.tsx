'use client';

import { MoreHorizontal, Pencil, Trash2, Flag, Pin, Crown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface CommentContextMenuProps {
  commentId: string;
  questionId: number;
  isAuthor: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
  onPin?: () => void;
  onEndorse?: () => void;
  isPinned?: boolean;
  isEndorsed?: boolean;
}

export function CommentContextMenu({
  isAuthor,
  onEdit,
  onDelete,
  onReport,
  onPin,
  onEndorse,
  isPinned,
  isEndorsed,
}: CommentContextMenuProps) {
  const hasProfessorActions = onPin || onEndorse;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 transition-colors hover:text-zinc-600 focus:outline-none"
          aria-label="Opções do comentário"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {isAuthor ? (
          <>
            <DropdownMenuItem onClick={onEdit} className="gap-2">
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="gap-2 text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onClick={onReport} className="gap-2">
            <Flag className="h-3.5 w-3.5" />
            Reportar
          </DropdownMenuItem>
        )}
        {hasProfessorActions && <DropdownMenuSeparator />}
        {onPin && (
          <DropdownMenuItem onClick={onPin} className="gap-2">
            <Pin className="h-3.5 w-3.5" />
            {isPinned ? 'Desfixar' : 'Fixar'}
          </DropdownMenuItem>
        )}
        {onEndorse && (
          <DropdownMenuItem onClick={onEndorse} className="gap-2">
            <Crown className="h-3.5 w-3.5" />
            {isEndorsed ? 'Remover endosso' : 'Endossar'}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
