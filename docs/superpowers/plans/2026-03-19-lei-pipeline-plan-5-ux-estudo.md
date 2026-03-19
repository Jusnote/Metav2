# Lei Pipeline v2 — Plan 5: UX Estudo (Annotation Layers)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add annotation layer system to the lei seca study view: clean text by default, orange indicator for devices with legislative history, click to expand history panel, toggle between lei seca / lei anotada views.

**Architecture:** Reuses existing `annotation-slots-extension` infrastructure (React Portals into ProseMirror decorations). New components: `LeiHistoryIndicator` (orange dot), `LeiHistoryPanel` (expandable panel), `LeiViewToggle` (toolbar toggle). The study editor reads `anotacoes_legislativas` from the article data and renders indicators/panels accordingly.

**Tech Stack:** React, TipTap, ProseMirror decorations, React Portals

**Depends on:** Plan 1 (Foundation — types), Plan 2 (Parser — anotacoes_legislativas field populated in DB)

**Spec:** `2026-03-19-lei-ingestion-pipeline-design.md` (section 4.5)

---

## File Structure

```
src/components/lei-seca/lei-history-indicator.tsx  # CREATE — orange dot indicator
src/components/lei-seca/lei-history-panel.tsx       # CREATE — expandable history panel
src/components/lei-seca/lei-view-toggle.tsx          # CREATE — Lei Seca / Lei Anotada toggle
src/components/lei-seca/lei-seca-editor.tsx          # MODIFY — integrate indicators + toggle
```

---

### Task 1: Create History Indicator Component

**Files:**
- Create: `src/components/lei-seca/lei-history-indicator.tsx`

- [ ] **Step 1: Create the orange dot indicator**

```tsx
// src/components/lei-seca/lei-history-indicator.tsx
// Small orange dot shown on devices that have legislative history (anotacoes_legislativas).

'use client';

import { cn } from '@/lib/utils';

interface LeiHistoryIndicatorProps {
  count: number;           // Number of annotations
  onClick: () => void;
  className?: string;
}

export function LeiHistoryIndicator({ count, onClick, className }: LeiHistoryIndicatorProps) {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        'absolute top-2 right-2 w-2 h-2 rounded-full bg-orange-400 opacity-60',
        'hover:opacity-100 hover:scale-150 transition-all cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-orange-400/50',
        className
      )}
      title={`${count} alteracao(oes) legislativa(s) — clique para ver historico`}
      aria-label={`Ver historico legislativo (${count} alteracoes)`}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/lei-seca/lei-history-indicator.tsx
git commit -m "feat: create legislative history indicator (orange dot)"
```

---

### Task 2: Create History Panel Component

**Files:**
- Create: `src/components/lei-seca/lei-history-panel.tsx`

- [ ] **Step 1: Create the expandable history panel**

```tsx
// src/components/lei-seca/lei-history-panel.tsx
// Expandable panel showing legislative history for a device.
// Rendered via React Portal inside annotation slot (below the device paragraph).

'use client';

import type { LegislativeAnnotation } from '@/types/lei-import';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeiHistoryPanelProps {
  annotations: LegislativeAnnotation[];
  revokedText?: string | null;  // Previous version text if revoked
  onClose: () => void;
  className?: string;
}

const TIPO_LABELS: Record<string, string> = {
  redacao: 'Redacao alterada',
  inclusao: 'Incluido',
  revogacao: 'Revogado',
  vide: 'Vide',
  vigencia: 'Vigencia',
  regulamento: 'Regulamento',
  producao_efeito: 'Producao de efeito',
  veto: 'Vetado',
  outro: 'Outro',
};

const TIPO_COLORS: Record<string, string> = {
  redacao: 'text-orange-400',
  inclusao: 'text-green-400',
  revogacao: 'text-red-400',
  vide: 'text-blue-400',
  vigencia: 'text-yellow-400',
  regulamento: 'text-purple-400',
  veto: 'text-red-500',
  outro: 'text-gray-400',
};

export function LeiHistoryPanel({
  annotations,
  revokedText,
  onClose,
  className,
}: LeiHistoryPanelProps) {
  if (annotations.length === 0) return null;

  return (
    <div
      className={cn(
        'mx-4 my-2 p-3 rounded-lg border border-orange-500/20 bg-orange-50 dark:bg-orange-950/20',
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
          Historico Legislativo
        </span>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-orange-200/50 dark:hover:bg-orange-800/50"
          aria-label="Fechar historico"
        >
          <X className="w-3.5 h-3.5 text-orange-500" />
        </button>
      </div>

      <ul className="space-y-1">
        {annotations.map((a, i) => (
          <li key={i} className="text-xs leading-relaxed">
            <span className={cn('font-medium', TIPO_COLORS[a.tipo] || 'text-gray-400')}>
              {TIPO_LABELS[a.tipo] || a.tipo}
            </span>
            {a.lei_referenciada && (
              <span className="text-muted-foreground"> — Lei {a.lei_referenciada}</span>
            )}
          </li>
        ))}
      </ul>

      {revokedText && (
        <div className="mt-2 pt-2 border-t border-orange-500/10">
          <span className="text-xs font-medium text-muted-foreground">Versao anterior:</span>
          <p className="text-xs text-muted-foreground/70 mt-1 line-through">{revokedText}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/lei-seca/lei-history-panel.tsx
git commit -m "feat: create legislative history panel component"
```

---

### Task 3: Create View Toggle Component

**Files:**
- Create: `src/components/lei-seca/lei-view-toggle.tsx`

- [ ] **Step 1: Create the toggle**

```tsx
// src/components/lei-seca/lei-view-toggle.tsx
// Toggle between "Lei Seca" (clean) and "Lei Anotada" (with inline annotations) views.

'use client';

import { cn } from '@/lib/utils';

interface LeiViewToggleProps {
  mode: 'clean' | 'annotated';
  onChange: (mode: 'clean' | 'annotated') => void;
  className?: string;
}

export function LeiViewToggle({ mode, onChange, className }: LeiViewToggleProps) {
  return (
    <div className={cn('inline-flex rounded-lg border bg-muted p-0.5', className)}>
      <button
        onClick={() => onChange('clean')}
        className={cn(
          'px-3 py-1 text-xs font-medium rounded-md transition-colors',
          mode === 'clean'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Lei Seca
      </button>
      <button
        onClick={() => onChange('annotated')}
        className={cn(
          'px-3 py-1 text-xs font-medium rounded-md transition-colors',
          mode === 'annotated'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Lei Anotada
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/lei-seca/lei-view-toggle.tsx
git commit -m "feat: create Lei Seca / Lei Anotada view toggle"
```

---

### Task 4: Integrate into Study Editor

**Files:**
- Modify: `src/components/lei-seca/lei-seca-editor.tsx`

- [ ] **Step 1: Read the current file fully**

Read `src/components/lei-seca/lei-seca-editor.tsx` to understand current structure: extensions, decorations, annotation slots, action menu.

- [ ] **Step 2: Add view mode state**

```typescript
const [viewMode, setViewMode] = useState<'clean' | 'annotated'>('clean');
```

- [ ] **Step 3: Add LeiViewToggle to toolbar**

Render the toggle component in the editor toolbar area.

- [ ] **Step 4: Add LeiHistoryIndicator to each device with annotations**

The existing `LeiParagraph` extension renders each device as a paragraph with `data-slug`. For devices that have `anotacoes_legislativas.length > 0` in the article data, render a `LeiHistoryIndicator` positioned absolutely within the paragraph.

This requires the editor to receive article annotation data (from `useLeiContent` or similar) and match slugs to annotations.

- [ ] **Step 5: Wire indicator click to history panel**

Clicking the indicator should open a `LeiHistoryPanel` below the device, using the existing annotation-slots infrastructure:

1. `annotationStore.open(slug, 'expanded')` triggers the slot
2. `AnnotationPortals` renders the portal
3. Inside the portal, show `LeiHistoryPanel` instead of (or alongside) `AnnotationCard`

The slot system needs to support two panel types: user notes (existing) and legislative history (new). Use the `mode` field in annotationStore to distinguish.

- [ ] **Step 6: Handle "Lei Anotada" mode**

When `viewMode === 'annotated'`, render `texto_original` (with inline annotations) instead of `texto_limpo`. This can be done by swapping the plate_content used for rendering, or by injecting annotation text back inline.

- [ ] **Step 7: Verify build passes**

Run: `npx tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
git add src/components/lei-seca/lei-seca-editor.tsx
git commit -m "feat: integrate history indicator, panel, and view toggle in study editor"
```

---

## Verification

After completing all 4 tasks:

- [ ] Study view shows clean text by default (Lei Seca mode)
- [ ] Orange dot appears on devices with `anotacoes_legislativas`
- [ ] Clicking dot opens history panel below the device
- [ ] History panel shows annotation type, referenced law, and color coding
- [ ] Panel closes on X click or Escape
- [ ] Toggle switches between Lei Seca (clean) and Lei Anotada (inline annotations)
- [ ] Existing user annotation (caderno) system still works alongside
