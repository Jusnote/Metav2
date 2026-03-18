'use client';

import { useState } from 'react';
import { Plate, usePlateEditor } from 'platejs/react';
import type { TElement } from 'platejs';

import { LeiSecaEditorKit } from '@/components/lei-seca/lei-seca-editor-kit';
import { LeiSecaUserKit } from '@/components/lei-seca/lei-seca-editor-kit-v2';
import { PreventEditsPlugin } from '@/components/lei-seca/prevent-edits-plugin-v2';
import { SettingsDialog } from '@/components/settings-dialog';
import { Editor, EditorContainer } from '@/components/ui/editor';
import { cn } from '@/lib/utils';

const sampleLegalContent: TElement[] = [
  {
    type: 'h2',
    children: [{ text: 'Código Penal - Parte Geral' }],
  },
  {
    type: 'h3',
    children: [{ text: 'TÍTULO I - DA APLICAÇÃO DA LEI PENAL' }],
  },
  {
    type: 'p',
    children: [
      { text: 'Art. 1º - ', bold: true },
      { text: 'Não há crime sem lei anterior que o defina. Não há pena sem prévia cominação legal.' },
    ],
  },
  {
    type: 'p',
    children: [
      { text: 'Art. 2º - ', bold: true },
      { text: 'Ninguém pode ser punido por fato que lei posterior deixa de considerar crime, cessando em virtude dela a execução e os efeitos penais da sentença condenatória.' },
    ],
  },
  {
    type: 'p',
    children: [
      { text: 'Parágrafo único - ', italic: true },
      { text: 'A lei posterior, que de qualquer modo favorecer o agente, aplica-se aos fatos anteriores, ainda que decididos por sentença condenatória transitada em julgado.' },
    ],
  },
  {
    type: 'h3',
    children: [{ text: 'TÍTULO II - DO CRIME' }],
  },
  {
    type: 'p',
    children: [
      { text: 'Art. 13 - ', bold: true },
      { text: 'O resultado, de que depende a existência do crime, somente é imputável a quem lhe deu causa. Considera-se causa a ação ou omissão sem a qual o resultado não teria ocorrido.' },
    ],
  },
  {
    type: 'p',
    children: [
      { text: '§ 1º - ', bold: true },
      { text: 'A superveniência de causa relativamente independente exclui a imputação quando, por si só, produziu o resultado; os fatos anteriores, entretanto, imputam-se a quem os praticou.' },
    ],
  },
  {
    type: 'p',
    children: [
      { text: '§ 2º - ', bold: true },
      { text: 'A omissão é penalmente relevante quando o omitente devia e podia agir para evitar o resultado. O dever de agir incumbe a quem: a) tenha por lei obrigação de cuidado, proteção ou vigilância; b) de outra forma, assumiu a responsabilidade de impedir o resultado; c) com seu comportamento anterior, criou o risco da ocorrência do resultado.' },
    ],
  },
  {
    type: 'p',
    children: [
      { text: 'Art. 14 - ', bold: true },
      { text: 'Diz-se o crime:' },
    ],
  },
  {
    type: 'p',
    children: [
      { text: 'I - consumado', bold: true },
      { text: ', quando nele se reúnem todos os elementos de sua definição legal;' },
    ],
  },
  {
    type: 'p',
    children: [
      { text: 'II - tentado', bold: true },
      { text: ', quando, iniciada a execução, não se consuma por circunstâncias alheias à vontade do agente.' },
    ],
  },
  {
    type: 'p',
    children: [
      { text: 'Art. 18 - ', bold: true },
      { text: 'Diz-se o crime:' },
    ],
  },
  {
    type: 'p',
    children: [
      { text: 'I - doloso', bold: true },
      { text: ', quando o agente quis o resultado ou assumiu o risco de produzi-lo;' },
    ],
  },
  {
    type: 'p',
    children: [
      { text: 'II - culposo', bold: true },
      { text: ', quando o agente deu causa ao resultado por imprudência, negligência ou imperícia.' },
    ],
  },
];

/**
 * Editor de teste v3 — PreventEditsPlugin v2 com toggle Admin/User.
 *
 * - Modo USER: kit limpo (sem DnD, BlockMenu, Copilot, Slash, Autoformat)
 *   + PreventEditsPlugin com role='user' + allowedMarks
 *   + caret-transparent (cursor invisível)
 *
 * - Modo ADMIN: kit completo + PreventEditsPlugin com role='admin'
 *   + cursor normal
 *
 * Toggle altera o role via editor.setOption() — zero recreação.
 */
export function LeiSecaEditorV3Test() {
  const [role, setRole] = useState<'admin' | 'user'>('user');

  // User mode: kit limpo + plugin com role='user'
  const userEditor = usePlateEditor({
    id: 'lei-seca-v3-user',
    plugins: [
      ...LeiSecaUserKit,
      PreventEditsPlugin,
    ],
    value: sampleLegalContent,
  });

  // Admin mode: kit completo + plugin com role='admin'
  const adminEditor = usePlateEditor({
    id: 'lei-seca-v3-admin',
    plugins: [
      ...LeiSecaEditorKit,
      PreventEditsPlugin.configure({ options: { role: 'admin' } }),
    ],
    value: sampleLegalContent,
  });

  const editor = role === 'admin' ? adminEditor : userEditor;

  return (
    <div className="relative h-full">
      {/* Toggle Admin/User */}
      <div className="sticky top-0 z-50 flex items-center gap-3 border-b bg-background px-4 py-2">
        <span className="text-sm font-medium text-muted-foreground">Modo:</span>
        <button
          type="button"
          onClick={() => setRole('user')}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            role === 'user'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          User (read-only + highlight)
        </button>
        <button
          type="button"
          onClick={() => setRole('admin')}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            role === 'admin'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          Admin (edição total)
        </button>
        <span className="ml-auto text-xs text-muted-foreground">
          {role === 'user'
            ? 'Texto protegido — apenas highlight, cor de texto e cor de fundo permitidos'
            : 'Edição completa habilitada'}
        </span>
      </div>

      <Plate editor={editor} key={role}>
        <EditorContainer>
          <Editor
            variant="demo"
            className={cn(role === 'user' && 'caret-transparent')}
          />
        </EditorContainer>

        <SettingsDialog />
      </Plate>
    </div>
  );
}
