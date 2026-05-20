'use client'

// Editor de resumo (admin) refinado. Inclui:
//  - TL;DR (textarea acima do Plate)
//  - Plate editor (auto-save 5s via useResumoAutoSave)
//  - Takeaways editor (lista de bullets, mesmo debounce)
//  - Footer sticky com saveState + Descartar + Publicar
//
// Decisão: TL;DR e takeaways são CAMPOS do schema (não plugins Plate).

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plate, usePlateEditor } from 'platejs/react'
import type { Value } from 'platejs'

import { EditorKit } from '@/components/editor-kit'
import { Editor, EditorContainer } from '@/components/ui/editor'

import { useResumoAutoSave } from '@/v3/hooks/useResumoAutoSave'
import {
  despublicarResumo,
  publicarResumo,
} from '@/app/v3/(admin)/admin/concursos/[id]/resumos/actions'
import { TakeawaysEditor } from './TakeawaysEditor'
import styles from './resumos.module.css'

interface Props {
  subtopicoId: string
  conteudoInicial: Value | null
  statusInicial: 'nao-existe' | 'rascunho' | 'publicado'
  tldrInicial: string
  takeawaysInicial: string[]
}

const VAZIO: Value = [{ type: 'p', children: [{ text: '' }] }]
const TLDR_MAX = 240

export function PlateEditorResumo({
  subtopicoId,
  conteudoInicial,
  statusInicial,
  tldrInicial,
  takeawaysInicial,
}: Props) {
  const router = useRouter()
  const [statusResumo, setStatusResumo] = useState(statusInicial)
  const [pending, startTransition] = useTransition()
  const [acaoErro, setAcaoErro] = useState<string | null>(null)

  const [tldr, setTldr] = useState(tldrInicial)
  const [takeaways, setTakeaways] = useState<string[]>(takeawaysInicial)

  // Refs mantém o estado mais recente fora do closure (pra usar em salvarAgora)
  const tldrRef = useRef(tldr)
  const takeawaysRef = useRef(takeaways)
  useEffect(() => {
    tldrRef.current = tldr
  }, [tldr])
  useEffect(() => {
    takeawaysRef.current = takeaways
  }, [takeaways])

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
    getExtras: () => ({
      tldr: tldrRef.current,
      takeaways: takeawaysRef.current,
    }),
  })

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

  const handleTldrChange = (v: string) => {
    setTldr(v)
    if (editor) auto.agendar(editor.children)
  }
  const handleTakeawaysChange = (lista: string[]) => {
    setTakeaways(lista)
    if (editor) auto.agendar(editor.children)
  }

  const handlePublicar = () => {
    if (!editor) return
    setAcaoErro(null)
    startTransition(async () => {
      await auto.salvarAgora(editor.children)
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

  const handleDescartar = () => {
    if (typeof window === 'undefined') return
    if (window.confirm('Descartar alterações não salvas e voltar para a lista?')) {
      router.back()
    }
  }

  const saveLabel = useMemo(() => {
    if (auto.status === 'saving') return 'Salvando…'
    if (auto.status === 'error') return `Erro: ${auto.error ?? 'desconhecido'}`
    if (auto.status === 'saved') return 'Salvo agora'
    return 'Sincronizado'
  }, [auto.status, auto.error])

  const saveDotClass = useMemo(() => {
    if (auto.status === 'saving') return styles.saveDotSaving
    if (auto.status === 'error') return styles.saveDotError
    return ''
  }, [auto.status])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* TL;DR field */}
      <div className={styles.tldrField}>
        <div className={styles.tldrLabel}>O que vai aprender</div>
        <textarea
          className={styles.tldrInput}
          placeholder="2 frases: o coração desse bloco, o que o aluno sai sabendo."
          value={tldr}
          maxLength={TLDR_MAX}
          onChange={(e) => handleTldrChange(e.target.value)}
          onBlur={() => {
            if (editor) void auto.salvarAgora(editor.children)
          }}
          rows={3}
        />
        <div className={styles.tldrCount}>
          {tldr.length} / {TLDR_MAX}
        </div>
      </div>

      {/* Plate editor card */}
      <div className={styles.plateEditorCard}>
        <Plate editor={editor} onChange={handleChangePlate}>
          <EditorContainer onBlur={handleBlur}>
            <Editor
              variant="default"
              placeholder="Comece a escrever o resumo deste bloco…"
            />
          </EditorContainer>
        </Plate>
      </div>

      {/* Takeaways field */}
      <TakeawaysEditor
        inicial={takeaways}
        onChange={handleTakeawaysChange}
      />

      {acaoErro && (
        <p
          style={{
            color: '#dc2626',
            fontSize: 13,
            marginTop: 16,
            textAlign: 'center',
          }}
        >
          {acaoErro}
        </p>
      )}

      {/* Footer sticky com save state + actions */}
      <div className={styles.plateFooter} style={{ marginTop: 32 }}>
        <div className={styles.plateFooterMax}>
          <div className={styles.saveState}>
            <div className={`${styles.saveDot} ${saveDotClass}`} />
            {saveLabel}
          </div>
          <div className={styles.plateActions}>
            <button
              type="button"
              className={styles.btn}
              onClick={handleDescartar}
              disabled={pending}
            >
              Descartar
            </button>
            {statusResumo === 'publicado' ? (
              <button
                type="button"
                className={styles.btn}
                onClick={handleDespublicar}
                disabled={pending}
              >
                Despublicar
              </button>
            ) : (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnAccent}`}
                onClick={handlePublicar}
                disabled={pending}
              >
                Publicar
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
