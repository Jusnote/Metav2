"use client";
import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Search } from 'lucide-react';
import Fuse from 'fuse.js';
import { useTaxonomia, TaxonomiaNode, flattenTree } from '@/hooks/useTaxonomia';
import { useTaxonomiaCounts, CountsBody } from '@/hooks/useTaxonomiaCounts';
import { useTaxonomiaRecentes } from '@/hooks/useTaxonomiaRecentes';
import { Checkbox } from '@/components/ui/checkbox';

type Props = {
  materiaSlug: string;
  selectedIds: (number | 'outros')[];
  onToggle: (id: number | 'outros') => void;
  countsBody: CountsBody;
};

export function TaxonomiaTreePicker({ materiaSlug, selectedIds, onToggle, countsBody }: Props) {
  const { data, isLoading } = useTaxonomia(materiaSlug);
  const { data: counts } = useTaxonomiaCounts(
    materiaSlug, countsBody,
    Object.keys(countsBody).length > 0
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState('');
  const { items: recentes, push: pushRecente } = useTaxonomiaRecentes();
  const [hideZeros, setHideZeros] = useState(true);

  const fuse = useMemo(() => {
    if (!data) return null;
    const items = flattenTree(data.tree).filter(n => !n.is_sintetico && !n.is_virtual);
    return new Fuse(items, {
      keys: ['nome', 'hierarquia'],
      threshold: 0.3,
      minMatchCharLength: 2,
    });
  }, [data]);

  const matchedIds = useMemo(() => {
    if (!fuse || !query.trim()) return null;
    const results = fuse.search(query);
    return new Set(results.map(r => r.item.id));
  }, [fuse, query]);

  const autoExpandedIds = useMemo(() => {
    if (!matchedIds || !data) return new Set<string>();
    const set = new Set<string>();
    const findAncestors = (nodes: TaxonomiaNode[], targetId: number | string, ancestors: (number | string)[]): boolean => {
      for (const n of nodes) {
        if (n.id === targetId) {
          ancestors.forEach(a => set.add(String(a)));
          return true;
        }
        if (n.children && findAncestors(n.children, targetId, [...ancestors, n.id])) return true;
      }
      return false;
    };
    matchedIds.forEach(id => findAncestors(data.tree, id, []));
    return set;
  }, [matchedIds, data]);

  const effectiveExpanded = useMemo(
    () => new Set([...expandedIds, ...autoExpandedIds]),
    [expandedIds, autoExpandedIds]
  );

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Carregando...</div>;
  if (!data) return null;

  const handleToggleExpand = (id: number | string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      const k = String(id);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const handleSelect = (id: number | 'outros') => {
    onToggle(id);
    if (data) {
      const node = flattenTree(data.tree).find(n => n.id === id);
      if (node) pushRecente({ nodeId: id, nome: node.nome });
    }
  };

  const shouldShow = (node: TaxonomiaNode): boolean => {
    if (!hideZeros || !counts) return true;
    if (matchedIds && matchedIds.has(node.id)) return true;
    const total = counts[String(node.id)] ?? 0;
    return total > 0;
  };

  return (
    <div className="max-h-[500px] overflow-y-auto p-2">
      <div className="px-2 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Buscar tópico..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 text-sm border rounded"
          />
        </div>
      </div>

      {recentes.length > 0 && !query && (
        <div className="px-2 pb-2 border-b">
          <div className="text-xs text-muted-foreground mb-1">Recentes:</div>
          {recentes.map(r => (
            <div
              key={String(r.nodeId)}
              className="text-xs py-0.5 cursor-pointer hover:underline"
              onClick={() => handleSelect(r.nodeId as number | 'outros')}
            >
              • {r.nome}
            </div>
          ))}
        </div>
      )}

      <div className="px-2 pb-2 flex items-center justify-between text-xs">
        <span>{data.tree.filter(shouldShow).length} grupos visíveis</span>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Checkbox
            checked={hideZeros}
            onCheckedChange={(v) => setHideZeros(v === true)}
          />
          Esconder vazios
        </label>
      </div>

      {data.tree.filter(shouldShow).map(node => (
        <NodeRow
          key={node.id}
          node={node}
          depth={0}
          expanded={effectiveExpanded}
          onToggleExpand={handleToggleExpand}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          counts={counts}
          shouldShow={shouldShow}
        />
      ))}
    </div>
  );
}

type NodeRowProps = {
  node: TaxonomiaNode;
  depth: number;
  expanded: Set<string>;
  onToggleExpand: (id: number | string) => void;
  selectedIds: (number | 'outros')[];
  onSelect: (id: number | 'outros') => void;
  counts?: Record<string, number>;
  shouldShow: (node: TaxonomiaNode) => boolean;
};

function NodeRow({ node, depth, expanded, onToggleExpand, selectedIds, onSelect, counts, shouldShow }: NodeRowProps) {
  const hasChildren = node.children?.length > 0;
  const isFederalRoot = node.is_sintetico && depth === 0 && node.nome.endsWith('Federal');
  const isExpanded = expanded.has(String(node.id)) || (isFederalRoot && !expanded.has('__federal_collapsed__'));
  const isSelected = selectedIds.includes(node.id as any);
  const count = counts?.[String(node.id)];

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
          onCheckedChange={() => onSelect(node.id as any)}
          onClick={(e) => e.stopPropagation()}
        />
        <span
          className={`flex-1 truncate cursor-pointer ${node.is_sintetico ? 'font-medium' : ''}`}
          title={node.nome}
          onClick={() => onSelect(node.id as any)}
        >
          {node.is_sintetico ? '📁 ' : ''}{node.nome}
        </span>
        {count !== undefined && (
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {count.toLocaleString('pt-BR')}
          </span>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.filter(child => shouldShow(child)).map(child => (
            <NodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              selectedIds={selectedIds}
              onSelect={onSelect}
              counts={counts}
              shouldShow={shouldShow}
            />
          ))}
        </div>
      )}
    </div>
  );
}
