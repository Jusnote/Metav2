import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * AnnotationSlots — TipTap extension that creates empty <div> Decoration widgets
 * below provisions as mounting points for React Portals.
 *
 * The slots themselves are EMPTY divs — React renders the actual annotation UI
 * inside them via createPortal (see useAnnotationSlots hook).
 *
 * This keeps ProseMirror overhead minimal (1-3 empty divs at any time)
 * while allowing full React lifecycle for annotation components.
 */

export const annotationSlotsKey = new PluginKey('annotationSlots');

export interface SlotInfo {
  slug: string;
  mode: 'indicator' | 'expanded';
  pos: number;
}

export const AnnotationSlots = Extension.create({
  name: 'annotationSlots',

  addStorage() {
    return {
      /** Callback when a slot div is mounted in the DOM */
      onSlotMounted: null as ((slug: string, el: HTMLElement) => void) | null,
      /** Callback when a slot div is removed from the DOM */
      onSlotUnmounted: null as ((slug: string) => void) | null,
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;

    return [
      new Plugin({
        key: annotationSlotsKey,

        state: {
          init: () => DecorationSet.empty,

          apply(tr, prev, _oldState, newState) {
            const meta = tr.getMeta(annotationSlotsKey) as SlotInfo[] | null | undefined;

            if (meta !== undefined) {
              // null or empty = clear all slots
              if (!meta || meta.length === 0) return DecorationSet.empty;

              const decorations: Decoration[] = [];

              for (const slot of meta) {
                const node = newState.doc.nodeAt(slot.pos);
                if (!node) continue;

                const endPos = slot.pos + node.nodeSize;
                const slug = slot.slug;
                const mode = slot.mode;

                decorations.push(
                  Decoration.widget(
                    endPos,
                    () => {
                      const el = document.createElement('div');
                      el.className = 'annotation-slot';
                      el.dataset.annotationFor = slug;
                      el.dataset.annotationMode = mode;
                      el.contentEditable = 'false';

                      // Notify React that the slot is mounted
                      storage.onSlotMounted?.(slug, el);

                      return el;
                    },
                    {
                      side: 1,
                      key: `annotation-slot-${slug}`,
                      // Allow events inside the slot (React handles them)
                      stopEvent: () => true,
                      // Don't ignore mutations inside (React Portal will mutate)
                      ignoreSelection: true,
                    }
                  )
                );
              }

              return DecorationSet.create(newState.doc, decorations);
            }

            // Map existing decorations through document changes
            if (tr.docChanged) {
              return prev.map(tr.mapping, tr.doc);
            }

            return prev;
          },
        },

        props: {
          decorations(state) {
            return this.getState(state);
          },
        },

        // Clean up slot references when the plugin is destroyed
        destroy() {
          storage.onSlotMounted = null;
          storage.onSlotUnmounted = null;
        },
      }),
    ];
  },
});
