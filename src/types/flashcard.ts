import { State, Rating } from 'ts-fsrs';

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  deckId: string;
  created: Date;
  lastReviewed?: Date;
  nextReview: Date; // This will be `due` from FSRS
  
  // FSRS fields
  difficulty: number; // double precision
  stability: number; // double precision
  state: State; // integer (0=new, 1=learning, 2=review, 3=relearning)
  due: Date; // timestamp
  last_review?: Date; // timestamp
  review_count: number; // integer

  type: 'traditional' | 'word-hiding' | 'true-false'; // Tipo do flashcard
  hiddenWordIndices?: number[]; // Índices das palavras ocultadas (para word-hiding)
  hiddenWords?: string[]; // Palavras ocultadas (novo método com sintaxe {{ }})
  explanation?: string; // Explicação opcional (para flashcards true-false)
  
  // Hierarchy fields
  parentId?: string; // ID of parent flashcard
  childIds: string[]; // IDs of child flashcards
  level: number; // 0 = root, 1 = first level child, etc.
  order: number; // Order among siblings
}

export interface Deck {
  id: string;
  name: string;
  description?: string;
  created: Date;
  cardCount: number;
  color: string;
}

export interface StudySession {
  id: string;
  deckId: string;
  started: Date;
  ended?: Date;
  cardsStudied: number;
  accuracy: number;
}

export type StudyDifficulty = 'again' | 'hard' | 'medium' | 'easy';

// Helper function to convert StudyDifficulty to FSRS Rating
export function studyDifficultyToRating(difficulty: StudyDifficulty): Rating {
  switch (difficulty) {
    case 'again':
      return Rating.Again;
    case 'hard':
      return Rating.Hard;
    case 'medium':
      return Rating.Good;
    case 'easy':
      return Rating.Easy;
    default:
      return Rating.Good;
  }
}


