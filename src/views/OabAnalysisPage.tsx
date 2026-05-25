import { useEffect, useState, useMemo } from 'react';

interface Exame {
  id: number;
  ano: number;
  label: string;
  n_questoes: number;
}

interface ExameApareceu {
  id: number;
  n: number;
}

interface PorAno {
  ano: number;
  n: number;
}

interface Sample {
  id: number;
  ano: number;
  exam_id: number;
  assunto: string;
  enunciado: string;
}

interface ItemData {
  id: string;
  label: string;
  questoes: number;
  exames: number;
  pct_cobertura: number;
  pct_incidencia: number;
  sem_mapping: boolean;
  exames_apareceu: ExameApareceu[];
  por_ano: PorAno[];
  samples: Sample[];
}

interface AnalysisData {
  materia: string;
  banca: string;
  orgao: string;
  total_exames: number;
  total_questoes: number;
  cobertura_mapping_pct: number;
  gerado_em: string;
  exames: Exame[];
  items: ItemData[];
}

const SERIF = "'Source Serif 4', Georgia, serif";
const NUM_SERIF = "'Literata', 'Source Serif 4', Georgia, serif";

// ============== SIDE PANEL ==============
function ItemDetailPanel({
  item,
  exames,
  onClose,
}: {
  item: ItemData;
  exames: Exame[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40" />
      <div
        className="relative w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 z-10">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-wider text-blue-700 font-semibold mb-1">
                Tópico do edital da OAB
              </div>
              <h3
                className="text-2xl font-semibold text-slate-900 m-0 leading-tight"
                style={{ fontFamily: SERIF }}
              >
                {item.label}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Headline do tópico */}
        <section className="px-6 py-6 border-b border-slate-100">
          <p
            className="text-2xl text-slate-900 leading-snug m-0"
            style={{ fontFamily: SERIF, letterSpacing: '-0.01em' }}
          >
            Caiu em <span className="text-blue-600 font-bold">{item.pct_incidencia.toFixed(0)}% das provas</span> OAB FGV nos
            últimos 15 anos — total de <strong>{item.questoes} questões</strong>.
          </p>
        </section>

        {/* Exemplos */}
        <section className="px-6 py-6">
          <h4 className="text-sm font-semibold text-slate-900 mb-3">Exemplos de questões reais</h4>
          <div className="space-y-3">
            {item.samples.map((s) => (
              <div key={s.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
                  OAB {s.ano} · banca FGV
                </div>
                <p className="text-sm text-slate-700 leading-relaxed m-0">{s.enunciado}</p>
              </div>
            ))}
            {item.samples.length === 0 && (
              <p className="text-sm text-slate-500 italic">Nenhuma questão registrada.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ============== MAIN PAGE ==============
export default function OabAnalysisPage() {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch('/data/oab-analysis.json')
      .then((r) => {
        if (!r.ok) throw new Error('Falha ao carregar dados');
        return r.json();
      })
      .then((d: AnalysisData) => {
        setData(d);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const ranked = useMemo(() => {
    if (!data) return null;
    const all = data.items
      .filter((i) => !i.sem_mapping && i.questoes > 0)
      .slice()
      .sort((a, b) => b.questoes - a.questoes);
    const top5 = all.slice(0, 5);
    const top10 = all.slice(0, 10);
    const top5Q = top5.reduce((s, i) => s + i.questoes, 0);
    const top5Pct = data.total_questoes ? Math.round((100 * top5Q) / data.total_questoes) : 0;
    return { all, top5, top10, top5Pct };
  }, [data]);

  if (loading) {
    return <div className="max-w-3xl mx-auto p-12 text-slate-500 text-sm">Carregando...</div>;
  }
  if (error || !data || !ranked) {
    return <div className="max-w-3xl mx-auto p-12 text-red-600 text-sm">Erro: {error}</div>;
  }

  const visibleItems = showAll ? ranked.all : ranked.top10;
  const maxQuestoes = ranked.all[0]?.questoes ?? 1;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        {/* Hero — UMA frase, gigante */}
        <section className="mb-20">
          <div className="text-[11px] uppercase tracking-[0.2em] text-blue-700 font-semibold mb-6">
            OAB · banca FGV · 15 anos analisados
          </div>
          <h1
            className="m-0 leading-[1.05] text-slate-900"
            style={{
              fontFamily: SERIF,
              fontSize: 'clamp(36px, 6vw, 60px)',
              fontWeight: 600,
              letterSpacing: '-0.025em',
            }}
          >
            Em {data.materia.replace('Direito ', 'Direito ')},
            <br />
            <span style={{ color: '#2563eb' }}>5 tópicos</span> respondem por
            <br />
            <span style={{ color: '#2563eb' }}>{ranked.top5Pct}%</span> de tudo que cai na OAB.
          </h1>
          <p className="text-slate-600 text-lg leading-relaxed mt-8 max-w-2xl">
            Em vez do aluno estudar os 21 tópicos do edital de forma uniforme, o app foca primeiro
            no que a banca FGV mais insiste. Análise feita sobre <strong>{data.total_exames} provas reais</strong>
            (2010–2025) e <strong>{data.total_questoes} questões</strong> de {data.materia}.
          </p>
        </section>

        {/* Lista ranqueada — UMA SÓ visualização */}
        <section>
          <header className="mb-6">
            <h2
              className="text-2xl font-semibold text-slate-900 m-0"
              style={{ fontFamily: SERIF, letterSpacing: '-0.015em' }}
            >
              Os tópicos que mais caem
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Clique em qualquer tópico para ver questões reais já cobradas.
            </p>
          </header>

          <ol className="space-y-1">
            {visibleItems.map((item, idx) => {
              const isTop5 = idx < 5;
              const barPct = (100 * item.questoes) / maxQuestoes;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className="w-full text-left flex items-center gap-4 px-4 py-3.5 -mx-4 rounded-lg hover:bg-blue-50/50 transition-colors group"
                  >
                    <span
                      className={`shrink-0 w-7 text-center text-sm tabular-nums ${
                        isTop5 ? 'text-blue-600 font-bold' : 'text-slate-400 font-medium'
                      }`}
                    >
                      {idx + 1}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="text-base text-slate-900 font-medium group-hover:text-blue-700 transition-colors mb-1.5 truncate">
                        {item.label}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-md">
                          <div
                            className={`h-full ${isTop5 ? 'bg-blue-600' : 'bg-blue-300'} transition-all`}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
                          <strong className="text-slate-800">{item.questoes}</strong> questões · cai em{' '}
                          <strong className="text-slate-800">{item.pct_incidencia.toFixed(0)}%</strong> das provas
                        </span>
                      </div>
                    </div>

                    <span className="shrink-0 text-slate-300 group-hover:text-blue-500 transition-colors">→</span>
                  </button>
                </li>
              );
            })}
          </ol>

          {!showAll && ranked.all.length > 10 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-6 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Ver todos os {ranked.all.length} tópicos →
            </button>
          )}
          {showAll && (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="mt-6 text-sm text-slate-500 hover:text-slate-800 font-medium"
            >
              ← Mostrar apenas top 10
            </button>
          )}
        </section>

        {/* Footer minimalista */}
        <footer className="mt-24 pt-8 border-t border-slate-100 text-xs text-slate-400">
          Análise atualizada em {new Date(data.gerado_em).toLocaleDateString('pt-BR')} ·
          {' '}
          {data.total_exames} provas · {data.cobertura_mapping_pct}% das questões mapeadas
        </footer>
      </div>

      {selectedItem && (
        <ItemDetailPanel item={selectedItem} exames={data.exames} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
