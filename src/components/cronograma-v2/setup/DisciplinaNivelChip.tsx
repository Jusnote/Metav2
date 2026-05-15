'use client';

type Nivel = 'iniciante' | 'intermediario' | 'avancado';

const LABEL: Record<Nivel, string> = {
  iniciante: 'INI',
  intermediario: 'INT',
  avancado: 'AVA',
};
const TITLE: Record<Nivel, string> = {
  iniciante: 'Iniciante (+50% tempo)',
  intermediario: 'Intermediário (tempo base)',
  avancado: 'Avançado (-30% tempo)',
};

export function DisciplinaNivelChip({
  current,
  onChange,
  disabled,
}: {
  current: Nivel;
  onChange: (n: Nivel) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-full border border-slate-700 bg-slate-900/60 p-0.5">
      {(['iniciante', 'intermediario', 'avancado'] as const).map(n => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          title={TITLE[n]}
          className={`
            px-2.5 py-1 text-[10px] font-semibold rounded-full transition
            ${current === n
              ? 'bg-emerald-500 text-slate-900 shadow'
              : 'text-slate-400 hover:text-slate-200'}
          `}
        >
          {LABEL[n]}
        </button>
      ))}
    </div>
  );
}
