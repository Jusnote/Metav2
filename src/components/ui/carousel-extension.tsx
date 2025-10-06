import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CarouselNodeView } from './carousel-node-view';

export interface CarouselOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    carousel: {
      setCarousel: (slides: Array<{ image: string; content: string }>) => ReturnType;
    };
  }
}

export const CarouselExtension = Node.create<CarouselOptions>({
  name: 'carousel',

  group: 'block',

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      slides: {
        default: [],
        parseHTML: element => {
          const slidesData = element.getAttribute('data-slides');
          return slidesData ? JSON.parse(slidesData) : [];
        },
        renderHTML: attributes => {
          return {
            'data-slides': JSON.stringify(attributes.slides),
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-carousel]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-carousel': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CarouselNodeView);
  },

  addCommands() {
    return {
      setCarousel: (slides) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: { slides },
        });
      },
    };
  },
});
