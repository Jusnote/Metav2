import { Check } from 'lucide-react';

export interface FilterCheckboxItemProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  count?: number;
  disabled?: boolean;
}

/**
 * Linha checkable padronizada pra pickers (Banca, Ano, Órgão, etc).
 *
 * Layout: checkbox quadrado à esquerda (24px) + label + count opcional à direita.
 * Click em qualquer ponto do item toggla. Hover destaca o fundo.
 *
 * Componente puro — sem estado interno. Pai controla `checked` e responde ao `onToggle`.
 */
export function FilterCheckboxItem({
  label,
  checked,
  onToggle,
  count,
  disabled = false,
}: FilterCheckboxItemProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={checked}
      className={[
        'group flex items-center gap-3 w-full px-2 py-1.5 rounded-md text-left transition-colors',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:bg-slate-50 cursor-pointer',
      ].join(' ')}
    >
      <span
        className={[
          'inline-flex items-center justify-center w-4 h-4 rounded-md border transition-colors shrink-0',
          checked
            ? 'bg-[#1e3a8a] border-[#1e3a8a] text-white shadow-none'
            : 'bg-zinc-100 border-zinc-200/80 shadow-[inset_0_1px_2px_0_rgb(0_0_0/0.05)] group-hover:bg-zinc-200/70',
        ].join(' ')}
        aria-hidden="true"
      >
        {checked && <Check className="w-3 h-3" strokeWidth={3} />}
      </span>

      <span className="flex-1 text-sm text-slate-800 truncate">{label}</span>

      {count !== undefined && (
        <span className="text-xs text-slate-400 tabular-nums shrink-0">
          {count.toLocaleString('pt-BR')}
        </span>
      )}
    </button>
  );
}
