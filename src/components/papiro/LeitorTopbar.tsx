import { Link } from 'react-router-dom';

interface Props {
  onExitHref: string;       // pra onde o × leva (rota da trilha)
  indice: { atual: number; total: number };
}

/**
 * Visível somente em mobile (via media query em papiro.css).
 * Em desktop tem `display: none !important`.
 */
export function LeitorTopbar({ onExitHref, indice }: Props) {
  return (
    <div className="papiro-leitor-topbar flex items-center justify-between border-b border-stone-100 bg-stone-50 px-4 py-2.5 text-[11px] text-stone-600">
      <Link to={onExitHref} aria-label="Sair do leitor" className="text-base text-stone-900 hover:text-stone-700">
        ×
      </Link>
      <span>
        Tema <strong className="font-semibold text-stone-900">{indice.atual}</strong> de {indice.total}
      </span>
      <span className="w-4" />
    </div>
  );
}
