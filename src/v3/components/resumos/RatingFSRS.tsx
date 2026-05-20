'use client'

// Card "Como foi essa leitura?" com 4 botões de rating estilo FSRS.
// Ao clicar: chama Server Action `marcarBlocoConcluidoAction`, mostra
// confirmação inline + opcionalmente link pro próximo bloco.

import { useState, useTransition } from 'react'
import { marcarBlocoConcluidoAction } from '@/app/v3/(aluno)/cursos/[id]/resumos/[blocoId]/actions'
import styles from './resumos.module.css'

interface Props {
  resumoId: string
  proximoBlocoHref?: string | null
  proximoBlocoNome?: string | null
}

type Rating = 'again' | 'hard' | 'good' | 'easy'

const RATINGS: Array<{
  rating: Rating
  face: string
  label: string
  hint: string
  className: string
}> = [
  { rating: 'again', face: '×', label: 'Difícil', hint: 'revisar amanhã', className: 'ratingBtnAgain' },
  { rating: 'hard', face: '~', label: 'Médio', hint: 'em 3 dias', className: 'ratingBtnHard' },
  { rating: 'good', face: '✓', label: 'Fácil', hint: 'em 7 dias', className: 'ratingBtnGood' },
  { rating: 'easy', face: '★', label: 'Mole', hint: 'em 15 dias', className: 'ratingBtnEasy' },
]

export function RatingFSRS({ resumoId, proximoBlocoHref, proximoBlocoNome }: Props) {
  const [pending, startTransition] = useTransition()
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const handleClick = (rating: Rating) => {
    setErro(null)
    startTransition(async () => {
      const res = await marcarBlocoConcluidoAction({ resumoId, rating })
      if (res.ok) {
        setSalvo(true)
      } else {
        setErro(res.erro)
      }
    })
  }

  if (salvo) {
    return (
      <div className={styles.concluirCard}>
        <div className={styles.concluirSuccess}>
          <div className={styles.concluirSuccessTitle}>
            Marcado como concluído ✓
          </div>
          <p className={styles.concluirSub} style={{ margin: 0 }}>
            Sua resposta calibrará as próximas revisões.
          </p>
          {proximoBlocoHref && (
            <a
              href={proximoBlocoHref}
              className={`${styles.btn} ${styles.btnAccent}`}
              style={{ marginTop: 12 }}
            >
              Próximo bloco{proximoBlocoNome ? `: ${proximoBlocoNome}` : ''} →
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.concluirCard}>
      <h3 className={styles.concluirTitle}>Como foi essa leitura?</h3>
      <p className={styles.concluirSub}>
        Sua resposta calibra quando esse bloco volta pra revisão.
      </p>
      <div className={styles.ratingGrid}>
        {RATINGS.map((r) => (
          <button
            key={r.rating}
            type="button"
            className={`${styles.ratingBtn} ${styles[r.className]}`}
            onClick={() => handleClick(r.rating)}
            disabled={pending}
          >
            <div className={styles.ratingBtnFace}>{r.face}</div>
            <div className={styles.ratingBtnLabel}>{r.label}</div>
            <div className={styles.ratingBtnHint}>{r.hint}</div>
          </button>
        ))}
      </div>
      {erro && (
        <p
          style={{
            color: '#dc2626',
            fontSize: 12,
            marginTop: 12,
          }}
        >
          {erro}
        </p>
      )}
    </div>
  )
}
