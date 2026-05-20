'use client'

// Editor de resumo (admin) — responsável SÓ por renderizar o Plate + auto-save.
// TL;DR, takeaways, header, botão Publicar e drawer ficam no EditorAdminClient,
// que controla o estado e passa via `getExtras` callback.
//
// Isto é deliberado: queremos o Plate full-bleed, igualzinho ao /plate-editor real.
// Wrappers extras (card branco, overflow:hidden, altura fixa) quebram o layout
// interno do Plate (toolbar flutuante, padding interno, etc).

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
} from 'react'
import { Plate, usePlateEditor } from 'platejs/react'
import type { Value } from 'platejs'

import { EditorKit } from '@/components/editor-kit'
import { Editor, EditorContainer } from '@/components/ui/editor'

import {
  useResumoAutoSave,
  type AutoSaveStatus,
} from '@/v3/hooks/useResumoAutoSave'

export interface PlateEditorResumoHandle {
  /** Salva imediatamente com o conteúdo atual do editor. */
  salvarAgora: () => Promise<void>
}

export interface PlateEditorResumoExtras {
  tldr: string
  takeaways: string[]
}

interface Props {
  subtopicoId: string
  conteudoInicial: Value | null
  /** Callback que retorna TL;DR e takeaways atuais (lidos via refs no pai). */
  getExtras: () => PlateEditorResumoExtras
  /** Notificação opcional do estado de auto-save (pai mostra pill no header). */
  onStatusChange?: (s: AutoSaveStatus, error: string | null) => void
}

const VAZIO: Value = [{ type: 'p', children: [{ text: '' }] }]

export const PlateEditorResumo = forwardRef<PlateEditorResumoHandle, Props>(
  function PlateEditorResumo(
    { subtopicoId, conteudoInicial, getExtras, onStatusChange },
    ref,
  ) {
    const valorInicial = useMemo<Value>(() => {
      if (
        !conteudoInicial ||
        (Array.isArray(conteudoInicial) && conteudoInicial.length === 0)
      ) {
        return VAZIO
      }
      return conteudoInicial
    }, [conteudoInicial])

    const editor = usePlateEditor({
      plugins: EditorKit,
      value: valorInicial,
    })

    const auto = useResumoAutoSave({
      subtopicoId,
      debounceMs: 5000,
      getExtras,
    })

    // Notifica o pai sobre mudanças no status de salvamento.
    useEffect(() => {
      onStatusChange?.(auto.status, auto.error ?? null)
    }, [auto.status, auto.error, onStatusChange])

    const handleChangePlate = useCallback(
      ({ value }: { value: Value }) => {
        auto.agendar(value)
      },
      [auto],
    )

    const handleBlur = useCallback(() => {
      if (!editor) return
      void auto.salvarAgora(editor.children)
    }, [auto, editor])

    useImperativeHandle(
      ref,
      () => ({
        salvarAgora: async () => {
          if (!editor) return
          await auto.salvarAgora(editor.children)
        },
      }),
      [auto, editor],
    )

    return (
      <Plate editor={editor} onChange={handleChangePlate}>
        <EditorContainer onBlur={handleBlur}>
          <Editor
            variant="default"
            placeholder="Comece a escrever o resumo deste bloco…"
          />
        </EditorContainer>
      </Plate>
    )
  },
)
