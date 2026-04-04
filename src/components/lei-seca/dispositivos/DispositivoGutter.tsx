'use client';

import { memo } from 'react';
import { Heart, Flame, MessageCircle, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DispositivoGutterProps {
  liked: boolean;
  onToggleLike: () => void;
  incidencia: number | null;
  commentsCount: number;
  hasNote: boolean;
  footerOpen: boolean;
  onToggleFooter: () => void;
}

/**
 * Flame color by incidence level:
 * null/0 = muted (no data), low = light orange, medium = orange, high = deep orange
 */
function getFlameColor(incidencia: number | null): string {
  if (!incidencia || incidencia === 0) return 'text-muted-foreground/20';
  if (incidencia <= 10) return 'text-orange-300';
  if (incidencia <= 50) return 'text-orange-400';
  return 'text-orange-500';
}

function getFlameLabel(incidencia: number | null): string {
  if (!incidencia || incidencia === 0) return 'Incidência em questões';
  return `Caiu em ${incidencia} questões`;
}

export const DispositivoGutter = memo(function DispositivoGutter({
  liked,
  onToggleLike,
  incidencia,
  commentsCount,
  hasNote,
  footerOpen,
  onToggleFooter,
}: DispositivoGutterProps) {
  const hasContent = liked || commentsCount > 0 || hasNote || (incidencia != null && incidencia > 0);
  const flameColor = getFlameColor(incidencia);
  const hasFill = incidencia != null && incidencia > 0;

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

      {/* Incidência — 1 chama, cor por intensidade */}
      <span
        data-tip={getFlameLabel(incidencia)}
        className={cn("p-1 rounded cursor-default", flameColor)}
      >
        <Flame className={cn("h-3.5 w-3.5", hasFill && "fill-current")} />
      </span>

      <span className="text-muted-foreground/20">|</span>

      {/* Badge unificado: 💬N + dot blue para nota */}
      {(commentsCount > 0 || hasNote) && (
        <>
          <button
            data-tip={
              commentsCount > 0 && hasNote
                ? `${commentsCount} comentário${commentsCount > 1 ? 's' : ''} + nota pessoal`
                : commentsCount > 0
                  ? `${commentsCount} comentário${commentsCount > 1 ? 's' : ''}`
                  : 'Nota pessoal'
            }
            onClick={onToggleFooter}
            className="flex items-center gap-[2px] p-1 rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
          >
            <MessageCircle className={cn(
              "h-3.5 w-3.5",
              commentsCount > 0 ? "text-violet-500" : ""
            )} />
            {commentsCount > 0 && (
              <span className="text-[10px] font-bold text-violet-500 tabular-nums">{commentsCount}</span>
            )}
            {hasNote && (
              <span className="w-[5px] h-[5px] rounded-full bg-blue-500 ml-[1px]" />
            )}
          </button>
          <span className="text-muted-foreground/20">|</span>
        </>
      )}

      {/* Mais (abre footer) — sempre por último */}
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
    </div>
  );
});
