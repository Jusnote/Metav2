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
      artigos: {
        Row: {
          anotacoes_legislativas: Json | null
          content_hash: string | null
          contexto: string | null
          created_at: string | null
          epigrafe: string | null
          flags: Json | null
          fonte: string | null
          fonte_url: string | null
          id: string
          lei_id: string | null
          numero: string
          ordem_numerica: number | null
          path: Json | null
          plate_content: Json | null
          qualidade_score: number | null
          reference_links: Json | null
          revoked_versions: Json | null
          search_text: string | null
          slug: string | null
          source_id: number | null
          source_index: number | null
          source_type: string | null
          texto_limpo: string | null
          texto_original_fonte: string | null
          texto_plano: string | null
          updated_at: string | null
          vigente: boolean | null
        }
        Insert: {
          anotacoes_legislativas?: Json | null
          content_hash?: string | null
          contexto?: string | null
          created_at?: string | null
          epigrafe?: string | null
          flags?: Json | null
          fonte?: string | null
          fonte_url?: string | null
          id: string
          lei_id?: string | null
          numero: string
          ordem_numerica?: number | null
          path?: Json | null
          plate_content?: Json | null
          qualidade_score?: number | null
          reference_links?: Json | null
          revoked_versions?: Json | null
          search_text?: string | null
          slug?: string | null
          source_id?: number | null
          source_index?: number | null
          source_type?: string | null
          texto_limpo?: string | null
          texto_original_fonte?: string | null
          texto_plano?: string | null
          updated_at?: string | null
          vigente?: boolean | null
        }
        Update: {
          anotacoes_legislativas?: Json | null
          content_hash?: string | null
          contexto?: string | null
          created_at?: string | null
          epigrafe?: string | null
          flags?: Json | null
          fonte?: string | null
          fonte_url?: string | null
          id?: string
          lei_id?: string | null
          numero?: string
          ordem_numerica?: number | null
          path?: Json | null
          plate_content?: Json | null
          qualidade_score?: number | null
          reference_links?: Json | null
          revoked_versions?: Json | null
          search_text?: string | null
          slug?: string | null
          source_id?: number | null
          source_index?: number | null
          source_type?: string | null
          texto_limpo?: string | null
          texto_original_fonte?: string | null
          texto_plano?: string | null
          updated_at?: string | null
          vigente?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "artigos_lei_id_fkey"
            columns: ["lei_id"]
            isOneToOne: false
            referencedRelation: "leis"
            referencedColumns: ["id"]
          },
        ]
      }
      caderno_items: {
        Row: {
          artigo_contexto: string | null
          artigo_numero: string
          caderno_id: string
          context_chain: Json | null
          created_at: string | null
          id: string
          lei_id: string
          lei_nome: string | null
          lei_sigla: string | null
          markers: string[] | null
          note: string | null
          position: number
          provision_role: string
          provision_slug: string
          provision_text: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          artigo_contexto?: string | null
          artigo_numero: string
          caderno_id: string
          context_chain?: Json | null
          created_at?: string | null
          id?: string
          lei_id: string
          lei_nome?: string | null
          lei_sigla?: string | null
          markers?: string[] | null
          note?: string | null
          position?: number
          provision_role: string
          provision_slug: string
          provision_text: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          artigo_contexto?: string | null
          artigo_numero?: string
          caderno_id?: string
          context_chain?: Json | null
          created_at?: string | null
          id?: string
          lei_id?: string
          lei_nome?: string | null
          lei_sigla?: string | null
          markers?: string[] | null
          note?: string | null
          position?: number
          provision_role?: string
          provision_slug?: string
          provision_text?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caderno_items_caderno_id_fkey"
            columns: ["caderno_id"]
            isOneToOne: false
            referencedRelation: "cadernos"
            referencedColumns: ["id"]
          },
        ]
      }
      cadernos: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      grifos: {
        Row: {
          color: string
          created_at: string | null
          dispositivo_id: string
          end_offset: number
          id: string
          lei_id: string
          note: string | null
          orphan: boolean | null
          start_offset: number
          style: string
          tags: string[] | null
          texto_grifado: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          dispositivo_id: string
          end_offset: number
          id?: string
          lei_id: string
          note?: string | null
          orphan?: boolean | null
          start_offset: number
          style?: string
          tags?: string[] | null
          texto_grifado: string
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          color?: string
          created_at?: string | null
          dispositivo_id?: string
          end_offset?: number
          id?: string
          lei_id?: string
          note?: string | null
          orphan?: boolean | null
          start_offset?: number
          style?: string
          tags?: string[] | null
          texto_grifado?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      leis: {
        Row: {
          created_at: string | null
          data_publicacao: string | null
          ementa: string | null
          hierarquia: Json | null
          id: string
          nome: string | null
          numero: string | null
          raw_metadata: Json | null
          raw_tabelas: Json | null
          sigla: string | null
          total_artigos: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_publicacao?: string | null
          ementa?: string | null
          hierarquia?: Json | null
          id: string
          nome?: string | null
          numero?: string | null
          raw_metadata?: Json | null
          raw_tabelas?: Json | null
          sigla?: string | null
          total_artigos?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_publicacao?: string | null
          ementa?: string | null
          hierarquia?: Json | null
          id?: string
          nome?: string | null
          numero?: string | null
          raw_metadata?: Json | null
          raw_tabelas?: Json | null
          sigla?: string | null
          total_artigos?: number | null
          updated_at?: string | null
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
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      question_comment_edits: {
        Row: {
          comment_id: string
          content_json: Json
          content_text: string
          edited_at: string
          id: string
        }
        Insert: {
          comment_id: string
          content_json: Json
          content_text: string
          edited_at?: string
          id?: string
        }
        Update: {
          comment_id?: string
          content_json?: Json
          content_text?: string
          edited_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_comment_edits_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "question_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      question_comment_reports: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_comment_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "question_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      question_comment_votes: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_comment_votes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "question_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      question_comments: {
        Row: {
          content_json: Json
          content_text: string
          created_at: string
          deleted_by: string | null
          edit_count: number
          id: string
          is_author_shadowbanned: boolean
          is_deleted: boolean
          is_endorsed: boolean
          is_pinned: boolean
          last_edited_at: string | null
          question_id: number
          quoted_text: string | null
          reply_count: number
          reply_to_id: string | null
          report_count: number
          root_id: string | null
          updated_at: string
          upvote_count: number
          user_id: string
        }
        Insert: {
          content_json: Json
          content_text: string
          created_at?: string
          deleted_by?: string | null
          edit_count?: number
          id?: string
          is_author_shadowbanned?: boolean
          is_deleted?: boolean
          is_endorsed?: boolean
          is_pinned?: boolean
          last_edited_at?: string | null
          question_id: number
          quoted_text?: string | null
          reply_count?: number
          reply_to_id?: string | null
          report_count?: number
          root_id?: string | null
          updated_at?: string
          upvote_count?: number
          user_id: string
        }
        Update: {
          content_json?: Json
          content_text?: string
          created_at?: string
          deleted_by?: string | null
          edit_count?: number
          id?: string
          is_author_shadowbanned?: boolean
          is_deleted?: boolean
          is_endorsed?: boolean
          is_pinned?: boolean
          last_edited_at?: string | null
          question_id?: number
          quoted_text?: string | null
          reply_count?: number
          reply_to_id?: string | null
          report_count?: number
          root_id?: string | null
          updated_at?: string
          upvote_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_comments_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "question_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_comments_root_id_fkey"
            columns: ["root_id"]
            isOneToOne: false
            referencedRelation: "question_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      question_notes: {
        Row: {
          content_json: Json
          content_text: string
          created_at: string
          question_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          content_json: Json
          content_text: string
          created_at?: string
          question_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          content_json?: Json
          content_text?: string
          created_at?: string
          question_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      user_moderation: {
        Row: {
          banned_by: string | null
          created_at: string
          is_shadowbanned: boolean
          timeout_reason: string | null
          timeout_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          banned_by?: string | null
          created_at?: string
          is_shadowbanned?: boolean
          timeout_reason?: string | null
          timeout_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          banned_by?: string | null
          created_at?: string
          is_shadowbanned?: boolean
          timeout_reason?: string | null
          timeout_until?: string | null
          updated_at?: string
          user_id?: string
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
      get_comment_replies: {
        Args: { p_root_id: string; p_user_id: string }
        Returns: {
          content_json: Json
          content_text: string
          created_at: string
          edit_count: number
          has_upvoted: boolean
          id: string
          is_author_shadowbanned: boolean
          is_deleted: boolean
          last_edited_at: string
          quoted_text: string
          reply_to_id: string
          root_id: string
          upvote_count: number
          user_id: string
        }[]
      }
      get_comments_with_votes: {
        Args: { p_question_id: number; p_sort?: string; p_user_id: string }
        Returns: {
          content_json: Json
          content_text: string
          created_at: string
          edit_count: number
          has_upvoted: boolean
          id: string
          is_author_shadowbanned: boolean
          is_deleted: boolean
          is_endorsed: boolean
          is_pinned: boolean
          last_edited_at: string
          question_id: number
          quoted_text: string
          reply_count: number
          reply_to_id: string
          report_count: number
          root_id: string
          upvote_count: number
          user_id: string
        }[]
      }
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
      handle_soft_delete: {
        Args: { p_comment_id: string; p_user_id: string }
        Returns: Json
      }
      immutable_unaccent: { Args: { "": string }; Returns: string }
      search_artigos: {
        Args: {
          lei_filter?: string
          limit_count?: number
          search_query: string
        }
        Returns: {
          contexto: string
          id: string
          lei_id: string
          numero: string
          rank: number
          texto_plano: string
        }[]
      }
      toggle_upvote: {
        Args: { p_comment_id: string; p_user_id: string }
        Returns: Json
      }
      upsert_lei_com_artigos: {
        Args: { p_artigos: Json; p_lei: Json }
        Returns: Json
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
