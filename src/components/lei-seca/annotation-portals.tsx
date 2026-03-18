'use client';

import { createPortal } from 'react-dom';
import { AnnotationCard } from './annotation-card';
import { annotationStore } from '@/stores/annotationStore';

/**
 * AnnotationPortals — Renders React components inside ProseMirror Decoration slots.
 *
 * Each slot is an empty <div> created by the AnnotationSlots extension.
 * This component uses createPortal to render AnnotationCard inside each slot,
 * giving full React lifecycle (hooks, Context, Supabase) to annotation UI
 * that lives within the ProseMirror document flow.
 */
interface AnnotationPortalsProps {
  /** Map of slug → HTMLElement from useAnnotationSlots hook */
  slots: Map<string, HTMLElement>;
}

export function AnnotationPortals({ slots }: AnnotationPortalsProps) {
  if (slots.size === 0) return null;

  return (
    <>
      {Array.from(slots.entries()).map(([slug, el]) =>
        createPortal(
          <AnnotationCard
            key={slug}
            slug={slug}
            onClose={() => annotationStore.close()}
          />,
          el
        )
      )}
    </>
  );
}
