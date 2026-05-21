import { Link } from 'react-router-dom';
import { disciplinaUrl } from '@/lib/papiro/slug';
import type { PapiroDisciplinaResumo } from '@/lib/papiro/types';

interface Props {
  disciplina: PapiroDisciplinaResumo;
  coming?: boolean;
}

export function DisciplinaCard({ disciplina, coming = false }: Props) {
  const meta = coming
    ? 'curadoria em andamento'
    : `${disciplina.macroAreasCount} área${disciplina.macroAreasCount === 1 ? '' : 's'} · ${disciplina.stats.temasTotal} temas`;

  const content = (
    <>
      <div className="flex-1">
        <h4 className="m-0 text-[16px] font-semibold tracking-tight text-stone-950">
          {disciplina.nome}
        </h4>
        <div className="mt-1 text-[11.5px] text-stone-500">
          {meta}
          {!coming && disciplina.stats.temasDisponiveis > 0 && (
            <>
              {' · '}
              <span className="font-medium text-[#4a7050]">
                {disciplina.stats.temasDisponiveis} disponível
              </span>
            </>
          )}
        </div>
      </div>
      {coming ? (
        <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[10.5px] font-medium text-stone-500">
          em breve
        </span>
      ) : (
        <span className="text-base text-stone-300">›</span>
      )}
    </>
  );

  const classes =
    'flex items-center justify-between rounded-lg border px-[22px] py-[18px] transition-all';

  if (coming) {
    return (
      <div className={`${classes} cursor-default border-dashed border-stone-200 bg-stone-50`}>
        {content}
      </div>
    );
  }
  return (
    <Link
      to={disciplinaUrl(disciplina.slug)}
      className={`${classes} border-[#ece8de] bg-white hover:-translate-y-px hover:border-[#c8d6c3] hover:shadow-sm`}
    >
      {content}
    </Link>
  );
}
