"use client";
import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useTaxonomia, TaxonomiaNode } from '@/hooks/useTaxonomia';
import { useTaxonomiaCounts, CountsBody } from '@/hooks/useTaxonomiaCounts';

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

  return (
    <div className="max-h-[500px] overflow-y-auto p-2">
      {data.tree.map(node => (
        <NodeRow
          key={node.id}
          node={node}
          depth={0}
          expanded={expandedIds}
          onToggleExpand={handleToggleExpand}
          selectedIds={selectedIds}
          onSelect={onToggle}
          counts={counts}
          shouldShow={() => true}
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
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(node.id as any)}
          onClick={e => e.stopPropagation()}
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
