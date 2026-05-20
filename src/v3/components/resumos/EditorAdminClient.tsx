'use client'

// Cliente que orquestra a tela de edição admin de resumo:
//   - Header com voltar, título, save-pill e botão Publicar/Despublicar
//   - Faixa fina TL;DR abaixo do header
//   - Plate editor full-bleed (mesmo look do /plate-editor real)
//   - Drawer "+" flutuante com Takeaways editáveis + roteiro + referência
//
// Por que aqui (e não na page server)? Precisamos de useState/useRef pra TL;DR
// e takeaways (controlled) e pra passar o callback `getExtras` ao Plate. A page
// é Server Component (faz fetch) e renderiza este client.

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { Value } from 'platejs'

import { DrawerContexto } from './DrawerContexto'
import {
  PlateEditorResumo,
  type PlateEditorResumoHandle,
} from './PlateEditorResumo'
import { TakeawaysEditor } from './TakeawaysEditor'
import type { AutoSaveStatus } from '@/v3/hooks/useResumoAutoSave'
import {
  despublicarResumo,
  publicarResumo,
} from '@/app/v3/(admin)/admin/concursos/[id]/resumos/actions'
import type { BlocoEditorContexto } from '@/v3/lib/resumos/arvore-resumos'
import styles from './resumos.module.css'

interface Props {
  concursoId: string
  blocoId: string
  contexto: BlocoEditorContexto
  conteudoInicial: Value | null
  statusInicial: 'nao-existe' | 'rascunho' | 'publicado'
  tldrInicial: string
  takeawaysInicial: string[]
}

const TLDR_MAX = 240

export function EditorAdminClient({
  concursoId,
  blocoId,
  contexto,
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

  // Refs sempre com o valor mais recente — usadas pelo Plate via getExtras
  const tldrRef = useRef(tldr)
  const takeawaysRef = useRef(takeaways)
  useEffect(() => {
    tldrRef.current = tldr
  }, [tldr])
  useEffect(() => {
    takeawaysRef.current = takeaways
  }, [takeaways])

  const plateRef = useRef<PlateEditorResumoHandle>(null)

  const [saveStatus, setSaveStatus] = useState<AutoSaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleStatusChange = (s: AutoSaveStatus, error: string | null) => {
    setSaveStatus(s)
    setSaveError(error)
  }

  const handlePublicar = () => {
    setAcaoErro(null)
    startTransition(async () => {
      // Garante save antes de publicar
      await plateRef.current?.salvarAgora()
      const res = await publicarResumo(blocoId)
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
      const res = await despublicarResumo(blocoId)
      if (res.ok) {
        setStatusResumo('rascunho')
        router.refresh()
      } else {
        setAcaoErro(res.erro)
      }
    })
  }

  const saveLabel = useMemo(() => {
    if (saveStatus === 'saving') return 'Salvando…'
    if (saveStatus === 'error') return `Erro: ${saveError ?? 'desconhecido'}`
    if (saveStatus === 'saved') return 'Salvo'
    return 'Sincronizado'
  }, [saveStatus, saveError])

  const saveDotClass = useMemo(() => {
    if (saveStatus === 'saving') return styles.saveStatePillDotSaving
    if (saveStatus === 'error') return styles.saveStatePillDotError
    return ''
  }, [saveStatus])

  // TL;DR controlled — dispara auto-save via plateRef (mas só se o Plate já montou)
  // Para simplificar, deixamos o save acontecer naturalmente no próximo
  // onChange do Plate, OU forçamos no blur do textarea.
  const handleTldrBlur = () => {
    void plateRef.current?.salvarAgora()
  }
  const handleTakeawaysChange = (lista: string[]) => {
    setTakeaways(lista)
    // dispara save em ~5s via debounce (próximo onChange do Plate cobre, mas
    // se o usuário só mexe nos takeaways, force após pequena pausa)
    if (debounceTakeawaysRef.current) {
      clearTimeout(debounceTakeawaysRef.current)
    }
    debounceTakeawaysRef.current = setTimeout(() => {
      void plateRef.current?.salvarAgora()
    }, 1500)
  }
  const debounceTakeawaysRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (debounceTakeawaysRef.current) clearTimeout(debounceTakeawaysRef.current)
    }
  }, [])

  return (
    <div className={styles.root}>
      <div className={styles.platePage}>
        {/* Header espelho do PlateEditorPage real */}
        <header className={styles.platePageHeader}>
          <div className={styles.plateHeaderInner}>
            <div className={styles.plateHeaderLeft}>
              <Link
                href={`/v3/admin/concursos/${concursoId}/resumos`}
                className={styles.plateIconbtn}
                title="Voltar para lista"
                aria-label="Voltar para lista"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </Link>
              <div className={styles.plateTitleRow}>
                <svg
                  className={styles.plateTitleIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                  <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
                </svg>
                <div className={styles.plateTitleBlock}>
                  <h1 className={styles.plateTitle}>{contexto.bloco.nome}</h1>
                  <p className={styles.plateSubtitle}>
                    Aula {String(contexto.aula.ordem).padStart(2, '0')} ·{' '}
                    {contexto.aula.nome} · Bloco {contexto.bloco.ordem} ·{' '}
                    {contexto.disciplina.nome}
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.plateHeaderRight}>
              <div
                className={styles.saveStatePill}
                title={saveError ?? undefined}
              >
                <span
                  className={`${styles.saveStatePillDot} ${saveDotClass}`}
                />
                {saveLabel}
              </div>
              {statusResumo === 'publicado' ? (
                <button
                  type="button"
                  className={styles.plateHeaderOutline}
                  onClick={handleDespublicar}
                  disabled={pending}
                >
                  Despublicar
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.plateHeaderOutline}
                  onClick={handlePublicar}
                  disabled={pending}
                  style={{
                    background: 'var(--accent)',
                    color: 'white',
                    borderColor: 'var(--accent)',
                  }}
                >
                  Publicar
                </button>
              )}
            </div>
          </div>
        </header>

        {/* TL;DR como faixa fina horizontal */}
        <div className={styles.tldrBar}>
          <div className={styles.tldrBarInner}>
            <textarea
              className={styles.tldrInline}
              placeholder="O que vai aprender — 2 frases curtas (TL;DR)"
              value={tldr}
              maxLength={TLDR_MAX}
              onChange={(e) => setTldr(e.target.value)}
              onBlur={handleTldrBlur}
              rows={1}
              style={{ minHeight: 22 }}
            />
          </div>
        </div>

        {acaoErro && (
          <div
            style={{
              padding: '8px 24px',
              color: '#dc2626',
              fontSize: 13,
              textAlign: 'center',
              background: 'rgba(220,38,38,0.06)',
            }}
          >
            {acaoErro}
          </div>
        )}

        {/* Plate full-bleed (sem card envolvendo) */}
        <div className={styles.plateStage}>
          <PlateEditorResumo
            ref={plateRef}
            subtopicoId={blocoId}
            conteudoInicial={conteudoInicial}
            getExtras={() => ({
              tldr: tldrRef.current,
              takeaways: takeawaysRef.current,
            })}
            onStatusChange={handleStatusChange}
          />
        </div>

        {/* Drawer "+" com Takeaways editáveis + Roteiro + Referência */}
        <DrawerContexto
          titulo="Contexto do bloco"
          triggerAriaLabel="Takeaways, roteiro & referência"
        >
          <section className={styles.drawerSection}>
            <div className={styles.drawerSectionLabel}>
              <span className="dot" />
              Key Takeaways (Decora isso)
            </div>
            <TakeawaysEditor
              inicial={takeaways}
              onChange={handleTakeawaysChange}
            />
          </section>

          <section className={styles.drawerSection}>
            <div className={styles.drawerSectionLabel}>
              <span className="dot" />
              Roteiro do bloco
            </div>
            <div className={styles.drawerRoteiroItem}>
              <span style={{ fontWeight: 600 }}>{contexto.bloco.nome}</span>
            </div>
            {contexto.blocosIrmaos.map((b) => (
              <div key={b.id} className={styles.drawerRoteiroItem}>
                <Link
                  href={`/v3/admin/concursos/${concursoId}/resumos/${b.id}`}
                  style={{
                    color: 'var(--ink-2)',
                    textDecoration: 'none',
                    display: 'block',
                    width: '100%',
                  }}
                >
                  Bloco {b.ordem}: {b.nome}
                </Link>
              </div>
            ))}
          </section>

          <section className={styles.drawerSection}>
            <div className={styles.drawerPdf}>
              <div className={styles.drawerSectionLabel}>
                <span className="dot" />
                Referência
              </div>
              <div className={styles.drawerPdfLink}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: 'rgba(255,255,255,0.7)' }}
                >
                  <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                  <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>
                    Aula {String(contexto.aula.ordem).padStart(2, '0')} · PDF
                    original
                  </div>
                </div>
              </div>
              <div className={styles.drawerPdfNote}>
                PDF Storage será conectado em fase futura.
              </div>
            </div>
          </section>
        </DrawerContexto>
      </div>
    </div>
  )
}
