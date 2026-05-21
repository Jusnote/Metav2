import { useEffect } from 'react';
import { Navigate, useParams, Link } from 'react-router-dom';
import { isValidSlug, buildTemaSlug } from '@/lib/papiro/slug';
import { usePapiroTema } from '@/hooks/papiro/usePapiroTema';
import { TemaSemResumoPreview } from '@/components/papiro/TemaSemResumoPreview';
import { LeitorTopbar } from '@/components/papiro/LeitorTopbar';
import { LeitorNavRodape } from '@/components/papiro/LeitorNavRodape';
import { ResumoLeitor } from '@/v3/components/resumos/ResumoLeitor';
import type { Value } from 'platejs';

export default function PapiroLeitorPage() {
  const { disciplinaSlug, macroAreaTail, temaTail } = useParams<{
    disciplinaSlug: string;
    macroAreaTail: string;
    temaTail: string;
  }>();

  // Aplica .papiro-leitor-open no body só enquanto montado (overflow:hidden no mobile)
  useEffect(() => {
    document.body.classList.add('papiro-leitor-open');
    return () => document.body.classList.remove('papiro-leitor-open');
  }, []);

  if (
    !disciplinaSlug || !macroAreaTail || !temaTail ||
    !isValidSlug(disciplinaSlug) || !isValidSlug(macroAreaTail) || !isValidSlug(temaTail)
  ) {
    return <Navigate to="/estudar" replace />;
  }

  const slug = buildTemaSlug(disciplinaSlug, macroAreaTail, temaTail);
  const { data, isLoading, error } = usePapiroTema(slug);

  const trilhaHref = `/estudar/${disciplinaSlug}/${macroAreaTail}`;

  if (isLoading) {
    return (
      <article className="papiro-leitor-mobile-focal w-full px-8 py-10">
        <div className="text-sm text-stone-500">Carregando tema…</div>
      </article>
    );
  }
  if (error) {
    return (
      <article className="papiro-leitor-mobile-focal w-full px-8 py-10">
        <div className="text-sm text-red-600">Erro ao carregar tema.</div>
      </article>
    );
  }
  if (!data) {
    return <Navigate to={trilhaHref} replace />;
  }

  const { tema, resumo, prev, next, prereqs, indice, macroAreaNome, disciplinaNome } = data;
  const temResumo = resumo !== null && resumo.conteudo_plate !== null;

  return (
    <article className="papiro-leitor-mobile-focal w-full bg-white">
      <LeitorTopbar onExitHref={trilhaHref} indice={indice} />

      {/* Header (breadcrumb + título + meta) constrito numa coluna de leitura */}
      <div className="mx-auto max-w-[920px] px-8 pt-7">
        <div className="mb-3 text-[11px] text-stone-400">
          <Link to="/estudar" className="text-stone-600 hover:text-stone-900">Estudar</Link>
          {' › '}
          <Link to={`/estudar/${disciplinaSlug}`} className="text-stone-600 hover:text-stone-900">
            {disciplinaNome}
          </Link>
          {' › '}
          <Link to={trilhaHref} className="text-stone-600 hover:text-stone-900">
            {macroAreaNome}
          </Link>
        </div>
        <h1 className="m-0 mb-1.5 text-2xl font-bold leading-tight tracking-tight text-stone-950">
          {tema.nome}
        </h1>
        <div className="mb-5 border-b border-stone-100 pb-4 text-[11px] text-stone-500">
          Tema {tema.ordem_curricular} · {tema.tempo_estudo_min ?? '?'} min
        </div>
      </div>

      {/* Resumo/preview: full-bleed quando publicado (Plate respira); preview pedagógico
          em coluna de leitura (texto curto, melhor legibilidade) */}
      {temResumo ? (
        <div className="w-full">
          <ResumoLeitor conteudo={resumo.conteudo_plate as unknown as Value} />
        </div>
      ) : (
        <div className="mx-auto max-w-[920px] px-8">
          <TemaSemResumoPreview tema={tema} prereqs={prereqs} />
        </div>
      )}

      {/* Nav rodapé: constrita pra alinhar com o header */}
      <div className="mx-auto max-w-[920px] px-8 pb-12">
        <LeitorNavRodape prev={prev} next={next} />
      </div>
    </article>
  );
}
