"use client";

import React, { useState, useCallback, memo } from "react";
import { cn } from "@/lib/utils";
import { useActiveArtigoIndex } from "@/stores/activeArtigoStore";
import { TYPE_LABELS } from "@/lib/lei-hierarchy";

// -------- Types --------
export type LeiTreeNode = {
  id: string;
  type: 'parte' | 'livro' | 'titulo' | 'subtitulo' | 'capitulo' | 'secao' | 'subsecao' | 'artigo';
  badge?: string;
  label: string;
  sublabel?: string;
  children?: LeiTreeNode[];
  // Artigo-specific
  artigoIndex?: number;
  epigrafe?: string;
  preview?: string;
  frequencia?: number;
  isFavorite?: boolean;
  isRevogado?: boolean;
  isActive?: boolean;
  extra?: React.ReactNode;
};

export type LeiTreeProps = {
  data: LeiTreeNode[];
  expanded?: Set<string>;
  activePath?: Set<string>;
  onToggle?: (id: string) => void;
  onSelectArtigo?: (artigoIndex: number) => void;
  onAnimationStart?: () => void;
  onAnimationSettled?: () => void;
  hideChevrons?: boolean;
  className?: string;
};

// -------- Component --------
export const LeiTree = memo(function LeiTree({ data, expanded, activePath, onToggle, onSelectArtigo, onAnimationStart, onAnimationSettled, hideChevrons, className }: LeiTreeProps) {
  const [internalExpanded, setInternalExpanded] = useState<Set<string>>(new Set());
  const isExpanded = expanded || internalExpanded;
  const handleToggle = onToggle || ((id: string) => {
    setInternalExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  });

  const renderNodes = useCallback((nodes: LeiTreeNode[], level = 0) => {
    return nodes.map((node) => {
      if (node.type === 'artigo') {
        return (
          <ArtigoNode
            key={node.id}
            node={node}
            level={level}
            onSelect={onSelectArtigo}
          />
        );
      }

      const open = isExpanded.has(node.id);
      const hasChildren = node.children && node.children.length > 0;
      const isOnActivePath = activePath?.has(node.id);

      return (
        <div key={node.id} className="relative" style={{ paddingLeft: level === 0 ? 0 : 22 }}>
          {/* Vertical line connecting to children */}
          {hasChildren && open && (
            <div
              className="absolute top-[18px] bottom-0 w-[1.5px]"
              style={{ background: 'rgba(22,163,74,0.1)', left: 6 }}
            />
          )}
          <button
            data-tree-branch
            data-tree-level={level}
            onClick={() => handleToggle(node.id)}
            className="w-full flex items-center gap-[7px] py-1 px-2 text-left rounded-md transition-colors duration-150 hover:bg-[rgba(22,163,74,0.04)] relative"
          >
            {/* Horizontal connector line (not on root level) */}
            {level > 0 && (
              <div
                className="absolute w-[11px] h-[1.5px] top-1/2"
                style={{ background: 'rgba(22,163,74,0.1)', left: -16 }}
              />
            )}
            {/* Circle node indicator */}
            <div className={cn(
              "w-[7px] h-[7px] rounded-full border-[1.5px] shrink-0 transition-all duration-150",
              isOnActivePath
                ? "border-[#16a34a] bg-[rgba(22,163,74,0.1)]"
                : "border-[#b0c0b5] bg-white"
            )} />
            {/* Type label */}
            <span className="text-[8.5px] font-semibold uppercase tracking-[0.5px] text-[#8a9a8f] shrink-0">
              {TYPE_LABELS[node.type] ?? node.type}
            </span>
            {/* Node name */}
            <span className={cn(
              "text-xs text-[#3a4a40] truncate",
              isOnActivePath && "text-[#16a34a] font-medium"
            )}>
              {node.sublabel || node.label}
            </span>
          </button>

          {/* CSS grid animation instead of framer-motion height: auto */}
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-in-out"
            style={{ gridTemplateRows: hasChildren && open ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              {hasChildren && node.children && renderNodes(node.children, level + 1)}
            </div>
          </div>
        </div>
      );
    });
  }, [isExpanded, handleToggle, onSelectArtigo, onAnimationStart, onAnimationSettled, hideChevrons, activePath]);

  return (
    <div role="tree" className={cn("text-sm", className)}>
      {renderNodes(data)}
    </div>
  );
});

// -------- Artigo node (connected tree dot styling) --------
const ArtigoNode = memo(function ArtigoNode({ node, level, onSelect }: {
  node: LeiTreeNode;
  level: number;
  onSelect?: (index: number) => void;
}) {
  const activeIndex = useActiveArtigoIndex();
  const isActive = node.artigoIndex === activeIndex;

  return (
    <div
      style={{ paddingLeft: level === 0 ? 0 : 22 }}
      data-artigo-index={node.artigoIndex}
      data-tree-level={level}
      className="relative"
    >
      <button
        onClick={() => node.artigoIndex !== undefined && onSelect?.(node.artigoIndex)}
        className={cn(
          "w-full flex items-center gap-[5px] py-[2px] px-2 text-left transition-all duration-150 text-[11px]",
          isActive
            ? "text-[#16a34a] font-medium"
            : "text-[#7a8a80] hover:text-[#3a5540]"
        )}
      >
        {/* Connector line */}
        {level > 0 && (
          <div
            className="absolute w-[7px] h-[1.5px] top-1/2"
            style={{ background: 'rgba(22,163,74,0.08)', left: -8 }}
          />
        )}
        {/* Dot */}
        <div className={cn(
          "w-1 h-1 rounded-full shrink-0",
          isActive ? "bg-[#4ade80]" : "bg-[#d5e4d9]"
        )} />
        <span className="truncate">{node.label}</span>
        {node.epigrafe && (
          <span className="text-[#9aaa9f] font-light truncate">— {node.epigrafe}</span>
        )}
      </button>
    </div>
  );
});
