'use client'

// Leitor read-only de resumo. Usa Plate em modo `readOnly` + EditorKit completo
// (todos os elementos renderizam, mas a edição é bloqueada).

import { useMemo } from 'react'
import { Plate, usePlateEditor } from 'platejs/react'
import type { Value } from 'platejs'

import { EditorKit } from '@/components/editor-kit'
import { Editor, EditorContainer } from '@/components/ui/editor'

interface Props {
  conteudo: Value
}

export function ResumoLeitor({ conteudo }: Props) {
  const valor = useMemo<Value>(
    () => (conteudo.length > 0 ? conteudo : [{ type: 'p', children: [{ text: '' }] }]),
    [conteudo],
  )

  const editor = usePlateEditor({
    plugins: EditorKit,
    value: valor,
    readOnly: true,
  })

  return (
    <Plate editor={editor}>
      <EditorContainer>
        <Editor variant="default" readOnly />
      </EditorContainer>
    </Plate>
  )
}
