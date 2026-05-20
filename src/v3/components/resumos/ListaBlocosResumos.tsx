'use client'

// Lista flat de aulas/blocos no padrão do mock (Tela 1).
// Aula header collapsible com chevron + counter "X/Y" + tempo total.
// Bloco row com ord + nome + meta + pill de status + arrow.
//
// Filtros (Todas/Pendentes/Rascunhos/Publicadas) + busca client-side.

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type {
  ConcursoComResumos,
  StatusResumo,
} from '@/v3/lib/resumos/arvore-resumos'
import styles from './resumos.module.css'

interface Props {
  concurso: ConcursoComResumos
}

type Filtro = 'todas' | 'pendentes' | 'rascunhos' | 'publicadas'

const STATUS_PILL: Record<StatusResumo, { className: string; label: string }> = {
  publicado: { className: styles.pillGreen, label: 'publicado' },
  rascunho: { className: styles.pillAmber, label: 'rascunho' },
  'sem-resumo': { className: styles.pillGray, label: 'pendente' },
}

export function ListaBlocosResumos({ concurso }: Props) {
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [busca, setBusca] = useState('')
  const [abertas, setAbertas] = useState<Set<string>>(
    () => new Set(concurso.disciplinas[0]?.aulas[0] ? [concurso.disciplinas[0].aulas[0].id] : []),
  )

  // Flatten todas as aulas de todas as disciplinas (1 lista achatada como no mock)
  const aulasFlat = useMemo(() => {
    return concurso.disciplinas.flatMap((d) =>
      d.aulas.map((a) => ({
        ...a,
        disciplinaId: d.id,
        disciplinaNome: d.nome,
      })),
    )
  }, [concurso])

  // Aplica filtros + busca
  const aulasFiltradas = useMemo(() => {
    const buscaLower = busca.trim().toLowerCase()

    return aulasFlat
      .map((aula) => {
        const blocosFiltrados = aula.blocos.filter((b) => {
          if (filtro === 'pendentes' && b.statusResumo !== 'sem-resumo') return false
          if (filtro === 'rascunhos' && b.statusResumo !== 'rascunho') return false
          if (filtro === 'publicadas' && b.statusResumo !== 'publicado') return false
          if (buscaLower && !b.nome.toLowerCase().includes(buscaLower)) return false
          return true
        })
        return { ...aula, blocos: blocosFiltrados }
      })
      .filter((a) => a.blocos.length > 0)
  }, [aulasFlat, filtro, busca])

  const toggleAula = (aulaId: string) => {
    setAbertas((prev) => {
      const novo = new Set(prev)
      if (novo.has(aulaId)) novo.delete(aulaId)
      else novo.add(aulaId)
      return novo
    })
  }

  if (concurso.disciplinas.length === 0) {
    return <EmptyState />
  }

  return (
    <div className={styles.listaWrap}>
      <div className={styles.listaToolbar}>
        <h3>Aulas</h3>
        {(['todas', 'pendentes', 'rascunhos', 'publicadas'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`${styles.filterPill} ${filtro === f ? styles.filterPillActive : ''}`}
            onClick={() => setFiltro(f)}
          >
            {LABELS[f]}
          </button>
        ))}
        <div className={styles.searchWrap}>
          <svg
            className={styles.searchIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Buscar bloco..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.aulas}>
        {aulasFiltradas.length === 0 ? (
          <div
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              color: 'var(--ink-3)',
              fontSize: 13,
            }}
          >
            Nenhum bloco para os filtros selecionados.
          </div>
        ) : (
          aulasFiltradas.map((aula) => {
            const aberta = abertas.has(aula.id)
            const totalBlocos = aula.blocos.length
            const blocosConcluidos = aula.blocos.filter(
              (b) => b.statusResumo === 'publicado',
            ).length

            // Tempo total: soma horas_sugeridas dos blocos (ou da aula como fallback)
            const totalMin = aula.blocos.reduce((acc, b) => {
              const h = b.horas_sugeridas ?? 0
              return acc + h * 60
            }, 0)
            const tempoStr = formatarTempo(
              totalMin > 0 ? totalMin : aula.horas_sugeridas * 60,
            )

            return (
              <div
                key={aula.id}
                className={`${styles.aula} ${aberta ? styles.aulaOpen : ''}`}
              >
                <button
                  type="button"
                  className={styles.aulaHead}
                  onClick={() => toggleAula(aula.id)}
                >
                  <svg
                    className={styles.aulaChev}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                  <div className={styles.aulaNum}>
                    {String(aula.ordem).padStart(2, '0')}
                  </div>
                  <div className={styles.aulaName}>{aula.nome}</div>
                  <div
                    className={`${styles.aulaCounter} ${
                      blocosConcluidos === totalBlocos && totalBlocos > 0
                        ? styles.aulaCounterComplete
                        : ''
                    }`}
                  >
                    {blocosConcluidos} / {totalBlocos}
                  </div>
                  <div className={styles.aulaTime}>{tempoStr}</div>
                </button>
                {aberta && (
                  <div className={styles.aulaBody}>
                    {aula.blocos.map((bloco) => {
                      const pillCfg = STATUS_PILL[bloco.statusResumo]
                      const isPending = bloco.statusResumo === 'sem-resumo'
                      const blocoTime = bloco.horas_sugeridas
                        ? `${Math.round(bloco.horas_sugeridas * 60)} min`
                        : '—'
                      return (
                        <Link
                          key={bloco.id}
                          href={`/v3/admin/concursos/${concurso.id}/resumos/${bloco.id}`}
                          className={`${styles.bloco} ${
                            isPending ? styles.blocoPending : ''
                          }`}
                        >
                          <div className={styles.blocoOrd}>
                            {String(bloco.ordem).padStart(2, '0')}
                          </div>
                          <div className={styles.blocoName}>{bloco.nome}</div>
                          <div className={styles.blocoMeta}>{blocoTime}</div>
                          <span className={`${styles.pill} ${pillCfg.className}`}>
                            {pillCfg.label}
                          </span>
                          <span className={styles.blocoArrow}>
                            {isPending ? (
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M12 5v14M5 12h14" />
                              </svg>
                            ) : (
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M5 12h14M13 5l7 7-7 7" />
                              </svg>
                            )}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

const LABELS: Record<Filtro, string> = {
  todas: 'Todas',
  pendentes: 'Pendentes',
  rascunhos: 'Rascunhos',
  publicadas: 'Publicadas',
}

function formatarTempo(minutos: number): string {
  if (minutos <= 0) return '—'
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

function EmptyState() {
  return (
    <div
      style={{
        maxWidth: 1080,
        margin: '56px auto 0',
        padding: '40px',
        textAlign: 'center',
        color: 'var(--ink-3)',
      }}
    >
      <h2 style={{ fontSize: 16, marginBottom: 8, color: 'var(--ink)' }}>
        Sem conteúdo
      </h2>
      <p style={{ fontSize: 13 }}>
        Este concurso ainda não tem disciplinas/aulas cadastradas. Volte para
        a tela de revisão para processar o edital.
      </p>
    </div>
  )
}
