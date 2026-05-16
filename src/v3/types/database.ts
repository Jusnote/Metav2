// V3 — Tipos gerados a partir do schema Supabase
//
// ESTE ARQUIVO É UM PLACEHOLDER.
// Deve ser sobrescrito com o output real do comando:
//
//   npx supabase gen types typescript --linked > src/v3/types/database.ts
//
// Após aplicação completa das migrations V3 (001-011), execute o comando acima.
// Não sobrescreva src/types/database.ts (legacy V2).
//
// Status atual: migrations 001-002 aplicadas; 003-011 aguardam resolução
// de colisão de nomes de tabelas (disciplinas, topicos, subtopicos) com V2.
//
// Ver: supabase/verify/v3/verify_01_fase1.sql para critérios de aceite.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Placeholder — será substituído pelo gen types completo
export interface Database {
  public: {
    Tables: {
      // Tabelas aplicadas (migrations 001-002):
      concursos: {
        Row: {
          id: string
          nome: string
          banca: string
          cargo: string
          nivel: string | null
          data_prova: string | null
          edital_url: string | null
          status: 'rascunho' | 'revisao' | 'publicado' | 'arquivado'
          publicado_em: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: Omit<Database['public']['Tables']['concursos']['Row'], 'id' | 'criado_em' | 'atualizado_em'>
        Update: Partial<Database['public']['Tables']['concursos']['Insert']>
      }
      editais_raw: {
        Row: {
          id: string
          concurso_id: string
          texto_bruto: string
          fonte: 'pdf' | 'colado' | 'url' | null
          url_original: string | null
          versao: number
          criado_em: string
        }
        Insert: Omit<Database['public']['Tables']['editais_raw']['Row'], 'id' | 'criado_em'>
        Update: Partial<Database['public']['Tables']['editais_raw']['Insert']>
      }
      // Demais tabelas (migrations 003-011) serão adicionadas após resolução
      // da colisão de nomes com V2 e aplicação manual no Supabase Studio.
    }
    Views: {
      v_progresso_disciplinas: {
        Row: {
          aluno_id: string
          disciplina_id: string
          disciplina_nome: string
          horas_totais: number
          total_topicos: number
          topicos_com_teoria: number
          subtopicos_em_fsrs: number
          desempenho_medio: number | null
        }
      }
      v_memoria_em_risco: {
        Row: {
          aluno_id: string
          subtopico_id: string
          subtopico_nome: string
          topico_nome: string
          disciplina_nome: string
          retrievability: number | null
          due_date: string
          last_review: string | null
          lapse_count: number
        }
      }
    }
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
