export type Database = {
  public: {
    Tables: {
      deck_drafts: {
        Row: {
          id: string;
          deck_id: string | null;
          user_id: string;
          blocks_data: any; // JSON data
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          deck_id?: string | null;
          user_id: string;
          blocks_data: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          deck_id?: string | null;
          user_id?: string;
          blocks_data?: any;
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

