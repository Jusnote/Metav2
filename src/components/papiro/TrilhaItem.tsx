import { Link } from 'react-router-dom';
import { temaUrl } from '@/lib/papiro/slug';
import type { PapiroTemaComStatus } from '@/lib/papiro/types';

interface Props {
  tema: PapiroTemaComStatus;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2.5,6.5 5,9 9.5,3.5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 10 10" width="8" height="8" fill="currentColor">
      <polygon points="2,1 9,5 2,9" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.4}>
      <circle cx="7" cy="7" r="5.5" />
      <polyline points="7,4 7,7 9.5,8.5" />
    </svg>
  );
}

function ArrowUpRight() {
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
      <path d="M3.5 8.5 L8.5 3.5 M5 3.5 L8.5 3.5 L8.5 7" />
    </svg>
  );
}

export function TrilhaItem({ tema }: Props) {
  const ord = String(tema.ordem_curricular).padStart(2, '0');
  const href = temaUrl(tema.slug_hierarquico);
  return (
    <li className="grid items-start gap-3.5 py-1.5" style={{ gridTemplateColumns: '34px 26px 1fr' }}>
      <div className="pt-[18px] text-right text-xs font-medium tracking-[0.02em] tabular-nums text-stone-400">
        {ord}
      </div>
      <div
        className={`relative z-[2] mt-3 flex h-[26px] w-[26px] items-center justify-center rounded-full ${
          tema.temResumoPublicado ? 'bg-[#6b8e5a]' : 'border-[1.5px] border-stone-200 bg-white'
        }`}
      >
        {tema.temResumoPublicado && <CheckIcon />}
      </div>
      <Link
        to={href}
        className="block rounded-lg border border-[#f1f5f4] bg-white px-[18px] py-3.5 transition-colors hover:border-stone-200 hover:shadow-sm"
      >
        <h3 className="m-0 mb-2 text-[14.5px] font-semibold leading-tight tracking-tight text-stone-950">
          {tema.nome}
        </h3>
        <div className="flex flex-wrap items-center gap-3.5 text-xs">
          {tema.temResumoPublicado ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f0e2] px-2 py-0.5 text-[11.5px] font-medium text-[#4a7050]">
              <PlayIcon /> disponível
            </span>
          ) : (
            <span className="text-[11.5px] font-medium text-stone-500">em breve</span>
          )}
          <span className="inline-flex items-center gap-1.5 tabular-nums text-stone-500">
            <ClockIcon />
            {tema.tempo_estudo_min ?? '?'} min
          </span>
          {tema.prereqs.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-stone-500">
              <ArrowUpRight />
              apoia-se em{' '}
              {tema.prereqs.map((p, i) => (
                <span key={p.slug_hierarquico}>
                  <Link
                    to={temaUrl(p.slug_hierarquico)}
                    className="font-medium text-stone-700 underline decoration-stone-300 underline-offset-2 hover:decoration-stone-500"
                  >
                    {p.nome}
                  </Link>
                  {i < tema.prereqs.length - 1 ? ', ' : ''}
                </span>
              ))}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}
