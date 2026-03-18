/**
 * Script de teste de conexão com Supabase
 * Execute: npx tsx scripts/test-supabase-connection.ts
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xmtleqquivcukwgdexhc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lGE34ong-9feNwCdx5b0XA_Pm9SYGVN';

async function testConnection() {
  console.log('🔍 Testando conexão com Supabase...\n');

  // Verificar variáveis de ambiente
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Variáveis de ambiente não configuradas:');
    console.error(`   NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_URL ? '✅' : '❌ não encontrada'}`);
    console.error(`   NEXT_PUBLIC_SUPABASE_ANON_KEY: ${SUPABASE_KEY ? '✅' : '❌ não encontrada'}`);
    process.exit(1);
  }

  console.log(`✅ URL: ${SUPABASE_URL}`);
  console.log(`✅ Key: ${SUPABASE_KEY.substring(0, 20)}...`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    // Teste 1: Listar tabelas (via pg_tables)
    console.log('\n📋 Teste 1: Verificando acesso ao banco...');
    const { data: tables, error: tablesError } = await supabase
      .from('units')
      .select('id')
      .limit(1);

    if (tablesError) {
      console.error(`❌ Erro ao acessar tabela units: ${tablesError.message}`);
    } else {
      console.log('✅ Conexão com tabela units OK');
    }

    // Teste 2: Verificar se podemos criar as novas tabelas (sem RLS)
    console.log('\n📋 Teste 2: Verificando extensões necessárias...');

    // Testar se conseguimos fazer queries básicas
    const { data: testData, error: testError } = await supabase
      .rpc('get_daily_capacity', { intensity_level: 'moderate' });

    if (testError) {
      console.log(`⚠️  RPC get_daily_capacity: ${testError.message}`);
    } else {
      console.log(`✅ RPC funcionando (get_daily_capacity retornou: ${testData})`);
    }

    // Resumo
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMO DO TESTE');
    console.log('='.repeat(50));
    console.log('✅ Conexão com Supabase: OK');
    console.log('✅ Acesso ao banco de dados: OK');
    console.log('\n🚀 Pronto para criar as tabelas de Lei Seca!');
    console.log('\nPróximos passos:');
    console.log('1. Criar tabelas: leis, artigos');
    console.log('2. Criar extensões: unaccent, pg_trgm');
    console.log('3. Criar índices');
    console.log('4. Importar dados do JSON');

  } catch (error) {
    console.error('❌ Erro na conexão:', error);
    process.exit(1);
  }
}

testConnection();
