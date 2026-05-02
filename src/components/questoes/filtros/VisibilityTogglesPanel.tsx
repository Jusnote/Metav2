'use client';
import type { AppliedFilters, VisibilityState } from '@/lib/questoes/filter-serialization';

interface ToggleRowProps {
  groupKey: string;
  label: string;
  options: { value: string; label: string }[];
  selectedValue: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

function ToggleRow({
  groupKey,
  label,
  options,
  selectedValue,
  onChange,
  disabled = false,
}: ToggleRowProps) {
  return (
    <div
      data-toggle-group={groupKey}
      aria-disabled={disabled || undefined}
      title={disabled ? 'em breve' : undefined}
      className={['flex flex-col gap-1', disabled && 'opacity-50'].filter(Boolean).join(' ')}
    >
      <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
        {label}
      </div>
      <div className="flex gap-3 text-xs text-slate-700">
        {options.map((opt) => {
          const checked = opt.value === selectedValue;
          return (
            <label
              key={opt.value}
              className={[
                'flex items-center gap-1.5',
                disabled ? 'cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              <input
                type="radio"
                name={`vis-${groupKey}`}
                value={opt.value}
                checked={checked}
                disabled={disabled}
                onChange={() => {
                  if (!disabled && onChange) onChange(opt.value);
                }}
                aria-label={`${opt.label} ${label}`}
                className="accent-slate-900"
              />
              <span className={checked ? 'font-medium text-slate-900' : ''}>
                {opt.label}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export interface VisibilityTogglesPanelProps {
  pendentes: AppliedFilters;
  onChange: (patch: Partial<AppliedFilters>) => void;
}

export function VisibilityTogglesPanel({
  pendentes,
  onChange,
}: VisibilityTogglesPanelProps) {
  const anuladas = pendentes.visibility_anuladas ?? 'mostrar';
  const desatualizadas = pendentes.visibility_desatualizadas ?? 'mostrar';

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <ToggleRow
        groupKey="anuladas"
        label="Anuladas"
        options={[
          { value: 'mostrar', label: 'Mostrar' },
          { value: 'esconder', label: 'Esconder' },
        ]}
        selectedValue={anuladas}
        onChange={(v) =>
          onChange({ visibility_anuladas: v as VisibilityState })
        }
      />
      <ToggleRow
        groupKey="desatualizadas"
        label="Desatualizadas"
        options={[
          { value: 'mostrar', label: 'Mostrar' },
          { value: 'esconder', label: 'Esconder' },
        ]}
        selectedValue={desatualizadas}
        onChange={(v) =>
          onChange({ visibility_desatualizadas: v as VisibilityState })
        }
      />
      <ToggleRow
        groupKey="ja_respondidas"
        label="Já respondidas"
        options={[
          { value: 'mostrar', label: 'Mostrar' },
          { value: 'esconder', label: 'Esconder' },
        ]}
        selectedValue="mostrar"
        disabled
      />
      <ToggleRow
        groupKey="errei_antes"
        label="Errei antes"
        options={[
          { value: 'mostrar', label: 'Mostrar' },
          { value: 'esconder', label: 'Esconder' },
          { value: 'somente', label: 'Somente' },
        ]}
        selectedValue="mostrar"
        disabled
      />
    </div>
  );
}
