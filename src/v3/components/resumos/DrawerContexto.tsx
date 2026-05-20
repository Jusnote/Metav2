'use client'

// Drawer "+" flutuante à direita, com seções pluggáveis.
// Implementação CSS própria (não usa shadcn Sheet pra evitar conflito com
// portal animations); fecha com Esc ou click no overlay.

import { useEffect, useState, type ReactNode } from 'react'
import styles from './resumos.module.css'

interface Props {
  titulo: string
  children: ReactNode
  /** Aria label do trigger flutuante */
  triggerAriaLabel?: string
}

export function DrawerContexto({
  titulo,
  children,
  triggerAriaLabel = 'Abrir contexto',
}: Props) {
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    if (!aberto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [aberto])

  // Trava scroll do body enquanto aberto
  useEffect(() => {
    if (aberto) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [aberto])

  return (
    <>
      <button
        type="button"
        className={styles.drawerTrigger}
        onClick={() => setAberto(true)}
        aria-label={triggerAriaLabel}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {aberto && (
        <>
          <div
            className={styles.drawerOverlay}
            onClick={() => setAberto(false)}
            aria-hidden="true"
          />
          <aside
            className={`${styles.drawer} ${styles.drawerOpen}`}
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
          >
            <header className={styles.drawerHead}>
              <h3>{titulo}</h3>
              <button
                type="button"
                className={styles.drawerClose}
                onClick={() => setAberto(false)}
                aria-label="Fechar"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </header>
            <div className={styles.drawerBody}>{children}</div>
          </aside>
        </>
      )}
    </>
  )
}
