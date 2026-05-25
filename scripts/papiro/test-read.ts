/**
 * PAPIRO — Teste de leitura via PostgREST.
 *
 * Confirma que:
 *  - Sem login: bloqueio por RLS/grants (anon não vê).
 *  - Com login (PAPIRO_TEST_EMAIL/PAPIRO_TEST_PASSWORD): retorna os 22 temas.
 *
 * Uso:
 *   npx tsx scripts/papiro/test-read.ts
 *
 * Vars (lidas de .env, com .env.local como override):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   PAPIRO_TEST_EMAIL      (opcional — se ausente, só roda etapa anon)
 *   PAPIRO_TEST_PASSWORD   (opcional)
 */

import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY ausente.');
  process.exit(1);
}

async function readTemas(label: string, supabase: ReturnType<typeof createClient>) {
  console.log(`\n📖 [${label}] supabase.schema('papiro').from('tema').select(...)`);
  const { data, error, status } = await supabase
    .schema('papiro' as never)
    .from('tema')
    .select('slug_hierarquico, nome, ordem_curricular')
    .order('ordem_curricular', { ascending: true });

  if (error) {
    console.log(`   ❌ status=${status} code=${error.code}`);
    console.log(`      message: ${error.message}`);
    if (error.details) console.log(`      details: ${error.details}`);
    if (error.hint) console.log(`      hint:    ${error.hint}`);
    return { ok: false as const, count: 0 };
  }

  console.log(`   ✓ status=${status} — retornou ${data?.length ?? 0} linha(s)`);
  if (data && data.length > 0) {
    for (const t of data) {
      console.log(`     [${t.ordem_curricular as number}] ${t.slug_hierarquico} — ${t.nome}`);
    }
  }
  return { ok: true as const, count: data?.length ?? 0 };
}

async function main() {
  // ----- ETAPA 1: sem login (anon) -----
  console.log('═══ ETAPA 1: SEM LOGIN (cliente anônimo) ═══');
  console.log('Esperado: bloqueio por RLS/grants (anon não tem usage do schema papiro).');

  const anonClient = createClient(url!, anonKey!);
  const anonResult = await readTemas('anon', anonClient);

  if (anonResult.ok && anonResult.count > 0) {
    console.log('\n⚠️  PROBLEMA: cliente anon conseguiu ler! RLS/grants estão permissivos demais.');
  } else if (anonResult.ok && anonResult.count === 0) {
    console.log('\n✓ Comportamento aceitável: anon ficou com 0 linhas (RLS bloqueou filtro).');
  } else {
    console.log('\n✓ Comportamento esperado: anon bloqueado por permission/RLS.');
  }

  // ----- ETAPA 2: com login (authenticated) -----
  const email = process.env.PAPIRO_TEST_EMAIL;
  const password = process.env.PAPIRO_TEST_PASSWORD;

  if (!email || !password) {
    console.log('\n═══ ETAPA 2: COM LOGIN ═══');
    console.log('⏭  Pulada: PAPIRO_TEST_EMAIL/PAPIRO_TEST_PASSWORD não configurados.');
    console.log('   Adicione em .env.local e rode de novo:');
    console.log('     PAPIRO_TEST_EMAIL=aluno-teste@exemplo.com');
    console.log('     PAPIRO_TEST_PASSWORD=...');
    return;
  }

  console.log('\n═══ ETAPA 2: COM LOGIN (cliente autenticado) ═══');
  const authClient = createClient(url!, anonKey!);

  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email,
    password,
  });
  if (authError) {
    console.error(`❌ Falha no login: ${authError.message}`);
    process.exit(1);
  }
  console.log(`✓ Logado como ${authData.user?.email} (uid: ${authData.user?.id})`);

  const authResult = await readTemas('authenticated', authClient);

  if (authResult.ok && authResult.count === 22) {
    console.log('\n✅ SUCESSO: 22 temas retornados via PostgREST autenticado.');
  } else if (authResult.ok) {
    console.log(`\n⚠️  Logado retornou ${authResult.count} temas (esperado 22).`);
  } else {
    console.log('\n❌ Logado falhou — investigar policy/grants.');
  }
}

main().catch((err) => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});
