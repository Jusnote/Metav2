/**
 * Debug do erro "Erro ao carregar disciplinas" reportado em /estudar.
 * Reproduz exatamente a query do usePapiroDisciplinas com auth real.
 */

import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const email = process.env.PAPIRO_TEST_EMAIL!;
const password = process.env.PAPIRO_TEST_PASSWORD!;

async function main() {
  const supabase = createClient(url, anonKey);

  console.log('🔑 Logando...');
  const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error('Auth falhou:', authErr.message);
    process.exit(1);
  }
  console.log('   ✓ logado');

  console.log('\n📖 Reproduzindo query do usePapiroDisciplinas...');
  const { data, error, status } = await supabase
    .schema('papiro' as never)
    .from('disciplina')
    .select(`
      id, nome, slug, ordem,
      macro_area:macro_area!disciplina_id (
        id,
        tema:tema!macro_area_id (
          id,
          tempo_estudo_min,
          resumo:resumo!tema_id ( status )
        )
      )
    `)
    .order('ordem');

  if (error) {
    console.error(`❌ status=${status} code=${error.code}`);
    console.error(`   message: ${error.message}`);
    if (error.details) console.error(`   details: ${error.details}`);
    if (error.hint) console.error(`   hint: ${error.hint}`);
    process.exit(1);
  }

  console.log(`✅ status=${status}`);
  console.log(`   ${data?.length ?? 0} disciplinas retornadas`);
  if (data && data.length > 0) {
    console.log(JSON.stringify(data, null, 2));
  }
}

main().catch((err) => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});
