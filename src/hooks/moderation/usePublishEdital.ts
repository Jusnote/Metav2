// src/hooks/moderation/usePublishEdital.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

interface PublishPayload {
  cargo_id: number
  edital_id: number
}

async function publishEdital(payload: PublishPayload): Promise<{ ok: boolean; published_at: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Não autenticado')

  const res = await fetch('/api/admin/editais/publish', {
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

export function usePublishEdital() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: publishEdital,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['editais-curados'] })
    },
  })
}
