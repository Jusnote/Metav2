import { supabase } from '@/integrations/supabase/client'

const EDITAIS_API_URL = process.env.NEXT_PUBLIC_EDITAIS_API_URL
  ?? 'http://sw8gw00okssc8k8g4k8skskc.95.217.197.95.sslip.io/graphql'

interface GqlResult<T = any> {
  data: T | null
  error: string | null
}

export async function editaisQuery<T = any>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<GqlResult<T>> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  const res = await fetch(EDITAIS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!res.ok) {
    return { data: null, error: `${res.status} ${res.statusText}` }
  }

  const json = await res.json()
  if (json.errors?.length) {
    return { data: null, error: json.errors[0].message }
  }

  return { data: json.data, error: null }
}
