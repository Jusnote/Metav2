import { FSRS, Rating, State, Card, generatorParameters, RecordLogItem } from 'ts-fsrs';
import { Flashcard } from '../types/flashcard';

const params = generatorParameters();
const fsrs = new FSRS(params);

export class FSRSSpacedRepetition {
  static calculateNextReview(
    card: Flashcard,
    rating: Rating
  ): {
    difficulty: number;
    stability: number;
    state: State;
    due: Date;
    last_review: Date;
    review_count: number;
  } {
    const now = new Date();
    
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


