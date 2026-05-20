// /v3/admin/concursos/[id]/resumos — lista de blocos com status de resumo.
// Refinada na Fase 2: page-head + progress-strip + continue-card + aulas flat.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ListaBlocosResumos } from '@/v3/components/resumos/ListaBlocosResumos'
import {
  carregarConcursoComResumos,
  carregarUltimoRascunho,
} from '@/v3/lib/resumos/arvore-resumos'
import styles from '@/v3/components/resumos/resumos.module.css'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ResumosListPage({ params }: Props) {
  const { id } = await params

  const [concurso, ultimoRascunho] = await Promise.all([
    carregarConcursoComResumos(id),
    carregarUltimoRascunho(id),
  ])
  if (!concurso) notFound()

  const { stats } = concurso

  // Tempo total de conteúdo: soma horas_sugeridas de todos os blocos
  const totalHoras = concurso.disciplinas.reduce(
    (acc, d) =>
      acc +
      d.aulas.reduce(
        (a2, aula) =>
          a2 +
          aula.blocos.reduce(
            (a3, b) => a3 + (b.horas_sugeridas ?? 0),
            0,
          ),
        0,
      ),
    0,
  )

  // Progress strip percentages
  const total = Math.max(1, stats.totalBlocos)
  const pctPublicados = (stats.publicados / total) * 100
  const pctRascunhos = (stats.rascunhos / total) * 100

  return (
    <div className={styles.root}>
      {/* Page head */}
      <div className={styles.pageHead}>
        <div className={styles.pageEyebrow}>
          <span className="dot" style={{ width: 5, height: 5, background: 'var(--accent)', borderRadius: '50%' }} />
          <Link
            href={`/v3/admin/concursos`}
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            Concursos
          </Link>
          {' · '}
          {concurso.banca}
          {' · '}
          {concurso.cargo}
        </div>
        <h1 className={styles.pageTitle}>Resumos</h1>
        <p className={styles.pageSub}>
          Curadoria didática dos blocos do cronograma. Escreva uma vez —
          todos os alunos do curso leem.
        </p>
      </div>

      {/* Progress strip */}
      <div className={styles.progressStrip}>
        <div className={styles.progressBarTrack}>
          <div
            className={styles.progressBarFill}
            style={{ width: `${pctPublicados}%` }}
          />
          <div
            className={styles.progressBarFillAmber}
            style={{ width: `${pctRascunhos}%` }}
          />
        </div>
        <div className={styles.progressLegend}>
          <span className={styles.progressLegendItem}>
            <span className="swatch" style={swatchStyle('var(--ink)')} />
            <strong>{stats.publicados}</strong>&nbsp;publicados
          </span>
          <span className={styles.progressLegendItem}>
            <span
              className="swatch"
              style={{ ...swatchStyle('var(--amber)'), opacity: 0.7 }}
            />
            <strong>{stats.rascunhos}</strong>&nbsp;rascunhos
          </span>
          <span className={styles.progressLegendItem}>
            <span className="swatch" style={swatchStyle('var(--ink-5)')} />
            <strong>{stats.semResumo}</strong>&nbsp;pendentes
          </span>
          <span className={styles.progressLegendSpacer} />
          <span className={styles.progressLegendTotal}>
            <strong>
              {totalHoras > 0 ? `${Math.round(totalHoras)}h` : '—'}
            </strong>{' '}
            de conteúdo
          </span>
        </div>
      </div>

      {/* Continue card — só aparece se houver rascunho */}
      {ultimoRascunho && (
        <div className={styles.continueCard}>
          <Link
            href={`/v3/admin/concursos/${id}/resumos/${ultimoRascunho.blocoId}`}
            className={styles.continueCardInner}
          >
            <div className={styles.continueIcon}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <div className={styles.continueText}>
              <div className={styles.continueEyebrow}>
                Continue de onde parou
                <span className={`${styles.pill} ${styles.pillAmber}`}>
                  rascunho
                </span>
              </div>
              <div className={styles.continueTitle}>
                {ultimoRascunho.blocoNome}
              </div>
              <div className={styles.continueMeta}>
                Aula {String(ultimoRascunho.aulaOrdem).padStart(2, '0')} · Bloco{' '}
                {ultimoRascunho.blocoOrdem} · última edição{' '}
                {relativeTime(ultimoRascunho.atualizadoEm)}
              </div>
            </div>
            <div className={styles.continueArrow}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>
      )}

      {/* Lista de aulas/blocos */}
      <ListaBlocosResumos concurso={concurso} />
    </div>
  )
}

function swatchStyle(color: string): React.CSSProperties {
  return {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: color,
    display: 'inline-block',
  }
}

function relativeTime(iso: string): string {
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 1) return 'agora há pouco'
  if (diffMin < 60) return `há ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `há ${diffH}h`
  const diffD = Math.round(diffH / 24)
  if (diffD < 30) return `há ${diffD}d`
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}
