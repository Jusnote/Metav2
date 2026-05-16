// Cliente Supabase para uso no servidor (Server Components, Server Actions, Route Handlers)
// V3 namespace — todas as queries caem em coaching.* (isolado de public/V2)
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/v3/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl) {
  throw new Error('Variável NEXT_PUBLIC_SUPABASE_URL é obrigatória')
}

// Client com service role — nunca expor no browser
// Usa schema coaching para todas as operações V3
export function createServerClient() {
  if (!supabaseServiceRoleKey) {
    throw new Error('Variável SUPABASE_SERVICE_ROLE_KEY é obrigatória para operações de servidor')
  }

  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    db: {
      schema: 'coaching', // Todas as queries V3 apontam pro schema coaching (não public)
    },
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

  return createClient<Database>(supabaseUrl, anonKey, {
    db: {
      schema: 'coaching', // Todas as queries V3 apontam pro schema coaching (não public)
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
