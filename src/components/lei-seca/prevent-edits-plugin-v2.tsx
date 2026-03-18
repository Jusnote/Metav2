'use client';

import type { PluginConfig } from 'platejs';
import { createTPlatePlugin } from 'platejs/react';

type PreventEditsConfig = PluginConfig<
  'preventEdits',
  {
    role: 'admin' | 'user';
    allowedMarks: string[];
  }
>;

/**
 * PreventEditsPlugin v2 — Bloqueia 28 transforms para modo 'user'.
 *
 * - role: 'user' → bloqueia tudo exceto marks em allowedMarks
 * - role: 'admin' → passthrough total (editor normal)
 * - getOptions() é lazy (lido no momento do transform, não na criação)
 * - Troca de role via editor.setOption(PreventEditsPlugin, 'role', 'admin')
 *
 * IMPORTANTE: tf é uma referência live ao editor.tf.
 * Precisamos capturar as funções originais ANTES do override ser aplicado,
 * caso contrário tf.setNodes() chama nosso override → recursão infinita.
 */
export const PreventEditsPlugin = createTPlatePlugin<PreventEditsConfig>({
  key: 'preventEdits',
  options: {
    role: 'user',
    allowedMarks: ['highlight', 'color', 'backgroundColor'],
  },
}).overrideEditor(({ getOptions, tf }) => {
  // Captura referências originais ANTES do override ser aplicado.
  // Sem isso, tf.setNodes() dentro do override chama a si mesmo → stack overflow.
  //
  // Contador: addMark/removeMark/toggleMark internamente chamam setNodes/splitNodes/mergeNodes.
  // Sem esse contador, essas operações são bloqueadas. Contador (não boolean) para reentrada segura.
  let markOpCount = 0;

  const orig = {
    insertText: tf.insertText,
    insertBreak: tf.insertBreak,
    insertSoftBreak: tf.insertSoftBreak,
    deleteBackward: tf.deleteBackward,
    deleteForward: tf.deleteForward,
    deleteFragment: tf.deleteFragment,
    delete: tf.delete,
    insertNode: tf.insertNode,
    insertNodes: tf.insertNodes,
    insertFragment: tf.insertFragment,
    insertData: tf.insertData,
    addMark: tf.addMark,
    removeMark: tf.removeMark,
    toggleMark: tf.toggleMark,
    moveNodes: tf.moveNodes,
    removeNodes: tf.removeNodes,
    setNodes: tf.setNodes,
    splitNodes: tf.splitNodes,
    mergeNodes: tf.mergeNodes,
    wrapNodes: tf.wrapNodes,
    unwrapNodes: tf.unwrapNodes,
    liftNodes: tf.liftNodes,
    unsetNodes: tf.unsetNodes,
    replaceNodes: tf.replaceNodes,
    duplicateNodes: tf.duplicateNodes,
    toggleBlock: tf.toggleBlock,
    reset: tf.reset,
    undo: tf.undo,
    redo: tf.redo,
  };

  return {
    transforms: {
      // === Text insertion ===
      insertText(...args) {
        if (getOptions().role === 'admin') return orig.insertText(...args);
      },
      insertBreak(...args) {
        if (getOptions().role === 'admin') return orig.insertBreak(...args);
      },
      insertSoftBreak(...args) {
        if (getOptions().role === 'admin') return orig.insertSoftBreak(...args);
      },

      // === Deletion ===
      deleteBackward(...args) {
        if (getOptions().role === 'admin') return orig.deleteBackward(...args);
      },
      deleteForward(...args) {
        if (getOptions().role === 'admin') return orig.deleteForward(...args);
      },
      deleteFragment(...args) {
        if (getOptions().role === 'admin') return orig.deleteFragment(...args);
      },
      delete(...args) {
        if (getOptions().role === 'admin') return orig.delete(...args);
      },

      // === Node insertion ===
      insertNode(...args) {
        if (getOptions().role === 'admin') return orig.insertNode(...args);
      },
      insertNodes(...args) {
        if (getOptions().role === 'admin') return orig.insertNodes(...args);
      },
      insertFragment(...args) {
        if (getOptions().role === 'admin') return orig.insertFragment(...args);
      },
      insertData(...args) {
        if (getOptions().role === 'admin') return orig.insertData(...args);
      },

      // === Marks (allowlist para user) ===
      // addMark/removeMark/toggleMark internamente chamam setNodes/splitNodes/mergeNodes.
      // O contador markOpCount libera essas operações durante mark ops.
      addMark(...args) {
        const { allowedMarks, role } = getOptions();
        if (role === 'admin') return orig.addMark(...args);
        if (allowedMarks.includes(args[0])) {
          markOpCount++;
          try { return orig.addMark(...args); } finally { markOpCount--; }
        }
      },
      removeMark(...args) {
        const { allowedMarks, role } = getOptions();
        if (role === 'admin') return orig.removeMark(...args);
        if (allowedMarks.includes(args[0])) {
          markOpCount++;
          try { return orig.removeMark(...args); } finally { markOpCount--; }
        }
      },
      toggleMark(...args) {
        const { allowedMarks, role } = getOptions();
        if (role === 'admin') return orig.toggleMark(...args);
        if (allowedMarks.includes(args[0])) {
          markOpCount++;
          try { return orig.toggleMark(...args); } finally { markOpCount--; }
        }
      },

      // === Node manipulation (context menu, DnD, block selection) ===
      moveNodes(...args) {
        if (getOptions().role === 'admin') return orig.moveNodes(...args);
      },
      removeNodes(...args) {
        if (getOptions().role === 'admin') return orig.removeNodes(...args);
      },
      setNodes(...args) {
        if (getOptions().role === 'admin' || markOpCount > 0) return orig.setNodes(...args);
      },
      splitNodes(...args) {
        if (getOptions().role === 'admin' || markOpCount > 0) return orig.splitNodes(...args);
      },
      mergeNodes(...args) {
        if (getOptions().role === 'admin' || markOpCount > 0) return orig.mergeNodes(...args);
      },
      wrapNodes(...args) {
        if (getOptions().role === 'admin') return orig.wrapNodes(...args);
      },
      unwrapNodes(...args) {
        if (getOptions().role === 'admin') return orig.unwrapNodes(...args);
      },
      liftNodes(...args) {
        if (getOptions().role === 'admin') return orig.liftNodes(...args);
      },
      unsetNodes(...args) {
        if (getOptions().role === 'admin') return orig.unsetNodes(...args);
      },
      replaceNodes(...args) {
        if (getOptions().role === 'admin') return orig.replaceNodes(...args);
      },
      duplicateNodes(...args) {
        if (getOptions().role === 'admin') return orig.duplicateNodes(...args);
      },

      // === Block operations ===
      toggleBlock(...args) {
        if (getOptions().role === 'admin') return orig.toggleBlock(...args);
      },
      reset(...args) {
        if (getOptions().role === 'admin') return orig.reset(...args);
      },

      // === History (liberado para user desfazer/refazer marks) ===
      undo(...args) {
        return orig.undo(...args);
      },
      redo(...args) {
        return orig.redo(...args);
      },
    },
  };
});
