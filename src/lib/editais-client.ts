import { Client, cacheExchange, fetchExchange } from 'urql'
import { authExchange } from '@urql/exchange-auth'
import { supabase } from '@/integrations/supabase/client'

const EDITAIS_API_URL = process.env.NEXT_PUBLIC_EDITAIS_API_URL
  ?? 'http://sw8gw00okssc8k8g4k8skskc.95.217.197.95.sslip.io/graphql'

// Token lifecycle: initialized once, kept in sync by onAuthStateChange
let _cachedToken: string | null = null
let _tokenReady: Promise<void> | null = null

if (typeof window !== 'undefined') {
  // Initialize token immediately
  _tokenReady = supabase.auth.getSession().then(({ data }) => {
    _cachedToken = data.session?.access_token ?? null
  })

  // Keep in sync on auth changes (login, logout, refresh)
  supabase.auth.onAuthStateChange((_event, session) => {
    _cachedToken = session?.access_token ?? null
  })
}

// Ensures token is initialized before first use
async function ensureToken(): Promise<string | null> {
  if (_tokenReady) await _tokenReady
  return _cachedToken
}

export const editaisClient = new Client({
  url: EDITAIS_API_URL,
  exchanges: [
    cacheExchange,
    authExchange(async (utils) => {
      await ensureToken()

      return {
        addAuthToOperation(operation) {
          if (!_cachedToken) return operation
          return utils.appendHeaders(operation, {
            Authorization: `Bearer ${_cachedToken}`,
          })
        },
        didAuthError(error) {
          return error.response?.status === 401
        },
        async refreshAuth() {
          const { data } = await supabase.auth.refreshSession()
          _cachedToken = data.session?.access_token ?? null
        },
      }
    }),
    fetchExchange,
  ],
})

// Fetch-based helper for queries and mutations (used by useEditaisAdmin)
export async function editaisQuery<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null }> {
  const token = await ensureToken()

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(EDITAIS_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    })

    if (!res.ok) {
      return { data: null, error: `HTTP ${res.status}: ${res.statusText}` }
    }

    const json = await res.json()
    if (json.errors?.length) {
      return { data: null, error: json.errors[0]?.message ?? 'GraphQL error' }
    }

    return { data: json.data as T, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Erro desconhecido' }
  }
}

export const editaisMutation = editaisQuery
