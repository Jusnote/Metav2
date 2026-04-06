import { Client, cacheExchange, fetchExchange } from 'urql'
import { authExchange } from '@urql/exchange-auth'
import { supabase } from '@/integrations/supabase/client'

const EDITAIS_API_URL = process.env.NEXT_PUBLIC_EDITAIS_API_URL
  ?? 'http://sw8gw00okssc8k8g4k8skskc.95.217.197.95.sslip.io/graphql'

let _cachedToken: string | null = null

// Keep token in sync with Supabase auth state
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((_event, session) => {
    _cachedToken = session?.access_token ?? null
  })
}

export const editaisClient = new Client({
  url: EDITAIS_API_URL,
  exchanges: [
    cacheExchange,
    authExchange(async (utils) => {
      // Await token before processing any operations
      const { data } = await supabase.auth.getSession()
      _cachedToken = data.session?.access_token ?? null

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
