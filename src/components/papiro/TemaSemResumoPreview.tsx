import { Link } from 'react-router-dom';
import type { PapiroTema, PapiroPrereqResolvido } from '@/lib/papiro/types';
import { temaUrl } from '@/lib/papiro/slug';

interface Props {
  tema: PapiroTema;
  prereqs: PapiroPrereqResolvido[];
}

export function TemaSemResumoPreview({ tema, prereqs }: Props) {
  const conceitos = Array.isArray(tema.conceitos_principais)
    ? (tema.conceitos_principais as unknown as string[])
    : [];

  return (
    <div className="space-y-6">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-medium text-stone-500">
        <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth={1.4}>
          <circle cx="6" cy="6" r="4.5" />
        </svg>
        em breve
      </span>

      {prereqs.length > 0 && (
        <section>
          <h4 className="m-0 mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            Apoia-se em
          </h4>
          <p className="m-0 text-[13px] leading-relaxed text-stone-700">
            {prereqs.map((p, i) => (
              <span key={p.slug_hierarquico}>
                <Link
                  to={temaUrl(p.slug_hierarquico)}
                  className="text-stone-800 underline decoration-stone-300 underline-offset-2 hover:decoration-stone-500"
                >
                  {p.nome}
                </Link>
                {i < prereqs.length - 1 ? ', ' : ''}
              </span>
            ))}
          </p>
        </section>
      )}

      {tema.objetivo_pedagogico && (
        <section>
          <h4 className="m-0 mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            Objetivo
          </h4>
          <p className="m-0 text-[13.5px] leading-relaxed text-stone-700">
            {tema.objetivo_pedagogico}
          </p>
        </section>
      )}

      {conceitos.length > 0 && (
        <section>
          <h4 className="m-0 mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            O que vai cobrir
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {conceitos.map((c, i) => (
              <span
                key={i}
                className="rounded-full border border-stone-100 bg-stone-50 px-2.5 py-1 text-[11px] text-stone-700"
              >
                {c}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
