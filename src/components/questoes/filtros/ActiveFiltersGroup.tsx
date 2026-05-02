'use client';

export interface ActiveFiltersGroupProps {
  label: string;
  items: string[];
  onClearGroup: () => void;
  onRemoveItem: (value: string) => void;
}

export function ActiveFiltersGroup({
  label,
  items,
  onClearGroup,
  onRemoveItem,
}: ActiveFiltersGroupProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
          {label}
        </span>
        <button
          type="button"
          onClick={onClearGroup}
          aria-label={`limpar grupo ${label}`}
          className="text-slate-400 hover:text-slate-600 px-1 leading-none"
        >
          ✕
        </button>
      </div>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li
            key={item}
            className="group flex items-center justify-between gap-2 pl-3 py-0.5 border-l-2 border-amber-400"
          >
            <span className="text-sm text-slate-700 truncate">{item}</span>
            <button
              type="button"
              onClick={() => onRemoveItem(item)}
              aria-label={`remover ${item}`}
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 px-1 leading-none transition-opacity"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
