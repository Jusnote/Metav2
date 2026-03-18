"use client";

import React, { useState, useEffect, useRef, useId, useCallback, forwardRef, useImperativeHandle } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useScroll,
  useTransform,
} from "motion/react";
import { cn } from "@/lib/utils";

// ---- Public ref interface ----
export interface TracingBeamRef {
  /** Force re-measurement of node positions (call after animations settle) */
  remeasure: () => void;
  /** Signal that a tree animation has started (blocks measurement until settled) */
  animationStarted: () => void;
}

interface TracingBeamProps {
  /** Index of the active artigo (for dot positioning) */
  activeArtigoIndex: number;
  /** Ref to the scroll container (sidebar scroll area) */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
  children: React.ReactNode;
}

interface PathNode {
  y: number;
  yBottom: number; // bottom edge of the element — beam extends here before diagonal
  x: number;
  type: "section" | "artigo";
  index?: number;
}

// ---- Beam X positions derived from tree level (deterministic, no DOM measurement) ----
const BASE_X = 5;
const LEVEL_STEP = 8;
const getBeamX = (level: number) => BASE_X + level * LEVEL_STEP;

// ---- Path builder: tree-style L-shaped connectors ----
// Each parent gets a vertical line connecting its children.
// Each child gets a horizontal branch from the parent's vertical.
// No diagonals — clean ├── / └── tree structure.
function buildTreePath(nodes: PathNode[], contentHeight: number): string {
  if (nodes.length === 0) return "";

  const sorted = [...nodes].sort((a, b) => a.y - b.y);
  const paths: string[] = [];

  // Aesthetic: vertical from top of content to first node
  if (sorted[0].y > 0) {
    paths.push(`M ${sorted[0].x} 0 L ${sorted[0].x} ${sorted[0].y}`);
  }

  // Active vertical connectors per x-level.
  // Each entry: vertical at x from yStart (below section label) to yEnd (last child y).
  const verticals = new Map<number, { yStart: number; yEnd: number }>();

  for (const node of sorted) {
    // 1) Close verticals strictly deeper than this node
    for (const [x, seg] of verticals) {
      if (x > node.x) {
        if (seg.yEnd > seg.yStart) {
          paths.push(`M ${x} ${seg.yStart} L ${x} ${seg.yEnd}`);
        }
        verticals.delete(x);
      }
    }

    // 2) Close vertical at same x (previous section's subtree is complete)
    if (verticals.has(node.x)) {
      const seg = verticals.get(node.x)!;
      if (seg.yEnd > seg.yStart) {
        paths.push(`M ${node.x} ${seg.yStart} L ${node.x} ${seg.yEnd}`);
      }
      verticals.delete(node.x);
    }

    // 3) Horizontal branch from nearest shallower vertical
    let parentX = -1;
    for (const [x] of verticals) {
      if (x < node.x && x > parentX) parentX = x;
    }
    if (parentX >= 0) {
      paths.push(`M ${parentX} ${node.y} L ${node.x} ${node.y}`);
      verticals.get(parentX)!.yEnd = node.y;
    }

    // 4) New vertical for this node's potential children
    // Starts at node.y (where parent's horizontal branch arrives) — not yBottom —
    // so the vertical seamlessly continues from the branch through the label to children.
    verticals.set(node.x, { yStart: node.y, yEnd: node.y });
  }

  // Finalize: draw remaining verticals, extend shallowest to contentHeight
  let minX = Infinity;
  for (const [x] of verticals) {
    if (x < minX) minX = x;
  }
  for (const [x, seg] of verticals) {
    const endY = x === minX && contentHeight > seg.yEnd + 10 ? contentHeight : seg.yEnd;
    if (endY > seg.yStart) {
      paths.push(`M ${x} ${seg.yStart} L ${x} ${endY}`);
    }
  }

  return paths.join(" ");
}

// ---- Component ----
export const TracingBeam = forwardRef<TracingBeamRef, TracingBeamProps>(
  function TracingBeam({ activeArtigoIndex, scrollContainerRef, className, children }, ref) {
    const id = useId();
    const gradientId = `beam-grad-${id.replace(/:/g, "")}`;

    const contentRef = useRef<HTMLDivElement>(null);
    const [svgHeight, setSvgHeight] = useState(0);
    const [svgWidth, setSvgWidth] = useState(0);
    const [nodes, setNodes] = useState<PathNode[]>([]);

    // Timer refs — component-level so they're accessible from both
    // scheduleRemeasure (debounced, for observers) and remeasure (immediate, for onAnimationComplete)
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();
    const rafIdRef = useRef<number>();
    // Generation counter: incremented on every new measurement request.
    // Stale debounced callbacks check this to avoid executing after a newer request superseded them.
    const measureGenRef = useRef(0);
    const svgRef = useRef<SVGSVGElement>(null);
    const animatingRef = useRef(false);
    const safetyTimerRef = useRef<ReturnType<typeof setTimeout>>();

    // ---- Scroll tracking (follows SIDEBAR scroll) ----
    const { scrollYProgress } = useScroll({
      container: scrollContainerRef,
    });

    const y1 = useSpring(
      useTransform(scrollYProgress, [0, 0.8], [50, svgHeight]),
      { stiffness: 500, damping: 90 }
    );
    const y2 = useSpring(
      useTransform(scrollYProgress, [0, 1], [50, svgHeight - 200]),
      { stiffness: 500, damping: 90 }
    );

    // ---- Measure all geometry in one atomic pass ----
    // Reads dimensions + node positions in a single synchronous block so that
    // setSvgHeight/setSvgWidth/setNodes are batched into ONE React render.
    const measureAll = useCallback(() => {
      const el = contentRef.current;
      if (!el) return;

      // --- Batch ALL DOM reads before any state writes (no layout thrash) ---
      const height = el.offsetHeight;
      const width = el.offsetWidth;
      const contentRect = el.getBoundingClientRect();
      const newNodes: PathNode[] = [];

      // Section buttons
      el.querySelectorAll<HTMLElement>("[data-tree-branch]").forEach((btn) => {
        const rect = btn.getBoundingClientRect();
        if (rect.height < 1) return; // skip collapsed/exiting elements
        const level = parseInt(btn.getAttribute("data-tree-level") || "0", 10);
        const x = getBeamX(level);
        const y = rect.top - contentRect.top + 10;
        const yBottom = rect.bottom - contentRect.top;
        newNodes.push({ y, yBottom, x, type: "section" });
      });

      // Artigo nodes
      el.querySelectorAll<HTMLElement>("[data-artigo-index]").forEach((div) => {
        const rect = div.getBoundingClientRect();
        if (rect.height < 1) return;
        const level = parseInt(div.getAttribute("data-tree-level") || "0", 10);
        const x = getBeamX(level);
        const y = rect.top - contentRect.top + rect.height / 2;
        const yBottom = rect.bottom - contentRect.top;
        const idx = parseInt(div.getAttribute("data-artigo-index") || "0", 10);
        newNodes.push({ y, yBottom, x, type: "artigo", index: idx });
      });

      // --- All three state updates batched into one React render ---
      setSvgHeight(height);
      setSvgWidth(width);
      setNodes(newNodes);
    }, []);

    // ---- Debounced measurement (for ResizeObserver/MutationObserver) ----
    // Skips entirely while tree animations are in progress (animatingRef).
    // Otherwise waits 280ms after the LAST observer event before measuring.
    const scheduleRemeasure = useCallback(() => {
      // Skip measurement while tree animations are in progress
      if (animatingRef.current) return;

      clearTimeout(debounceTimerRef.current);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      measureGenRef.current++;
      const gen = measureGenRef.current;

      debounceTimerRef.current = setTimeout(() => {
        if (measureGenRef.current !== gen) return;
        rafIdRef.current = requestAnimationFrame(measureAll);
      }, 280);
    }, [measureAll]);

    // ---- Post-animation measurement (called from onAnimationComplete via ref) ----
    // Short debounce (80ms) to batch multiple concurrent animation completions,
    // then double-rAF to ensure DOM layout is fully settled.
    const remeasure = useCallback(() => {
      clearTimeout(debounceTimerRef.current);
      clearTimeout(safetyTimerRef.current);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      measureGenRef.current++;
      const gen = measureGenRef.current;

      debounceTimerRef.current = setTimeout(() => {
        if (measureGenRef.current !== gen) return;
        animatingRef.current = false;
        // Double-rAF: ensures layout is fully committed before reading geometry
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = requestAnimationFrame(() => {
            measureAll();
            if (svgRef.current) svgRef.current.style.opacity = '1';
          });
        });
      }, 80);
    }, [measureAll]);

    // ---- Signal that a tree expand/collapse animation has started ----
    // Blocks observer-driven measurements and fades the beam to avoid visual noise.
    const animationStarted = useCallback(() => {
      animatingRef.current = true;
      if (svgRef.current) svgRef.current.style.opacity = '0.3';
      // Safety: force measure after 600ms if onAnimationComplete never fires
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = setTimeout(() => {
        if (animatingRef.current) {
          animatingRef.current = false;
          measureGenRef.current++;
          rafIdRef.current = requestAnimationFrame(() => {
            measureAll();
            if (svgRef.current) svgRef.current.style.opacity = '1';
          });
        }
      }, 600);
    }, [measureAll]);

    // Expose remeasure + animationStarted to parent via ref
    useImperativeHandle(ref, () => ({ remeasure, animationStarted }), [remeasure, animationStarted]);

    // ---- Unified observer: ResizeObserver + MutationObserver → single debounced measure ----
    useEffect(() => {
      const el = contentRef.current;
      if (!el) return;

      // Immediate initial measurement — no animation in progress at mount
      measureAll();

      const ro = new ResizeObserver(scheduleRemeasure);
      ro.observe(el);

      const mo = new MutationObserver(scheduleRemeasure);
      mo.observe(el, { childList: true, subtree: true });

      return () => {
        clearTimeout(debounceTimerRef.current);
        clearTimeout(safetyTimerRef.current);
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        ro.disconnect();
        mo.disconnect();
      };
    }, [measureAll, scheduleRemeasure]);

    // ---- Active artigo dot (spring-animated) ----
    const activeNode = nodes.find(
      (n) => n.type === "artigo" && n.index === activeArtigoIndex
    );
    const targetY = activeNode?.y ?? 0;
    const targetX = activeNode?.x ?? BASE_X;

    const dotYMV = useMotionValue(targetY);
    const smoothDotY = useSpring(dotYMV, { stiffness: 400, damping: 60 });
    const dotXMV = useMotionValue(targetX);
    const smoothDotX = useSpring(dotXMV, { stiffness: 400, damping: 60 });

    useEffect(() => {
      dotYMV.set(targetY);
      dotXMV.set(targetX);
    }, [targetY, targetX, dotYMV, dotXMV]);

    // ---- SVG path ----
    const treePath = buildTreePath(nodes, svgHeight);

    return (
      <div className={cn("relative w-full", className)}>
        {/* SVG overlays content — traces through tree structure */}
        {svgHeight > 0 && treePath && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            width={svgWidth}
            height={svgHeight}
            className="absolute top-0 left-0 pointer-events-none"
            style={{ zIndex: 1, transition: 'opacity 0.2s ease' }}
            aria-hidden
          >
            {/* Background path — full tree, subtle */}
            <path
              d={treePath}
              fill="none"
              stroke="#9091A0"
              strokeOpacity="0.20"
              strokeWidth="1.5"
              strokeLinecap="round"
            />

            {/* Animated gradient path — scroll-driven */}
            <path
              d={treePath}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="1.5"
              strokeLinecap="round"
            />

            <defs>
              <motion.linearGradient
                id={gradientId}
                gradientUnits="userSpaceOnUse"
                x1="0"
                x2="0"
                y1={y1}
                y2={y2}
              >
                <stop stopColor="#9CA3AF" stopOpacity="0" />
                <stop stopColor="#9CA3AF" />
                <stop offset="0.325" stopColor="#9CA3AF" />
                <stop offset="1" stopColor="#9CA3AF" stopOpacity="0" />
              </motion.linearGradient>
            </defs>

            {/* Section dots — animated for smooth position transitions */}
            {nodes
              .filter((n) => n.type === "section")
              .map((n, i) => (
                <motion.circle
                  key={`s-${i}`}
                  r="3"
                  fill="white"
                  stroke="#9091A0"
                  strokeWidth="1"
                  strokeOpacity="0.4"
                  animate={{ cx: n.x, cy: n.y }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                />
              ))}

            {/* Active artigo — glowing dot */}
            <motion.circle
              cx={smoothDotX}
              cy={smoothDotY}
              r="4"
              className="fill-blue-500 dark:fill-blue-400"
              style={{
                filter: "drop-shadow(0 0 4px rgba(59,130,246,0.5))",
              }}
            />
            <motion.circle
              cx={smoothDotX}
              cy={smoothDotY}
              r="7"
              fill="none"
              className="stroke-blue-400/25 dark:stroke-blue-300/15"
              strokeWidth="1"
            />
          </svg>
        )}

        {/* Content — beam overlays on top */}
        <div ref={contentRef} className="tracing-beam-content">
          {children}
        </div>
      </div>
    );
  }
);
