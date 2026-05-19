'use client'

// Editor de resumo (admin). Reusa Plate via EditorKit do projeto, mas com
// auto-save (useResumoAutoSave) e header de status + ações publicar/despublicar.
//
// Decisão: usa o MESMO EditorKit do app (src/components/editor-kit) — não
// duplica plugins. O sistema de comentários do Plate fica visualmente inativo
// porque não criamos infraestrutura de discussão por ora, mas o plugin é
// inerte (sem dados, sem UI ativa).

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plate, usePlateEditor } from 'platejs/react'
import type { Value } from 'platejs'

import { EditorKit } from '@/components/editor-kit'
import { Editor, EditorContainer } from '@/components/ui/editor'
import { SaveIndicator } from '@/components/ui/save-indicator'
import type { SaveStatus } from '@/types/plate-document'

import { useResumoAutoSave } from '@/v3/hooks/useResumoAutoSave'
import {
  despublicarResumo,
  publicarResumo,
} from '@/app/v3/(admin)/admin/concursos/[id]/resumos/actions'

interface Props {
  subtopicoId: string
  /** Conteúdo inicial. Se null → editor começa vazio. */
  conteudoInicial: Value | null
  /** Status inicial do resumo. 'nao-existe' quando subtopicoId não tem resumo ainda. */
  statusInicial: 'nao-existe' | 'rascunho' | 'publicado'
}

const VAZIO: Value = [{ type: 'p', children: [{ text: '' }] }]

export function PlateEditorResumo({
  subtopicoId,
  conteudoInicial,
  statusInicial,
}: Props) {
  const router = useRouter()
  const [statusResumo, setStatusResumo] = useState(statusInicial)
  const [pending, startTransition] = useTransition()
  const [acaoErro, setAcaoErro] = useState<string | null>(null)

  const valorInicial = useMemo<Value>(() => {
    if (!conteudoInicial || (Array.isArray(conteudoInicial) && conteudoInicial.length === 0)) {
      return VAZIO
    }
    return conteudoInicial
  }, [conteudoInicial])

  const editor = usePlateEditor({
    plugins: EditorKit,
    value: valorInicial,
  })

  const auto = useResumoAutoSave({ subtopicoId, debounceMs: 5000 })

  const handleChange = useCallback(
    ({ value }: { value: Value }) => {
      auto.agendar(value)
    },
    [auto],
  )

  const handleBlur = useCallback(() => {
    if (!editor) return
    // Flush imediato no blur
    void auto.salvarAgora(editor.children)
  }, [auto, editor])

  // Mapeia status do auto-save para o SaveIndicator existente
  const indicadorStatus: SaveStatus = useMemo(() => {
    if (auto.status === 'saving') return { type: 'saving' }
    if (auto.status === 'saved') return { type: 'saved' }
    if (auto.status === 'error')
      return { type: 'error', message: auto.error ?? 'Erro' }
    return { type: 'idle' }
  }, [auto.status, auto.error])

  const handleSalvarAgora = () => {
    if (!editor) return
    void auto.salvarAgora(editor.children)
  }

  const handlePublicar = () => {
    if (!editor) return
    setAcaoErro(null)
    startTransition(async () => {
      // 1) flush conteúdo atual primeiro
      await auto.salvarAgora(editor.children)
      // 2) publica
      const res = await publicarResumo(subtopicoId)
      if (res.ok) {
        setStatusResumo('publicado')
        router.refresh()
      } else {
        setAcaoErro(res.erro)
      }
    })
  }

  const handleDespublicar = () => {
    setAcaoErro(null)
    startTransition(async () => {
      const res = await despublicarResumo(subtopicoId)
      if (res.ok) {
        setStatusResumo('rascunho')
        router.refresh()
      } else {
        setAcaoErro(res.erro)
      }
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Barra de ações */}
      <div
        className="px-4 py-2 border-b flex items-center justify-between gap-3 flex-shrink-0"
        style={{
          borderColor: 'var(--border-default)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div className="flex items-center gap-3">
          <SaveIndicator status={indicadorStatus} />
          {acaoErro && (
            <span
              className="text-xs"
              style={{ color: 'var(--color-danger, #c0392b)' }}
            >
              {acaoErro}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSalvarAgora}
            disabled={pending || auto.status === 'saving'}
            className="text-xs px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
            style={{
              backgroundColor: 'var(--bg-surface-2)',
              color: 'var(--fg-secondary)',
              border: '1px solid var(--border-default)',
            }}
          >
            Salvar rascunho
          </button>
          {statusResumo === 'publicado' ? (
            <button
              type="button"
              onClick={handleDespublicar}
              disabled={pending}
              className="text-xs px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
              style={{
                backgroundColor: 'rgba(212,154,42,0.15)',
                color: 'rgb(170,120,30)',
                border: '1px solid rgba(212,154,42,0.4)',
              }}
            >
              Despublicar
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePublicar}
              disabled={pending}
              className="text-xs px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
              style={{
                backgroundColor: 'rgba(70,160,90,0.18)',
                color: 'rgb(50,120,65)',
                border: '1px solid rgba(70,160,90,0.45)',
              }}
            >
              Publicar
            </button>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Plate editor={editor} onChange={handleChange}>
          <EditorContainer onBlur={handleBlur}>
            <Editor variant="default" placeholder="Comece a escrever o resumo deste bloco…" />
          </EditorContainer>
        </Plate>
      </div>
    </div>
  )
}
