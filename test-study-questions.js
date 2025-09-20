/**
 * Script para testar a integração das perguntas do estudo dirigido com Supabase
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xmtleqquivcukwgdexhc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdGxlcXF1aXZjdWt3Z2RleGhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMjk5OTcsImV4cCI6MjA2ODgwNTk5N30.7_MFUfXszXysh0kFrezS_i5kjcnvMqKJZlhoCEsX58E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testStudyQuestions() {
  try {
    console.log('🧪 Testando integração das perguntas do estudo dirigido...\n');

    // 1. Verificar se a tabela existe
    console.log('1️⃣ Verificando se a tabela study_questions existe...');
    const { data: tables, error: tablesError } = await supabase
      .from('study_questions')
      .select('count')
      .limit(1);

    if (tablesError) {
      console.error('❌ Tabela study_questions não existe ou não está acessível:', tablesError.message);
      console.log('💡 Execute a migração primeiro: npx supabase db push');
      return;
    }

    console.log('✅ Tabela study_questions existe e está acessível\n');

    // 2. Inserir pergunta de teste
    console.log('2️⃣ Inserindo pergunta de teste...');
    const testQuestion = {
      document_id: 'test-document-123',
      section_index: 0,
      section_title: 'Seção de Teste',
      question_type: 'multiple',
      question_text: 'Qual é a capital do Brasil?',
      options: ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador'],
      correct_answer: 2,
      explanation: 'Brasília é a capital federal do Brasil desde 1960.',
      points: 10
    };

    const { data: insertedQuestion, error: insertError } = await supabase
      .from('study_questions')
      .insert([testQuestion])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erro ao inserir pergunta:', insertError);
      return;
    }

    console.log('✅ Pergunta inserida com sucesso:', insertedQuestion.id);
    console.log('📝 Pergunta:', insertedQuestion.question_text);

    // 3. Buscar pergunta inserida
    console.log('\n3️⃣ Buscando pergunta inserida...');
    const { data: foundQuestions, error: selectError } = await supabase
      .from('study_questions')
      .select('*')
      .eq('document_id', 'test-document-123');

    if (selectError) {
      console.error('❌ Erro ao buscar perguntas:', selectError);
      return;
    }

    console.log('✅ Perguntas encontradas:', foundQuestions.length);
    foundQuestions.forEach((q, index) => {
      console.log(`   ${index + 1}. ${q.question_text} (ID: ${q.id})`);
    });

    // 4. Atualizar pergunta
    console.log('\n4️⃣ Atualizando pergunta...');
    const { data: updatedQuestion, error: updateError } = await supabase
      .from('study_questions')
      .update({ 
        question_text: 'Qual é a capital do Brasil? (Atualizada)',
        points: 15 
      })
      .eq('id', insertedQuestion.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar pergunta:', updateError);
      return;
    }

    console.log('✅ Pergunta atualizada:', updatedQuestion.question_text);
    console.log('📊 Pontos atualizados:', updatedQuestion.points);

    // 5. Inserir mais perguntas para testar agrupamento por seção
    console.log('\n5️⃣ Inserindo mais perguntas para teste...');
    const moreQuestions = [
      {
        document_id: 'test-document-123',
        section_index: 0,
        section_title: 'Seção de Teste',
        question_type: 'boolean',
        question_text: 'O Brasil é o maior país da América do Sul?',
        options: null,
        correct_answer: true,
        explanation: 'Sim, o Brasil ocupa cerca de 47% do território sul-americano.',
        points: 5
      },
      {
        document_id: 'test-document-123',
        section_index: 1,
        section_title: 'Segunda Seção',
        question_type: 'text',
        question_text: 'Qual é o maior rio do Brasil?',
        options: null,
        correct_answer: 'Amazonas',
        explanation: 'O Rio Amazonas é o maior rio do Brasil e do mundo em volume de água.',
        points: 15
      }
    ];

    const { data: insertedQuestions, error: batchInsertError } = await supabase
      .from('study_questions')
      .insert(moreQuestions)
      .select();

    if (batchInsertError) {
      console.error('❌ Erro ao inserir perguntas em lote:', batchInsertError);
      return;
    }

    console.log('✅ Perguntas inseridas em lote:', insertedQuestions.length);

    // 6. Buscar todas as perguntas agrupadas por seção
    console.log('\n6️⃣ Buscando todas as perguntas agrupadas por seção...');
    const { data: allQuestions, error: allQuestionsError } = await supabase
      .from('study_questions')
      .select('*')
      .eq('document_id', 'test-document-123')
      .order('section_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (allQuestionsError) {
      console.error('❌ Erro ao buscar todas as perguntas:', allQuestionsError);
      return;
    }

    // Agrupar por seção
    const sectionMap = new Map();
    allQuestions.forEach(q => {
      if (!sectionMap.has(q.section_index)) {
        sectionMap.set(q.section_index, {
          sectionTitle: q.section_title,
          questions: []
        });
      }
      sectionMap.get(q.section_index).questions.push(q);
    });

    console.log('✅ Perguntas agrupadas por seção:');
    sectionMap.forEach((section, index) => {
      console.log(`   📚 Seção ${index}: ${section.sectionTitle} (${section.questions.length} perguntas)`);
      section.questions.forEach((q, qIndex) => {
        console.log(`      ${qIndex + 1}. ${q.question_text} [${q.question_type}]`);
      });
    });

    // 7. Testar estatísticas
    console.log('\n7️⃣ Calculando estatísticas...');
    const totalQuestions = allQuestions.length;
    const totalSections = sectionMap.size;
    const avgQuestionsPerSection = totalQuestions / totalSections;

    console.log('📊 Estatísticas:');
    console.log(`   Total de perguntas: ${totalQuestions}`);
    console.log(`   Total de seções: ${totalSections}`);
    console.log(`   Média de perguntas por seção: ${avgQuestionsPerSection.toFixed(1)}`);

    // 8. Limpeza - remover perguntas de teste
    console.log('\n8️⃣ Limpando dados de teste...');
    const { error: deleteError } = await supabase
      .from('study_questions')
      .delete()
      .eq('document_id', 'test-document-123');

    if (deleteError) {
      console.error('❌ Erro ao limpar dados de teste:', deleteError);
      return;
    }

    console.log('✅ Dados de teste removidos com sucesso');

    console.log('\n🎉 Todos os testes passaram! A integração está funcionando corretamente.');

  } catch (error) {
    console.error('💥 Erro durante os testes:', error);
  }
}

// Executar testes
testStudyQuestions();
