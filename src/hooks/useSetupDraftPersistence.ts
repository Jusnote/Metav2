import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

type AnswersBlob = Record<string, unknown>

export interface DraftExisting {
  plano_id: string
  nome: string
  updated_at: string
}

export interface DraftState {
  existing: DraftExisting | null
  loading: boolean
  load: () => Promise<AnswersBlob | null>
  save: (answers: AnswersBlob, planoNome?: string) => Promise<void>
  discardAll: () => Promise<void>
}

const RASCUNHO_TTL_DAYS = 7
const DEBOUNCE_MS = 1000

/**
 * Persistência de rascunho do wizard no Supabase.
 *
 * NOTA: Usa `cargo_snapshot` (JSONB) como blob temporário para guardar o
 * estado do wizard. Semanticamente impuro — cargo_snapshot é para snapshot do
 * cargo, não para o wizard. Marcado como cleanup futuro: adicionar coluna
 * `wizard_state JSONB` à tabela `planos_estudo` via migration.
 *
 * O blob tem estrutura `{ answers: <object>, draft_version: 1 }` para
 * distinguir de dados reais de cargo_snapshot.
 *
 * - `save` é debounced (1s). Caller pode chamar a cada mudança sem preocupação.
 * - `existing` indica se há rascunho ≤7 dias do user.
 */
export function useSetupDraftPersistence(userId: string | null): DraftState {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const existingRef = useRef<DraftExisting | null>(null)
  const [loading, setLoading] = useState(true)
  const [existing, setExisting] = useState<DraftExisting | null>(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    const cutoff = new Date(Date.now() - RASCUNHO_TTL_DAYS * 86400 * 1000).toISOString()
    supabase
      .from('planos_estudo')
      .select('id, nome, updated_at')
      .eq('user_id', userId)
      .eq('status', 'rascunho')
      .gte('updated_at', cutoff)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const found: DraftExisting = {
            plano_id: data.id,
            nome: data.nome,
            updated_at: data.updated_at,
          }
          existingRef.current = found
          setExisting(found)
        }
        setLoading(false)
      })
  }, [userId])

  const save = useCallback(async (answers: AnswersBlob, planoNome?: string) => {
    if (!userId) return
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)

    debounceTimerRef.current = setTimeout(async () => {
      // Use cargo_snapshot as temporary blob for wizard answers.
      // Structure: { answers, draft_version: 1 } distinguishes from real cargo_snapshot.
      const blob = { answers, draft_version: 1 }
      if (existingRef.current?.plano_id) {
        await supabase
          .from('planos_estudo')
          .update({
            cargo_snapshot: blob as unknown as Record<string, unknown>,
            nome: planoNome ?? existingRef.current.nome,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRef.current.plano_id)
      } else {
        const today = new Date().toISOString().slice(0, 10)
        const futureDate = new Date(Date.now() + 60 * 86400 * 1000).toISOString().slice(0, 10)
        const { data } = await supabase
          .from('planos_estudo')
          .insert({
            user_id: userId,
            nome: planoNome ?? 'Rascunho',
            status: 'rascunho',
            mode: 'edital',
            data_inicio: today,
            data_prova: futureDate,
            cargo_snapshot: blob as unknown as Record<string, unknown>,
          })
          .select('id, nome, updated_at')
          .single()
        if (data) {
          const created: DraftExisting = {
            plano_id: data.id,
            nome: data.nome ?? planoNome ?? 'Rascunho',
            updated_at: data.updated_at,
          }
          existingRef.current = created
          setExisting(created)
        }
      }
    }, DEBOUNCE_MS)
  }, [userId])

  const load = useCallback(async (): Promise<AnswersBlob | null> => {
    if (!existingRef.current) return null
    const { data } = await supabase
      .from('planos_estudo')
      .select('cargo_snapshot')
      .eq('id', existingRef.current.plano_id)
      .maybeSingle()
    const blob = data?.cargo_snapshot as { answers?: AnswersBlob; draft_version?: number } | null
    // Only restore if it's actually a wizard draft (has draft_version marker)
    if (blob?.draft_version === 1 && blob.answers) {
      return blob.answers
    }
    return null
  }, [])

  const discardAll = useCallback(async () => {
    if (!userId) return
    await supabase
      .from('planos_estudo')
      .delete()
      .eq('user_id', userId)
      .eq('status', 'rascunho')
    existingRef.current = null
    setExisting(null)
  }, [userId])

  return {
    existing,
    loading,
    load,
    save,
    discardAll,
  }
}
