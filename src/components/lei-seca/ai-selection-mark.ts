import { Mark } from '@tiptap/core';

export const AiSelectionMark = Mark.create({
  name: 'aiSelection',

  parseHTML() {
    return [{ tag: 'span.ai-highlight' }];
  },

  renderHTML() {
    return ['span', { class: 'ai-highlight' }, 0];
  },
});
