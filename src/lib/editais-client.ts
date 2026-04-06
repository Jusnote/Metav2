import { Client, cacheExchange, fetchExchange } from 'urql'
import { supabase } from '@/integrations/supabase/client'

const EDITAIS_API_URL = process.env.NEXT_PUBLIC_EDITAIS_API_URL
  ?? 'http://sw8gw00okssc8k8g4k8skskc.95.217.197.95.sslip.io/graphql'

export const editaisClient = new Client({
  url: EDITAIS_API_URL,
  exchanges: [cacheExchange, fetchExchange],
  fetchOptions: () => {
    const token = _cachedToken
    return token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : {}
  },
})

// Token cache — updated on auth state change
let _cachedToken: string | null = null

if (typeof window !== 'undefined') {
  supabase.auth.getSession().then(({ data }) => {
    _cachedToken = data.session?.access_token ?? null
  })
  supabase.auth.onAuthStateChange((_event, session) => {
    _cachedToken = session?.access_token ?? null
  })
}
