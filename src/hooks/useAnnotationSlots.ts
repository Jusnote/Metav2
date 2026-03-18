import { useState, useEffect, useCallback } from 'react';
import type { Editor } from '@tiptap/core';
import { annotationSlotsKey } from '@/components/lei-seca/annotation-slots-extension';
import type { SlotInfo } from '@/components/lei-seca/annotation-slots-extension';

/**
 * useAnnotationSlots — Bridge between React and the AnnotationSlots ProseMirror plugin.
 *
 * Manages the lifecycle of annotation slots:
 * - Listens for slot mount/unmount events from ProseMirror
 * - Provides openSlot/closeSlot/toggleSlot to create/destroy slots
 * - Returns a Map of slug → HTMLElement for React Portal rendering
 *
 * Usage:
 *   const { slots, openSlot, closeSlot, toggleSlot } = useAnnotationSlots(editor);
 *   // Render portals:
 *   {Array.from(slots.entries()).map(([slug, el]) =>
 *     createPortal(<AnnotationCard slug={slug} />, el)
 *   )}
 */
export function useAnnotationSlots(editor: Editor | null) {
  const [slots, setSlots] = useState<Map<string, HTMLElement>>(new Map());

  // Wire up mount/unmount callbacks from the ProseMirror plugin
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const storage = (editor.storage as any).annotationSlots;
    if (!storage) return;

    storage.onSlotMounted = (slug: string, el: HTMLElement) => {
      setSlots((prev) => {
        const next = new Map(prev);
        next.set(slug, el);
        return next;
      });
    };

    storage.onSlotUnmounted = (slug: string) => {
      setSlots((prev) => {
        const next = new Map(prev);
        next.delete(slug);
        return next;
      });
    };

    return () => {
      storage.onSlotMounted = null;
      storage.onSlotUnmounted = null;
    };
  }, [editor]);

  // Clear slots when editor content changes (navigation / infinite scroll)
  useEffect(() => {
    if (!editor) return;

    const onUpdate = () => {
      setSlots(new Map());
    };

    // Listen to content changes that replace the document
    editor.on('update', ({ transaction }) => {
      if (transaction.docChanged && transaction.steps.length > 2) {
        // Likely a full content replacement (setContent), not a mark toggle
        onUpdate();
      }
    });
  }, [editor]);

  // Find the ProseMirror position of a paragraph by its slug
  const findPosBySlug = useCallback(
    (slug: string): number | null => {
      if (!editor || editor.isDestroyed) return null;

      let found: number | null = null;
      editor.state.doc.descendants((node, pos) => {
        if (found !== null) return false;
        if (node.type.name === 'paragraph' && node.attrs.slug === slug) {
          found = pos;
          return false;
        }
      });
      return found;
    },
    [editor]
  );

  // Open a slot below a provision
  const openSlot = useCallback(
    (slug: string, mode: 'indicator' | 'expanded' = 'expanded') => {
      if (!editor || editor.isDestroyed) return;

      const pos = findPosBySlug(slug);
      if (pos === null) return;

      const slotInfo: SlotInfo[] = [{ slug, mode, pos }];
      editor.view.dispatch(
        editor.state.tr.setMeta(annotationSlotsKey, slotInfo)
      );
    },
    [editor, findPosBySlug]
  );

  // Close all slots
  const closeSlot = useCallback(
    (_slug?: string) => {
      if (!editor || editor.isDestroyed) return;

      // Clear the slot from the map immediately (React Portal unmounts)
      setSlots(new Map());

      editor.view.dispatch(
        editor.state.tr.setMeta(annotationSlotsKey, null)
      );
    },
    [editor]
  );

  // Toggle: if slug is open, close; otherwise open
  const toggleSlot = useCallback(
    (slug: string, mode: 'indicator' | 'expanded' = 'expanded') => {
      if (slots.has(slug)) {
        closeSlot(slug);
      } else {
        openSlot(slug, mode);
      }
    },
    [slots, openSlot, closeSlot]
  );

  return { slots, openSlot, closeSlot, toggleSlot };
}
