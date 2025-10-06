import { Mark, mergeAttributes } from '@tiptap/core';

export interface InteractiveExplanationOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    interactiveExplanation: {
      setInteractiveExplanation: (options: { explanation: string }) => ReturnType;
      unsetInteractiveExplanation: () => ReturnType;
    };
  }
}

export const InteractiveExplanationExtension = Mark.create<InteractiveExplanationOptions>({
  name: 'interactiveExplanation',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      explanation: {
        default: '',
        parseHTML: element => element.getAttribute('data-explanation'),
        renderHTML: attributes => {
          if (!attributes.explanation) {
            return {};
          }
          return {
            'data-explanation': attributes.explanation,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-explanation]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span', 
      mergeAttributes(
        this.options.HTMLAttributes, 
        HTMLAttributes,
        {
          class: 'interactive-explanation-mark',
          style: 'text-decoration: underline; text-decoration-color: hsl(var(--primary)); text-decoration-thickness: 2px; text-underline-offset: 2px; background: hsl(var(--primary) / 0.1); padding: 0.125rem 0.25rem; border-radius: 0.25rem; color: hsl(var(--primary)); font-weight: 500; cursor: help;'
        }
      ), 
      0
    ];
  },


  addCommands() {
    return {
      setInteractiveExplanation:
        (options) =>
        ({ chain }) => {
          return chain()
            .setMark(this.name, { explanation: options.explanation })
            .run();
        },

      unsetInteractiveExplanation:
        () =>
        ({ chain }) => {
          return chain()
            .unsetMark(this.name)
            .run();
        },
    };
  },
});
