'use client'

// Cliente Supabase para uso no browser (Client Components)
// V3 namespace — todas as queries caem em coaching.* (isolado de public/V2)
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/v3/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórias')
}

export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'coaching', // Todas as queries V3 apontam pro schema coaching (não public)
  },
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
})
