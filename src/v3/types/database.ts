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
  coaching: {
    Tables: {
      alunos: {
        Row: {
          atualizado_em: string | null
          avatar_url: string | null
          concurso_id: string | null
          criado_em: string | null
          data_inicio: string | null
          deletado_em: string | null
          email: string
          horario_pico: string | null
          horas_por_dia: Json
          id: string
          nome: string
          onboarding_completo: boolean
          role: string
        }
        Insert: {
          atualizado_em?: string | null
          avatar_url?: string | null
          concurso_id?: string | null
          criado_em?: string | null
          data_inicio?: string | null
          deletado_em?: string | null
          email: string
          horario_pico?: string | null
          horas_por_dia?: Json
          id: string
          nome: string
          onboarding_completo?: boolean
          role?: string
        }
        Update: {
          atualizado_em?: string | null
          avatar_url?: string | null
          concurso_id?: string | null
          criado_em?: string | null
          data_inicio?: string | null
          deletado_em?: string | null
          email?: string
          horario_pico?: string | null
          horas_por_dia?: Json
          id?: string
          nome?: string
          onboarding_completo?: boolean
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "alunos_concurso_id_fkey"
            columns: ["concurso_id"]
            isOneToOne: false
            referencedRelation: "concursos"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades: {
        Row: {
          aluno_id: string
          concluida_em: string | null
          conteudo_id: string | null
          criado_em: string | null
          desempenho_pct: number | null
          duracao_estimada_min: number
          duracao_real_min: number | null
          id: string
          iniciada_em: string | null
          ordem_sugerida: number | null
          origem: string
          peso_incidencia: number | null
          semana_id: string
          status: string
          subtopico_id: string | null
          tipo: string
          titulo: string
          topico_id: string | null
        }
        Insert: {
          aluno_id: string
          concluida_em?: string | null
          conteudo_id?: string | null
          criado_em?: string | null
          desempenho_pct?: number | null
          duracao_estimada_min: number
          duracao_real_min?: number | null
          id?: string
          iniciada_em?: string | null
          ordem_sugerida?: number | null
          origem?: string
          peso_incidencia?: number | null
          semana_id: string
          status?: string
          subtopico_id?: string | null
          tipo: string
          titulo: string
          topico_id?: string | null
        }
        Update: {
          aluno_id?: string
          concluida_em?: string | null
          conteudo_id?: string | null
          criado_em?: string | null
          desempenho_pct?: number | null
          duracao_estimada_min?: number
          duracao_real_min?: number | null
          id?: string
          iniciada_em?: string | null
          ordem_sugerida?: number | null
          origem?: string
          peso_incidencia?: number | null
          semana_id?: string
          status?: string
          subtopico_id?: string | null
          tipo?: string
          titulo?: string
          topico_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atividades_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_progresso_disciplinas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "atividades_conteudo_id_fkey"
            columns: ["conteudo_id"]
            isOneToOne: false
            referencedRelation: "conteudos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_semana_id_fkey"
            columns: ["semana_id"]
            isOneToOne: false
            referencedRelation: "semanas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_subtopico_id_fkey"
            columns: ["subtopico_id"]
            isOneToOne: false
            referencedRelation: "subtopicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_topico_id_fkey"
            columns: ["topico_id"]
            isOneToOne: false
            referencedRelation: "topicos"
            referencedColumns: ["id"]
          },
        ]
      }
      blocos_tematicos: {
        Row: {
          criado_em: string | null
          disciplina_id: string
          horas_bloco: number | null
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          criado_em?: string | null
          disciplina_id: string
          horas_bloco?: number | null
          id?: string
          nome: string
          ordem: number
        }
        Update: {
          criado_em?: string | null
          disciplina_id?: string
          horas_bloco?: number | null
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "blocos_tematicos_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocos_tematicos_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "v_progresso_disciplinas"
            referencedColumns: ["disciplina_id"]
          },
        ]
      }
      concursos: {
        Row: {
          atualizado_em: string | null
          banca: string
          cargo: string
          criado_em: string | null
          data_prova: string | null
          edital_url: string | null
          id: string
          nivel: string | null
          nome: string
          publicado_em: string | null
          status: string
        }
        Insert: {
          atualizado_em?: string | null
          banca: string
          cargo: string
          criado_em?: string | null
          data_prova?: string | null
          edital_url?: string | null
          id?: string
          nivel?: string | null
          nome: string
          publicado_em?: string | null
          status?: string
        }
        Update: {
          atualizado_em?: string | null
          banca?: string
          cargo?: string
          criado_em?: string | null
          data_prova?: string | null
          edital_url?: string | null
          id?: string
          nivel?: string | null
          nome?: string
          publicado_em?: string | null
          status?: string
        }
        Relationships: []
      }
      conteudos: {
        Row: {
          ativo: boolean
          atualizado_em: string | null
          corpo_json: Json
          criado_em: string | null
          duracao_estimada_min: number
          id: string
          ordem: number
          subtopico_id: string | null
          tipo: string
          titulo: string
          topico_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string | null
          corpo_json: Json
          criado_em?: string | null
          duracao_estimada_min?: number
          id?: string
          ordem?: number
          subtopico_id?: string | null
          tipo: string
          titulo: string
          topico_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string | null
          corpo_json?: Json
          criado_em?: string | null
          duracao_estimada_min?: number
          id?: string
          ordem?: number
          subtopico_id?: string | null
          tipo?: string
          titulo?: string
          topico_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conteudos_subtopico_id_fkey"
            columns: ["subtopico_id"]
            isOneToOne: false
            referencedRelation: "subtopicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conteudos_topico_id_fkey"
            columns: ["topico_id"]
            isOneToOne: false
            referencedRelation: "topicos"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplinas: {
        Row: {
          atualizado_em: string | null
          concurso_id: string
          cor: string | null
          criado_em: string | null
          horas_totais: number
          id: string
          nivel: string | null
          nome: string
          observacoes_globais: Json | null
          ordem: number
        }
        Insert: {
          atualizado_em?: string | null
          concurso_id: string
          cor?: string | null
          criado_em?: string | null
          horas_totais: number
          id?: string
          nivel?: string | null
          nome: string
          observacoes_globais?: Json | null
          ordem: number
        }
        Update: {
          atualizado_em?: string | null
          concurso_id?: string
          cor?: string | null
          criado_em?: string | null
          horas_totais?: number
          id?: string
          nivel?: string | null
          nome?: string
          observacoes_globais?: Json | null
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "disciplinas_concurso_id_fkey"
            columns: ["concurso_id"]
            isOneToOne: false
            referencedRelation: "concursos"
            referencedColumns: ["id"]
          },
        ]
      }
      editais_raw: {
        Row: {
          concurso_id: string
          criado_em: string | null
          fonte: string | null
          id: string
          texto_bruto: string
          url_original: string | null
          versao: number
        }
        Insert: {
          concurso_id: string
          criado_em?: string | null
          fonte?: string | null
          id?: string
          texto_bruto: string
          url_original?: string | null
          versao?: number
        }
        Update: {
          concurso_id?: string
          criado_em?: string | null
          fonte?: string | null
          id?: string
          texto_bruto?: string
          url_original?: string | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "editais_raw_concurso_id_fkey"
            columns: ["concurso_id"]
            isOneToOne: false
            referencedRelation: "concursos"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos: {
        Row: {
          aluno_id: string | null
          criado_em: string | null
          id: string
          payload: Json | null
          tipo: string
        }
        Insert: {
          aluno_id?: string | null
          criado_em?: string | null
          id?: string
          payload?: Json | null
          tipo: string
        }
        Update: {
          aluno_id?: string | null
          criado_em?: string | null
          id?: string
          payload?: Json | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_progresso_disciplinas"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      fsrs_cards: {
        Row: {
          aluno_id: string
          atualizado_em: string | null
          criado_em: string | null
          difficulty: number
          due_date: string
          elapsed_days: number
          id: string
          lapse_count: number
          last_review: string | null
          retrievability: number | null
          review_count: number
          scheduled_days: number
          stability: number
          state: string
          subtopico_id: string
        }
        Insert: {
          aluno_id: string
          atualizado_em?: string | null
          criado_em?: string | null
          difficulty: number
          due_date: string
          elapsed_days?: number
          id?: string
          lapse_count?: number
          last_review?: string | null
          retrievability?: number | null
          review_count?: number
          scheduled_days?: number
          stability: number
          state: string
          subtopico_id: string
        }
        Update: {
          aluno_id?: string
          atualizado_em?: string | null
          criado_em?: string | null
          difficulty?: number
          due_date?: string
          elapsed_days?: number
          id?: string
          lapse_count?: number
          last_review?: string | null
          retrievability?: number | null
          review_count?: number
          scheduled_days?: number
          stability?: number
          state?: string
          subtopico_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fsrs_cards_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fsrs_cards_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_progresso_disciplinas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "fsrs_cards_subtopico_id_fkey"
            columns: ["subtopico_id"]
            isOneToOne: false
            referencedRelation: "subtopicos"
            referencedColumns: ["id"]
          },
        ]
      }
      fsrs_reviews_log: {
        Row: {
          acertos: number
          aluno_id: string
          card_id: string
          difficulty_antes: number
          difficulty_depois: number
          due_anterior: string | null
          due_proxima: string
          duracao_segundos: number | null
          id: string
          rating: number
          revisado_em: string | null
          stability_antes: number
          stability_depois: number
          taxa_acerto: number
          total_questoes: number
        }
        Insert: {
          acertos: number
          aluno_id: string
          card_id: string
          difficulty_antes: number
          difficulty_depois: number
          due_anterior?: string | null
          due_proxima: string
          duracao_segundos?: number | null
          id?: string
          rating: number
          revisado_em?: string | null
          stability_antes: number
          stability_depois: number
          taxa_acerto: number
          total_questoes: number
        }
        Update: {
          acertos?: number
          aluno_id?: string
          card_id?: string
          difficulty_antes?: number
          difficulty_depois?: number
          due_anterior?: string | null
          due_proxima?: string
          duracao_segundos?: number | null
          id?: string
          rating?: number
          revisado_em?: string | null
          stability_antes?: number
          stability_depois?: number
          taxa_acerto?: number
          total_questoes?: number
        }
        Relationships: [
          {
            foreignKeyName: "fsrs_reviews_log_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fsrs_reviews_log_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_progresso_disciplinas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "fsrs_reviews_log_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "fsrs_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      resumos: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          conteudo_plate: Json
          id: string
          publicado_em: string | null
          status: string
          subtopico_id: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          conteudo_plate?: Json
          id?: string
          publicado_em?: string | null
          status?: string
          subtopico_id: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          conteudo_plate?: Json
          id?: string
          publicado_em?: string | null
          status?: string
          subtopico_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resumos_subtopico_id_fkey"
            columns: ["subtopico_id"]
            isOneToOne: true
            referencedRelation: "subtopicos"
            referencedColumns: ["id"]
          },
        ]
      }
      questoes: {
        Row: {
          alternativas: Json | null
          ano: number | null
          ativa: boolean
          atualizado_em: string | null
          banca: string | null
          comentario_json: Json | null
          criado_em: string | null
          dificuldade_estimada: number | null
          enunciado: string
          gabarito: string
          id: string
          subtopico_id: string | null
          tipo: string
          topico_id: string
        }
        Insert: {
          alternativas?: Json | null
          ano?: number | null
          ativa?: boolean
          atualizado_em?: string | null
          banca?: string | null
          comentario_json?: Json | null
          criado_em?: string | null
          dificuldade_estimada?: number | null
          enunciado: string
          gabarito: string
          id?: string
          subtopico_id?: string | null
          tipo: string
          topico_id: string
        }
        Update: {
          alternativas?: Json | null
          ano?: number | null
          ativa?: boolean
          atualizado_em?: string | null
          banca?: string | null
          comentario_json?: Json | null
          criado_em?: string | null
          dificuldade_estimada?: number | null
          enunciado?: string
          gabarito?: string
          id?: string
          subtopico_id?: string | null
          tipo?: string
          topico_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questoes_subtopico_id_fkey"
            columns: ["subtopico_id"]
            isOneToOne: false
            referencedRelation: "subtopicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questoes_topico_id_fkey"
            columns: ["topico_id"]
            isOneToOne: false
            referencedRelation: "topicos"
            referencedColumns: ["id"]
          },
        ]
      }
      semanas: {
        Row: {
          aluno_id: string
          concluida_em: string | null
          criado_em: string | null
          data_fim: string
          data_inicio: string
          horas_estudadas: number | null
          horas_planejadas: number | null
          id: string
          numero: number
          qualidade_pct: number | null
          status: string
        }
        Insert: {
          aluno_id: string
          concluida_em?: string | null
          criado_em?: string | null
          data_fim: string
          data_inicio: string
          horas_estudadas?: number | null
          horas_planejadas?: number | null
          id?: string
          numero: number
          qualidade_pct?: number | null
          status?: string
        }
        Update: {
          aluno_id?: string
          concluida_em?: string | null
          criado_em?: string | null
          data_fim?: string
          data_inicio?: string
          horas_estudadas?: number | null
          horas_planejadas?: number | null
          id?: string
          numero?: number
          qualidade_pct?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "semanas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semanas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_progresso_disciplinas"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      subtopicos: {
        Row: {
          criado_em: string | null
          horas_sugeridas: number | null
          id: string
          nome: string
          ordem: number
          topico_id: string
        }
        Insert: {
          criado_em?: string | null
          horas_sugeridas?: number | null
          id?: string
          nome: string
          ordem: number
          topico_id: string
        }
        Update: {
          criado_em?: string | null
          horas_sugeridas?: number | null
          id?: string
          nome?: string
          ordem?: number
          topico_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtopicos_topico_id_fkey"
            columns: ["topico_id"]
            isOneToOne: false
            referencedRelation: "topicos"
            referencedColumns: ["id"]
          },
        ]
      }
      tentativas_questoes: {
        Row: {
          acertou: boolean
          aluno_id: string
          atividade_id: string | null
          comentario_lido: boolean | null
          id: string
          questao_id: string
          respondida_em: string | null
          resposta: string
          tempo_segundos: number
        }
        Insert: {
          acertou: boolean
          aluno_id: string
          atividade_id?: string | null
          comentario_lido?: boolean | null
          id?: string
          questao_id: string
          respondida_em?: string | null
          resposta: string
          tempo_segundos: number
        }
        Update: {
          acertou?: boolean
          aluno_id?: string
          atividade_id?: string | null
          comentario_lido?: boolean | null
          id?: string
          questao_id?: string
          respondida_em?: string | null
          resposta?: string
          tempo_segundos?: number
        }
        Relationships: [
          {
            foreignKeyName: "tentativas_questoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tentativas_questoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_progresso_disciplinas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "tentativas_questoes_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tentativas_questoes_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
        ]
      }
      topicos: {
        Row: {
          atualizado_em: string | null
          bloco_id: string
          criado_em: string | null
          horas_sugeridas: number
          id: string
          natureza: string
          nome: string
          observacao: string | null
          ordem: number
          peso_incidencia: number
          pre_requisito_topico_id: string | null
          tipo_revisao: string | null
        }
        Insert: {
          atualizado_em?: string | null
          bloco_id: string
          criado_em?: string | null
          horas_sugeridas: number
          id?: string
          natureza: string
          nome: string
          observacao?: string | null
          ordem: number
          peso_incidencia: number
          pre_requisito_topico_id?: string | null
          tipo_revisao?: string | null
        }
        Update: {
          atualizado_em?: string | null
          bloco_id?: string
          criado_em?: string | null
          horas_sugeridas?: number
          id?: string
          natureza?: string
          nome?: string
          observacao?: string | null
          ordem?: number
          peso_incidencia?: number
          pre_requisito_topico_id?: string | null
          tipo_revisao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topicos_bloco_id_fkey"
            columns: ["bloco_id"]
            isOneToOne: false
            referencedRelation: "blocos_tematicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topicos_pre_requisito_topico_id_fkey"
            columns: ["pre_requisito_topico_id"]
            isOneToOne: false
            referencedRelation: "topicos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_memoria_em_risco: {
        Row: {
          aluno_id: string | null
          disciplina_nome: string | null
          due_date: string | null
          lapse_count: number | null
          last_review: string | null
          retrievability: number | null
          subtopico_id: string | null
          subtopico_nome: string | null
          topico_nome: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fsrs_cards_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fsrs_cards_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_progresso_disciplinas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "fsrs_cards_subtopico_id_fkey"
            columns: ["subtopico_id"]
            isOneToOne: false
            referencedRelation: "subtopicos"
            referencedColumns: ["id"]
          },
        ]
      }
      v_progresso_disciplinas: {
        Row: {
          aluno_id: string | null
          desempenho_medio: number | null
          disciplina_id: string | null
          disciplina_nome: string | null
          horas_totais: number | null
          subtopicos_em_fsrs: number | null
          topicos_com_teoria: number | null
          total_topicos: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
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
  coaching: {
    Enums: {},
  },
} as const
