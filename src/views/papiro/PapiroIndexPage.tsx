import { usePapiroDisciplinas } from '@/hooks/papiro/usePapiroDisciplinas';
import { DisciplinaCard } from '@/components/papiro/DisciplinaCard';

export default function PapiroIndexPage() {
  const { data, isLoading, error } = usePapiroDisciplinas();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[880px] px-14 py-12">
        <div className="text-sm text-stone-500">Carregando…</div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-[880px] px-14 py-12">
        <div className="text-sm text-red-600">Erro ao carregar disciplinas.</div>
      </div>
    );
  }
  const { disponiveis, emProducao } = data;

  return (
    <div className="mx-auto max-w-[880px] rounded-2xl bg-white px-14 pb-16 pt-12">
      <header className="mb-11">
        <div className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
          Papiro
        </div>
        <h1 className="m-0 mb-3 text-4xl font-semibold leading-tight tracking-tight text-stone-950">
          Estudar
        </h1>
        <p className="m-0 max-w-xl text-[15px] leading-relaxed text-stone-600">
          Trilhas curadas por disciplina, com resumos integrados às fontes do seu edital.
        </p>
      </header>

      <Section title="Disponíveis" count={disponiveis.length}>
        {disponiveis.map((d) => (
          <DisciplinaCard key={d.id} disciplina={d} />
        ))}
      </Section>

      {emProducao.length > 0 && (
        <Section title="Em produção" count={emProducao.length}>
          {emProducao.map((d) => (
            <DisciplinaCard key={d.id} disciplina={d} coming />
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
          {count} {count === 1 ? 'matéria' : 'matérias'}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2.5">{children}</div>
    </section>
  );
}
