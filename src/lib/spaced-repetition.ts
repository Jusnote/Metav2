import { Flashcard, StudyDifficulty } from '../types/flashcard';

/**
 * SuperMemo 2 algorithm implementation for spaced repetition
 */
export class SpacedRepetition {
  static calculateNextReview(
    card: Flashcard,
    difficulty: StudyDifficulty
  ): { interval: number; easeFactor: number; repetitions: number } {
    // Use FSRS properties instead of legacy SM2 properties
    let interval = Math.max(1, Math.round(card.stability)); // Use stability as interval
    let easeFactor = Math.max(1.3, 2.5 - (card.difficulty / 10)); // Convert difficulty to ease factor
    let repetitions = card.review_count;
    
    // Map difficulty to quality factor (0-5 scale)
    const qualityMap: Record<StudyDifficulty, number> = {
      again: 0,   // Complete blackout
      hard: 3,    // Correct response but serious difficulty
      medium: 4,  // Correct response with hesitation
      easy: 5     // Perfect response
    };
    
    const quality = qualityMap[difficulty];
    
    // If quality < 3, reset repetitions and interval
    if (quality < 3) {
      repetitions = 0;
      interval = 1;
    } else {
      // Update ease factor
      easeFactor = Math.max(
        1.3,
        easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
      );
      
      // Calculate new interval
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      
      repetitions++;
    }
    
    return { interval, easeFactor, repetitions };
  }
  
  static getNextReviewDate(intervalDays: number): Date {
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + intervalDays);
    return nextReview;
  }
  
  static isDue(card: Flashcard): boolean {
    return new Date() >= card.nextReview;
  }
  
  static getDueCards(cards: Flashcard[]): Flashcard[] {
    return cards.filter(card => this.isDue(card));
  }
}