import { useEffect, useRef } from 'react';
import { Settings, X, RotateCcw } from 'lucide-react';

interface DayContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onChangeAvailability: () => void;
  onMarkUnavailable: () => void;
  onRestoreDefault: () => void;
  hasException: boolean;
}

export function DayContextMenu({
  x,
  y,
  onClose,
  onChangeAvailability,
  onMarkUnavailable,
  onRestoreDefault,
  hasException,
}: DayContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Menu */}
      <div
        ref={menuRef}
        className="fixed z-50 min-w-[200px] bg-white border border-slate-200 rounded-lg shadow-lg py-1"
        style={{
          left: `${x}px`,
          top: `${y}px`,
        }}
      >
        <button
          onClick={() => {
            onChangeAvailability();
            onClose();
          }}
          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
        >
          <Settings className="w-4 h-4 text-slate-500" />
          Alterar disponibilidade
        </button>

        <button
          onClick={() => {
            onMarkUnavailable();
            onClose();
          }}
          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
        >
          <X className="w-4 h-4 text-slate-500" />
          Marcar como indisponível
        </button>

        {hasException && (
          <>
            <div className="h-px bg-slate-100 my-1" />
            <button
              onClick={() => {
                onRestoreDefault();
                onClose();
              }}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4 text-slate-500" />
              Restaurar padrão
            </button>
          </>
        )}
      </div>
    </>
  );
}
