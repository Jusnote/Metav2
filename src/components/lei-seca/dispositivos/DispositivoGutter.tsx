'use client';

import { memo } from 'react';
import { Heart, Minus, MoreHorizontal, Pencil, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DispositivoGutterProps {
  liked: boolean;
  onToggleLike: () => void;
  commentsCount: number;
  hasNote: boolean;
  footerOpen: boolean;
  onToggleFooter: () => void;
  onHide?: () => void;
  onAnnotate?: () => void;
}

export const DispositivoGutter = memo(function DispositivoGutter({
  liked,
  onToggleLike,
  commentsCount,
  hasNote,
  footerOpen,
  onToggleFooter,
  onHide,
  onAnnotate,
}: DispositivoGutterProps) {
  const hasContent = liked || commentsCount > 0 || hasNote;

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 shrink-0 ml-3 pt-0.5",
        "transition-opacity duration-150",
        hasContent ? "opacity-100" : "opacity-0 group-hover/disp:opacity-100"
      )}
    >
      {/* Favoritar */}
      <button
        data-tip={liked ? 'Descurtir' : 'Favoritar'}
        onClick={onToggleLike}
        className={cn(
          "p-1 rounded transition-colors hover:bg-muted",
          liked
            ? "text-red-500"
            : "text-muted-foreground/50 hover:text-red-500"
        )}
      >
        <Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} />
      </button>

      <span className="text-muted-foreground/20">|</span>

      {/* Ocultar */}
      <button
        data-tip="Ocultar"
        onClick={onHide}
        className="p-1 rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>

      <span className="text-muted-foreground/20">|</span>

      {/* Mais (abre footer) */}
      <button
        data-tip="Mais"
        onClick={onToggleFooter}
        className={cn(
          "p-1 rounded transition-colors",
          footerOpen
            ? "text-foreground bg-muted"
            : "text-muted-foreground/50 hover:text-foreground hover:bg-muted"
        )}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>

      {/* Anotar */}
      <button
        data-tip="Anotar"
        onClick={onAnnotate}
        className={cn(
          "p-1 rounded transition-colors",
          hasNote
            ? "text-amber-500"
            : "text-muted-foreground/50 hover:text-foreground hover:bg-muted"
        )}
      >
        <Pencil className={cn("h-3.5 w-3.5", hasNote && "fill-amber-500/20")} />
      </button>

      {/* Comentários (só aparece se tem) */}
      {commentsCount > 0 && (
        <>
          <span className="text-muted-foreground/20">|</span>
          <button
            data-tip={`${commentsCount} comentário${commentsCount > 1 ? 's' : ''}`}
            onClick={onToggleFooter}
            className="flex items-center gap-0.5 p-1 rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="text-[11px]">{commentsCount}</span>
          </button>
        </>
      )}
    </div>
  );
});
