'use client';

import type { EstruturaNode } from '@/lib/lei-seca/derive-estrutura';
import { EstruturaRow } from './EstruturaRow';

interface Props {
  shortName: string;
  estrutura: EstruturaNode[];
  loading: boolean;
  activeNodeId: string | null;
  onSelect: (node: EstruturaNode) => void;
}

export function EstruturaColumn({ shortName, estrutura, loading, activeNodeId, onSelect }: Props) {
  return (
    <div>
      <div className="text-[10.5px] text-n-ink-3 tracking-[0.12em] uppercase mb-3">
        {shortName} · Estrutura
      </div>

      {loading && (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[44px] bg-n-rule-2 rounded-md animate-pulse" />
          ))}
        </div>
      )}

      {!loading && estrutura.length === 0 && (
        <div className="text-[12px] text-n-ink-3">Esta lei não tem hierarquia estrutural.</div>
      )}

      {!loading && estrutura.length > 0 && (
        <div className="flex flex-col">
          {estrutura.map((node, idx) => (
            <EstruturaRow
              key={node.id}
              node={node}
              isActive={activeNodeId === node.id}
              isFirst={idx === 0}
              onClick={() => onSelect(node)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
