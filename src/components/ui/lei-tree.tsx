"use client";

import React, { useState, useCallback, memo, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight } from "lucide-react";
import { useActiveArtigoIndex } from "@/stores/activeArtigoStore";

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
  onToggle?: (id: string) => void;
  onSelectArtigo?: (artigoIndex: number) => void;
  /** Called when an expand/collapse animation starts — used by TracingBeam to block measurement */
  onAnimationStart?: () => void;
  /** Called when an expand/collapse animation finishes — used by TracingBeam to remeasure */
  onAnimationSettled?: () => void;
  hideChevrons?: boolean;
  className?: string;
};

// -------- Badge style (neutral for all levels) --------
const badgeClass = "text-muted-foreground bg-muted";


// -------- Component --------
export const LeiTree = memo(function LeiTree({ data, expanded, onToggle, onSelectArtigo, onAnimationStart, onAnimationSettled, hideChevrons, className }: LeiTreeProps) {
  // Internal expanded state if not controlled
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

      return (
        <div key={node.id}>
          <button
            data-tree-branch
            data-tree-level={level}
            onClick={() => handleToggle(node.id)}
            className={cn(
              "w-full flex items-start gap-2 py-1.5 px-2 text-left rounded-md transition-colors group",
              "hover:bg-accent/50",
              open && "bg-accent/30"
            )}
            style={{ paddingLeft: level === 0 ? 12 : level * 8 + 8 }}
          >
            {hasChildren && !hideChevrons && (
              <ChevronRight
                size={12}
                className={cn(
                  "shrink-0 transition-transform duration-200 text-muted-foreground/60 mt-0.5",
                  open && "rotate-90"
                )}
              />
            )}
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded tracking-wide w-fit",
                badgeClass
              )}>
                {node.badge || node.type.toUpperCase()}
              </span>
              {node.sublabel && (
                <span className="text-[10px] text-muted-foreground/50 leading-snug line-clamp-2 pl-0.5">
                  {node.sublabel}
                </span>
              )}
            </div>
          </button>

          <AnimatePresence initial={false}>
            {hasChildren && open && (
              <motion.div
                key="children"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                onAnimationStart={onAnimationStart}
                onAnimationComplete={onAnimationSettled}
                className="overflow-hidden"
              >
                <div style={{ marginLeft: 4 }}>
                  {renderNodes(node.children!, level + 1)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    });
  }, [isExpanded, handleToggle, onSelectArtigo, onAnimationStart, onAnimationSettled, hideChevrons]);

  return (
    <div role="tree" className={cn("text-sm", className)}>
      {renderNodes(data)}
    </div>
  );
});

// -------- Artigo node (memoized, subscribes to active index directly) --------
const ArtigoNode = memo(function ArtigoNode({ node, level, onSelect }: {
  node: LeiTreeNode;
  level: number;
  onSelect?: (index: number) => void;
}) {
  // Subscribe to external store — only THIS node re-renders when its active state changes
  const activeIndex = useActiveArtigoIndex();
  const isActive = node.artigoIndex === activeIndex;

  return (
    <div style={{ paddingLeft: level === 0 ? 12 : level * 8 + 8 }} data-artigo-index={node.artigoIndex} data-tree-level={level}>
      {/* Epígrafe acima do artigo */}
      {node.epigrafe && (
        <div className="text-[10px] font-medium text-muted-foreground/70 px-2 pt-1.5 pb-0.5 truncate">
          {node.epigrafe}
        </div>
      )}

      {/* Card do artigo */}
      <button
        onClick={() => node.artigoIndex !== undefined && onSelect?.(node.artigoIndex)}
        className={cn(
          "w-full flex flex-col gap-0.5 py-1.5 px-2 pl-3 text-left rounded-md transition-colors group",
          isActive
            ? "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
            : "hover:bg-accent/50 text-foreground",
          node.isRevogado && "opacity-50"
        )}
      >
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-xs font-semibold shrink-0",
            isActive && "text-blue-700 dark:text-blue-300",
            node.isRevogado && "line-through"
          )}>
            {node.label}
          </span>
          {node.extra}
        </div>

        {/* Preview abaixo */}
        {node.preview && (
          <p className={cn(
            "text-[11px] text-muted-foreground line-clamp-1 leading-snug",
            node.isRevogado && "line-through"
          )}>
            {node.preview}
          </p>
        )}
      </button>
    </div>
  );
});
