import { FSRS, Rating, State, Card } from 'ts-fsrs';
import { Flashcard } from '@/types/flashcard';

const fsrs = new FSRS({});

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
    
    // Create FSRS Card object from our Flashcard
    const fsrsCard: Card = {
      due: card.due || now,
      stability: card.stability || 0,
      difficulty: card.difficulty || 0,
      elapsed_days: card.last_review ? Math.floor((now.getTime() - card.last_review.getTime()) / (1000 * 60 * 60 * 24)) : 0,
      scheduled_days: 0,
      reps: card.review_count || 0,
      lapses: 0,
      state: card.state || State.New,
      last_review: card.last_review || now,
      learning_steps: []
    };

    let scheduling_cards;

    if (fsrsCard.state === State.New) {
      scheduling_cards = fsrs.repeat(fsrsCard, now);
    } else {
      scheduling_cards = fsrs.repeat(fsrsCard, now);
    }

    const scheduledCard = scheduling_cards[rating];

    return {
      difficulty: scheduledCard.card.difficulty,
      stability: scheduledCard.card.stability,
      state: scheduledCard.card.state,
      due: scheduledCard.card.due,
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


