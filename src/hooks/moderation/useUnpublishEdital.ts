// src/hooks/moderation/useUnpublishEdital.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

interface UnpublishPayload {
  cargo_id: number
  edital_id: number
}

async function unpublishEdital(payload: UnpublishPayload): Promise<{ ok: boolean }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Não autenticado')

  const res = await fetch('/api/admin/editais/unpublish', {
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

export function useUnpublishEdital() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: unpublishEdital,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['editais-curados'] })
    },
  })
}
