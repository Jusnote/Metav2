'use client'

// Editor de bullets "Decora isso" (Key Takeaways).
// Lista editável de strings; cada mudança dispara onChange (consumido pelo
// componente pai pra agendar auto-save).

import { useCallback, useState } from 'react'
import styles from './resumos.module.css'

interface Props {
  inicial: string[]
  onChange: (lista: string[]) => void
  /** Maximum bullets. Default: 10 */
  max?: number
}

export function TakeawaysEditor({ inicial, onChange, max = 10 }: Props) {
  const [items, setItems] = useState<string[]>(
    inicial.length > 0 ? inicial : [''],
  )

  const aplicar = useCallback(
    (novo: string[]) => {
      setItems(novo)
      // Filtra vazios antes de mandar pra fora? Não — o save aceita strings
      // vazias, mas pra evitar lixo, removemos linhas vazias do final.
      const limpos = novo.filter((s, idx) => s.trim().length > 0 || idx < novo.length - 1)
      onChange(limpos)
    },
    [onChange],
  )

  const handleChange = (idx: number, valor: string) => {
    const novo = [...items]
    novo[idx] = valor
    aplicar(novo)
  }

  const handleRemove = (idx: number) => {
    if (items.length === 1) {
      aplicar([''])
      return
    }
    const novo = items.filter((_, i) => i !== idx)
    aplicar(novo)
  }

  const handleAdd = () => {
    if (items.length >= max) return
    aplicar([...items, ''])
  }

  return (
    <div className={styles.takeawaysField}>
      <div className={styles.takeawaysFieldLabel}>Decora isso</div>
      <ul className={styles.takeawaysList}>
        {items.map((item, idx) => (
          <li key={idx} className={styles.takeawayRow}>
            <input
              type="text"
              className={styles.takeawayInput}
              value={item}
              onChange={(e) => handleChange(idx, e.target.value)}
              placeholder={`Bullet ${idx + 1}`}
              maxLength={500}
            />
            <button
              type="button"
              className={styles.takeawayRemove}
              onClick={() => handleRemove(idx)}
              title="Remover bullet"
              aria-label="Remover bullet"
            >
              <svg
                width="14"
                height="14"
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
          </li>
        ))}
      </ul>
      {items.length < max && (
        <button
          type="button"
          className={styles.takeawayAdd}
          onClick={handleAdd}
        >
          + Adicionar bullet
        </button>
      )}
    </div>
  )
}
