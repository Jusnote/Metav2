import { Navigate, useParams, Link } from 'react-router-dom';
import { isValidSlug } from '@/lib/papiro/slug';
import { usePapiroDisciplina } from '@/hooks/papiro/usePapiroDisciplina';
import { MacroAreaCard } from '@/components/papiro/MacroAreaCard';

export default function PapiroDisciplinaPage() {
  const { disciplinaSlug } = useParams<{ disciplinaSlug: string }>();

  if (!disciplinaSlug || !isValidSlug(disciplinaSlug)) {
    return <Navigate to="/estudar" replace />;
  }

  const { data, isLoading, error } = usePapiroDisciplina(disciplinaSlug);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[880px] px-14 py-12">
        <div className="text-sm text-stone-500">Carregando…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-[880px] px-14 py-12">
        <div className="text-sm text-red-600">Erro ao carregar disciplina.</div>
      </div>
    );
  }
  if (!data) {
    return <Navigate to="/estudar" replace />;
  }

  const { disciplina, macroAreasDisponiveis, macroAreasEmProducao } = data;

  return (
    <div className="mx-auto max-w-[880px] rounded-2xl bg-white px-14 pb-16 pt-12">
      <header className="mb-11">
        <div className="mb-1.5 text-[11px] text-stone-400">
          <Link to="/estudar" className="text-stone-600 hover:text-stone-900">‹ Estudar</Link>
        </div>
        <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
          Disciplina
        </div>
        <h1 className="m-0 mb-3 text-3xl font-semibold leading-tight tracking-tight text-stone-950">
          {disciplina.nome}
        </h1>
        <p className="m-0 max-w-lg text-[15px] leading-relaxed text-stone-600">
          Áreas de estudo cobertas pela trilha de {disciplina.nome}.
        </p>
      </header>

      <Section title="Disponíveis" count={macroAreasDisponiveis.length}>
        {macroAreasDisponiveis.map((m) => (
          <MacroAreaCard key={m.id} macroArea={m} />
        ))}
      </Section>

      {macroAreasEmProducao.length > 0 && (
        <Section title="Em produção" count={macroAreasEmProducao.length}>
          {macroAreasEmProducao.map((m) => (
            <MacroAreaCard key={m.id} macroArea={m} coming />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-12 last:mb-0">
      <div className="mb-4 flex items-center justify-between border-b border-stone-100 pb-3.5">
        <h3 className="m-0 text-[13px] font-semibold tracking-tight text-stone-700">{title}</h3>
        <span className="text-[11px] tabular-nums text-stone-400">
          {count} {count === 1 ? 'área' : 'áreas'}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2.5">{children}</div>
    </section>
  );
}
