import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SectionQuestions, Question } from '@/types/questions';
import * as studyQuestionsService from '@/services/studyQuestionsService';

// Mock data para testes - depois será integrado com Supabase
const INITIAL_MOCK_QUESTIONS: SectionQuestions[] = [
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

interface QuestionsContextType {
  questions: SectionQuestions[];
  loading: boolean;
  error: string | null;
  documentId: string;
  setDocumentId: (id: string) => void;
  getQuestionsForSection: (sectionIndex: number) => SectionQuestions | null;
  addQuestionToSection: (sectionIndex: number, sectionTitle: string, question: Omit<Question, 'id'>) => Promise<void>;
  removeQuestion: (sectionIndex: number, questionId: string) => Promise<void>;
  updateQuestion: (sectionIndex: number, questionId: string, updates: Partial<Question>) => Promise<void>;
  hasQuestions: (sectionIndex: number) => boolean;
  getStats: () => {
    totalSections: number;
    totalQuestions: number;
    sectionsWithQuestions: number;
    averageQuestionsPerSection: number;
  };
  replaceQuestionsForSection: (sectionIndex: number, sectionTitle: string, newQuestions: Question[]) => Promise<void>;
  refreshQuestions: () => Promise<void>;
}

const QuestionsContext = createContext<QuestionsContextType | undefined>(undefined);

interface QuestionsProviderProps {
  children: ReactNode;
  documentId?: string | null;
}

export function QuestionsProvider({ children, documentId: propDocumentId }: QuestionsProviderProps) {
  const [questions, setQuestions] = useState<SectionQuestions[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string>(propDocumentId || 'default-document');

  // Função para carregar perguntas do Supabase
  const loadQuestions = async () => {
    if (!documentId) return;
    
    setLoading(true);
    try {
      console.log('🔄 Carregando perguntas do Supabase para documento:', documentId);
      const loadedQuestions = await studyQuestionsService.getQuestionsForDocument(documentId);
      setQuestions(loadedQuestions);
      setError(null);
      console.log('✅ Perguntas carregadas do Supabase:', loadedQuestions.length, 'seções');
    } catch (err) {
      console.error('❌ Erro ao carregar perguntas do Supabase:', err);
      // Fallback para dados mock em caso de erro
      console.log('🔄 Usando dados mock como fallback');
      setQuestions(INITIAL_MOCK_QUESTIONS);
      setError('Erro ao carregar perguntas do banco. Usando dados de exemplo.');
    } finally {
      setLoading(false);
    }
  };

  // Sincronizar com prop documentId
  useEffect(() => {
    if (propDocumentId && propDocumentId !== documentId) {
      console.log('📄 [CONTEXT] Atualizando documentId:', documentId, '->', propDocumentId);
      setDocumentId(propDocumentId);
    }
  }, [propDocumentId, documentId]);

  // Carregar perguntas quando o documento mudar
  useEffect(() => {
    if (documentId && documentId !== 'default-document') {
      console.log('🔄 [CONTEXT] Carregando perguntas para documento:', documentId);
      loadQuestions();
    }
  }, [documentId]);

  // Função para atualizar o document ID
  const handleSetDocumentId = (id: string) => {
    console.log('📄 Mudando document ID:', documentId, '->', id);
    setDocumentId(id);
  };

  // Função para recarregar perguntas
  const refreshQuestions = async () => {
    await loadQuestions();
  };

  // Buscar perguntas de uma seção específica
  const getQuestionsForSection = (sectionIndex: number): SectionQuestions | null => {
    const result = questions.find(q => q.sectionIndex === sectionIndex) || null;
    console.log('🔍 [CONTEXT] getQuestionsForSection:', sectionIndex, 'resultado:', result);
    return result;
  };

  // Substituir todas as perguntas de uma seção (usado pelo QuestionManagerSimple)
  const replaceQuestionsForSection = async (sectionIndex: number, sectionTitle: string, newQuestions: Question[]): Promise<void> => {
    try {
      console.log('🔄 [CONTEXT] Substituindo perguntas da seção no Supabase:', sectionIndex, 'novas perguntas:', newQuestions.length);
      
      // Usar o serviço do Supabase
      const updatedSection = await studyQuestionsService.replaceQuestionsForSection(
        documentId,
        sectionIndex,
        sectionTitle,
        newQuestions
      );
      
      // Atualizar estado local
      setQuestions(prev => {
        const existingSectionIndex = prev.findIndex(s => s.sectionIndex === sectionIndex);
        
        if (!updatedSection) {
          // Se não há perguntas, remover a seção
          if (existingSectionIndex >= 0) {
            return prev.filter((_, i) => i !== existingSectionIndex);
          }
          return prev;
        }
        
        if (existingSectionIndex >= 0) {
          // Substituir seção existente
          const updated = [...prev];
          updated[existingSectionIndex] = updatedSection;
          console.log('🔄 [CONTEXT] Seção substituída no estado local:', updatedSection);
          return updated;
        } else {
          // Criar nova seção
          const result = [...prev, updatedSection].sort((a, b) => a.sectionIndex - b.sectionIndex);
          console.log('🆕 [CONTEXT] Nova seção criada no estado local:', updatedSection);
          return result;
        }
      });
      
      console.log('✅ [CONTEXT] Perguntas substituídas com sucesso no Supabase');
    } catch (err) {
      setError('Erro ao substituir perguntas no banco de dados');
      console.error('❌ Erro ao substituir perguntas no Supabase:', err);
      throw err;
    }
  };

  // Adicionar pergunta a uma seção
  const addQuestionToSection = async (sectionIndex: number, sectionTitle: string, question: Omit<Question, 'id'>): Promise<void> => {
    try {
      console.log('➕ [CONTEXT] Adicionando pergunta à seção no Supabase:', sectionIndex, 'título:', sectionTitle);

      // Usar o serviço do Supabase
      const newQuestion = await studyQuestionsService.addQuestionToSection(
        documentId,
        sectionIndex,
        sectionTitle,
        question
      );

      // Atualizar estado local
      setQuestions(prev => {
        const existingSectionIndex = prev.findIndex(s => s.sectionIndex === sectionIndex);
        
        if (existingSectionIndex >= 0) {
          // Seção já existe, adicionar pergunta
          const updated = [...prev];
          updated[existingSectionIndex] = {
            ...updated[existingSectionIndex],
            questions: [...updated[existingSectionIndex].questions, newQuestion],
            updatedAt: new Date().toISOString()
          };
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
          return [...prev, newSection].sort((a, b) => a.sectionIndex - b.sectionIndex);
        }
      });

      console.log('✅ [CONTEXT] Pergunta adicionada ao Supabase:', newQuestion);
    } catch (err) {
      setError('Erro ao adicionar pergunta no banco de dados');
      console.error('❌ Erro ao adicionar pergunta no Supabase:', err);
      throw err;
    }
  };

  // Remover pergunta
  const removeQuestion = async (sectionIndex: number, questionId: string): Promise<void> => {
    try {
      console.log('🗑️ [CONTEXT] Removendo pergunta do Supabase:', questionId);

      // Usar o serviço do Supabase
      await studyQuestionsService.removeQuestion(questionId);

      // Atualizar estado local
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

      console.log('✅ [CONTEXT] Pergunta removida do Supabase:', questionId);
    } catch (err) {
      setError('Erro ao remover pergunta do banco de dados');
      console.error('❌ Erro ao remover pergunta do Supabase:', err);
      throw err;
    }
  };

  // Atualizar pergunta
  const updateQuestion = async (sectionIndex: number, questionId: string, updates: Partial<Question>): Promise<void> => {
    try {
      console.log('📝 [CONTEXT] Atualizando pergunta no Supabase:', questionId, updates);

      // Usar o serviço do Supabase
      const updatedQuestion = await studyQuestionsService.updateQuestion(questionId, updates);

      // Atualizar estado local
      setQuestions(prev => {
        return prev.map(section => {
          if (section.sectionIndex === sectionIndex) {
            return {
              ...section,
              questions: section.questions.map(q => 
                q.id === questionId ? updatedQuestion : q
              ),
              updatedAt: new Date().toISOString()
            };
          }
          return section;
        });
      });

      console.log('✅ [CONTEXT] Pergunta atualizada no Supabase:', updatedQuestion);
    } catch (err) {
      setError('Erro ao atualizar pergunta no banco de dados');
      console.error('❌ Erro ao atualizar pergunta no Supabase:', err);
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

  return (
    <QuestionsContext.Provider value={{
      questions,
      loading,
      error,
      documentId,
      setDocumentId: handleSetDocumentId,
      getQuestionsForSection,
      addQuestionToSection,
      removeQuestion,
      updateQuestion,
      hasQuestions,
      getStats,
      replaceQuestionsForSection,
      refreshQuestions
    }}>
      {children}
    </QuestionsContext.Provider>
  );
}

export function useQuestions() {
  const context = useContext(QuestionsContext);
  if (context === undefined) {
    throw new Error('useQuestions must be used within a QuestionsProvider');
  }
  return context;
}

