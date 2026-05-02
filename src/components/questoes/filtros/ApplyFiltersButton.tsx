'use client';

export interface ApplyFiltersButtonProps {
  isDirty: boolean;
  count: number | null;
  onClick: () => void;
}

export function ApplyFiltersButton({
  isDirty,
  count,
  onClick,
}: ApplyFiltersButtonProps) {
  const disabled = !isDirty || count === null;
  const label = isDirty ? 'Aplicar mudanças' : 'Aplicar filtros';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'w-full py-2.5 rounded text-sm font-semibold transition-colors',
        disabled
          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
          : 'bg-slate-900 text-white hover:bg-slate-800',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
