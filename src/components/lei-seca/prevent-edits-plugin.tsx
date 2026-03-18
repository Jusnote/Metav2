'use client';

import { createPlatePlugin } from 'platejs/react';

/**
 * Plugin que bloqueia todas as edições do usuário no editor,
 * mantendo o editor tecnicamente "editável" (readOnly=false).
 *
 * Isso permite que plugins como AIChatPlugin, BlockSelectionPlugin
 * e FloatingToolbar funcionem normalmente, enquanto o texto legal
 * permanece imutável.
 *
 * Padrão oficial: .overrideEditor() com transforms (Plate.js v52)
 */
export const PreventEditsPlugin = createPlatePlugin({
  key: 'prevent-edits',
}).overrideEditor(({ tf }) => {
  return {
    transforms: {
      // Bloqueia digitação
      insertText() {},
      // Bloqueia Backspace
      deleteBackward() {},
      // Bloqueia Delete
      deleteForward() {},
      // Bloqueia delete de seleção
      deleteFragment() {},
      // Bloqueia Enter
      insertBreak() {},
      // Bloqueia Shift+Enter
      insertSoftBreak() {},
      // Bloqueia inserção de nodes
      insertNodes() {},
      // Bloqueia paste de fragmentos
      insertFragment() {},
      // Bloqueia paste (Ctrl+V)
      insertData() {},
      // Bloqueia adicionar formatação
      addMark() {},
      // Bloqueia remover formatação
      removeMark() {},
    },
  };
});
