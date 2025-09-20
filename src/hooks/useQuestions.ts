import { useState, useEffect } from 'react';
import { SectionQuestions, Question } from '@/types/questions';

// Mock data para testes - depois será integrado com Supabase
const MOCK_QUESTIONS: SectionQuestions[] = [
  {
    sectionId: 'section-0',
    sectionTitle: 'Brasil',
    sectionIndex: 0,
    questions: [
      {
        id: 'q1',
        type: 'multiple',
        question: 'Qual é a capital do Brasil?',
        options: ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador'],
        correctAnswer: 2,
        explanation: 'Brasília é a capital federal do Brasil desde 1960.',
        points: 10
      },
      {
        id: 'q2',
        type: 'boolean',
        question: 'O Brasil é o maior país da América do Sul?',
        correctAnswer: true,
        explanation: 'Sim, o Brasil ocupa cerca de 47% do território sul-americano.',
        points: 5
      }
    ]
  },
  {
    sectionId: 'section-1',
    sectionTitle: 'Segundo',
    sectionIndex: 1,
    questions: [
      {
        id: 'q3',
        type: 'text',
        question: 'Qual é o maior rio do Brasil?',
        correctAnswer: 'Amazonas',
        explanation: 'O Rio Amazonas é o maior rio do Brasil e do mundo em volume de água.',
        points: 15
      }
    ]
  }
];

export function useQuestions(documentId?: string) {
  const [questions, setQuestions] = useState<SectionQuestions[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar perguntas (mock por enquanto)
  useEffect(() => {
    const loadQuestions = async () => {
      setLoading(true);
      try {
        // Simular delay de API
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Por enquanto, usar dados mock
        setQuestions(MOCK_QUESTIONS);
        setError(null);
      } catch (err) {
        setError('Erro ao carregar perguntas');
        console.error('Erro ao carregar perguntas:', err);
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, [documentId]);

  // Buscar perguntas de uma seção específica
  const getQuestionsForSection = (sectionIndex: number): SectionQuestions | null => {
    const result = questions.find(q => q.sectionIndex === sectionIndex) || null;
    console.log('🔍 getQuestionsForSection:', sectionIndex, 'resultado:', result);
    console.log('📊 Todas as perguntas disponíveis:', questions);
    return result;
  };

  // Adicionar pergunta a uma seção
  const addQuestionToSection = async (sectionIndex: number, sectionTitle: string, question: Omit<Question, 'id'>): Promise<void> => {
    try {
      const newQuestion: Question = {
        ...question,
        id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      console.log('➕ Adicionando pergunta à seção:', sectionIndex, 'título:', sectionTitle);
      console.log('📝 Pergunta:', newQuestion);

      setQuestions(prev => {
        console.log('📊 Estado anterior de perguntas:', prev);
        const existingSectionIndex = prev.findIndex(s => s.sectionIndex === sectionIndex);
        
        if (existingSectionIndex >= 0) {
          // Seção já existe, adicionar pergunta
          const updated = [...prev];
          updated[existingSectionIndex] = {
            ...updated[existingSectionIndex],
            questions: [...updated[existingSectionIndex].questions, newQuestion],
            updatedAt: new Date().toISOString()
          };
          console.log('🔄 Seção existente atualizada:', updated[existingSectionIndex]);
          return updated;
        } else {
          // Criar nova seção
          const newSection: SectionQuestions = {
            sectionId: `section-${sectionIndex}`,
            sectionTitle,
            sectionIndex,
            questions: [newQuestion],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          const result = [...prev, newSection].sort((a, b) => a.sectionIndex - b.sectionIndex);
          console.log('🆕 Nova seção criada:', newSection);
          console.log('📊 Estado final:', result);
          return result;
        }
      });

      console.log('✅ Pergunta adicionada:', newQuestion);
    } catch (err) {
      setError('Erro ao adicionar pergunta');
      console.error('Erro ao adicionar pergunta:', err);
      throw err;
    }
  };

  // Remover pergunta
  const removeQuestion = async (sectionIndex: number, questionId: string): Promise<void> => {
    try {
      setQuestions(prev => {
        return prev.map(section => {
          if (section.sectionIndex === sectionIndex) {
            return {
              ...section,
              questions: section.questions.filter(q => q.id !== questionId),
              updatedAt: new Date().toISOString()
            };
          }
          return section;
        }).filter(section => section.questions.length > 0); // Remove seções vazias
      });

      console.log('🗑️ Pergunta removida:', questionId);
    } catch (err) {
      setError('Erro ao remover pergunta');
      console.error('Erro ao remover pergunta:', err);
      throw err;
    }
  };

  // Atualizar pergunta
  const updateQuestion = async (sectionIndex: number, questionId: string, updates: Partial<Question>): Promise<void> => {
    try {
      setQuestions(prev => {
        return prev.map(section => {
          if (section.sectionIndex === sectionIndex) {
            return {
              ...section,
              questions: section.questions.map(q => 
                q.id === questionId ? { ...q, ...updates } : q
              ),
              updatedAt: new Date().toISOString()
            };
          }
          return section;
        });
      });

      console.log('📝 Pergunta atualizada:', questionId, updates);
    } catch (err) {
      setError('Erro ao atualizar pergunta');
      console.error('Erro ao atualizar pergunta:', err);
      throw err;
    }
  };

  // Verificar se uma seção tem perguntas
  const hasQuestions = (sectionIndex: number): boolean => {
    const section = getQuestionsForSection(sectionIndex);
    return section !== null && section.questions.length > 0;
  };

  // Obter estatísticas
  const getStats = () => {
    const totalSections = questions.length;
    const totalQuestions = questions.reduce((sum, section) => sum + section.questions.length, 0);
    const sectionsWithQuestions = questions.filter(section => section.questions.length > 0).length;

    return {
      totalSections,
      totalQuestions,
      sectionsWithQuestions,
      averageQuestionsPerSection: totalSections > 0 ? totalQuestions / totalSections : 0
    };
  };

  return {
    questions,
    loading,
    error,
    getQuestionsForSection,
    addQuestionToSection,
    removeQuestion,
    updateQuestion,
    hasQuestions,
    getStats
  };
}
