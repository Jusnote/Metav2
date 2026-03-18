'use client';

import { LeiSecaEditorV2Test } from '@/components/lei-seca/lei-seca-editor-v2-test';

// ============================================================
// LEI SECA TEST PAGE - Abordagem 1 (Plugin bloqueio)
// readOnly=false + PreventEditsPlugin
//
// Como testar:
// 1. Selecione um trecho do texto legal
// 2. A floating toolbar aparece com botão AI
// 3. Clique no botão ou use Ctrl+J para abrir o AI Chat
// 4. Faça perguntas sobre o trecho selecionado
// 5. A resposta aparece no popover (texto permanece imutável)
// ============================================================

export default function LeiSecaTestPage() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100">
            Lei Seca - Teste AI
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Selecione um trecho do texto e clique em "Tirar Dúvida" na toolbar flutuante, ou use <kbd className="rounded bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.5 text-xs font-mono">Ctrl+J</kbd>
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
        <LeiSecaEditorV2Test />
      </div>
    </div>
  );
}
