/**
 * Tipos para o sistema de perguntas do estudo dirigido
 */

export type QuestionType = 'multiple' | 'boolean' | 'text';

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[]; // Para múltipla escolha
  correctAnswer: string | number | boolean;
  explanation?: string;
  points?: number; // Pontuação da questão
}

export interface SectionQuestions {
  sectionId: string; // ID da seção H1
  sectionTitle: string; // Título da seção H1
  sectionIndex: number; // Índice da seção (0, 1, 2...)
  questions: Question[];
  createdAt?: string;
  updatedAt?: string;
}

export interface QuestionResponse {
  questionId: string;
  userAnswer: string | number | boolean;
  isCorrect: boolean;
  timeSpent?: number; // Tempo em segundos
  attempts?: number; // Número de tentativas
}

export interface StudySession {
  sessionId: string;
  documentId: string;
  userId?: string;
  startedAt: string;
  completedAt?: string;
  sectionResponses: {
    sectionId: string;
    responses: QuestionResponse[];
    completedAt: string;
  }[];
  totalScore?: number;
  totalQuestions?: number;
}

// Configurações do sistema de perguntas
export interface QuestionSettings {
  allowSkip: boolean; // Permitir pular perguntas
  showExplanation: boolean; // Mostrar explicação após resposta
  allowRetry: boolean; // Permitir tentar novamente
  maxAttempts: number; // Máximo de tentativas por pergunta
  timeLimit?: number; // Limite de tempo por pergunta (segundos)
  shuffleQuestions: boolean; // Embaralhar ordem das perguntas
  shuffleOptions: boolean; // Embaralhar opções de múltipla escolha
}

