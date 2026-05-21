export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  papiro: {
    Tables: {
      disciplina: {
        Row: {
          criado_em: string
          id: string
          nome: string
          ordem: number
          slug: string
        }
        Insert: {
          criado_em?: string
          id?: string
          nome: string
          ordem?: number
          slug: string
        }
        Update: {
          criado_em?: string
          id?: string
          nome?: string
          ordem?: number
          slug?: string
        }
        Relationships: []
      }
      macro_area: {
        Row: {
          criado_em: string
          disciplina_id: string
          id: string
          nome: string
          ordem: number
          slug: string
        }
        Insert: {
          criado_em?: string
          disciplina_id: string
          id?: string
          nome: string
          ordem?: number
          slug: string
        }
        Update: {
          criado_em?: string
          disciplina_id?: string
          id?: string
          nome?: string
          ordem?: number
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "macro_area_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplina"
            referencedColumns: ["id"]
          },
        ]
      }
      resumo: {
        Row: {
          atualizado_em: string
          conteudo_md: string | null
          conteudo_plate: Json | null
          id: string
          status: string
          tema_id: string
          versao: number
        }
        Insert: {
          atualizado_em?: string
          conteudo_md?: string | null
          conteudo_plate?: Json | null
          id?: string
          status?: string
          tema_id: string
          versao?: number
        }
        Update: {
          atualizado_em?: string
          conteudo_md?: string | null
          conteudo_plate?: Json | null
          id?: string
          status?: string
          tema_id?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "resumo_tema_id_fkey"
            columns: ["tema_id"]
            isOneToOne: true
            referencedRelation: "tema"
            referencedColumns: ["id"]
          },
        ]
      }
      tema: {
        Row: {
          conceitos_principais: Json
          criado_em: string
          descricao_breve: string | null
          id: string
          macro_area_id: string
          mapeamento_paginas: Json
          nome: string
          objetivo_pedagogico: string | null
          ordem_curricular: number
          profundidade_estrat: string | null
          profundidade_gran: string | null
          slug_hierarquico: string
          tempo_estudo_min: number | null
        }
        Insert: {
          conceitos_principais?: Json
          criado_em?: string
          descricao_breve?: string | null
          id?: string
          macro_area_id: string
          mapeamento_paginas?: Json
          nome: string
          objetivo_pedagogico?: string | null
          ordem_curricular?: number
          profundidade_estrat?: string | null
          profundidade_gran?: string | null
          slug_hierarquico: string
          tempo_estudo_min?: number | null
        }
        Update: {
          conceitos_principais?: Json
          criado_em?: string
          descricao_breve?: string | null
          id?: string
          macro_area_id?: string
          mapeamento_paginas?: Json
          nome?: string
          objetivo_pedagogico?: string | null
          ordem_curricular?: number
          profundidade_estrat?: string | null
          profundidade_gran?: string | null
          slug_hierarquico?: string
          tempo_estudo_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tema_macro_area_id_fkey"
            columns: ["macro_area_id"]
            isOneToOne: false
            referencedRelation: "macro_area"
            referencedColumns: ["id"]
          },
        ]
      }
      tema_prereq: {
        Row: {
          prereq_tema_id: string
          tema_id: string
        }
        Insert: {
          prereq_tema_id: string
          tema_id: string
        }
        Update: {
          prereq_tema_id?: string
          tema_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tema_prereq_prereq_tema_id_fkey"
            columns: ["prereq_tema_id"]
            isOneToOne: false
            referencedRelation: "tema"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tema_prereq_tema_id_fkey"
            columns: ["tema_id"]
            isOneToOne: false
            referencedRelation: "tema"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  papiro: {
    Enums: {},
  },
} as const
A new version of Supabase CLI is available: v2.100.1 (currently installed v2.51.0)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
