import { Link } from 'react-router-dom';
import { temaUrl } from '@/lib/papiro/slug';
import type { PapiroTemaSibling } from '@/lib/papiro/types';

interface Props {
  prev: PapiroTemaSibling | null;
  next: PapiroTemaSibling | null;
}

export function LeitorNavRodape({ prev, next }: Props) {
  return (
    <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-4 text-[11px] text-stone-500">
      <div className="flex flex-col gap-px">
        <span className="text-[8px] font-medium uppercase tracking-wider text-stone-400">
          ‹ Anterior
        </span>
        {prev ? (
          <Link
            to={temaUrl(prev.slug_hierarquico)}
            className="font-medium text-stone-800 hover:text-stone-950"
          >
            {String(prev.ordem_curricular).padStart(2, '0')} · {prev.nome}
          </Link>
        ) : (
          <span className="font-medium text-stone-400">—</span>
        )}
      </div>
      <div className="flex flex-col gap-px text-right">
        <span className="text-[8px] font-medium uppercase tracking-wider text-stone-400">
          Próximo ›
        </span>
        {next ? (
          <Link
            to={temaUrl(next.slug_hierarquico)}
            className="font-medium text-stone-800 hover:text-stone-950"
          >
            {String(next.ordem_curricular).padStart(2, '0')} · {next.nome}
          </Link>
        ) : (
          <span className="font-medium text-stone-400">—</span>
        )}
      </div>
    </div>
  );
}
