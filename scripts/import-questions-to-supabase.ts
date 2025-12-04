/**
 * Script de Importação de Questões para Supabase
 *
 * COMO USAR:
 * 1. Rode primeiro: ts-node scripts/extract-tec-questions.ts
 * 2. Depois: ts-node scripts/import-questions-to-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const CONFIG = {
  // Arquivo de entrada (gerado pelo extrator)
  INPUT_FILE: 'data/tec-questions.json',

  // Supabase
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  SUPABASE_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',

  // User ID padrão (substitua com seu ID de usuário)
  // Você pode pegar do Supabase Auth ou passar como argumento
  USER_ID: process.env.USER_ID || 'seu-user-id-aqui',

  // Importar em lotes (evitar timeout)
  BATCH_SIZE: 50,
};

// ============================================================================
// INTERFACES
// ============================================================================

interface QuestaoFormatada {
  tec_id: number;
  tec_hash: string;
  titulo: string;
  enunciado: string;
  tipo: 'multipla_escolha' | 'verdadeiro_falso' | 'dissertativa';
  alternativas?: Array<{
    letra: string;
    texto: string;
    correta?: boolean;
  }>;
  disciplina: string;
  assunto: string;
  banca: string;
  ano: number;
  cargo?: string;
  orgao?: string;
  nivel: 'Fácil' | 'Médio' | 'Difícil';
  possui_comentario: boolean;
  possui_video: boolean;
  numero_questao: number;
  data_extracao: string;
}

interface QuestaoSupabase {
  user_id: string;
  titulo: string;
  enunciado: string;
  tipo: 'multipla_escolha' | 'verdadeiro_falso' | 'dissertativa';
  disciplina: string | null;
  assunto: string | null;
  banca: string | null;
  ano: number | null;
  cargo: string | null;
  dificuldade: 'Fácil' | 'Médio' | 'Difícil' | null;
  nivel: 'Fácil' | 'Médio' | 'Difícil';
  modalidade: 'multipla_escolha' | 'verdadeiro_falso' | 'dissertativa';
  alternativas?: any; // JSON
  gabarito_correto?: string;
  comentario?: string;
  metadata?: any; // JSON com dados extras do TEC
}

// ============================================================================
// FUNÇÕES
// ============================================================================

/**
 * Carrega questões do arquivo JSON
 */
async function carregarQuestoes(): Promise<QuestaoFormatada[]> {
  const filePath = path.join(process.cwd(), CONFIG.INPUT_FILE);
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Transforma questão para formato do Supabase
 */
function transformarParaSupabase(questao: QuestaoFormatada): QuestaoSupabase {
  return {
    user_id: CONFIG.USER_ID,
    titulo: questao.titulo,
    enunciado: questao.enunciado,
    tipo: questao.tipo,
    disciplina: questao.disciplina,
    assunto: questao.assunto,
    banca: questao.banca,
    ano: questao.ano,
    cargo: questao.cargo || null,
    dificuldade: questao.nivel,
    nivel: questao.nivel,
    modalidade: questao.tipo,
    alternativas: questao.alternativas ? JSON.stringify(questao.alternativas) : undefined,
    gabarito_correto: undefined, // Será preenchido manualmente ou via outro script
    comentario: questao.possui_comentario
      ? 'Comentário disponível no TEC Concursos'
      : undefined,
    metadata: {
      tec_id: questao.tec_id,
      tec_hash: questao.tec_hash,
      orgao: questao.orgao,
      possui_video: questao.possui_video,
      numero_questao: questao.numero_questao,
      data_extracao: questao.data_extracao,
    },
  };
}

/**
 * Importa questões em lotes
 */
async function importarQuestoes(questoes: QuestaoFormatada[]): Promise<void> {
  console.log(`\n📤 Importando ${questoes.length} questões para Supabase...\n`);

  // Criar cliente Supabase
  const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

  // Verificar conexão
  try {
    const { error: connError } = await supabase.from('questoes').select('count').limit(1);
    if (connError) throw connError;
    console.log('✅ Conexão com Supabase estabelecida\n');
  } catch (error) {
    console.error('❌ Erro ao conectar com Supabase:', error);
    throw error;
  }

  // Dividir em lotes
  const totalLotes = Math.ceil(questoes.length / CONFIG.BATCH_SIZE);
  let sucessos = 0;
  let erros = 0;
  const errosDetalhados: Array<{ questao: string; erro: string }> = [];

  for (let i = 0; i < totalLotes; i++) {
    const inicio = i * CONFIG.BATCH_SIZE;
    const fim = Math.min(inicio + CONFIG.BATCH_SIZE, questoes.length);
    const lote = questoes.slice(inicio, fim);

    console.log(`\n[Lote ${i + 1}/${totalLotes}] Importando questões ${inicio + 1}-${fim}...`);

    // Transformar lote
    const loteSupabase = lote.map(transformarParaSupabase);

    // Inserir no Supabase
    const { data, error } = await supabase
      .from('questoes')
      .insert(loteSupabase)
      .select();

    if (error) {
      console.error(`❌ Erro no lote ${i + 1}:`, error.message);
      erros += lote.length;

      // Tentar inserir uma por uma para identificar qual falhou
      for (const questao of lote) {
        const questaoSupabase = transformarParaSupabase(questao);
        const { error: erroIndividual } = await supabase
          .from('questoes')
          .insert([questaoSupabase]);

        if (erroIndividual) {
          errosDetalhados.push({
            questao: questao.titulo,
            erro: erroIndividual.message,
          });
        } else {
          sucessos++;
        }
      }
    } else {
      sucessos += lote.length;
      console.log(`✅ ${lote.length} questões importadas com sucesso`);
    }

    // Aguardar um pouco entre lotes (evitar rate limiting)
    if (i < totalLotes - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Relatório final
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 RELATÓRIO DE IMPORTAÇÃO');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`   Total de questões: ${questoes.length}`);
  console.log(`   ✅ Importadas com sucesso: ${sucessos}`);
  console.log(`   ❌ Erros: ${erros}`);
  console.log(`   Taxa de sucesso: ${((sucessos / questoes.length) * 100).toFixed(1)}%`);

  if (errosDetalhados.length > 0) {
    console.log('\n❌ ERROS DETALHADOS:');
    errosDetalhados.slice(0, 10).forEach((erro, index) => {
      console.log(`   ${index + 1}. ${erro.questao}`);
      console.log(`      Erro: ${erro.erro}`);
    });

    if (errosDetalhados.length > 10) {
      console.log(`   ... e mais ${errosDetalhados.length - 10} erros`);
    }

    // Salvar erros em arquivo
    const errosPath = path.join(process.cwd(), 'data', 'import-errors.json');
    await fs.writeFile(errosPath, JSON.stringify(errosDetalhados, null, 2), 'utf-8');
    console.log(`\n💾 Erros salvos em: ${errosPath}`);
  }
}

// ============================================================================
// EXECUÇÃO
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  IMPORTAÇÃO DE QUESTÕES PARA SUPABASE                  ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  // Validar configuração
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_KEY) {
    console.error('❌ Erro: SUPABASE_URL ou SUPABASE_KEY não configurados!');
    console.error('   Configure as variáveis de ambiente ou edite o script.');
    process.exit(1);
  }

  if (CONFIG.USER_ID === 'seu-user-id-aqui') {
    console.error('❌ Erro: USER_ID não configurado!');
    console.error('   Edite CONFIG.USER_ID no script ou passe via env USER_ID=...');
    process.exit(1);
  }

  try {
    // 1. Carregar questões do arquivo
    console.log(`\n📂 Carregando questões de: ${CONFIG.INPUT_FILE}`);
    const questoes = await carregarQuestoes();
    console.log(`✅ ${questoes.length} questões carregadas`);

    // 2. Estatísticas
    console.log('\n📊 ESTATÍSTICAS PRÉ-IMPORTAÇÃO:');
    console.log(`   Tipos: ${new Set(questoes.map(q => q.tipo)).size}`);
    console.log(`   Disciplinas: ${new Set(questoes.map(q => q.disciplina)).size}`);
    console.log(`   Bancas: ${new Set(questoes.map(q => q.banca)).size}`);

    // 3. Confirmar importação
    console.log('\n⚠️  ATENÇÃO: Esta operação vai inserir questões no banco de dados.');
    console.log(`   User ID: ${CONFIG.USER_ID}`);
    console.log(`   Total: ${questoes.length} questões`);

    // 4. Importar
    await importarQuestoes(questoes);

    console.log('\n🎉 Importação concluída!');

  } catch (error) {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  }
}

// Executar
if (require.main === module) {
  main();
}
