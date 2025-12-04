import { FSRS, Rating, State, Card, RecordLogItem } from 'ts-fsrs';
import { Flashcard } from '../types/flashcard';
import { getFSRSParameters, FSRSAggressiveness } from './fsrs-config';
import { supabase } from '@/integrations/supabase/client';

/**
 * FSRS Spaced Repetition System
 *
 * Utiliza configuração global do usuário (user_study_config.fsrs_aggressiveness)
 * para calcular revisões de flashcards avulsos.
 */
export class FSRSSpacedRepetition {
  /**
   * Busca configuração FSRS do usuário
   * Se não houver, retorna 'balanced' como padrão
   */
  private static async getUserAggressiveness(): Promise<FSRSAggressiveness> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 'balanced';

      const { data } = await supabase
        .from('user_study_config')
        .select('fsrs_aggressiveness')
        .eq('user_id', user.id)
        .single();

      return (data?.fsrs_aggressiveness as FSRSAggressiveness) || 'balanced';
    } catch (error) {
      console.error('Error fetching FSRS aggressiveness:', error);
      return 'balanced'; // Fallback
    }
  }

  /**
   * Cria instância FSRS com configuração do usuário
   */
  private static async createFSRSInstance(): Promise<FSRS> {
    const aggressiveness = await this.getUserAggressiveness();
    const params = getFSRSParameters(aggressiveness);
    return new FSRS(params);
  }

  static async calculateNextReview(
    card: Flashcard,
    rating: Rating
  ): Promise<{
    difficulty: number;
    stability: number;
    state: State;
    due: Date;
    last_review: Date;
    review_count: number;
  }> {
    const now = new Date();

    // Criar instância FSRS com configuração do usuário
    const fsrs = await this.createFSRSInstance();

    // Convert Flashcard to FSRS Card format
    const fsrsCard: Card = {
      due: card.due || now,
      stability: card.stability || 0,
      difficulty: card.difficulty || 0,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: card.review_count || 0,
      lapses: 0,
      state: card.state || State.New,
      last_review: card.last_review || now,
      learning_steps: 0
    };

    const scheduling_cards = fsrs.repeat(fsrsCard, now);

    // Get the scheduled card for the given rating
    const recordLogItem = scheduling_cards[rating as keyof typeof scheduling_cards] as RecordLogItem;
    
    if (!recordLogItem || !recordLogItem.card) {
      throw new Error(`No scheduled card found for rating: ${rating}`);
    }

    return {
      difficulty: recordLogItem.card.difficulty,
      stability: recordLogItem.card.stability,
      state: recordLogItem.card.state,
      due: recordLogItem.card.due,
      last_review: now,
      review_count: (card.review_count || 0) + 1,
    };
  }

  static getNextReviewDate(due: Date): Date {
    return due;
  }

  static isDue(card: Flashcard): boolean {
    return new Date() >= (card.due || card.nextReview);
  }

  static getDueCards(cards: Flashcard[]): Flashcard[] {
    return cards.filter(card => this.isDue(card));
  }
}


