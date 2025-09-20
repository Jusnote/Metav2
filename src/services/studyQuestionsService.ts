/**
 * Serviço para gerenciar perguntas do estudo dirigido no Supabase
 */

import { supabase } from '@/integrations/supabase/client';
import { Question, SectionQuestions } from '@/types/questions';

// Tipo para a tabela study_questions no Supabase
export interface StudyQuestionRow {
  id: string;
  document_id: string;
  section_index: number;
  section_title: string;
  question_type: 'multiple' | 'boolean' | 'text';
  question_text: string;
  options: string[] | null;
  correct_answer: string | number | boolean;
  explanation: string | null;
  points: number;
  created_at: string;
  updated_at: string;
}

/**
 * Converter Question para formato do Supabase
 */
function questionToSupabaseRow(
  question: Question, 
  documentId: string, 
  sectionIndex: number, 
  sectionTitle: string
): Omit<StudyQuestionRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    document_id: documentId,
    section_index: sectionIndex,
    section_title: sectionTitle,
    question_type: question.type,
    question_text: question.question,
    options: question.options || null,
    correct_answer: question.correctAnswer,
    explanation: question.explanation || null,
    points: question.points || 10,
  };
}

/**
 * Converter linha do Supabase para Question
 */
function supabaseRowToQuestion(row: StudyQuestionRow): Question {
  return {
    id: row.id,
    type: row.question_type,
    question: row.question_text,
    options: row.options || undefined,
    correctAnswer: row.correct_answer,
    explanation: row.explanation || undefined,
    points: row.points,
  };
}

/**
 * Buscar todas as perguntas de um documento
 */
export async function getQuestionsForDocument(documentId: string): Promise<SectionQuestions[]> {
  console.log('🔍 Buscando perguntas para documento:', documentId);
  
  const { data, error } = await supabase
    .from('study_questions')
    .select('*')
    .eq('document_id', documentId)
    .order('section_index', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Erro ao buscar perguntas:', error);
    throw new Error(`Erro ao buscar perguntas: ${error.message}`);
  }

  console.log('✅ Perguntas encontradas:', data?.length || 0);

  // Agrupar perguntas por seção
  const sectionMap = new Map<number, SectionQuestions>();
  
  data?.forEach((row) => {
    const question = supabaseRowToQuestion(row);
    
    if (!sectionMap.has(row.section_index)) {
      sectionMap.set(row.section_index, {
        sectionId: `section-${row.section_index}`,
        sectionTitle: row.section_title,
        sectionIndex: row.section_index,
        questions: [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }
    
    sectionMap.get(row.section_index)!.questions.push(question);
  });

  return Array.from(sectionMap.values()).sort((a, b) => a.sectionIndex - b.sectionIndex);
}

/**
 * Buscar perguntas de uma seção específica
 */
export async function getQuestionsForSection(
  documentId: string, 
  sectionIndex: number
): Promise<SectionQuestions | null> {
  console.log('🔍 Buscando perguntas para seção:', documentId, sectionIndex);
  
  const { data, error } = await supabase
    .from('study_questions')
    .select('*')
    .eq('document_id', documentId)
    .eq('section_index', sectionIndex)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Erro ao buscar perguntas da seção:', error);
    throw new Error(`Erro ao buscar perguntas da seção: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.log('📭 Nenhuma pergunta encontrada para a seção');
    return null;
  }

  const questions = data.map(supabaseRowToQuestion);
  const firstRow = data[0];

  return {
    sectionId: `section-${sectionIndex}`,
    sectionTitle: firstRow.section_title,
    sectionIndex: sectionIndex,
    questions: questions,
    createdAt: firstRow.created_at,
    updatedAt: Math.max(...data.map(row => new Date(row.updated_at).getTime())).toString(),
  };
}

/**
 * Adicionar uma pergunta a uma seção
 */
export async function addQuestionToSection(
  documentId: string,
  sectionIndex: number,
  sectionTitle: string,
  question: Omit<Question, 'id'>
): Promise<Question> {
  console.log('➕ Adicionando pergunta à seção:', documentId, sectionIndex, sectionTitle);
  
  const questionData = questionToSupabaseRow(
    { ...question, id: '' } as Question,
    documentId,
    sectionIndex,
    sectionTitle
  );

  const { data, error } = await supabase
    .from('study_questions')
    .insert([questionData])
    .select()
    .single();

  if (error) {
    console.error('❌ Erro ao adicionar pergunta:', error);
    throw new Error(`Erro ao adicionar pergunta: ${error.message}`);
  }

  console.log('✅ Pergunta adicionada:', data.id);
  return supabaseRowToQuestion(data);
}

/**
 * Atualizar uma pergunta
 */
export async function updateQuestion(
  questionId: string,
  updates: Partial<Question>
): Promise<Question> {
  console.log('📝 Atualizando pergunta:', questionId, updates);
  
  const updateData: Partial<StudyQuestionRow> = {};
  
  if (updates.type) updateData.question_type = updates.type;
  if (updates.question) updateData.question_text = updates.question;
  if (updates.options !== undefined) updateData.options = updates.options || null;
  if (updates.correctAnswer !== undefined) updateData.correct_answer = updates.correctAnswer;
  if (updates.explanation !== undefined) updateData.explanation = updates.explanation || null;
  if (updates.points !== undefined) updateData.points = updates.points;

  const { data, error } = await supabase
    .from('study_questions')
    .update(updateData)
    .eq('id', questionId)
    .select()
    .single();

  if (error) {
    console.error('❌ Erro ao atualizar pergunta:', error);
    throw new Error(`Erro ao atualizar pergunta: ${error.message}`);
  }

  console.log('✅ Pergunta atualizada:', data.id);
  return supabaseRowToQuestion(data);
}

/**
 * Remover uma pergunta
 */
export async function removeQuestion(questionId: string): Promise<void> {
  console.log('🗑️ Removendo pergunta:', questionId);
  
  const { error } = await supabase
    .from('study_questions')
    .delete()
    .eq('id', questionId);

  if (error) {
    console.error('❌ Erro ao remover pergunta:', error);
    throw new Error(`Erro ao remover pergunta: ${error.message}`);
  }

  console.log('✅ Pergunta removida:', questionId);
}

/**
 * Substituir todas as perguntas de uma seção
 */
export async function replaceQuestionsForSection(
  documentId: string,
  sectionIndex: number,
  sectionTitle: string,
  newQuestions: Question[]
): Promise<SectionQuestions | null> {
  console.log('🔄 Substituindo perguntas da seção:', documentId, sectionIndex, newQuestions.length);
  
  // Primeiro, remover todas as perguntas existentes da seção
  const { error: deleteError } = await supabase
    .from('study_questions')
    .delete()
    .eq('document_id', documentId)
    .eq('section_index', sectionIndex);

  if (deleteError) {
    console.error('❌ Erro ao remover perguntas existentes:', deleteError);
    throw new Error(`Erro ao remover perguntas existentes: ${deleteError.message}`);
  }

  // Se não há novas perguntas, retornar null
  if (newQuestions.length === 0) {
    console.log('📭 Nenhuma pergunta para adicionar');
    return null;
  }

  // Adicionar as novas perguntas
  const questionsData = newQuestions.map(question => 
    questionToSupabaseRow(question, documentId, sectionIndex, sectionTitle)
  );

  const { data, error: insertError } = await supabase
    .from('study_questions')
    .insert(questionsData)
    .select();

  if (insertError) {
    console.error('❌ Erro ao inserir novas perguntas:', insertError);
    throw new Error(`Erro ao inserir novas perguntas: ${insertError.message}`);
  }

  console.log('✅ Perguntas substituídas:', data?.length || 0);

  // Retornar as perguntas atualizadas
  const questions = data?.map(supabaseRowToQuestion) || [];
  
  return {
    sectionId: `section-${sectionIndex}`,
    sectionTitle: sectionTitle,
    sectionIndex: sectionIndex,
    questions: questions,
    createdAt: data?.[0]?.created_at || new Date().toISOString(),
    updatedAt: Math.max(...(data?.map(row => new Date(row.updated_at).getTime()) || [Date.now()])).toString(),
  };
}

/**
 * Verificar se uma seção tem perguntas
 */
export async function hasQuestionsForSection(
  documentId: string, 
  sectionIndex: number
): Promise<boolean> {
  const { count, error } = await supabase
    .from('study_questions')
    .select('*', { count: 'exact', head: true })
    .eq('document_id', documentId)
    .eq('section_index', sectionIndex);

  if (error) {
    console.error('❌ Erro ao verificar perguntas da seção:', error);
    return false;
  }

  return (count || 0) > 0;
}

/**
 * Obter estatísticas das perguntas de um documento
 */
export async function getQuestionStats(documentId: string) {
  const { data, error } = await supabase
    .from('study_questions')
    .select('section_index')
    .eq('document_id', documentId);

  if (error) {
    console.error('❌ Erro ao obter estatísticas:', error);
    return {
      totalSections: 0,
      totalQuestions: 0,
      sectionsWithQuestions: 0,
      averageQuestionsPerSection: 0,
    };
  }

  const totalQuestions = data?.length || 0;
  const sectionsSet = new Set(data?.map(row => row.section_index) || []);
  const sectionsWithQuestions = sectionsSet.size;

  return {
    totalSections: sectionsWithQuestions, // Só contamos seções que têm perguntas
    totalQuestions,
    sectionsWithQuestions,
    averageQuestionsPerSection: sectionsWithQuestions > 0 ? totalQuestions / sectionsWithQuestions : 0,
  };
}
