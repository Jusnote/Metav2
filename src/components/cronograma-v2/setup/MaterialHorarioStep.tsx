'use client';

type TipoMaterial = 'video' | 'pdf' | 'livro' | 'questoes' | 'misto';
type Horario = 'manha' | 'tarde' | 'noite' | 'madrugada' | 'flexivel';

const MATERIAL_LABEL: Record<TipoMaterial, string> = {
  video: 'Vídeo-aula',
  pdf: 'PDF / Apostila',
  livro: 'Livro',
  questoes: 'Resolução de questões',
  misto: 'Misto',
};
const HORARIO_LABEL: Record<Horario, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  madrugada: 'Madrugada',
  flexivel: 'Flexível',
};

export function MaterialHorarioStep({
  tipoMaterial,
  horario,
  onPickMaterial,
  onPickHorario,
}: {
  tipoMaterial: TipoMaterial | undefined;
  horario: Horario | undefined;
  onPickMaterial: (m: TipoMaterial) => void;
  onPickHorario: (h: Horario) => void;
}) {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      <section>
        <div className="text-[10px] tracking-[0.18em] uppercase text-slate-400 font-semibold mb-3">
          Tipo de material
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(MATERIAL_LABEL) as TipoMaterial[]).map(m => (
            <Pill key={m} active={tipoMaterial === m} onClick={() => onPickMaterial(m)} label={MATERIAL_LABEL[m]} />
          ))}
        </div>
      </section>
      <section>
        <div className="text-[10px] tracking-[0.18em] uppercase text-slate-400 font-semibold mb-3">
          Quando você costuma estudar
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(HORARIO_LABEL) as Horario[]).map(h => (
            <Pill key={h} active={horario === h} onClick={() => onPickHorario(h)} label={HORARIO_LABEL[h]} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Pill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-4 py-2 rounded-full text-sm font-medium border transition
        ${active
          ? 'bg-emerald-500 text-slate-900 border-emerald-500'
          : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-slate-100'}
      `}
    >
      {label}
    </button>
  );
}
