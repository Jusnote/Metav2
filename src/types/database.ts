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
  public: {
    Tables: {
      alternativas: {
        Row: {
          correta: boolean | null
          created_at: string | null
          id: string
          letra: string
          questao_id: string | null
          texto: string
        }
        Insert: {
          correta?: boolean | null
          created_at?: string | null
          id?: string
          letra: string
          questao_id?: string | null
          texto: string
        }
        Update: {
          correta?: boolean | null
          created_at?: string | null
          id?: string
          letra?: string
          questao_id?: string | null
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "alternativas_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content: Json
          content_text: string | null
          created_at: string
          id: string
          is_favorite: boolean
          subtopic_id: string | null
          tags: string[] | null
          title: string
          topic_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json
          content_text?: string | null
          created_at?: string
          id?: string
          is_favorite?: boolean
          subtopic_id?: string | null
          tags?: string[] | null
          title?: string
          topic_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          content_text?: string | null
          created_at?: string
          id?: string
          is_favorite?: boolean
          subtopic_id?: string | null
          tags?: string[] | null
          title?: string
          topic_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          back: Json
          created_at: string
          deck_name: string | null
          difficulty: string
          ease_factor: number
          front: Json
          id: string
          interval_days: number
          last_reviewed: string | null
          next_review: string
          repetitions: number
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          back: Json
          created_at?: string
          deck_name?: string | null
          difficulty?: string
          ease_factor?: number
          front: Json
          id?: string
          interval_days?: number
          last_reviewed?: string | null
          next_review?: string
          repetitions?: number
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          back?: Json
          created_at?: string
          deck_name?: string | null
          difficulty?: string
          ease_factor?: number
          front?: Json
          id?: string
          interval_days?: number
          last_reviewed?: string | null
          next_review?: string
          repetitions?: number
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          subtopic_id: string | null
          title: string
          topic_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          subtopic_id?: string | null
          title: string
          topic_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          subtopic_id?: string | null
          title?: string
          topic_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      questoes: {
        Row: {
          ano: number | null
          assunto: string | null
          banca: string | null
          cargo: string | null
          created_at: string | null
          dificuldade: string | null
          disciplina: string | null
          enunciado: string
          id: string
          modalidade: string | null
          nivel: string | null
          tipo: string | null
          titulo: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ano?: number | null
          assunto?: string | null
          banca?: string | null
          cargo?: string | null
          created_at?: string | null
          dificuldade?: string | null
          disciplina?: string | null
          enunciado: string
          id?: string
          modalidade?: string | null
          nivel?: string | null
          tipo?: string | null
          titulo: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ano?: number | null
          assunto?: string | null
          banca?: string | null
          cargo?: string | null
          created_at?: string | null
          dificuldade?: string | null
          disciplina?: string | null
          enunciado?: string
          id?: string
          modalidade?: string | null
          nivel?: string | null
          tipo?: string | null
          titulo?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      quick_notes: {
        Row: {
          back_content: Json | null
          card_order: number | null
          child_ids: string[] | null
          content: Json
          created_at: string
          deck_name: string | null
          difficulty: string | null
          difficulty_fsrs: number | null
          due: string | null
          ease_factor: number | null
          flashcard_id: string | null
          flashcard_type: string | null
          front_content: Json | null
          hidden_word_indices: number[] | null
          hidden_words: string[] | null
          id: string
          interval_days: number | null
          last_review_fsrs: string | null
          last_reviewed: string | null
          level: number | null
          next_review: string | null
          parent_id: string | null
          repetitions: number | null
          review_count: number | null
          stability: number | null
          state: number | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          back_content?: Json | null
          card_order?: number | null
          child_ids?: string[] | null
          content: Json
          created_at?: string
          deck_name?: string | null
          difficulty?: string | null
          difficulty_fsrs?: number | null
          due?: string | null
          ease_factor?: number | null
          flashcard_id?: string | null
          flashcard_type?: string | null
          front_content?: Json | null
          hidden_word_indices?: number[] | null
          hidden_words?: string[] | null
          id?: string
          interval_days?: number | null
          last_review_fsrs?: string | null
          last_reviewed?: string | null
          level?: number | null
          next_review?: string | null
          parent_id?: string | null
          repetitions?: number | null
          review_count?: number | null
          stability?: number | null
          state?: number | null
          title?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          back_content?: Json | null
          card_order?: number | null
          child_ids?: string[] | null
          content?: Json
          created_at?: string
          deck_name?: string | null
          difficulty?: string | null
          difficulty_fsrs?: number | null
          due?: string | null
          ease_factor?: number | null
          flashcard_id?: string | null
          flashcard_type?: string | null
          front_content?: Json | null
          hidden_word_indices?: number[] | null
          hidden_words?: string[] | null
          id?: string
          interval_days?: number | null
          last_review_fsrs?: string | null
          last_reviewed?: string | null
          level?: number | null
          next_review?: string | null
          parent_id?: string | null
          repetitions?: number | null
          review_count?: number | null
          stability?: number | null
          state?: number | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_notes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "quick_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_items: {
        Row: {
          actual_duration: number | null
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          delay_days: number | null
          deleted_at: string | null
          document_id: string | null
          estimated_duration: number | null
          fsrs_state: Json | null
          id: string
          is_delayed: boolean | null
          is_manual: boolean | null
          is_overbooked: boolean | null
          item_type: string | null
          next_revision_id: string | null
          notes: string | null
          original_scheduled_date: string | null
          parent_item_id: string | null
          performance_data: Json | null
          priority: number | null
          revision_number: number | null
          revision_type: string | null
          scheduled_date: string
          study_goal_id: string | null
          subtopic_id: string | null
          sync_enabled: boolean | null
          title: string
          topic_id: string | null
          unit_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actual_duration?: number | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          delay_days?: number | null
          deleted_at?: string | null
          document_id?: string | null
          estimated_duration?: number | null
          fsrs_state?: Json | null
          id?: string
          is_delayed?: boolean | null
          is_manual?: boolean | null
          is_overbooked?: boolean | null
          item_type?: string | null
          next_revision_id?: string | null
          notes?: string | null
          original_scheduled_date?: string | null
          parent_item_id?: string | null
          performance_data?: Json | null
          priority?: number | null
          revision_number?: number | null
          revision_type?: string | null
          scheduled_date: string
          study_goal_id?: string | null
          subtopic_id?: string | null
          sync_enabled?: boolean | null
          title: string
          topic_id?: string | null
          unit_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actual_duration?: number | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          delay_days?: number | null
          deleted_at?: string | null
          document_id?: string | null
          estimated_duration?: number | null
          fsrs_state?: Json | null
          id?: string
          is_delayed?: boolean | null
          is_manual?: boolean | null
          is_overbooked?: boolean | null
          item_type?: string | null
          next_revision_id?: string | null
          notes?: string | null
          original_scheduled_date?: string | null
          parent_item_id?: string | null
          performance_data?: Json | null
          priority?: number | null
          revision_number?: number | null
          revision_type?: string | null
          scheduled_date?: string
          study_goal_id?: string | null
          subtopic_id?: string | null
          sync_enabled?: boolean | null
          title?: string
          topic_id?: string | null
          unit_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_next_revision_id_fkey"
            columns: ["next_revision_id"]
            isOneToOne: false
            referencedRelation: "schedule_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_next_revision_id_fkey"
            columns: ["next_revision_id"]
            isOneToOne: false
            referencedRelation: "schedule_items_delayed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "schedule_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "schedule_items_delayed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_study_goal_id_fkey"
            columns: ["study_goal_id"]
            isOneToOne: false
            referencedRelation: "study_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      study_goals: {
        Row: {
          aggressiveness: string | null
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          enable_fsrs: boolean | null
          id: string
          progress_percentage: number | null
          start_date: string
          study_weekends: boolean | null
          target_date: string
          title: string
          unit_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          aggressiveness?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          enable_fsrs?: boolean | null
          id?: string
          progress_percentage?: number | null
          start_date: string
          study_weekends?: boolean | null
          target_date: string
          title: string
          unit_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          aggressiveness?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          enable_fsrs?: boolean | null
          id?: string
          progress_percentage?: number | null
          start_date?: string
          study_weekends?: boolean | null
          target_date?: string
          title?: string
          unit_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_goals_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      study_questions: {
        Row: {
          correct_answer: Json
          created_at: string | null
          document_id: string
          explanation: string | null
          id: string
          options: Json | null
          points: number | null
          question_text: string
          question_type: string
          section_index: number
          section_title: string
          updated_at: string | null
        }
        Insert: {
          correct_answer: Json
          created_at?: string | null
          document_id: string
          explanation?: string | null
          id?: string
          options?: Json | null
          points?: number | null
          question_text: string
          question_type: string
          section_index: number
          section_title: string
          updated_at?: string | null
        }
        Update: {
          correct_answer?: Json
          created_at?: string | null
          document_id?: string
          explanation?: string | null
          id?: string
          options?: Json | null
          points?: number | null
          question_text?: string
          question_type?: string
          section_index?: number
          section_title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      subtopics: {
        Row: {
          average_time: number | null
          created_at: string | null
          estimated_duration_minutes: number
          flashcards_vinculados: number | null
          id: string
          last_access: string | null
          questoes_vinculadas: number | null
          resumos_vinculados: number | null
          status: string | null
          tempo: string | null
          tempo_investido: number | null
          title: string
          topic_id: string
          total_aulas: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          average_time?: number | null
          created_at?: string | null
          estimated_duration_minutes?: number
          flashcards_vinculados?: number | null
          id?: string
          last_access?: string | null
          questoes_vinculadas?: number | null
          resumos_vinculados?: number | null
          status?: string | null
          tempo?: string | null
          tempo_investido?: number | null
          title: string
          topic_id: string
          total_aulas?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          average_time?: number | null
          created_at?: string | null
          estimated_duration_minutes?: number
          flashcards_vinculados?: number | null
          id?: string
          last_access?: string | null
          questoes_vinculadas?: number | null
          resumos_vinculados?: number | null
          status?: string | null
          tempo?: string | null
          tempo_investido?: number | null
          title?: string
          topic_id?: string
          total_aulas?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subtopics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_history: {
        Row: {
          changed_field: string
          id: string
          new_value: Json | null
          old_value: Json | null
          schedule_item_id: string | null
          sync_source: string | null
          synced_at: string | null
          user_id: string
        }
        Insert: {
          changed_field: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          schedule_item_id?: string | null
          sync_source?: string | null
          synced_at?: string | null
          user_id: string
        }
        Update: {
          changed_field?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          schedule_item_id?: string | null
          sync_source?: string | null
          synced_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_history_schedule_item_id_fkey"
            columns: ["schedule_item_id"]
            isOneToOne: false
            referencedRelation: "schedule_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_history_schedule_item_id_fkey"
            columns: ["schedule_item_id"]
            isOneToOne: false
            referencedRelation: "schedule_items_delayed"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          created_at: string | null
          estimated_duration_minutes: number
          id: string
          last_access: string | null
          tempo_investido: number | null
          title: string
          total_aulas: number | null
          unit_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          estimated_duration_minutes?: number
          id?: string
          last_access?: string | null
          tempo_investido?: number | null
          title: string
          total_aulas?: number | null
          unit_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          estimated_duration_minutes?: number
          id?: string
          last_access?: string | null
          tempo_investido?: number | null
          title?: string
          total_aulas?: number | null
          unit_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topics_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          created_at: string | null
          id: string
          subject: string | null
          title: string
          total_chapters: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          subject?: string | null
          title: string
          total_chapters?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          subject?: string | null
          title?: string
          total_chapters?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_study_config: {
        Row: {
          avoid_times: string[] | null
          created_at: string | null
          daily_exceptions: Json | null
          exam_date: string | null
          fsrs_aggressiveness: string | null
          has_exam: boolean | null
          id: string
          metadata: Json | null
          preferred_session_duration: number | null
          preferred_times: string[] | null
          study_goal_type: string | null
          study_saturday: boolean | null
          study_sunday: boolean | null
          updated_at: string | null
          user_id: string
          weekday_hours: number | null
          weekend_hours: number | null
        }
        Insert: {
          avoid_times?: string[] | null
          created_at?: string | null
          daily_exceptions?: Json | null
          exam_date?: string | null
          fsrs_aggressiveness?: string | null
          has_exam?: boolean | null
          id?: string
          metadata?: Json | null
          preferred_session_duration?: number | null
          preferred_times?: string[] | null
          study_goal_type?: string | null
          study_saturday?: boolean | null
          study_sunday?: boolean | null
          updated_at?: string | null
          user_id: string
          weekday_hours?: number | null
          weekend_hours?: number | null
        }
        Update: {
          avoid_times?: string[] | null
          created_at?: string | null
          daily_exceptions?: Json | null
          exam_date?: string | null
          fsrs_aggressiveness?: string | null
          has_exam?: boolean | null
          id?: string
          metadata?: Json | null
          preferred_session_duration?: number | null
          preferred_times?: string[] | null
          study_goal_type?: string | null
          study_saturday?: boolean | null
          study_sunday?: boolean | null
          updated_at?: string | null
          user_id?: string
          weekday_hours?: number | null
          weekend_hours?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      schedule_items_delayed: {
        Row: {
          delay_days: number | null
          estimated_duration: number | null
          id: string | null
          original_scheduled_date: string | null
          revision_type: string | null
          scheduled_date: string | null
          title: string | null
        }
        Insert: {
          delay_days?: number | null
          estimated_duration?: number | null
          id?: string | null
          original_scheduled_date?: string | null
          revision_type?: string | null
          scheduled_date?: string | null
          title?: string | null
        }
        Update: {
          delay_days?: number | null
          estimated_duration?: number | null
          id?: string | null
          original_scheduled_date?: string | null
          revision_type?: string | null
          scheduled_date?: string | null
          title?: string | null
        }
        Relationships: []
      }
      schedule_items_overbooked_by_date: {
        Row: {
          overbooked_count: number | null
          scheduled_date: string | null
          titles: string[] | null
          total_minutes: number | null
        }
        Relationships: []
      }
      schedule_items_revision_hierarchy: {
        Row: {
          depth: number | null
          id: string | null
          parent_item_id: string | null
          path: string[] | null
          revision_type: string | null
          scheduled_date: string | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      extract_text_from_plate: { Args: { content: Json }; Returns: string }
      get_daily_capacity: { Args: { intensity_level: string }; Returns: number }
      get_hard_limit_capacity: {
        Args: { intensity_level: string }
        Returns: number
      }
      get_or_create_user_study_config: {
        Args: { p_user_id: string }
        Returns: {
          avoid_times: string[] | null
          created_at: string | null
          daily_exceptions: Json | null
          exam_date: string | null
          fsrs_aggressiveness: string | null
          has_exam: boolean | null
          id: string
          metadata: Json | null
          preferred_session_duration: number | null
          preferred_times: string[] | null
          study_goal_type: string | null
          study_saturday: boolean | null
          study_sunday: boolean | null
          updated_at: string | null
          user_id: string
          weekday_hours: number | null
          weekend_hours: number | null
        }
        SetofOptions: {
          from: "*"
          to: "user_study_config"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
  public: {
    Enums: {},
  },
} as const

// Helper type exports
export type Questao = Tables<"questoes">
export type Alternativa = Tables<"alternativas">
export type BlockNoteFlashcard = Tables<"flashcards">
export type BlockNoteFlashcardInsert = TablesInsert<"flashcards">
export type ScheduleItem = Tables<"schedule_items">
export type ScheduleItemInsert = TablesInsert<"schedule_items">
export type ScheduleItemUpdate = TablesUpdate<"schedule_items">
export type StudyGoal = Tables<"study_goals">
export type StudyGoalInsert = TablesInsert<"study_goals">
