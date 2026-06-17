import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import {
  usePapiroArvore,
  usePapiroQuestoes,
  type PapiroNode,
} from '@/hooks/usePapiroTaxonomia';

const MATERIA = 'Direito Constitucional';

function fmt(n: number) {
  return n.toLocaleString('pt-BR');
}

function alternativasToList(alts: unknown): string[] {
  if (Array.isArray(alts)) {
    return alts.map((a: unknown) =>
      typeof a === 'string' ? a : (a as any)?.texto ?? (a as any)?.conteudo ?? JSON.stringify(a),
    );
  }
  return [];
}

function TreeItem({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: PapiroNode;
  depth: number;
  selectedId: number | null;
  onSelect: (n: PapiroNode) => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = node.children?.length > 0;
  const isSel = selectedId === node.id;
  return (
    <div>
      <div
        className={`flex items-center gap-1 rounded-md px-2 py-1 cursor-pointer text-sm hover:bg-indigo-50 ${
          isSel ? 'bg-indigo-100 font-semibold' : ''
        }`}
        style={{ paddingLeft: depth * 14 + 4 }}
        onClick={() => {
          onSelect(node);
          if (hasChildren) setOpen((o) => o);
        }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen((o) => !o);
            }}
            className="text-gray-400 hover:text-gray-700"
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="inline-block w-[14px]" />
        )}
        <span className={depth === 0 ? 'text-indigo-700' : 'text-gray-800'}>{node.nome}</span>
        <span className="ml-auto text-xs text-gray-400">{fmt(node.n)}</span>
      </div>
      {open && hasChildren && (
        <div>
          {node.children.map((c) => (
            <TreeItem
              key={c.id}
              node={c}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PapiroTaxonomiaPage() {
  const { data: arvore, isLoading, error } = usePapiroArvore(MATERIA);
  const [selected, setSelected] = useState<PapiroNode | null>(null);
  const { data: qData, isLoading: qLoading } = usePapiroQuestoes(selected?.id ?? null);

  return (
    <div className="max-w-[1200px] mx-auto">
      <h1 className="text-2xl font-bold mb-1">🌳 Taxonomia — {MATERIA}</h1>
      <p className="text-gray-500 mb-4 text-sm">
        Árvore derivada das questões (3 níveis) · incidência por nó · clique pra ver as questões.
        {arvore && ` · ${fmt(arvore.total)} questões`}
      </p>

      {isLoading && <div className="text-gray-500">Carregando árvore…</div>}
      {error && (
        <div className="text-red-600">
          Erro ao carregar. O verus_api expõe <code>/api/v1/papiro/{MATERIA}/arvore</code>? (precisa do redeploy)
        </div>
      )}

      {arvore && (
        <div className="grid grid-cols-[minmax(340px,420px)_1fr] gap-5">
          {/* árvore */}
          <div className="bg-white rounded-xl shadow-sm p-3 max-h-[78vh] overflow-auto">
            {arvore.tree.map((t) => (
              <TreeItem
                key={t.id}
                node={t}
                depth={0}
                selectedId={selected?.id ?? null}
                onSelect={setSelected}
              />
            ))}
          </div>

          {/* questões do nó */}
          <div className="bg-white rounded-xl shadow-sm p-4 max-h-[78vh] overflow-auto">
            {!selected && (
              <div className="text-gray-400 text-sm">Selecione um nó na árvore.</div>
            )}
            {selected && (
              <>
                <div className="border-b pb-2 mb-3">
                  <div className="font-semibold text-indigo-700">{selected.nome}</div>
                  {selected.artigo && (
                    <div className="text-xs text-gray-400">{selected.artigo}</div>
                  )}
                  {selected.definicao && (
                    <div className="text-xs text-gray-600 mt-1">{selected.definicao}</div>
                  )}
                  {selected.desempate && (
                    <div className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-1">
                      ⚖ {selected.desempate}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    {qData ? `${fmt(qData.total)} questões` : ''}
                  </div>
                </div>
                {qLoading && <div className="text-gray-400 text-sm">Carregando questões…</div>}
                <div className="space-y-3">
                  {qData?.questoes.map((q) => (
                    <div key={q.id} className="border rounded-lg p-3 text-sm">
                      <div className="text-[11px] text-gray-400 mb-1">
                        #{q.id} {q.banca ? `· ${q.banca}` : ''} {q.ano ? `· ${q.ano}` : ''}
                      </div>
                      <div className="text-gray-800 mb-2">{q.enunciado}</div>
                      <ul className="space-y-1 text-gray-600">
                        {alternativasToList(q.alternativas).map((a, i) => (
                          <li key={i}>
                            <b>{String.fromCharCode(65 + i)})</b> {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
