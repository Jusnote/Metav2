"use client";

import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * SimpleTreeBeam — Lightweight SVG tree connector for simple hierarchies.
 * Same visual language as TracingBeam (L-shaped connectors) but without
 * framer-motion, scroll tracking, or gradient animations.
 *
 * Usage: wrap tree content where children have data-tree-branch + data-tree-level attributes.
 */

function buildTreePath(nodes: { y: number; x: number }[]): string {
  if (nodes.length === 0) return "";
  const sorted = [...nodes].sort((a, b) => a.y - b.y);
  const paths: string[] = [];

  const verticals = new Map<number, { yStart: number; yEnd: number }>();

  for (const node of sorted) {
    for (const [x, seg] of verticals) {
      if (x > node.x) {
        if (seg.yEnd > seg.yStart) {
          paths.push(`M ${x} ${seg.yStart} L ${x} ${seg.yEnd}`);
        }
        verticals.delete(x);
      }
    }

    if (verticals.has(node.x)) {
      const seg = verticals.get(node.x)!;
      if (seg.yEnd > seg.yStart) {
        paths.push(`M ${node.x} ${seg.yStart} L ${node.x} ${seg.yEnd}`);
      }
      verticals.delete(node.x);
    }

    let parentX = -1;
    for (const [x] of verticals) {
      if (x < node.x && x > parentX) parentX = x;
    }
    if (parentX >= 0) {
      paths.push(`M ${parentX} ${node.y} L ${node.x} ${node.y}`);
      verticals.get(parentX)!.yEnd = node.y;
    }

    verticals.set(node.x, { yStart: node.y, yEnd: node.y });
  }

  for (const [x, seg] of verticals) {
    if (seg.yEnd > seg.yStart) {
      paths.push(`M ${x} ${seg.yStart} L ${x} ${seg.yEnd}`);
    }
  }

  return paths.join(" ");
}

interface SimpleTreeBeamProps {
  className?: string;
  children: React.ReactNode;
  /** Base X offset in pixels (default 8) */
  baseX?: number;
  /** X step per tree level in pixels (default 14) */
  levelStep?: number;
}

export function SimpleTreeBeam({
  className,
  children,
  baseX = 8,
  levelStep = 14,
}: SimpleTreeBeamProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [pathD, setPathD] = useState("");
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const measure = () => {
      const contentRect = el.getBoundingClientRect();
      const branches = el.querySelectorAll<HTMLElement>("[data-tree-branch]");
      const nodes: { y: number; x: number }[] = [];

      branches.forEach((branch) => {
        const rect = branch.getBoundingClientRect();
        if (rect.height < 1) return;
        const level = parseInt(branch.getAttribute("data-tree-level") || "0", 10);
        const x = baseX + level * levelStep;
        const y = rect.top - contentRect.top + rect.height / 2;
        nodes.push({ y, x });
      });

      const d = buildTreePath(nodes);
      setPathD(d);
      setSvgSize({ w: el.offsetWidth, h: el.offsetHeight });
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const mo = new MutationObserver(() => {
      requestAnimationFrame(measure);
    });
    mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [baseX, levelStep]);

  return (
    <div className={cn("relative w-full", className)}>
      {svgSize.h > 0 && pathD && (
        <svg
          viewBox={`0 0 ${svgSize.w} ${svgSize.h}`}
          width={svgSize.w}
          height={svgSize.h}
          className="absolute top-0 left-0 pointer-events-none"
          style={{ zIndex: 1 }}
          aria-hidden
        >
          <path
            d={pathD}
            fill="none"
            stroke="#9CA3AF"
            strokeOpacity="0.20"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )}
      <div ref={contentRef}>
        {children}
      </div>
    </div>
  );
}
