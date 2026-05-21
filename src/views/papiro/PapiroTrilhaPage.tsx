import { Navigate, useParams, Link } from 'react-router-dom';
import { isValidSlug, buildMacroAreaSlug } from '@/lib/papiro/slug';
import { usePapiroTrilha } from '@/hooks/papiro/usePapiroTrilha';
import { TrilhaHeader } from '@/components/papiro/TrilhaHeader';
import { TrilhaItem } from '@/components/papiro/TrilhaItem';

export default function PapiroTrilhaPage() {
  const { disciplinaSlug, macroAreaTail } = useParams<{ disciplinaSlug: string; macroAreaTail: string }>();

  if (
    !disciplinaSlug || !macroAreaTail ||
    !isValidSlug(disciplinaSlug) || !isValidSlug(macroAreaTail)
  ) {
    return <Navigate to="/estudar" replace />;
  }

  const slug = buildMacroAreaSlug(disciplinaSlug, macroAreaTail);
  const { data, isLoading, error } = usePapiroTrilha(slug);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[760px] px-14 py-12">
        <div className="text-sm text-stone-500">Carregando trilha…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-[760px] px-14 py-12">
        <div className="text-sm text-red-600">Erro ao carregar a trilha.</div>
      </div>
    );
  }
  if (!data) {
    return <Navigate to={`/estudar/${disciplinaSlug}`} replace />;
  }

  return (
    <div className="mx-auto max-w-[760px] rounded-2xl bg-white px-11 pb-14 pt-10">
      <div className="mb-3 text-[11px] text-stone-400">
        <Link to="/estudar" className="text-stone-600 hover:text-stone-900">Estudar</Link>
        {' › '}
        <Link to={`/estudar/${data.disciplinaSlug}`} className="text-stone-600 hover:text-stone-900">
          {data.disciplinaNome}
        </Link>
      </div>
      <TrilhaHeader
        kicker={data.disciplinaNome}
        title={data.nome}
        sub={`${data.stats.temasTotal} temas · trilha curada a partir das fontes do edital.`}
        stats={data.stats}
      />
      <ol className="papiro-trilha-list m-0 list-none p-0">
        {data.temas.map((t) => (
          <TrilhaItem key={t.id} tema={t} />
        ))}
      </ol>
    </div>
  );
}
