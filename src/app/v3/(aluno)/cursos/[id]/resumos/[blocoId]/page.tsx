// /v3/cursos/[id]/resumos/[blocoId] — leitor de resumo (aluno, read-only).
// Refinado: header espelho PlateEditorPage, reading progress, TL;DR callout,
// Plate read-only, takeaways card preto, rating FSRS, drawer com TOC + próximo.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Value } from 'platejs'

import { ResumoLeitor } from '@/v3/components/resumos/ResumoLeitor'
import { ReadingProgress } from '@/v3/components/resumos/ReadingProgress'
import { RatingFSRS } from '@/v3/components/resumos/RatingFSRS'
import { DrawerContexto } from '@/v3/components/resumos/DrawerContexto'
import {
  calcularProximoBloco,
  carregarContextoBloco,
} from '@/v3/lib/resumos/arvore-resumos'
import { extrairToc } from '@/v3/lib/resumos/plate-helpers'
import { createServerClient } from '@/v3/lib/supabase/server'
import styles from '@/v3/components/resumos/resumos.module.css'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string; blocoId: string }>
}

export default async function ResumoLeitorPage({ params }: Props) {
  const { id, blocoId } = await params

  const contexto = await carregarContextoBloco(id, blocoId)
  if (!contexto) notFound()

  const supabase = createServerClient()
  const { data: resumo } = await supabase
    .from('resumos')
    .select('id, conteudo_plate, status, publicado_em, tldr, takeaways')
    .eq('subtopico_id', blocoId)
    .maybeSingle()

  const publicado = resumo?.status === 'publicado'
  const conteudo = extrair(resumo?.conteudo_plate)
  const takeaways = extrairTakeaways(resumo?.takeaways)
  const tldr = resumo?.tldr ?? ''
  const toc = publicado ? extrairToc(conteudo) : []
  const proximo = calcularProximoBloco(contexto)

  // Total de minutos pra reading progress: horas_sugeridas do bloco * 60, fallback 24min
  const totalMinutos =
    contexto.bloco.horas_sugeridas != null
      ? Math.max(1, Math.round(contexto.bloco.horas_sugeridas * 60))
      : 24

  return (
    <div className={styles.root}>
      <div className={styles.platePage}>
        {/* Header espelho do PlateEditorPage */}
        <header className={styles.platePageHeader}>
          <div className={styles.plateHeaderInner}>
            <div className={styles.plateHeaderLeft}>
              <Link
                href={`/v3/cursos/${id}`}
                className={styles.plateIconbtn}
                title="Voltar ao cronograma"
                aria-label="Voltar ao cronograma"
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
                    Aula {String(contexto.aula.ordem).padStart(2, '0')} · Bloco{' '}
                    {contexto.bloco.ordem} ·{' '}
                    {publicado ? (
                      <ReadingProgress
                        totalMinutos={totalMinutos}
                        prefixoLabel=""
                      />
                    ) : (
                      <span>{totalMinutos} min</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Stage */}
        <main className={styles.plateStage}>
          {!publicado || !resumo ? (
            <EstadoVazio />
          ) : (
            <>
              <div className={styles.plateEditorCard}>
                <div style={{ padding: '56px 64px 80px', maxWidth: 820, margin: '0 auto' }}>
                  {tldr.trim().length > 0 && (
                    <div className={styles.leitorCalloutCard}>
                      <div className={styles.leitorCalloutLabel}>
                        O que vai aprender
                      </div>
                      <p>{tldr}</p>
                    </div>
                  )}

                  <ResumoLeitor conteudo={conteudo} />

                  {takeaways.length > 0 && (
                    <div className={styles.takeawaysCard}>
                      <div className={styles.leitorCalloutLabel}>
                        Decora isso
                      </div>
                      <ul>
                        {takeaways.map((t, idx) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <RatingFSRS
                    resumoId={resumo.id}
                    proximoBlocoHref={
                      proximo
                        ? `/v3/cursos/${id}/resumos/${proximo.id}`
                        : null
                    }
                    proximoBlocoNome={proximo?.nome ?? null}
                  />
                </div>
              </div>

              {/* Drawer "+" flutuante com TOC + próximo bloco */}
              <DrawerContexto
                titulo="Sumário"
                triggerAriaLabel="Sumário & navegação"
              >
                {toc.length > 0 && (
                  <section className={styles.drawerSection}>
                    <div className={styles.drawerSectionLabel}>
                      <span className="dot" />
                      Nesta página
                    </div>
                    {toc.map((entry) => (
                      <a
                        key={entry.id}
                        href={`#${entry.id}`}
                        className={styles.drawerTocLink}
                        style={{
                          paddingLeft: 16 + (entry.nivel - 1) * 12,
                        }}
                      >
                        {entry.texto}
                      </a>
                    ))}
                  </section>
                )}

                {proximo && (
                  <section className={styles.drawerSection}>
                    <div className={styles.drawerNext}>
                      <div className={styles.drawerSectionLabel}>
                        <span className="dot" />
                        Próximo bloco
                      </div>
                      <h4 className={styles.drawerNextTitle}>{proximo.nome}</h4>
                      <Link
                        href={`/v3/cursos/${id}/resumos/${proximo.id}`}
                        className={styles.drawerNextLink}
                      >
                        Continuar
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 12h14M13 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </section>
                )}
              </DrawerContexto>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function extrair(conteudo: unknown): Value {
  if (Array.isArray(conteudo) && conteudo.length > 0) {
    return conteudo as unknown as Value
  }
  return [{ type: 'p', children: [{ text: '' }] }]
}

function extrairTakeaways(t: unknown): string[] {
  if (Array.isArray(t)) {
    return t.filter((x): x is string => typeof x === 'string')
  }
  return []
}

function EstadoVazio() {
  return (
    <div
      style={{
        padding: 64,
        textAlign: 'center',
        color: 'var(--ink-3)',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <h2 style={{ fontSize: 19, color: 'var(--ink)', marginBottom: 8 }}>
        Resumo ainda não publicado
      </h2>
      <p style={{ fontSize: 14 }}>
        O conteúdo deste bloco está sendo preparado. Volte em breve.
      </p>
    </div>
  )
}
