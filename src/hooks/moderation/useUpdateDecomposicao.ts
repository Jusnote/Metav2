// src/hooks/moderation/useUpdateDecomposicao.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { EditalDecomposicao } from '@/lib/cronograma-v2/schemas'

interface UpdateDecomposicaoPayload {
  cargo_id: number
  edital_id: number
  decomposicao: EditalDecomposicao
}

async function updateDecomposicao(payload: UpdateDecomposicaoPayload): Promise<{ ok: boolean }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Não autenticado')

  const res = await fetch('/api/admin/editais/update-decomposicao', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export function useUpdateDecomposicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateDecomposicao,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['editais-curados'] })
    },
  })
}
