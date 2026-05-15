'use client';

type SimuladosFreq = 'nenhum' | 'mensal' | 'quinzenal' | 'semanal';

const FREQ_LABEL: Record<SimuladosFreq, { title: string; sub: string }> = {
  nenhum: { title: 'Não quero', sub: 'Só estudo regular' },
  mensal: { title: 'Mensal', sub: '1 a cada 4 semanas' },
  quinzenal: { title: 'Quinzenal', sub: '1 a cada 2 semanas' },
  semanal: { title: 'Semanal', sub: 'Todo fim de semana' },
};

export function ExtrasStep({
  simuladosFreq,
  temRedacao,
  onPickFreq,
  onToggleRedacao,
}: {
  simuladosFreq: SimuladosFreq | undefined;
  temRedacao: boolean | undefined;
  onPickFreq: (f: SimuladosFreq) => void;
  onToggleRedacao: (v: boolean) => void;
}) {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-10">
      <section>
        <div className="text-[10px] tracking-[0.18em] uppercase text-slate-400 font-semibold mb-3">
          Simulados periódicos
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(FREQ_LABEL) as SimuladosFreq[]).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => onPickFreq(f)}
              className={`
                text-left rounded-2xl border p-4 transition
                ${simuladosFreq === f
                  ? 'bg-emerald-500/10 border-emerald-400 ring-1 ring-emerald-400/40'
                  : 'border-slate-700 hover:border-slate-500'}
              `}
            >
              <div className="text-sm font-semibold text-slate-100">{FREQ_LABEL[f].title}</div>
              <div className="text-xs text-slate-400 mt-1">{FREQ_LABEL[f].sub}</div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="text-[10px] tracking-[0.18em] uppercase text-slate-400 font-semibold mb-3">
          Redação
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!temRedacao}
            onChange={(e) => onToggleRedacao(e.target.checked)}
            className="w-5 h-5 rounded accent-emerald-500"
          />
          <div>
            <div className="text-sm text-slate-100">Quero treinar redação semanalmente</div>
            <div className="text-xs text-slate-400 mt-0.5">Reserva ~1h por semana</div>
          </div>
        </label>
      </section>
    </div>
  );
}
