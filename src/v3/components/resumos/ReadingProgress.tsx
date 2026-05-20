'use client'

// Barra de progresso de leitura no topo + tempo restante dinâmico.
// O tempo restante é renderizado num portal/span identificado por data attr,
// pra ser inserido em qualquer lugar do header (subtitle do leitor).

import { useEffect, useState } from 'react'
import styles from './resumos.module.css'

interface Props {
  totalMinutos: number
  /** Onde renderizar o span "X min restantes". Use estilo inline normal. */
  prefixoLabel?: string
}

export function ReadingProgress({ totalMinutos, prefixoLabel = '' }: Props) {
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const handler = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      const p = max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0
      setPct(p)
    }
    window.addEventListener('scroll', handler, { passive: true })
    window.addEventListener('resize', handler)
    handler()
    return () => {
      window.removeEventListener('scroll', handler)
      window.removeEventListener('resize', handler)
    }
  }, [])

  const minutosRestantes = Math.max(1, Math.round(totalMinutos * (1 - pct / 100)))

  return (
    <>
      <div className={styles.readingProgress} aria-hidden="true">
        <span
          className={styles.readingProgressFill}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span data-reading-time-left>
        {prefixoLabel}
        {minutosRestantes} min restantes
      </span>
    </>
  )
}
