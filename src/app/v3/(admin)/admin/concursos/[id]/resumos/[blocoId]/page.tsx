// /v3/admin/concursos/[id]/resumos/[blocoId] — editor refinado.
// Header espelho do PlateEditorPage (ArrowLeft + FileText laranja + título + sub),
// Stage com TL;DR + Plate + Takeaways + Drawer "+".

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Value } from 'platejs'

import { PlateEditorResumo } from '@/v3/components/resumos/PlateEditorResumo'
import { DrawerContexto } from '@/v3/components/resumos/DrawerContexto'
import { carregarContextoBloco } from '@/v3/lib/resumos/arvore-resumos'
import {
  getResumoPorBloco,
  type Resumo,
} from '@/app/v3/(admin)/admin/concursos/[id]/resumos/actions'
import styles from '@/v3/components/resumos/resumos.module.css'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string; blocoId: string }>
}

export default async function EditorResumoAdminPage({ params }: Props) {
  const { id, blocoId } = await params

  const [contexto, resumo] = await Promise.all([
    carregarContextoBloco(id, blocoId),
    getResumoPorBloco(blocoId),
  ])

  if (!contexto) notFound()

  const statusInicial = resumo
    ? (resumo.status as 'rascunho' | 'publicado')
    : 'nao-existe'
  const conteudoInicial = extrairConteudo(resumo)
  const tldrInicial = resumo?.tldr ?? ''
  const takeawaysInicial = extrairTakeaways(resumo)

  return (
    <div className={styles.root}>
      <div className={styles.platePage}>
        {/* Header espelho do PlateEditorPage */}
        <header className={styles.platePageHeader}>
          <div className={styles.plateHeaderInner}>
            <div className={styles.plateHeaderLeft}>
              <Link
                href={`/v3/admin/concursos/${id}/resumos`}
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
          </div>
        </header>

        {/* Stage */}
        <main className={styles.plateStage}>
          <PlateEditorResumo
            subtopicoId={blocoId}
            conteudoInicial={conteudoInicial}
            statusInicial={statusInicial}
            tldrInicial={tldrInicial}
            takeawaysInicial={takeawaysInicial}
          />
        </main>

        {/* Drawer "+" flutuante com roteiro e referência */}
        <DrawerContexto
          titulo="Contexto do bloco"
          triggerAriaLabel="Roteiro & referência"
        >
          <section className={styles.drawerSection}>
            <div className={styles.drawerSectionLabel}>
              <span className="dot" />
              Roteiro do bloco
            </div>
            <div className={styles.drawerRoteiroItem}>
              <span>{contexto.bloco.nome}</span>
            </div>
            {contexto.blocosIrmaos.map((b) => (
              <div key={b.id} className={styles.drawerRoteiroItem}>
                <Link
                  href={`/v3/admin/concursos/${id}/resumos/${b.id}`}
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

function extrairConteudo(resumo: Resumo | null): Value | null {
  if (!resumo) return null
  const c = resumo.conteudo_plate
  if (Array.isArray(c) && c.length > 0) {
    return c as unknown as Value
  }
  return null
}

function extrairTakeaways(resumo: Resumo | null): string[] {
  if (!resumo) return []
  const t = resumo.takeaways
  if (Array.isArray(t)) {
    return t.filter((x): x is string => typeof x === 'string')
  }
  return []
}
