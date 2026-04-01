# Dispositivo Reactions + Footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add personal emoji reactions, community reaction badges, and inline action footer to each Lei Seca dispositivo.

**Architecture:** Database layer (table + 2 RPCs), React hooks for data fetching/mutation, a `DispositivoActions` component for the 3-zone gutter, and a `DispositivoFooter` for inline actions. The `DispositivoRenderer` gets modified to use flex layout with the new gutter.

**Tech Stack:** Supabase (table, RPCs, RLS), React Query hooks, React 19, Tailwind CSS, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-04-01-dispositivo-reactions-footer-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `src/hooks/useDispositivoReactions.ts` | Fetch reactions for a lei + toggle mutation |
| `src/components/lei-seca/dispositivos/DispositivoActions.tsx` | 3-zone gutter: personal, community, more |
| `src/components/lei-seca/dispositivos/DispositivoFooter.tsx` | Inline action bar (Copiar, Anotar, Grifar, Reportar) |
| `src/components/lei-seca/dispositivos/ReactionPicker.tsx` | Floating emoji picker pill |
| `src/components/lei-seca/dispositivos/CommunityPopover.tsx` | Popover showing reaction breakdown |

### Modified files

| File | Changes |
|------|---------|
| `src/components/lei-seca/dispositivos/DispositivoRenderer.tsx` | Replace absolute Flag button with flex layout + DispositivoActions |
| `src/components/lei-seca/dispositivos/DispositivoList.tsx` | Pass reactions data down |
| `src/views/LeiSecaPage.tsx` | Call useDispositivoReactions, pass to DispositivoList |

---

## Phase 1 — Database

### Task 1: Create table and RPCs in Supabase

**Files:** SQL executed via Supabase CLI/dashboard

- [ ] **Step 1: Create the table**

Run this SQL in the Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS dispositivo_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dispositivo_id text NOT NULL,
  lei_id text NOT NULL,
  emoji text NOT NULL CHECK (emoji IN ('🔥','📌','⚠️','💡','❤️')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, dispositivo_id)
);

CREATE INDEX idx_disp_reactions_lei ON dispositivo_reactions(lei_id);
CREATE INDEX idx_disp_reactions_disp ON dispositivo_reactions(dispositivo_id);

-- RLS
ALTER TABLE dispositivo_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all reactions"
  ON dispositivo_reactions FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own reactions"
  ON dispositivo_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reactions"
  ON dispositivo_reactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions"
  ON dispositivo_reactions FOR DELETE
  USING (auth.uid() = user_id);
```

- [ ] **Step 2: Create get_dispositivo_reactions RPC**

```sql
CREATE OR REPLACE FUNCTION get_dispositivo_reactions(p_lei_id text, p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  dispositivo_id text,
  top_emoji text,
  total_count bigint,
  breakdown jsonb,
  user_emoji text
)
LANGUAGE sql STABLE
AS $$
  WITH counts AS (
    SELECT
      r.dispositivo_id,
      r.emoji,
      count(*) AS cnt
    FROM dispositivo_reactions r
    WHERE r.lei_id = p_lei_id
    GROUP BY r.dispositivo_id, r.emoji
  ),
  agg AS (
    SELECT
      c.dispositivo_id,
      (ARRAY_AGG(c.emoji ORDER BY c.cnt DESC))[1] AS top_emoji,
      SUM(c.cnt) AS total_count,
      jsonb_object_agg(c.emoji, c.cnt) AS breakdown
    FROM counts c
    GROUP BY c.dispositivo_id
  ),
  user_reactions AS (
    SELECT dispositivo_id, emoji AS user_emoji
    FROM dispositivo_reactions
    WHERE lei_id = p_lei_id AND user_id = p_user_id
  )
  SELECT
    a.dispositivo_id,
    a.top_emoji,
    a.total_count,
    a.breakdown,
    u.user_emoji
  FROM agg a
  LEFT JOIN user_reactions u USING (dispositivo_id);
$$;
```

- [ ] **Step 3: Create toggle_dispositivo_reaction RPC**

```sql
CREATE OR REPLACE FUNCTION toggle_dispositivo_reaction(
  p_dispositivo_id text,
  p_lei_id text,
  p_emoji text
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing text;
BEGIN
  SELECT emoji INTO v_existing
  FROM dispositivo_reactions
  WHERE user_id = v_user_id AND dispositivo_id = p_dispositivo_id;

  IF v_existing IS NULL THEN
    INSERT INTO dispositivo_reactions (user_id, dispositivo_id, lei_id, emoji)
    VALUES (v_user_id, p_dispositivo_id, p_lei_id, p_emoji);
    RETURN 'added';
  ELSIF v_existing = p_emoji THEN
    DELETE FROM dispositivo_reactions
    WHERE user_id = v_user_id AND dispositivo_id = p_dispositivo_id;
    RETURN 'removed';
  ELSE
    UPDATE dispositivo_reactions
    SET emoji = p_emoji, created_at = now()
    WHERE user_id = v_user_id AND dispositivo_id = p_dispositivo_id;
    RETURN 'changed';
  END IF;
END;
$$;
```

- [ ] **Step 4: Verify**

Test in SQL Editor:
```sql
SELECT * FROM get_dispositivo_reactions('some-lei-id', auth.uid());
```

Should return empty result (no reactions yet).

---

## Phase 2 — Hook

### Task 2: useDispositivoReactions hook

**Files:**
- Create: `src/hooks/useDispositivoReactions.ts`

- [ ] **Step 1: Create the hook**

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface DispositivoReaction {
  dispositivoId: string;
  topEmoji: string;
  totalCount: number;
  breakdown: Record<string, number>;
  userEmoji: string | null;
}

export function useDispositivoReactions(leiId: string | undefined) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['dispositivo-reactions', leiId],
    queryFn: async () => {
      if (!leiId) return new Map<string, DispositivoReaction>();

      const { data, error } = await (supabase as any).rpc('get_dispositivo_reactions', {
        p_lei_id: leiId,
        p_user_id: user?.id ?? null,
      });

      if (error) throw error;

      const map = new Map<string, DispositivoReaction>();
      for (const row of data ?? []) {
        map.set(row.dispositivo_id, {
          dispositivoId: row.dispositivo_id,
          topEmoji: row.top_emoji,
          totalCount: Number(row.total_count),
          breakdown: row.breakdown ?? {},
          userEmoji: row.user_emoji ?? null,
        });
      }
      return map;
    },
    enabled: !!leiId,
    staleTime: 60 * 1000,
  });

  return query;
}

export function useToggleDispositivoReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dispositivoId,
      leiId,
      emoji,
    }: {
      dispositivoId: string;
      leiId: string;
      emoji: string;
    }) => {
      const { data, error } = await (supabase as any).rpc('toggle_dispositivo_reaction', {
        p_dispositivo_id: dispositivoId,
        p_lei_id: leiId,
        p_emoji: emoji,
      });
      if (error) throw error;
      return data as string; // 'added' | 'removed' | 'changed'
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['dispositivo-reactions', variables.leiId],
      });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useDispositivoReactions.ts
git commit -m "feat(lei-seca): add useDispositivoReactions hook"
```

---

## Phase 3 — Components

### Task 3: ReactionPicker

**Files:**
- Create: `src/components/lei-seca/dispositivos/ReactionPicker.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client';

import { useEffect, useRef } from 'react';

const REACTIONS = [
  { emoji: '🔥', label: 'Cai em prova' },
  { emoji: '📌', label: 'Decorar' },
  { emoji: '⚠️', label: 'Pegadinha' },
  { emoji: '💡', label: 'Insight' },
  { emoji: '❤️', label: 'Importante' },
];

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function ReactionPicker({ onSelect, onClose }: ReactionPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 bottom-[calc(100%+4px)] flex gap-0 bg-white border border-[#eee] rounded-[24px] px-1 py-[3px] z-10"
      style={{
        boxShadow: '0 8px 24px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.03)',
        animation: 'reactionPickerPop 0.18s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <style>{`
        @keyframes reactionPickerPop {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
      {REACTIONS.map((r) => (
        <button
          key={r.emoji}
          onClick={() => onSelect(r.emoji)}
          title={r.label}
          className="w-8 h-8 flex items-center justify-center border-none bg-transparent rounded-[18px] cursor-pointer text-[16px] transition-all duration-[120ms] hover:bg-[#f8f8f7] hover:scale-[1.2]"
        >
          {r.emoji}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/lei-seca/dispositivos/ReactionPicker.tsx
git commit -m "feat(lei-seca): add ReactionPicker component"
```

---

### Task 4: CommunityPopover

**Files:**
- Create: `src/components/lei-seca/dispositivos/CommunityPopover.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client';

import { useEffect, useRef } from 'react';

interface CommunityPopoverProps {
  breakdown: Record<string, number>;
  onClose: () => void;
}

export function CommunityPopover({ breakdown, onClose }: CommunityPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);

  return (
    <div
      ref={ref}
      className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 flex gap-1 items-center bg-white border border-[#eee] rounded-[14px] px-[10px] py-2 z-20 whitespace-nowrap"
      style={{
        boxShadow: '0 8px 24px rgba(0,0,0,0.07), 0 2px 6px rgba(0,0,0,0.03)',
        animation: 'commPopUp 0.15s ease-out',
      }}
    >
      <style>{`
        @keyframes commPopUp {
          from { opacity: 0; transform: translateX(-50%) translateY(4px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
      {sorted.map(([emoji, count]) => (
        <div
          key={emoji}
          className="flex items-center gap-[3px] px-2 py-[3px] rounded-lg text-[13px] font-[Inter,sans-serif] transition-colors hover:bg-[#f8f8f7]"
        >
          {emoji} <span className="text-[10px] text-[#999] font-semibold">{count}</span>
        </div>
      ))}
      {/* Arrow */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-white" />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/lei-seca/dispositivos/CommunityPopover.tsx
git commit -m "feat(lei-seca): add CommunityPopover component"
```

---

### Task 5: DispositivoFooter

**Files:**
- Create: `src/components/lei-seca/dispositivos/DispositivoFooter.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client';

import { useCallback } from 'react';
import { Copy, PenLine, Highlighter, Flag } from 'lucide-react';
import { toast } from 'sonner';

interface DispositivoFooterProps {
  texto: string;
  dispositivoId: string;
  leiId: string;
  dispositivoTipo: string;
  dispositivoPosicao: number | string;
  onAnnotate?: () => void;
  onHighlight?: () => void;
  onReport?: () => void;
}

export function DispositivoFooter({
  texto,
  onAnnotate,
  onHighlight,
  onReport,
}: DispositivoFooterProps) {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(texto).then(() => {
      toast.success('Texto copiado');
    }).catch(() => {
      toast.error('Erro ao copiar');
    });
  }, [texto]);

  return (
    <div
      className="flex items-center gap-0 py-[6px]"
      style={{ animation: 'dispFootSlide 0.18s ease-out' }}
    >
      <style>{`
        @keyframes dispFootSlide {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <button
        onClick={handleCopy}
        className="flex items-center gap-[6px] px-3 py-[6px] rounded-[7px] border-none bg-transparent font-[Inter,sans-serif] text-[11.5px] font-medium text-[#b0b0b0] cursor-pointer transition-all duration-[120ms] hover:bg-[#f5f5f4] hover:text-[#555] [&_svg]:opacity-50 [&:hover_svg]:opacity-80"
      >
        <Copy className="h-[13px] w-[13px]" />
        Copiar
      </button>
      <button
        onClick={onAnnotate}
        className="flex items-center gap-[6px] px-3 py-[6px] rounded-[7px] border-none bg-transparent font-[Inter,sans-serif] text-[11.5px] font-medium text-[#b0b0b0] cursor-pointer transition-all duration-[120ms] hover:bg-[#f5f5f4] hover:text-[#555] [&_svg]:opacity-50 [&:hover_svg]:opacity-80"
      >
        <PenLine className="h-[13px] w-[13px]" />
        Anotar
      </button>
      <button
        onClick={onHighlight}
        className="flex items-center gap-[6px] px-3 py-[6px] rounded-[7px] border-none bg-transparent font-[Inter,sans-serif] text-[11.5px] font-medium text-[#b0b0b0] cursor-pointer transition-all duration-[120ms] hover:bg-[#f5f5f4] hover:text-[#555] [&_svg]:opacity-50 [&:hover_svg]:opacity-80"
      >
        <Highlighter className="h-[13px] w-[13px]" />
        Grifar
      </button>
      <div className="w-px h-[14px] bg-[#eee] mx-[2px]" />
      <button
        onClick={onReport}
        className="flex items-center gap-[6px] px-3 py-[6px] rounded-[7px] border-none bg-transparent font-[Inter,sans-serif] text-[11.5px] font-medium text-[#b0b0b0] cursor-pointer transition-all duration-[120ms] hover:bg-[#f5f5f4] hover:text-[#555] [&_svg]:opacity-50 [&:hover_svg]:opacity-80"
      >
        <Flag className="h-[13px] w-[13px]" />
        Reportar
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/lei-seca/dispositivos/DispositivoFooter.tsx
git commit -m "feat(lei-seca): add DispositivoFooter inline actions"
```

---

### Task 6: DispositivoActions (3-zone gutter)

**Files:**
- Create: `src/components/lei-seca/dispositivos/DispositivoActions.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client';

import { useState, useCallback } from 'react';
import { ReactionPicker } from './ReactionPicker';
import { CommunityPopover } from './CommunityPopover';
import { DispositivoFooter } from './DispositivoFooter';
import { LeiReportModal } from '@/components/lei-seca/LeiReportModal';
import type { DispositivoReaction } from '@/hooks/useDispositivoReactions';

interface DispositivoActionsProps {
  dispositivoId: string;
  leiId: string;
  texto: string;
  tipo: string;
  posicao: number | string;
  reaction?: DispositivoReaction;
  onToggleReaction: (emoji: string) => void;
  onAnnotate?: () => void;
  onHighlight?: () => void;
}

export function DispositivoActions({
  dispositivoId,
  leiId,
  texto,
  tipo,
  posicao,
  reaction,
  onToggleReaction,
  onAnnotate,
  onHighlight,
}: DispositivoActionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [footerOpen, setFooterOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const userEmoji = reaction?.userEmoji;
  const hasReacted = !!userEmoji;
  const topEmoji = reaction?.topEmoji;
  const totalCount = reaction?.totalCount ?? 0;
  const breakdown = reaction?.breakdown ?? {};

  const handleSelectEmoji = useCallback((emoji: string) => {
    onToggleReaction(emoji);
    setPickerOpen(false);
  }, [onToggleReaction]);

  const handleToggleFooter = useCallback(() => {
    setFooterOpen((prev) => !prev);
    setPickerOpen(false);
    setPopoverOpen(false);
  }, []);

  return (
    <>
      {/* Gutter — 3 zones */}
      <div
        className={`flex items-center flex-shrink-0 ml-3 pt-[6px] transition-opacity duration-200 ${
          hasReacted ? 'opacity-100' : 'opacity-0 group-hover/disp:opacity-100'
        }`}
        style={{ gap: 0 }}
      >
        {/* Zone 1: Personal */}
        <div className="flex items-center gap-[3px] px-[5px] relative">
          <button
            onClick={() => { setPickerOpen(!pickerOpen); setPopoverOpen(false); }}
            className={`w-[26px] h-[26px] flex items-center justify-center rounded-[7px] border-none bg-transparent cursor-pointer transition-all duration-150 ${
              hasReacted
                ? 'text-[15px] hover:bg-[#f5f5f4] hover:scale-110'
                : 'text-[#d4d4d4] hover:bg-[#f5f5f4] hover:text-[#dc7c7c]'
            }`}
          >
            {hasReacted ? (
              userEmoji
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            )}
          </button>
          {pickerOpen && (
            <ReactionPicker
              onSelect={handleSelectEmoji}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>

        <div className="w-px h-4 bg-[#eceae7] flex-shrink-0" />

        {/* Zone 2: Community */}
        <div className="flex items-center gap-[3px] px-[5px] relative">
          {totalCount > 0 ? (
            <button
              onClick={() => { setPopoverOpen(!popoverOpen); setPickerOpen(false); }}
              className="flex items-center gap-[2px] px-[5px] py-[2px] rounded-lg text-[12px] font-[Inter,sans-serif] cursor-pointer transition-colors hover:bg-[#f5f5f4]"
            >
              {topEmoji} <span className="text-[9px] text-[#bbb] font-semibold">{totalCount}</span>
            </button>
          ) : (
            <span className="text-[9px] text-[#ddd] font-[Inter,sans-serif] px-[2px]">—</span>
          )}
          {popoverOpen && totalCount > 0 && (
            <CommunityPopover
              breakdown={breakdown}
              onClose={() => setPopoverOpen(false)}
            />
          )}
        </div>

        <div className="w-px h-4 bg-[#eceae7] flex-shrink-0" />

        {/* Zone 3: More */}
        <div className="flex items-center px-[5px]">
          <button
            onClick={handleToggleFooter}
            className={`w-[26px] h-[26px] flex items-center justify-center rounded-[7px] border-none bg-transparent cursor-pointer transition-all duration-150 ${
              footerOpen ? 'bg-[#f0f0ef] text-[#555]' : 'text-[#d4d4d4] hover:bg-[#f5f5f4] hover:text-[#888]'
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Footer (below dispositivo) */}
      {footerOpen && (
        <DispositivoFooter
          texto={texto}
          dispositivoId={dispositivoId}
          leiId={leiId}
          dispositivoTipo={tipo}
          dispositivoPosicao={posicao}
          onAnnotate={onAnnotate}
          onHighlight={onHighlight}
          onReport={() => { setReportOpen(true); setFooterOpen(false); }}
        />
      )}

      {/* Report modal */}
      {reportOpen && (
        <LeiReportModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          dispositivoId={String(dispositivoId)}
          leiId={leiId}
          dispositivoTipo={tipo}
          dispositivoNumero={String(posicao)}
          dispositivoTexto={texto}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/lei-seca/dispositivos/DispositivoActions.tsx
git commit -m "feat(lei-seca): add DispositivoActions 3-zone gutter"
```

---

## Phase 4 — Integration

### Task 7: Modify DispositivoRenderer

**Files:**
- Modify: `src/components/lei-seca/dispositivos/DispositivoRenderer.tsx`

- [ ] **Step 1: Read the current file fully**

- [ ] **Step 2: Replace imports and add new ones**

Remove the `Flag` and `LeiReportModal` imports. Add:

```typescript
import { DispositivoActions } from './DispositivoActions';
import type { DispositivoReaction } from '@/hooks/useDispositivoReactions';
```

- [ ] **Step 3: Add reaction prop to Props interface**

```typescript
interface Props {
  item: Dispositivo
  leiId?: string
  leiSecaMode?: boolean
  showRevogados?: boolean
  grifos?: Grifo[]
  onGrifoClick?: (grifo: Grifo, rect: DOMRect) => void
  onSaveNote?: (grifoId: string, note: string) => void
  noteOpenGrifoId?: string | null
  reaction?: DispositivoReaction
  onToggleReaction?: (dispositivoId: string, emoji: string) => void
}
```

- [ ] **Step 4: Update component signature and remove old report state**

Remove `const [reportModalOpen, setReportModalOpen] = useState(false)`.

Add `reaction` and `onToggleReaction` to destructured props.

- [ ] **Step 5: Replace the return JSX**

Replace the entire return block. Remove the old `<div className="group/disp relative">` wrapper with the absolute Flag button and LeiReportModal. Replace with:

```tsx
  return (
    <div className="group/disp flex items-start">
      <div className="flex-1 min-w-0">
        {content}
      </div>

      {/* Actions gutter */}
      {leiId && onToggleReaction && (
        <DispositivoActions
          dispositivoId={String(item.id)}
          leiId={leiId}
          texto={item.texto}
          tipo={item.tipo}
          posicao={item.posicao}
          reaction={reaction}
          onToggleReaction={(emoji) => onToggleReaction(String(item.id), emoji)}
        />
      )}

      {/* Note editor (open) */}
      {noteOpenGrifo && onSaveNote && (
        <GrifoNoteInline
          grifoId={noteOpenGrifo.id}
          color={noteOpenGrifo.color}
          initialNote={noteOpenGrifo.note}
          onSave={onSaveNote}
          onCancel={() => grifoPopupStore.closeNote()}
        />
      )}

      {/* Saved notes */}
      {!noteOpenGrifo && grifosWithNotes.length > 0 && (
        <NoteBadge grifos={grifosWithNotes} />
      )}
    </div>
  )
```

Note: The `GrifoNoteInline` and `NoteBadge` sections need to be OUTSIDE the flex container or the layout breaks. Wrap in a fragment if needed. Read the actual file to determine the best structure — the note/badge sections should be below the flex row, not inside it.

- [ ] **Step 6: Commit**

```bash
git add src/components/lei-seca/dispositivos/DispositivoRenderer.tsx
git commit -m "feat(lei-seca): integrate DispositivoActions in DispositivoRenderer"
```

---

### Task 8: Pass reactions through DispositivoList and LeiSecaPage

**Files:**
- Modify: `src/components/lei-seca/dispositivos/DispositivoList.tsx`
- Modify: `src/views/LeiSecaPage.tsx`

- [ ] **Step 1: Add props to DispositivoList**

Read the current file. Add to the interface:

```typescript
interface DispositivoListProps {
  dispositivos: Dispositivo[]
  leiId?: string
  leiSecaMode?: boolean
  showRevogados?: boolean
  grifosByDispositivo?: Map<string, Grifo[]>
  onGrifoClick?: (grifo: Grifo, rect: DOMRect) => void
  onSaveNote?: (grifoId: string, note: string) => void
  // NEW:
  reactionsMap?: Map<string, import('@/hooks/useDispositivoReactions').DispositivoReaction>
  onToggleReaction?: (dispositivoId: string, emoji: string) => void
}
```

Pass them to `DispositivoRenderer`:

```tsx
<DispositivoRenderer
  item={entry.item}
  leiId={leiId}
  leiSecaMode={leiSecaMode}
  showRevogados={showRevogados}
  grifos={grifosByDispositivo?.get(entry.item.id) ?? []}
  onGrifoClick={onGrifoClick}
  onSaveNote={onSaveNote}
  noteOpenGrifoId={noteOpenGrifoId}
  reaction={reactionsMap?.get(entry.item.id)}
  onToggleReaction={onToggleReaction}
/>
```

- [ ] **Step 2: Wire in LeiSecaPage**

Read the current file. Add imports:

```typescript
import { useDispositivoReactions, useToggleDispositivoReaction } from '@/hooks/useDispositivoReactions';
```

Inside the component, after existing hooks:

```typescript
const { data: reactionsMap } = useDispositivoReactions(currentLeiId);
const toggleReaction = useToggleDispositivoReaction();

const handleToggleReaction = useCallback((dispositivoId: string, emoji: string) => {
  if (!currentLeiId) return;
  toggleReaction.mutate({ dispositivoId, leiId: currentLeiId, emoji });
}, [currentLeiId, toggleReaction]);
```

Pass to `DispositivoList`:

```tsx
<DispositivoList
  dispositivos={dispositivos}
  leiId={currentLeiId}
  leiSecaMode={leiSecaMode}
  showRevogados={showRevogados}
  grifosByDispositivo={grifosByDispositivo}
  onGrifoClick={handleGrifoClick}
  onSaveNote={handleSaveNote}
  reactionsMap={reactionsMap}
  onToggleReaction={handleToggleReaction}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/lei-seca/dispositivos/DispositivoList.tsx src/views/LeiSecaPage.tsx
git commit -m "feat(lei-seca): wire reactions through DispositivoList and LeiSecaPage"
```

---

### Task 9: Build and test

- [ ] **Step 1: Build**

```bash
npx next build
```

Fix any compilation errors.

- [ ] **Step 2: Visual test**

Open `localhost:3000`, navigate to any lei. Verify:
- Hover on dispositivo shows 3 zones with separators
- Click ♡ opens picker, selecting emoji replaces ♡
- Community zone shows "—" (no data yet) or top emoji if reactions exist
- Click ··· opens/closes inline footer
- Footer actions: Copiar copies text, Reportar opens modal
- Gutter stays visible when user has reacted

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(lei-seca): integration fixes for dispositivo reactions"
```
