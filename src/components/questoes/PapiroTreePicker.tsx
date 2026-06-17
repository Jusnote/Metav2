"use client";
import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Search } from 'lucide-react';
import { usePapiroArvore, type PapiroNode } from '@/hooks/usePapiroTaxonomia';
import { Checkbox } from '@/components/ui/checkbox';

type Props = {
  /** Nome da matéria (a árvore papiro é indexada por nome, não slug). */
  materia: string;
  selectedIds: number[];
  onToggle: (id: number) => void;
};

function flatten(nodes: PapiroNode[]): PapiroNode[] {
  const out: PapiroNode[] = [];
  const walk = (ns: PapiroNode[]) => {
    for (const n of ns) {
      out.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export function PapiroTreePicker({ materia, selectedIds, onToggle }: Props) {
  const { data, isLoading } = usePapiroArvore(materia);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [query, setQuery] = useState('');

  const all = useMemo(() => (data ? flatten(data.tree) : []), [data]);

  // IDs que casam a busca (por nome) + ancestrais (pra auto-expandir o caminho).
  const { matchedIds, autoExpand } = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !data) return { matchedIds: null as Set<number> | null, autoExpand: new Set<number>() };
    const matched = new Set<number>();
    for (const n of all) {
      if (n.nome.toLowerCase().includes(q)) matched.add(n.id);
    }
    const anc = new Set<number>();
    const findPath = (nodes: PapiroNode[], target: number, path: number[]): boolean => {
      for (const n of nodes) {
        if (n.id === target) {
          path.forEach((p) => anc.add(p));
          return true;
        }
        if (n.children?.length && findPath(n.children, target, [...path, n.id])) return true;
      }
      return false;
    };
    matched.forEach((id) => findPath(data.tree, id, []));
    return { matchedIds: matched, autoExpand: anc };
  }, [query, data, all]);

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Carregando…</div>;
  if (!data) return null;

  const effectiveExpanded = new Set([...expandedIds, ...autoExpand]);

  const toggleExpand = (id: number) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Quando há busca, só mostra o nó se ele casa ou tem descendente que casa.
  const matchesDeep = (node: PapiroNode): boolean => {
    if (!matchedIds) return true;
    if (matchedIds.has(node.id)) return true;
    return (node.children ?? []).some(matchesDeep);
  };

  const roots = data.tree.filter(matchesDeep);

  return (
    <div className="max-h-[500px] overflow-y-auto p-2">
      <div className="px-2 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Buscar tópico…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 text-sm border rounded"
          />
        </div>
      </div>

      {roots.map((node) => (
        <PapiroNodeRow
          key={node.id}
          node={node}
          depth={0}
          expanded={effectiveExpanded}
          onToggleExpand={toggleExpand}
          selectedIds={selectedIds}
          onSelect={onToggle}
          matchesDeep={matchesDeep}
        />
      ))}
    </div>
  );
}

type RowProps = {
  node: PapiroNode;
  depth: number;
  expanded: Set<number>;
  onToggleExpand: (id: number) => void;
  selectedIds: number[];
  onSelect: (id: number) => void;
  matchesDeep: (node: PapiroNode) => boolean;
};

function PapiroNodeRow({ node, depth, expanded, onToggleExpand, selectedIds, onSelect, matchesDeep }: RowProps) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedIds.includes(node.id);

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-muted/50 text-sm"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button onClick={() => onToggleExpand(node.id)} aria-label="Expandir" className="shrink-0">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-[14px]" />
        )}
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect(node.id)}
          onClick={(e) => e.stopPropagation()}
        />
        <span
          className={`flex-1 truncate cursor-pointer ${node.nivel === 1 ? 'font-medium' : ''}`}
          title={node.nome}
          onClick={() => onSelect(node.id)}
        >
          {node.nivel === 1 ? '📁 ' : ''}{node.nome}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {node.n.toLocaleString('pt-BR')}
        </span>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.filter(matchesDeep).map((child) => (
            <PapiroNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              selectedIds={selectedIds}
              onSelect={onSelect}
              matchesDeep={matchesDeep}
            />
          ))}
        </div>
      )}
    </div>
  );
}
