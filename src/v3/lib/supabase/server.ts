// Cliente Supabase para uso no servidor (Server Components, Server Actions, Route Handlers)
// V3 namespace — usa service role key para operações privilegiadas
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl) {
  throw new Error('Variável NEXT_PUBLIC_SUPABASE_URL é obrigatória')
}

// Client com service role — nunca expor no browser
export function createServerClient() {
  if (!supabaseServiceRoleKey) {
    throw new Error('Variável SUPABASE_SERVICE_ROLE_KEY é obrigatória para operações de servidor')
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Client anon para Server Components que respeitam RLS do usuário autenticado
export function createAnonServerClient() {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  if (!anonKey) {
    throw new Error('Variável NEXT_PUBLIC_SUPABASE_ANON_KEY é obrigatória')
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
