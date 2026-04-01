'use client';

interface DispositivoGutterProps {
  liked: boolean;
  onToggleLike: () => void;
  incidencia: number | null;
  commentsCount: number;
  hasNote: boolean;
  footerOpen: boolean;
  onToggleFooter: () => void;
}

export function DispositivoGutter({
  liked,
  onToggleLike,
  incidencia,
  commentsCount,
  hasNote,
  footerOpen,
  onToggleFooter,
}: DispositivoGutterProps) {
  const hasContent = liked || commentsCount > 0 || hasNote;

  return (
    <div
      className={`flex items-center flex-shrink-0 ml-3 pt-[6px] transition-opacity duration-200 ${
        hasContent ? 'opacity-100' : 'opacity-0 group-hover/disp:opacity-100'
      }`}
    >
      {/* Zone 1: Like toggle */}
      <div className="flex items-center gap-[3px] px-[5px]">
        <button
          onClick={onToggleLike}
          aria-label={liked ? 'Descurtir' : 'Curtir'}
          className={`w-[26px] h-[26px] flex items-center justify-center rounded-[7px] border-none bg-transparent cursor-pointer transition-all duration-150 ${
            liked
              ? 'text-[15px] hover:bg-[#f5f5f4] hover:scale-110'
              : 'text-[#d4d4d4] hover:bg-[#f5f5f4] hover:text-[#dc7c7c]'
          }`}
        >
          {liked ? (
            <span className="text-[15px] leading-none">{'\u2764\uFE0F'}</span>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          )}
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-[#eceae7] flex-shrink-0" />

      {/* Zone 2: Question incidence */}
      <div className="flex items-center gap-[3px] px-[5px]">
        {incidencia != null && incidencia > 0 ? (
          <span className="flex items-center gap-[2px] px-[5px] py-[2px] rounded-lg text-[12px] font-[Inter,sans-serif]">
            {'\uD83D\uDD25'}<span className="text-[9px] text-[#bbb] font-semibold">{incidencia}</span>
          </span>
        ) : (
          <span className="text-[9px] text-[#ddd] font-[Inter,sans-serif] px-[2px]">{'\u2014'}</span>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-[#eceae7] flex-shrink-0" />

      {/* Zone 3: More button + badges */}
      <div className="flex items-center px-[5px]">
        <button
          onClick={onToggleFooter}
          aria-label="A\u00E7\u00F5es do dispositivo"
          className={`h-[26px] flex items-center gap-[3px] px-[5px] rounded-[7px] border-none bg-transparent cursor-pointer transition-all duration-150 ${
            footerOpen
              ? 'bg-[#f0f0ef] text-[#555]'
              : 'text-[#d4d4d4] hover:bg-[#f5f5f4] hover:text-[#888]'
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
          </svg>
          {(commentsCount > 0 || hasNote) && (
            <span className="flex items-center gap-[2px] ml-[1px]">
              {commentsCount > 0 && (
                <span className="flex items-center gap-[1px] text-[9px] font-[Inter,sans-serif] text-[#7c3aed]">
                  {'\uD83D\uDCAC'}<span className="text-[8px] font-bold">{commentsCount}</span>
                </span>
              )}
              {commentsCount > 0 && hasNote && (
                <span className="w-px h-[8px] bg-[#e8e8e6]" />
              )}
              {hasNote && (
                <span className="text-[9px] text-[#d97706]">{'\u270F\uFE0F'}</span>
              )}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
