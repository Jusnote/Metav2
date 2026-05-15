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
      achievements_catalog: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string
          icon_name: string
          id: string
          ordem: number
          slug: string
          title: string
          trigger_threshold: number
          trigger_type: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          description: string
          icon_name: string
          id?: string
          ordem?: number
          slug: string
          title: string
          trigger_threshold: number
          trigger_type: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string
          icon_name?: string
          id?: string
          ordem?: number
          slug?: string
          title?: string
          trigger_threshold?: number
          trigger_type?: string
        }
        Relationships: []
      }
      ai_quality_feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          subtopico_id: string | null
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          subtopico_id?: string | null
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          subtopico_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
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
      analytics_events: {
        Row: {
          event_name: string
          id: string
          occurred_at: string
          properties: Json
          user_id: string | null
        }
        Insert: {
          event_name: string
          id?: string
          occurred_at?: string
          properties?: Json
          user_id?: string | null
        }
        Update: {
          event_name?: string
          id?: string
          occurred_at?: string
          properties?: Json
          user_id?: string | null
        }
        Relationships: []
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
      behavioral_signals: {
        Row: {
          id: string
          occurred_at: string
          plano_id: string | null
          schedule_item_id: string | null
          signal_type: string
          user_id: string
          value: Json
        }
        Insert: {
          id?: string
          occurred_at?: string
          plano_id?: string | null
          schedule_item_id?: string | null
          signal_type: string
          user_id: string
          value: Json
        }
        Update: {
          id?: string
          occurred_at?: string
          plano_id?: string | null
          schedule_item_id?: string | null
          signal_type?: string
          user_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "behavioral_signals_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_estudo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behavioral_signals_schedule_item_id_fkey"
            columns: ["schedule_item_id"]
            isOneToOne: false
            referencedRelation: "schedule_items"
            referencedColumns: ["id"]
          },
        ]
      }
      behavioral_signals_2026_05: {
        Row: {
          id: string
          occurred_at: string
          plano_id: string | null
          schedule_item_id: string | null
          signal_type: string
          user_id: string
          value: Json
        }
        Insert: {
          id?: string
          occurred_at?: string
          plano_id?: string | null
          schedule_item_id?: string | null
          signal_type: string
          user_id: string
          value: Json
        }
        Update: {
          id?: string
          occurred_at?: string
          plano_id?: string | null
          schedule_item_id?: string | null
          signal_type?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      behavioral_signals_2026_06: {
        Row: {
          id: string
          occurred_at: string
          plano_id: string | null
          schedule_item_id: string | null
          signal_type: string
          user_id: string
          value: Json
        }
        Insert: {
          id?: string
          occurred_at?: string
          plano_id?: string | null
          schedule_item_id?: string | null
          signal_type: string
          user_id: string
          value: Json
        }
        Update: {
          id?: string
          occurred_at?: string
          plano_id?: string | null
          schedule_item_id?: string | null
          signal_type?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      behavioral_signals_default: {
        Row: {
          id: string
          occurred_at: string
          plano_id: string | null
          schedule_item_id: string | null
          signal_type: string
          user_id: string
          value: Json
        }
        Insert: {
          id?: string
          occurred_at?: string
          plano_id?: string | null
          schedule_item_id?: string | null
          signal_type: string
          user_id: string
          value: Json
        }
        Update: {
          id?: string
          occurred_at?: string
          plano_id?: string | null
          schedule_item_id?: string | null
          signal_type?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
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
      dead_letters: {
        Row: {
          attempts: number
          error_message: string
          event_type: string
          first_failed_at: string
          id: string
          last_failed_at: string
          payload: Json
          resolution_notes: string | null
          resolved_at: string | null
          source_event_id: string | null
        }
        Insert: {
          attempts: number
          error_message: string
          event_type: string
          first_failed_at: string
          id?: string
          last_failed_at: string
          payload: Json
          resolution_notes?: string | null
          resolved_at?: string | null
          source_event_id?: string | null
        }
        Update: {
          attempts?: number
          error_message?: string
          event_type?: string
          first_failed_at?: string
          id?: string
          last_failed_at?: string
          payload?: Json
          resolution_notes?: string | null
          resolved_at?: string | null
          source_event_id?: string | null
        }
        Relationships: []
      }
      disciplinas: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          origin_disciplina_ref: number | null
          peso_edital: number | null
          plano_id: string | null
          source_type: string | null
          subject: string | null
          total_chapters: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          origin_disciplina_ref?: number | null
          peso_edital?: number | null
          plano_id?: string | null
          source_type?: string | null
          subject?: string | null
          total_chapters?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          origin_disciplina_ref?: number | null
          peso_edital?: number | null
          plano_id?: string | null
          source_type?: string | null
          subject?: string | null
          total_chapters?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      dispositivo_bookmarks: {
        Row: {
          created_at: string | null
          dispositivo_id: string
          id: string
          lei_id: string
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dispositivo_id: string
          id?: string
          lei_id: string
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          dispositivo_id?: string
          id?: string
          lei_id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      dispositivo_comment_reactions: {
        Row: {
          comment_id: string
          created_at: string | null
          emoji: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          emoji: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          emoji?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispositivo_comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "dispositivo_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      dispositivo_comment_upvotes: {
        Row: {
          comment_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispositivo_comment_upvotes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "dispositivo_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      dispositivo_comments: {
        Row: {
          content_json: Json
          content_text: string
          created_at: string | null
          dispositivo_id: string
          edit_count: number | null
          id: string
          is_author_shadowbanned: boolean | null
          is_deleted: boolean | null
          is_endorsed: boolean | null
          is_pinned: boolean | null
          last_edited_at: string | null
          lei_id: string
          quoted_text: string | null
          reply_count: number | null
          reply_to_id: string | null
          root_id: string | null
          updated_at: string | null
          upvote_count: number | null
          user_id: string
        }
        Insert: {
          content_json?: Json
          content_text?: string
          created_at?: string | null
          dispositivo_id: string
          edit_count?: number | null
          id?: string
          is_author_shadowbanned?: boolean | null
          is_deleted?: boolean | null
          is_endorsed?: boolean | null
          is_pinned?: boolean | null
          last_edited_at?: string | null
          lei_id: string
          quoted_text?: string | null
          reply_count?: number | null
          reply_to_id?: string | null
          root_id?: string | null
          updated_at?: string | null
          upvote_count?: number | null
          user_id: string
        }
        Update: {
          content_json?: Json
          content_text?: string
          created_at?: string | null
          dispositivo_id?: string
          edit_count?: number | null
          id?: string
          is_author_shadowbanned?: boolean | null
          is_deleted?: boolean | null
          is_endorsed?: boolean | null
          is_pinned?: boolean | null
          last_edited_at?: string | null
          lei_id?: string
          quoted_text?: string | null
          reply_count?: number | null
          reply_to_id?: string | null
          root_id?: string | null
          updated_at?: string | null
          upvote_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispositivo_comments_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "dispositivo_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispositivo_comments_root_id_fkey"
            columns: ["root_id"]
            isOneToOne: false
            referencedRelation: "dispositivo_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      dispositivo_likes: {
        Row: {
          created_at: string | null
          dispositivo_id: string
          id: string
          lei_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dispositivo_id: string
          id?: string
          lei_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          dispositivo_id?: string
          id?: string
          lei_id?: string
          user_id?: string
        }
        Relationships: []
      }
      dispositivo_notes: {
        Row: {
          content_json: Json
          content_text: string
          created_at: string | null
          dispositivo_id: string
          id: string
          lei_id: string
          tags: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content_json?: Json
          content_text?: string
          created_at?: string | null
          dispositivo_id: string
          id?: string
          lei_id: string
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content_json?: Json
          content_text?: string
          created_at?: string | null
          dispositivo_id?: string
          id?: string
          lei_id?: string
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      dispositivo_user_status: {
        Row: {
          created_at: string | null
          dispositivo_id: string
          id: string
          lei_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dispositivo_id: string
          id?: string
          lei_id: string
          status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          dispositivo_id?: string
          id?: string
          lei_id?: string
          status?: string
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
          subtopico_id: string | null
          tags: string[] | null
          title: string
          topico_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json
          content_text?: string | null
          created_at?: string
          id?: string
          is_favorite?: boolean
          subtopico_id?: string | null
          tags?: string[] | null
          title?: string
          topico_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          content_text?: string | null
          created_at?: string
          id?: string
          is_favorite?: boolean
          subtopico_id?: string | null
          tags?: string[] | null
          title?: string
          topico_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_subtopic_id_fkey"
            columns: ["subtopico_id"]
            isOneToOne: false
            referencedRelation: "subtopicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_topic_id_fkey"
            columns: ["topico_id"]
            isOneToOne: false
            referencedRelation: "topicos"
            referencedColumns: ["id"]
          },
        ]
      }
      edital_cache: {
        Row: {
          ai_model: string
          cargo_id: number
          decomposicao: Json
          edital_id: number
          generated_at: string
          last_validated_at: string
          payload_hash: string
        }
        Insert: {
          ai_model: string
          cargo_id: number
          decomposicao: Json
          edital_id: number
          generated_at?: string
          last_validated_at?: string
          payload_hash: string
        }
        Update: {
          ai_model?: string
          cargo_id?: number
          decomposicao?: Json
          edital_id?: number
          generated_at?: string
          last_validated_at?: string
          payload_hash?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          enabled: boolean
          flag_name: string
          rollout_pct: number
          updated_at: string
          user_allowlist: string[]
          user_blocklist: string[]
        }
        Insert: {
          enabled?: boolean
          flag_name: string
          rollout_pct?: number
          updated_at?: string
          user_allowlist?: string[]
          user_blocklist?: string[]
        }
        Update: {
          enabled?: boolean
          flag_name?: string
          rollout_pct?: number
          updated_at?: string
          user_allowlist?: string[]
          user_blocklist?: string[]
        }
        Relationships: []
      }
      feriados_nacionais: {
        Row: {
          cidade: string | null
          data: string
          nome: string
          tipo: string
          uf: string | null
        }
        Insert: {
          cidade?: string | null
          data: string
          nome: string
          tipo: string
          uf?: string | null
        }
        Update: {
          cidade?: string | null
          data?: string
          nome?: string
          tipo?: string
          uf?: string | null
        }
        Relationships: []
      }
      flash_questoes: {
        Row: {
          alternativas: Json
          created_at: string | null
          dificuldade: number | null
          fsrs_difficulty: number | null
          fsrs_stability: number | null
          id: string
          next_review: string | null
          questao_texto: string
          resposta_correta: string
          source: string | null
          topico_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alternativas: Json
          created_at?: string | null
          dificuldade?: number | null
          fsrs_difficulty?: number | null
          fsrs_stability?: number | null
          id?: string
          next_review?: string | null
          questao_texto: string
          resposta_correta: string
          source?: string | null
          topico_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alternativas?: Json
          created_at?: string | null
          dificuldade?: number | null
          fsrs_difficulty?: number | null
          fsrs_stability?: number | null
          id?: string
          next_review?: string | null
          questao_texto?: string
          resposta_correta?: string
          source?: string | null
          topico_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_questoes_topico_id_fkey"
            columns: ["topico_id"]
            isOneToOne: false
            referencedRelation: "topicos"
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
      graphql_cache: {
        Row: {
          cache_key: string
          expires_at: string
          payload: Json
        }
        Insert: {
          cache_key: string
          expires_at: string
          payload: Json
        }
        Update: {
          cache_key?: string
          expires_at?: string
          payload?: Json
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
      law_article_reports: {
        Row: {
          created_at: string
          details: string | null
          dispositivo_id: string
          dispositivo_texto: string | null
          dispositivo_tipo: string | null
          id: string
          lei_id: string
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          dispositivo_id: string
          dispositivo_texto?: string | null
          dispositivo_tipo?: string | null
          id?: string
          lei_id: string
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          dispositivo_id?: string
          dispositivo_texto?: string | null
          dispositivo_tipo?: string | null
          id?: string
          lei_id?: string
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
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
      moderation_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          subtopico_id: string | null
          title: string
          topico_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          subtopico_id?: string | null
          title: string
          topico_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          subtopico_id?: string | null
          title?: string
          topico_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_subtopic_id_fkey"
            columns: ["subtopico_id"]
            isOneToOne: false
            referencedRelation: "subtopicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_topic_id_fkey"
            columns: ["topico_id"]
            isOneToOne: false
            referencedRelation: "topicos"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_decisions: {
        Row: {
          action: string
          algorithm_variant: string
          created_at: string
          id: string
          inputs_hash: string | null
          output_summary: Json
          plano_id: string
          reason: string
          triggered_by: string | null
          week_number: number | null
        }
        Insert: {
          action: string
          algorithm_variant?: string
          created_at?: string
          id?: string
          inputs_hash?: string | null
          output_summary: Json
          plano_id: string
          reason: string
          triggered_by?: string | null
          week_number?: number | null
        }
        Update: {
          action?: string
          algorithm_variant?: string
          created_at?: string
          id?: string
          inputs_hash?: string | null
          output_summary?: Json
          plano_id?: string
          reason?: string
          triggered_by?: string | null
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_decisions_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_estudo"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_decisions_2026_05: {
        Row: {
          action: string
          algorithm_variant: string
          created_at: string
          id: string
          inputs_hash: string | null
          output_summary: Json
          plano_id: string
          reason: string
          triggered_by: string | null
          week_number: number | null
        }
        Insert: {
          action: string
          algorithm_variant?: string
          created_at?: string
          id?: string
          inputs_hash?: string | null
          output_summary: Json
          plano_id: string
          reason: string
          triggered_by?: string | null
          week_number?: number | null
        }
        Update: {
          action?: string
          algorithm_variant?: string
          created_at?: string
          id?: string
          inputs_hash?: string | null
          output_summary?: Json
          plano_id?: string
          reason?: string
          triggered_by?: string | null
          week_number?: number | null
        }
        Relationships: []
      }
      plan_decisions_2026_06: {
        Row: {
          action: string
          algorithm_variant: string
          created_at: string
          id: string
          inputs_hash: string | null
          output_summary: Json
          plano_id: string
          reason: string
          triggered_by: string | null
          week_number: number | null
        }
        Insert: {
          action: string
          algorithm_variant?: string
          created_at?: string
          id?: string
          inputs_hash?: string | null
          output_summary: Json
          plano_id: string
          reason: string
          triggered_by?: string | null
          week_number?: number | null
        }
        Update: {
          action?: string
          algorithm_variant?: string
          created_at?: string
          id?: string
          inputs_hash?: string | null
          output_summary?: Json
          plano_id?: string
          reason?: string
          triggered_by?: string | null
          week_number?: number | null
        }
        Relationships: []
      }
      plan_decisions_default: {
        Row: {
          action: string
          algorithm_variant: string
          created_at: string
          id: string
          inputs_hash: string | null
          output_summary: Json
          plano_id: string
          reason: string
          triggered_by: string | null
          week_number: number | null
        }
        Insert: {
          action: string
          algorithm_variant?: string
          created_at?: string
          id?: string
          inputs_hash?: string | null
          output_summary: Json
          plano_id: string
          reason: string
          triggered_by?: string | null
          week_number?: number | null
        }
        Update: {
          action?: string
          algorithm_variant?: string
          created_at?: string
          id?: string
          inputs_hash?: string | null
          output_summary?: Json
          plano_id?: string
          reason?: string
          triggered_by?: string | null
          week_number?: number | null
        }
        Relationships: []
      }
      plan_events: {
        Row: {
          attempts: number
          dead_letter: boolean
          event_type: string
          fired_at: string
          id: string
          payload: Json
          plano_id: string | null
          processed_at: string | null
          sequence_number: number
        }
        Insert: {
          attempts?: number
          dead_letter?: boolean
          event_type: string
          fired_at?: string
          id?: string
          payload: Json
          plano_id?: string | null
          processed_at?: string | null
          sequence_number?: number
        }
        Update: {
          attempts?: number
          dead_letter?: boolean
          event_type?: string
          fired_at?: string
          id?: string
          payload?: Json
          plano_id?: string | null
          processed_at?: string | null
          sequence_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_events_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_estudo"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_events_2026_05: {
        Row: {
          attempts: number
          dead_letter: boolean
          event_type: string
          fired_at: string
          id: string
          payload: Json
          plano_id: string | null
          processed_at: string | null
          sequence_number: number
        }
        Insert: {
          attempts?: number
          dead_letter?: boolean
          event_type: string
          fired_at?: string
          id?: string
          payload: Json
          plano_id?: string | null
          processed_at?: string | null
          sequence_number?: number
        }
        Update: {
          attempts?: number
          dead_letter?: boolean
          event_type?: string
          fired_at?: string
          id?: string
          payload?: Json
          plano_id?: string | null
          processed_at?: string | null
          sequence_number?: number
        }
        Relationships: []
      }
      plan_events_2026_06: {
        Row: {
          attempts: number
          dead_letter: boolean
          event_type: string
          fired_at: string
          id: string
          payload: Json
          plano_id: string | null
          processed_at: string | null
          sequence_number: number
        }
        Insert: {
          attempts?: number
          dead_letter?: boolean
          event_type: string
          fired_at?: string
          id?: string
          payload: Json
          plano_id?: string | null
          processed_at?: string | null
          sequence_number?: number
        }
        Update: {
          attempts?: number
          dead_letter?: boolean
          event_type?: string
          fired_at?: string
          id?: string
          payload?: Json
          plano_id?: string | null
          processed_at?: string | null
          sequence_number?: number
        }
        Relationships: []
      }
      plan_events_default: {
        Row: {
          attempts: number
          dead_letter: boolean
          event_type: string
          fired_at: string
          id: string
          payload: Json
          plano_id: string | null
          processed_at: string | null
          sequence_number: number
        }
        Insert: {
          attempts?: number
          dead_letter?: boolean
          event_type: string
          fired_at?: string
          id?: string
          payload: Json
          plano_id?: string | null
          processed_at?: string | null
          sequence_number?: number
        }
        Update: {
          attempts?: number
          dead_letter?: boolean
          event_type?: string
          fired_at?: string
          id?: string
          payload?: Json
          plano_id?: string | null
          processed_at?: string | null
          sequence_number?: number
        }
        Relationships: []
      }
      plan_templates: {
        Row: {
          cargo_id: number
          config: Json
          created_at: string
          created_by: string | null
          duracao_dias: number
          id: string
          nome: string
          success_rate: number | null
          uses_count: number
          visibility: Database["public"]["Enums"]["plan_template_visibility"]
        }
        Insert: {
          cargo_id: number
          config: Json
          created_at?: string
          created_by?: string | null
          duracao_dias: number
          id?: string
          nome: string
          success_rate?: number | null
          uses_count?: number
          visibility?: Database["public"]["Enums"]["plan_template_visibility"]
        }
        Update: {
          cargo_id?: number
          config?: Json
          created_at?: string
          created_by?: string | null
          duracao_dias?: number
          id?: string
          nome?: string
          success_rate?: number | null
          uses_count?: number
          visibility?: Database["public"]["Enums"]["plan_template_visibility"]
        }
        Relationships: []
      }
      plano_config: {
        Row: {
          block_duration_minutes: number
          created_at: string
          daily_exceptions: Json
          difficulty_weighting: boolean
          fsrs_enabled: boolean
          horario_preferido: Database["public"]["Enums"]["horario_preferido_enum"]
          mix_ratio: Json
          plano_id: string
          simulados_freq: Database["public"]["Enums"]["simulados_freq_enum"]
          tem_redacao: boolean
          tipo_material: Database["public"]["Enums"]["tipo_material_enum"]
          updated_at: string
          weekday_minutes: number
          weekend_minutes: number
        }
        Insert: {
          block_duration_minutes?: number
          created_at?: string
          daily_exceptions?: Json
          difficulty_weighting?: boolean
          fsrs_enabled?: boolean
          horario_preferido?: Database["public"]["Enums"]["horario_preferido_enum"]
          mix_ratio?: Json
          plano_id: string
          simulados_freq?: Database["public"]["Enums"]["simulados_freq_enum"]
          tem_redacao?: boolean
          tipo_material?: Database["public"]["Enums"]["tipo_material_enum"]
          updated_at?: string
          weekday_minutes?: number
          weekend_minutes?: number
        }
        Update: {
          block_duration_minutes?: number
          created_at?: string
          daily_exceptions?: Json
          difficulty_weighting?: boolean
          fsrs_enabled?: boolean
          horario_preferido?: Database["public"]["Enums"]["horario_preferido_enum"]
          mix_ratio?: Json
          plano_id?: string
          simulados_freq?: Database["public"]["Enums"]["simulados_freq_enum"]
          tem_redacao?: boolean
          tipo_material?: Database["public"]["Enums"]["tipo_material_enum"]
          updated_at?: string
          weekday_minutes?: number
          weekend_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "plano_config_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: true
            referencedRelation: "planos_estudo"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_config_history: {
        Row: {
          applied_at: string
          id: string
          plano_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          applied_at?: string
          id?: string
          plano_id: string
          snapshot: Json
          version: number
        }
        Update: {
          applied_at?: string
          id?: string
          plano_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "plano_config_history_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_estudo"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_disciplinas: {
        Row: {
          created_at: string
          disciplina_id: string
          enabled: boolean
          excluded_subtopico_ids: string[]
          id: string
          is_ponto_fraco: boolean
          nivel_conhecimento: Database["public"]["Enums"]["nivel_conhecimento_enum"]
          ordem: number
          peso: number
          plano_id: string
          prioridade: string
        }
        Insert: {
          created_at?: string
          disciplina_id: string
          enabled?: boolean
          excluded_subtopico_ids?: string[]
          id?: string
          is_ponto_fraco?: boolean
          nivel_conhecimento?: Database["public"]["Enums"]["nivel_conhecimento_enum"]
          ordem?: number
          peso?: number
          plano_id: string
          prioridade?: string
        }
        Update: {
          created_at?: string
          disciplina_id?: string
          enabled?: boolean
          excluded_subtopico_ids?: string[]
          id?: string
          is_ponto_fraco?: boolean
          nivel_conhecimento?: Database["public"]["Enums"]["nivel_conhecimento_enum"]
          ordem?: number
          peso?: number
          plano_id?: string
          prioridade?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_disciplinas_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_disciplinas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_estudo"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_predictions_history: {
        Row: {
          computed_at: string
          coverage_pct: number
          id: string
          pace_index: number | null
          plano_id: string
          recommendations: Json | null
          slack_weeks: number | null
          weakest_disciplinas: Json | null
        }
        Insert: {
          computed_at?: string
          coverage_pct: number
          id?: string
          pace_index?: number | null
          plano_id: string
          recommendations?: Json | null
          slack_weeks?: number | null
          weakest_disciplinas?: Json | null
        }
        Update: {
          computed_at?: string
          coverage_pct?: number
          id?: string
          pace_index?: number | null
          plano_id?: string
          recommendations?: Json | null
          slack_weeks?: number | null
          weakest_disciplinas?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "plano_predictions_history_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_estudo"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_estudo: {
        Row: {
          algorithm_variant: string
          cargo_id: number | null
          cargo_snapshot: Json | null
          created_at: string
          data_inicio: string
          data_prova: string
          deleted_at: string | null
          edital_id: number | null
          id: string
          mode: Database["public"]["Enums"]["plano_mode"]
          nome: string
          paused_at: string | null
          status: Database["public"]["Enums"]["plano_status"]
          target_score: number | null
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          algorithm_variant?: string
          cargo_id?: number | null
          cargo_snapshot?: Json | null
          created_at?: string
          data_inicio: string
          data_prova: string
          deleted_at?: string | null
          edital_id?: number | null
          id?: string
          mode?: Database["public"]["Enums"]["plano_mode"]
          nome: string
          paused_at?: string | null
          status?: Database["public"]["Enums"]["plano_status"]
          target_score?: number | null
          template_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          algorithm_variant?: string
          cargo_id?: number | null
          cargo_snapshot?: Json | null
          created_at?: string
          data_inicio?: string
          data_prova?: string
          deleted_at?: string | null
          edital_id?: number | null
          id?: string
          mode?: Database["public"]["Enums"]["plano_mode"]
          nome?: string
          paused_at?: string | null
          status?: Database["public"]["Enums"]["plano_status"]
          target_score?: number | null
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planos_estudo_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "plan_templates"
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
      question_comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          emoji: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          emoji: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          emoji?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_comment_reactions_comment_id_fkey"
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
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content_json: Json
          content_text: string
          created_at?: string
          question_id: number
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content_json?: Json
          content_text?: string
          created_at?: string
          question_id?: number
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      question_reports: {
        Row: {
          assunto: string | null
          created_at: string
          details: string | null
          id: string
          materia: string | null
          question_id: number
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          assunto?: string | null
          created_at?: string
          details?: string | null
          id?: string
          materia?: string | null
          question_id: number
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          assunto?: string | null
          created_at?: string
          details?: string | null
          id?: string
          materia?: string | null
          question_id?: number
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
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
      questoes_log: {
        Row: {
          conceito_confundido: string | null
          correto: boolean
          created_at: string | null
          dificuldade: number | null
          id: string
          questao_id: number | null
          session_id: string | null
          tempo_resposta: number | null
          tipo_erro: string | null
          topico_id: string | null
          user_id: string
        }
        Insert: {
          conceito_confundido?: string | null
          correto: boolean
          created_at?: string | null
          dificuldade?: number | null
          id?: string
          questao_id?: number | null
          session_id?: string | null
          tempo_resposta?: number | null
          tipo_erro?: string | null
          topico_id?: string | null
          user_id: string
        }
        Update: {
          conceito_confundido?: string | null
          correto?: boolean
          created_at?: string | null
          dificuldade?: number | null
          id?: string
          questao_id?: number | null
          session_id?: string | null
          tempo_resposta?: number | null
          tipo_erro?: string | null
          topico_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questoes_log_topico_id_fkey"
            columns: ["topico_id"]
            isOneToOne: false
            referencedRelation: "topicos"
            referencedColumns: ["id"]
          },
        ]
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
      rate_limit_buckets: {
        Row: {
          action: string
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          action: string
          count?: number
          user_id: string
          window_start: string
        }
        Update: {
          action?: string
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      schedule_items: {
        Row: {
          actual_duration_minutes: number | null
          completed_at: string | null
          created_at: string
          disciplina_id: string | null
          estimated_duration_minutes: number
          fsrs_due_date: string | null
          fsrs_state: Json | null
          id: string
          is_anticipated: boolean
          notes: string | null
          parent_item_id: string | null
          performance: Json | null
          plano_id: string
          priority: number
          revision_number: number
          scheduled_date: string
          scheduled_time: string | null
          status: Database["public"]["Enums"]["schedule_item_status"]
          subtopico_id: string | null
          title: string
          topico_id: string | null
          type: Database["public"]["Enums"]["schedule_item_type"]
          unlocked_early: boolean
          updated_at: string
          user_id: string
          version: number
          week_number: number
        }
        Insert: {
          actual_duration_minutes?: number | null
          completed_at?: string | null
          created_at?: string
          disciplina_id?: string | null
          estimated_duration_minutes?: number
          fsrs_due_date?: string | null
          fsrs_state?: Json | null
          id?: string
          is_anticipated?: boolean
          notes?: string | null
          parent_item_id?: string | null
          performance?: Json | null
          plano_id: string
          priority?: number
          revision_number?: number
          scheduled_date: string
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["schedule_item_status"]
          subtopico_id?: string | null
          title: string
          topico_id?: string | null
          type: Database["public"]["Enums"]["schedule_item_type"]
          unlocked_early?: boolean
          updated_at?: string
          user_id: string
          version?: number
          week_number: number
        }
        Update: {
          actual_duration_minutes?: number | null
          completed_at?: string | null
          created_at?: string
          disciplina_id?: string | null
          estimated_duration_minutes?: number
          fsrs_due_date?: string | null
          fsrs_state?: Json | null
          id?: string
          is_anticipated?: boolean
          notes?: string | null
          parent_item_id?: string | null
          performance?: Json | null
          plano_id?: string
          priority?: number
          revision_number?: number
          scheduled_date?: string
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["schedule_item_status"]
          subtopico_id?: string | null
          title?: string
          topico_id?: string | null
          type?: Database["public"]["Enums"]["schedule_item_type"]
          unlocked_early?: boolean
          updated_at?: string
          user_id?: string
          version?: number
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedule_items_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
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
            foreignKeyName: "schedule_items_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_estudo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_subtopico_id_fkey"
            columns: ["subtopico_id"]
            isOneToOne: false
            referencedRelation: "subtopicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_topico_id_fkey"
            columns: ["topico_id"]
            isOneToOne: false
            referencedRelation: "topicos"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          item_id: string | null
          metadata: Json
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          item_id?: string | null
          metadata?: Json
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          item_id?: string | null
          metadata?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_logs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "schedule_items"
            referencedColumns: ["id"]
          },
        ]
      }
      score_snapshots: {
        Row: {
          breakdown: Json | null
          created_at: string | null
          id: string
          pass_probability: number | null
          plano_id: string | null
          score_current: number | null
          score_projected: number | null
          user_id: string
        }
        Insert: {
          breakdown?: Json | null
          created_at?: string | null
          id?: string
          pass_probability?: number | null
          plano_id?: string | null
          score_current?: number | null
          score_projected?: number | null
          user_id: string
        }
        Update: {
          breakdown?: Json | null
          created_at?: string | null
          id?: string
          pass_probability?: number | null
          plano_id?: string | null
          score_current?: number | null
          score_projected?: number | null
          user_id?: string
        }
        Relationships: []
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
      study_sessions: {
        Row: {
          active_minutes: number | null
          activities: Json | null
          created_at: string | null
          cycle: number | null
          ended_at: string | null
          id: string
          planned_minutes: number | null
          plano_id: string | null
          score_after: number | null
          score_before: number | null
          started_at: string
          user_id: string
        }
        Insert: {
          active_minutes?: number | null
          activities?: Json | null
          created_at?: string | null
          cycle?: number | null
          ended_at?: string | null
          id?: string
          planned_minutes?: number | null
          plano_id?: string | null
          score_after?: number | null
          score_before?: number | null
          started_at: string
          user_id: string
        }
        Update: {
          active_minutes?: number | null
          activities?: Json | null
          created_at?: string | null
          cycle?: number | null
          ended_at?: string | null
          id?: string
          planned_minutes?: number | null
          plano_id?: string | null
          score_after?: number | null
          score_before?: number | null
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subtopicos: {
        Row: {
          average_time: number | null
          created_at: string | null
          estimated_duration_minutes: number
          flashcards_vinculados: number | null
          id: string
          last_access: string | null
          nome: string
          questoes_vinculadas: number | null
          resumos_vinculados: number | null
          status: string | null
          tempo: string | null
          tempo_investido: number | null
          topico_id: string
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
          nome: string
          questoes_vinculadas?: number | null
          resumos_vinculados?: number | null
          status?: string | null
          tempo?: string | null
          tempo_investido?: number | null
          topico_id: string
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
          nome?: string
          questoes_vinculadas?: number | null
          resumos_vinculados?: number | null
          status?: string | null
          tempo?: string | null
          tempo_investido?: number | null
          topico_id?: string
          total_aulas?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subtopics_topic_id_fkey"
            columns: ["topico_id"]
            isOneToOne: false
            referencedRelation: "topicos"
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
        Relationships: []
      }
      topicos: {
        Row: {
          ai_decomposed_at: string | null
          completed_at: string | null
          created_at: string | null
          depends_on: string[] | null
          diagnostic_score: number | null
          disciplina_id: string
          discrimination_score: number | null
          estimated_duration_minutes: number
          fsrs_difficulty: number | null
          fsrs_stability: number | null
          id: string
          last_access: string | null
          learning_rate: number | null
          learning_stage: string | null
          leis_lidas: string | null
          marginal_gain: number | null
          mastery_score: number | null
          nome: string
          nome_curto: string | null
          origin_topico_ref: number | null
          peso_edital: number | null
          question_accuracy: number | null
          questions_total: number | null
          questoes_acertos: number | null
          questoes_erros: number | null
          referencias_legais: Json | null
          retention_score: number | null
          source_type: string | null
          speed_avg_seconds: number | null
          tempo_investido: number | null
          teoria_finalizada: boolean | null
          total_aulas: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_decomposed_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          depends_on?: string[] | null
          diagnostic_score?: number | null
          disciplina_id: string
          discrimination_score?: number | null
          estimated_duration_minutes?: number
          fsrs_difficulty?: number | null
          fsrs_stability?: number | null
          id?: string
          last_access?: string | null
          learning_rate?: number | null
          learning_stage?: string | null
          leis_lidas?: string | null
          marginal_gain?: number | null
          mastery_score?: number | null
          nome: string
          nome_curto?: string | null
          origin_topico_ref?: number | null
          peso_edital?: number | null
          question_accuracy?: number | null
          questions_total?: number | null
          questoes_acertos?: number | null
          questoes_erros?: number | null
          referencias_legais?: Json | null
          retention_score?: number | null
          source_type?: string | null
          speed_avg_seconds?: number | null
          tempo_investido?: number | null
          teoria_finalizada?: boolean | null
          total_aulas?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_decomposed_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          depends_on?: string[] | null
          diagnostic_score?: number | null
          disciplina_id?: string
          discrimination_score?: number | null
          estimated_duration_minutes?: number
          fsrs_difficulty?: number | null
          fsrs_stability?: number | null
          id?: string
          last_access?: string | null
          learning_rate?: number | null
          learning_stage?: string | null
          leis_lidas?: string | null
          marginal_gain?: number | null
          mastery_score?: number | null
          nome?: string
          nome_curto?: string | null
          origin_topico_ref?: number | null
          peso_edital?: number | null
          question_accuracy?: number | null
          questions_total?: number | null
          questoes_acertos?: number | null
          questoes_erros?: number | null
          referencias_legais?: Json | null
          retention_score?: number | null
          source_type?: string | null
          speed_avg_seconds?: number | null
          tempo_investido?: number | null
          teoria_finalizada?: boolean | null
          total_aulas?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topics_unit_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          current_value: number
          progress: number
          unlocked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          current_value?: number
          progress?: number
          unlocked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          current_value?: number
          progress?: number
          unlocked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements_catalog"
            referencedColumns: ["id"]
          },
        ]
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
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      user_study_config: {
        Row: {
          avoid_times: string[] | null
          break_duration: number | null
          created_at: string | null
          daily_exceptions: Json | null
          exam_date: string | null
          fsrs_aggressiveness: string | null
          has_exam: boolean | null
          id: string
          interleaving: boolean | null
          max_new_topics_per_day: number | null
          metadata: Json | null
          peak_hours: string[] | null
          preferred_session_duration: number | null
          preferred_times: string[] | null
          questions_per_day: number | null
          revision_style: string | null
          session_duration: number | null
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
          break_duration?: number | null
          created_at?: string | null
          daily_exceptions?: Json | null
          exam_date?: string | null
          fsrs_aggressiveness?: string | null
          has_exam?: boolean | null
          id?: string
          interleaving?: boolean | null
          max_new_topics_per_day?: number | null
          metadata?: Json | null
          peak_hours?: string[] | null
          preferred_session_duration?: number | null
          preferred_times?: string[] | null
          questions_per_day?: number | null
          revision_style?: string | null
          session_duration?: number | null
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
          break_duration?: number | null
          created_at?: string | null
          daily_exceptions?: Json | null
          exam_date?: string | null
          fsrs_aggressiveness?: string | null
          has_exam?: boolean | null
          id?: string
          interleaving?: boolean | null
          max_new_topics_per_day?: number | null
          metadata?: Json | null
          peak_hours?: string[] | null
          preferred_session_duration?: number | null
          preferred_times?: string[] | null
          questions_per_day?: number | null
          revision_style?: string | null
          session_duration?: number | null
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
      weekly_stats: {
        Row: {
          completion_pct: number | null
          desempenho_pct: number | null
          items_completed: number
          items_overdue: number
          items_skipped: number
          items_total: number
          minutes_actual: number
          minutes_estimated: number
          overflow: boolean
          plano_id: string
          questoes_correct: number
          questoes_total: number
          unlocked_early: boolean
          updated_at: string
          week_number: number
        }
        Insert: {
          completion_pct?: number | null
          desempenho_pct?: number | null
          items_completed?: number
          items_overdue?: number
          items_skipped?: number
          items_total?: number
          minutes_actual?: number
          minutes_estimated?: number
          overflow?: boolean
          plano_id: string
          questoes_correct?: number
          questoes_total?: number
          unlocked_early?: boolean
          updated_at?: string
          week_number: number
        }
        Update: {
          completion_pct?: number | null
          desempenho_pct?: number | null
          items_completed?: number
          items_overdue?: number
          items_skipped?: number
          items_total?: number
          minutes_actual?: number
          minutes_estimated?: number
          overflow?: boolean
          plano_id?: string
          questoes_correct?: number
          questoes_total?: number
          unlocked_early?: boolean
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_stats_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_estudo"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      plano_predictions: {
        Row: {
          computed_at: string | null
          coverage_pct: number | null
          id: string | null
          pace_index: number | null
          plano_id: string | null
          recommendations: Json | null
          slack_weeks: number | null
          weakest_disciplinas: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "plano_predictions_history_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_estudo"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      extract_text_from_plate: { Args: { content: Json }; Returns: string }
      gerar_cronograma: { Args: { plano_uuid: string }; Returns: Json }
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
          reaction_counts: Json
          reply_count: number
          reply_to_id: string
          report_count: number
          root_id: string
          upvote_count: number
          user_id: string
          user_reactions: Json
        }[]
      }
      get_daily_capacity: { Args: { intensity_level: string }; Returns: number }
      get_dispositivo_comment_counts: {
        Args: { p_lei_id: string }
        Returns: {
          count: number
          dispositivo_id: string
        }[]
      }
      get_dispositivo_comments_with_votes: {
        Args: { p_dispositivo_id: string; p_lei_id: string; p_user_id: string }
        Returns: {
          author_avatar_url: string
          author_email: string
          author_name: string
          content_json: Json
          content_text: string
          created_at: string
          dispositivo_id: string
          edit_count: number
          has_upvoted: boolean
          id: string
          is_author_shadowbanned: boolean
          is_deleted: boolean
          is_endorsed: boolean
          is_pinned: boolean
          last_edited_at: string
          lei_id: string
          quoted_text: string
          reaction_counts: Json
          reply_count: number
          reply_to_id: string
          root_id: string
          updated_at: string
          upvote_count: number
          user_id: string
          user_reactions: Json
        }[]
      }
      get_dispositivo_likes: {
        Args: { p_lei_id: string; p_user_id: string }
        Returns: {
          dispositivo_id: string
        }[]
      }
      get_dispositivo_note_flags: {
        Args: { p_lei_id: string; p_user_id: string }
        Returns: {
          dispositivo_id: string
        }[]
      }
      get_hard_limit_capacity: {
        Args: { intensity_level: string }
        Returns: number
      }
      get_moderation_log: {
        Args: { p_limit?: number; p_target_id?: string; p_target_type?: string }
        Returns: {
          action: string
          actor_email: string
          actor_id: string
          actor_name: string
          created_at: string
          details: Json
          id: string
          target_id: string
          target_type: string
        }[]
      }
      get_moderation_stats: {
        Args: { p_days?: number }
        Returns: {
          active_bans: number
          avg_resolution_time_hours: number
          pending_reports: number
          resolved_reports_period: number
        }[]
      }
      get_moderation_users: {
        Args: never
        Returns: {
          avatar_url: string
          banned_by: string
          comment_count: number
          created_at: string
          email: string
          is_shadowbanned: boolean
          last_sign_in_at: string
          name: string
          report_count_made: number
          report_count_received: number
          role: string
          timeout_reason: string
          timeout_until: string
          user_id: string
        }[]
      }
      get_or_create_user_study_config: {
        Args: { p_user_id: string }
        Returns: {
          avoid_times: string[] | null
          break_duration: number | null
          created_at: string | null
          daily_exceptions: Json | null
          exam_date: string | null
          fsrs_aggressiveness: string | null
          has_exam: boolean | null
          id: string
          interleaving: boolean | null
          max_new_topics_per_day: number | null
          metadata: Json | null
          peak_hours: string[] | null
          preferred_session_duration: number | null
          preferred_times: string[] | null
          questions_per_day: number | null
          revision_style: string | null
          session_duration: number | null
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
      get_pending_report_counts: {
        Args: { p_comment_ids: string[] }
        Returns: {
          comment_id: string
          pending_count: number
        }[]
      }
      get_report_analytics: { Args: { p_days?: number }; Returns: Json }
      get_reports_paginated: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: {
          comment_author_email: string
          comment_author_name: string
          comment_content_json: Json
          comment_content_text: string
          comment_id: string
          comment_question_id: number
          created_at: string
          id: string
          reason: string
          report_count_by_reporter: number
          reporter_email: string
          reporter_id: string
          reporter_name: string
          resolved_at: string
          resolved_by: string
          status: string
          total_count: number
        }[]
      }
      get_reports_with_context: {
        Args: { p_status?: string }
        Returns: {
          comment_author_email: string
          comment_author_name: string
          comment_content_json: Json
          comment_content_text: string
          comment_id: string
          comment_question_id: number
          created_at: string
          id: string
          reason: string
          report_count_by_reporter: number
          reporter_email: string
          reporter_id: string
          reporter_name: string
          resolved_at: string
          resolved_by: string
          status: string
        }[]
      }
      get_user_role: { Args: { p_user_id: string }; Returns: string }
      handle_dispositivo_soft_delete: {
        Args: { p_comment_id: string }
        Returns: undefined
      }
      handle_soft_delete: {
        Args: { p_comment_id: string; p_user_id: string }
        Returns: Json
      }
      immutable_unaccent: { Args: { "": string }; Returns: string }
      is_feature_enabled: {
        Args: { p_flag_name: string; p_user_id: string }
        Returns: boolean
      }
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
      toggle_dispositivo_comment_reaction: {
        Args: { p_comment_id: string; p_emoji: string }
        Returns: string
      }
      toggle_dispositivo_comment_upvote: {
        Args: { p_comment_id: string }
        Returns: string
      }
      toggle_dispositivo_like: {
        Args: { p_dispositivo_id: string; p_lei_id: string }
        Returns: string
      }
      toggle_reaction: {
        Args: { p_comment_id: string; p_emoji: string; p_user_id: string }
        Returns: Json
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
      horario_preferido_enum:
        | "manha"
        | "tarde"
        | "noite"
        | "madrugada"
        | "flexivel"
      nivel_conhecimento_enum: "iniciante" | "intermediario" | "avancado"
      plan_template_visibility: "publico" | "privado" | "oficial"
      plano_mode: "edital" | "continuo" | "misto"
      plano_status: "rascunho" | "ativo" | "pausado" | "concluido" | "arquivado"
      schedule_item_status:
        | "pendente"
        | "em_andamento"
        | "concluido"
        | "pulado"
        | "cancelado"
        | "reagendado"
      schedule_item_type:
        | "estudo_inicial_p1"
        | "estudo_inicial_p2"
        | "revisao"
        | "questoes"
        | "flashcards"
        | "simulado"
        | "lei_seca"
      simulados_freq_enum: "nenhum" | "mensal" | "quinzenal" | "semanal"
      tipo_material_enum: "video" | "pdf" | "livro" | "questoes" | "misto"
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
    Enums: {
      horario_preferido_enum: [
        "manha",
        "tarde",
        "noite",
        "madrugada",
        "flexivel",
      ],
      nivel_conhecimento_enum: ["iniciante", "intermediario", "avancado"],
      plan_template_visibility: ["publico", "privado", "oficial"],
      plano_mode: ["edital", "continuo", "misto"],
      plano_status: ["rascunho", "ativo", "pausado", "concluido", "arquivado"],
      schedule_item_status: [
        "pendente",
        "em_andamento",
        "concluido",
        "pulado",
        "cancelado",
        "reagendado",
      ],
      schedule_item_type: [
        "estudo_inicial_p1",
        "estudo_inicial_p2",
        "revisao",
        "questoes",
        "flashcards",
        "simulado",
        "lei_seca",
      ],
      simulados_freq_enum: ["nenhum", "mensal", "quinzenal", "semanal"],
      tipo_material_enum: ["video", "pdf", "livro", "questoes", "misto"],
    },
  },
} as const
