'use client';

import { LeiSecaEditorV3Test } from '@/components/lei-seca/lei-seca-editor-v3-test';

// ============================================================
// LEI SECA TEST V3 - PreventEditsPlugin v2 com toggle Admin/User
//
// Como testar:
// 1. No modo USER: texto protegido, mas highlight/cor funcionam
//    - Selecione texto → floating toolbar → highlight ou cor
//    - Tente digitar, deletar, Ctrl+Z → tudo bloqueado
//    - Ctrl+J → AI Chat funciona normalmente
// 2. No modo ADMIN: edição total habilitada
//    - Clique no botão "Admin" para alternar
//    - Todas as operações funcionam normalmente
// ============================================================

export default function LeiSecaTestV3Page() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100">
            Lei Seca - Teste V3 (Plugin v2)
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            28 transforms bloqueados + allowedMarks (highlight, color, backgroundColor) + toggle Admin/User
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
        <LeiSecaEditorV3Test />
      </div>
    </div>
  );
}
