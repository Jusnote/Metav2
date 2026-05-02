'use client';

export interface CarregarLinkProps {
  onClick?: () => void;
}

export function CarregarLink({ onClick: _onClick }: CarregarLinkProps = {}) {
  return (
    <button
      type="button"
      aria-disabled="true"
      title="em breve"
      className="text-xs text-slate-300 cursor-not-allowed"
      onClick={(e) => e.preventDefault()}
    >
      Carregar ↑
    </button>
  );
}
