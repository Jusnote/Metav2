import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xmtleqquivcukwgdexhc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdGxlcXF1aXZjdWt3Z2RleGhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMjk5OTcsImV4cCI6MjA2ODgwNTk5N30.7_MFUfXszXysh0kFrezS_i5kjcnvMqKJZlhoCEsX58E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    console.log('Testando conectividade com Supabase...');
    
    // Teste básico de conectividade
    const { data: healthCheck, error: healthError } = await supabase
      .from('units')
      .select('count')
      .limit(1);
    
    if (healthError) {
      console.error('Erro na conectividade:', healthError);
      return;
    }
    
    console.log('✅ Conectividade OK');
    
    // Contar registros em cada tabela
    const { count: unitsCount } = await supabase
      .from('units')
      .select('*', { count: 'exact', head: true });
    
    const { count: topicsCount } = await supabase
      .from('topics')
      .select('*', { count: 'exact', head: true });
    
    const { count: subtopicsCount } = await supabase
      .from('subtopics')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Dados encontrados:`);
    console.log(`   Units: ${unitsCount}`);
    console.log(`   Topics: ${topicsCount}`);
    console.log(`   Subtopics: ${subtopicsCount}`);
    
    // Teste de consulta otimizada com JOIN
    console.log('\n🔍 Testando consulta otimizada...');
    const startTime = Date.now();
    
    const { data: optimizedData, error: optimizedError } = await supabase
      .from('units')
      .select(`
        *,
        topics (
          *,
          subtopics (*)
        )
      `)
      .limit(5);
    
    const endTime = Date.now();
    
    if (optimizedError) {
      console.error('❌ Erro na consulta otimizada:', optimizedError);
    } else {
      console.log(`✅ Consulta otimizada executada em ${endTime - startTime}ms`);
      console.log(`   Retornou ${optimizedData?.length || 0} unidades`);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testConnection();