export type Database = {
  public: {
    Tables: {
      deck_drafts: {
        Row: {
          id: string;
          deck_id: string | null;
          user_id: string;
          blocks_data: Record<string, unknown>; // JSON data
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          deck_id?: string | null;
          user_id: string;
          blocks_data: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          deck_id?: string | null;
          user_id?: string;
          blocks_data?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
      };
      questoes: {
        Row: {
          id: string;
          user_id: string;
          titulo: string;
          enunciado: string;
          disciplina: string | null;
          assunto: string | null;
          banca: string | null;
          ano: number | null;
          cargo: string | null;
          modalidade: 'multipla_escolha' | 'verdadeiro_falso' | 'dissertativa' | null;
          dificuldade: 'Fácil' | 'Médio' | 'Difícil' | null;
          nivel: 'Fácil' | 'Médio' | 'Difícil' | null;
          tipo: 'multipla_escolha' | 'verdadeiro_falso' | 'dissertativa';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          titulo: string;
          enunciado: string;
          disciplina?: string | null;
          assunto?: string | null;
          banca?: string | null;
          ano?: number | null;
          cargo?: string | null;
          modalidade?: 'multipla_escolha' | 'verdadeiro_falso' | 'dissertativa' | null;
          dificuldade?: 'Fácil' | 'Médio' | 'Difícil' | null;
          nivel?: 'Fácil' | 'Médio' | 'Difícil' | null;
          tipo?: 'multipla_escolha' | 'verdadeiro_falso' | 'dissertativa';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          titulo?: string;
          enunciado?: string;
          disciplina?: string | null;
          assunto?: string | null;
          banca?: string | null;
          ano?: number | null;
          cargo?: string | null;
          modalidade?: 'multipla_escolha' | 'verdadeiro_falso' | 'dissertativa' | null;
          dificuldade?: 'Fácil' | 'Médio' | 'Difícil' | null;
          nivel?: 'Fácil' | 'Médio' | 'Difícil' | null;
          tipo?: 'multipla_escolha' | 'verdadeiro_falso' | 'dissertativa';
          created_at?: string;
          updated_at?: string;
        };
      };
      alternativas: {
        Row: {
          id: string;
          questao_id: string;
          letra: 'A' | 'B' | 'C' | 'D' | 'E';
          texto: string;
          correta: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          questao_id: string;
          letra: 'A' | 'B' | 'C' | 'D' | 'E';
          texto: string;
          correta?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          questao_id?: string;
          letra?: 'A' | 'B' | 'C' | 'D' | 'E';
          texto?: string;
          correta?: boolean;
          created_at?: string;
        };
      };
      units: {
        Row: {
          id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      topics: {
        Row: {
          id: string;
          unit_id: string;
          title: string;
          created_at: string;
          updated_at: string;
          last_access: string;
        };
        Insert: {
          id?: string;
          unit_id: string;
          title: string;
          created_at?: string;
          updated_at?: string;
          last_access?: string;
        };
        Update: {
          id?: string;
          unit_id?: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
          last_access?: string;
        };
      };
      subtopics: {
        Row: {
          id: string;
          topic_id: string;
          title: string;
          average_time: number;
          created_at: string;
          updated_at: string;
          last_access: string;
        };
        Insert: {
          id?: string;
          topic_id: string;
          title: string;
          average_time?: number;
          created_at?: string;
          updated_at?: string;
          last_access?: string;
        };
        Update: {
          id?: string;
          topic_id?: string;
          title?: string;
          average_time?: number;
          created_at?: string;
          updated_at?: string;
          last_access?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          content: any;
          content_text: string | null;
          created_at: string;
          updated_at: string;
          is_favorite: boolean;
          tags: string[];
          subtopic_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          content: any;
          content_text?: string | null;
          created_at?: string;
          updated_at?: string;
          is_favorite?: boolean;
          tags?: string[];
          subtopic_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          content?: any;
          content_text?: string | null;
          created_at?: string;
          updated_at?: string;
          is_favorite?: boolean;
          tags?: string[];
          subtopic_id?: string | null;
        };
      };
      quick_notes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          content: any; // BlockNote JSON structure
          created_at: string;
          updated_at: string;
          flashcard_id?: string; // ID do flashcard vinculado (se houver)
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          content: any;
          created_at?: string;
          updated_at?: string;
          flashcard_id?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          content?: any;
          created_at?: string;
          updated_at?: string;
          flashcard_id?: string;
        };
      };
      flashcards: {
        Row: {
          id: string;
          user_id: string;
          deck_name: string;
          title: string;
          front: any; // BlockNote JSON structure
          back: any; // BlockNote JSON structure
          last_reviewed: string | null;
          next_review: string;
          interval_days: number;
          ease_factor: number;
          repetitions: number;
          difficulty: 'easy' | 'medium' | 'hard' | 'again';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          deck_name?: string;
          title?: string;
          front: any;
          back: any;
          last_reviewed?: string | null;
          next_review?: string;
          interval_days?: number;
          ease_factor?: number;
          repetitions?: number;
          difficulty?: 'easy' | 'medium' | 'hard' | 'again';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          deck_name?: string;
          title?: string;
          front?: any;
          back?: any;
          last_reviewed?: string | null;
          next_review?: string;
          interval_days?: number;
          ease_factor?: number;
          repetitions?: number;
          difficulty?: 'easy' | 'medium' | 'hard' | 'again';
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
};

export type Questao = Database['public']['Tables']['questoes']['Row'];
export type QuestaoInsert = Database['public']['Tables']['questoes']['Insert'];
export type QuestaoUpdate = Database['public']['Tables']['questoes']['Update'];

export type Alternativa = Database['public']['Tables']['alternativas']['Row'];
export type AlternativaInsert = Database['public']['Tables']['alternativas']['Insert'];
export type AlternativaUpdate = Database['public']['Tables']['alternativas']['Update'];

// Adicionar tipos para deck_drafts
export type DeckDraft = Database['public']['Tables']['deck_drafts']['Row'];
export type DeckDraftInsert = Database['public']['Tables']['deck_drafts']['Insert'];
export type DeckDraftUpdate = Database['public']['Tables']['deck_drafts']['Update'];

export type Unit = Database['public']['Tables']['units']['Row'];
export type UnitInsert = Database['public']['Tables']['units']['Insert'];
export type UnitUpdate = Database['public']['Tables']['units']['Update'];

export type Topic = Database['public']['Tables']['topics']['Row'];
export type TopicInsert = Database['public']['Tables']['topics']['Insert'];
export type TopicUpdate = Database['public']['Tables']['topics']['Update'];

export type Subtopic = Database['public']['Tables']['subtopics']['Row'];
export type SubtopicInsert = Database['public']['Tables']['subtopics']['Insert'];
export type SubtopicUpdate = Database['public']['Tables']['subtopics']['Update'];

export type Document = Database['public']['Tables']['documents']['Row'];
export type DocumentInsert = Database['public']['Tables']['documents']['Insert'];
export type DocumentUpdate = Database['public']['Tables']['documents']['Update'];

export type QuickNote = Database['public']['Tables']['quick_notes']['Row'];
export type QuickNoteInsert = Database['public']['Tables']['quick_notes']['Insert'];
export type QuickNoteUpdate = Database['public']['Tables']['quick_notes']['Update'];

export type BlockNoteFlashcard = Database['public']['Tables']['flashcards']['Row'];
export type BlockNoteFlashcardInsert = Database['public']['Tables']['flashcards']['Insert'];
export type BlockNoteFlashcardUpdate = Database['public']['Tables']['flashcards']['Update'];

