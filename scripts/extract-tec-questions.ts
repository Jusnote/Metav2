/**
 * Script de Extração de Questões do TEC Concursos
 *
 * COMO USAR:
 * 1. npm install playwright
 * 2. npx playwright install chromium
 * 3. Edite EMAIL e SENHA abaixo
 * 4. ts-node scripts/extract-tec-questions.ts
 */

import { chromium, BrowserContext, Page } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const CONFIG = {
  // ⚠️ SUBSTITUA COM SUAS CREDENCIAIS
  EMAIL: 'SEU_EMAIL_TEC@example.com',
  SENHA: 'SUA_SENHA',

  // URL da lista de questões que você quer extrair
  URL_QUESTOES: 'https://www.tecconcursos.com.br/questoes/cadernos/...', // Cole a URL aqui

  // Quantas questões extrair (0 = todas disponíveis)
  TOTAL_QUESTOES: 100,

  // Delay entre cliques (em ms) - para parecer mais humano
  DELAY_MIN: 1000,
  DELAY_MAX: 2000,

  // Arquivo de saída
  OUTPUT_FILE: 'data/tec-questions.json',
};

// ============================================================================
// INTERFACES
// ============================================================================

interface TecQuestaoRaw {
  questao: {
    numeroQuestaoAtual: number;
    enunciado: string;
    alternativas: string[];
    nomeMateria: string;
    nomeAssunto: string;
    bancaSigla: string;
    orgaoSigla: string;
    orgaoNome: string;
    cargoSigla: string;
    concursoAno: number;
    tipoQuestao: string;
    idQuestao: number;
    gabaritoPreliminar: boolean;
    possuiComentario: boolean;
    possuiComentarioVideo: boolean;
    status: number; // 0=não respondida, 1=certa, 2=errada
    hash: string;
    // ... outros campos
  };
}

interface QuestaoFormatada {
  // ID original do TEC
  tec_id: number;
  tec_hash: string;

  // Dados principais
  titulo: string;
  enunciado: string;
  tipo: 'multipla_escolha' | 'verdadeiro_falso' | 'dissertativa';

  // Alternativas (para múltipla escolha e V/F)
  alternativas?: Array<{
    letra: string;
    texto: string;
    correta?: boolean;
  }>;

  // Metadados
  disciplina: string;
  assunto: string;
  banca: string;
  ano: number;
  cargo?: string;
  orgao?: string;

  // Status
  nivel: 'Fácil' | 'Médio' | 'Difícil';
  possui_comentario: boolean;
  possui_video: boolean;

  // Para rastreamento
  numero_questao: number;
  data_extracao: string;
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Gera delay aleatório entre min e max (comportamento humano)
 */
function randomDelay(min: number = CONFIG.DELAY_MIN, max: number = CONFIG.DELAY_MAX): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Remove HTML tags do enunciado
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&ordm;/g, 'º')
    .replace(/&atilde;/g, 'ã')
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&ccedil;/g, 'ç')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Transforma questão do TEC para nosso formato
 */
function transformarQuestao(raw: TecQuestaoRaw): QuestaoFormatada {
  const q = raw.questao;

  // Determinar tipo
  let tipo: 'multipla_escolha' | 'verdadeiro_falso' | 'dissertativa' = 'multipla_escolha';
  if (q.tipoQuestao === 'CERTO_ERRADO') {
    tipo = 'verdadeiro_falso';
  } else if (q.tipoQuestao === 'DISCURSIVA') {
    tipo = 'dissertativa';
  }

  // Criar título (primeiros 100 caracteres do enunciado limpo)
  const enunciadoLimpo = stripHtml(q.enunciado);
  const titulo = enunciadoLimpo.substring(0, 100) + (enunciadoLimpo.length > 100 ? '...' : '');

  // Formatar alternativas
  let alternativas: Array<{ letra: string; texto: string; correta?: boolean }> | undefined;
  if (tipo !== 'dissertativa' && q.alternativas && q.alternativas.length > 0) {
    alternativas = q.alternativas.map((texto, index) => ({
      letra: String.fromCharCode(65 + index), // A, B, C, D, E
      texto: texto,
      correta: undefined // Gabarito será preenchido depois (se disponível)
    }));
  }

  // Inferir dificuldade (simplificado - pode melhorar depois)
  let nivel: 'Fácil' | 'Médio' | 'Difícil' = 'Médio';
  if (q.nomeMateria.includes('Português') || q.nomeMateria.includes('Raciocínio')) {
    nivel = 'Médio';
  }

  return {
    tec_id: q.idQuestao,
    tec_hash: q.hash,
    titulo,
    enunciado: q.enunciado, // Manter HTML original (pode ser útil)
    tipo,
    alternativas,
    disciplina: q.nomeMateria,
    assunto: q.nomeAssunto,
    banca: q.bancaSigla,
    ano: q.concursoAno,
    cargo: q.cargoSigla,
    orgao: q.orgaoNome,
    nivel,
    possui_comentario: q.possuiComentario,
    possui_video: q.possuiComentarioVideo,
    numero_questao: q.numeroQuestaoAtual,
    data_extracao: new Date().toISOString(),
  };
}

/**
 * Salva questões em arquivo JSON
 */
async function salvarQuestoes(questoes: QuestaoFormatada[], filename: string = CONFIG.OUTPUT_FILE): Promise<void> {
  const outputPath = path.join(process.cwd(), filename);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(questoes, null, 2), 'utf-8');
  console.log(`💾 ${questoes.length} questões salvas em: ${outputPath}`);
}

// ============================================================================
// EXTRAÇÃO PRINCIPAL
// ============================================================================

async function extrairQuestoesTEC(): Promise<QuestaoFormatada[]> {
  console.log('🚀 Iniciando extração de questões do TEC Concursos...\n');

  const questoes: QuestaoFormatada[] = [];
  const questoesRaw: TecQuestaoRaw[] = []; // Para debug

  // Lançar navegador
  console.log('🌐 Abrindo navegador...');
  const browser = await chromium.launch({
    headless: false, // Deixe false para ver o que está acontecendo
    slowMo: 50, // Mais natural
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'pt-BR',
  });

  const page = await context.newPage();

  // ✅ INTERCEPTAR RESPOSTAS DE REDE
  page.on('response', async (response) => {
    const url = response.url();

    // Capturar JSONs de questões
    if (url.includes('/api/questao') || url.includes('questoes/proxima') || url.includes('questao-navegacao')) {
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          const json = await response.json();

          // Verificar se é uma questão válida
          if (json.questao && json.questao.idQuestao) {
            questoesRaw.push(json as TecQuestaoRaw);

            const questaoFormatada = transformarQuestao(json as TecQuestaoRaw);
            questoes.push(questaoFormatada);

            console.log(`✅ Questão ${questoes.length} capturada: ${questaoFormatada.titulo}`);
          }
        }
      } catch (error) {
        // Não é JSON válido, ignorar
      }
    }
  });

  try {
    // ============================================================================
    // FAZER LOGIN
    // ============================================================================

    console.log('\n🔐 Fazendo login no TEC Concursos...');
    await page.goto('https://www.tecconcursos.com.br/login', { waitUntil: 'networkidle' });

    // Verificar se já está logado
    const jaLogado = await page.$('text=Sair') || await page.$('text=Minha Conta');

    if (!jaLogado) {
      // Preencher formulário de login
      await page.fill('input[name="email"], input[type="email"]', CONFIG.EMAIL);
      await page.fill('input[name="password"], input[type="password"]', CONFIG.SENHA);
      await page.click('button[type="submit"], button:has-text("Entrar")');

      // Aguardar navegação pós-login
      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => {
        console.log('⚠️ Timeout no login, mas continuando...');
      });

      console.log('✅ Login realizado com sucesso!');
    } else {
      console.log('✅ Já estava logado!');
    }

    await randomDelay();

    // ============================================================================
    // NAVEGAR PARA QUESTÕES
    // ============================================================================

    console.log('\n📚 Navegando para lista de questões...');
    await page.goto(CONFIG.URL_QUESTOES, { waitUntil: 'networkidle' });
    await randomDelay(2000, 3000);

    // ============================================================================
    // LOOP: CLICAR EM "PRÓXIMA"
    // ============================================================================

    console.log(`\n🔄 Iniciando extração de ${CONFIG.TOTAL_QUESTOES > 0 ? CONFIG.TOTAL_QUESTOES : 'todas as'} questões...\n`);

    const maxQuestoes = CONFIG.TOTAL_QUESTOES > 0 ? CONFIG.TOTAL_QUESTOES : 10000;

    for (let i = 0; i < maxQuestoes; i++) {
      console.log(`\n[${i + 1}/${maxQuestoes}] Processando questão...`);

      // Aguardar um pouco (comportamento humano)
      await randomDelay();

      // Procurar botão "Próxima" ou "Avançar"
      const botaoProxima = await page.$(
        'button:has-text("Próxima"), button:has-text("Próximo"), button:has-text("Avançar"), a:has-text("Próxima")'
      );

      if (!botaoProxima) {
        console.log('⚠️ Botão "Próxima" não encontrado. Fim da lista ou layout diferente?');
        break;
      }

      // Clicar no botão
      await botaoProxima.click();

      // Aguardar rede ficar idle (requisição do JSON completar)
      await page.waitForLoadState('networkidle').catch(() => {
        console.log('⚠️ Timeout aguardando rede, mas continuando...');
      });

      // Aguardar elemento da questão aparecer (validação)
      await page.waitForSelector('p[id*="Q-"], div[class*="enunciado"]', { timeout: 5000 }).catch(() => {
        console.log('⚠️ Enunciado não encontrado na página');
      });
    }

    console.log(`\n✅ Extração concluída! ${questoes.length} questões capturadas.`);

  } catch (error) {
    console.error('❌ Erro durante extração:', error);
  } finally {
    // Fechar navegador
    await browser.close();
  }

  return questoes;
}

// ============================================================================
// EXECUÇÃO
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  TEC CONCURSOS - EXTRATOR DE QUESTÕES                  ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Extrair questões
    const questoes = await extrairQuestoesTEC();

    if (questoes.length === 0) {
      console.log('⚠️ Nenhuma questão foi extraída. Verifique a URL e suas credenciais.');
      return;
    }

    // 2. Salvar em arquivo
    await salvarQuestoes(questoes);

    // 3. Estatísticas
    console.log('\n📊 ESTATÍSTICAS:');
    console.log(`   Total de questões: ${questoes.length}`);
    console.log(`   Disciplinas: ${new Set(questoes.map(q => q.disciplina)).size}`);
    console.log(`   Bancas: ${new Set(questoes.map(q => q.banca)).size}`);
    console.log(`   Com comentário: ${questoes.filter(q => q.possui_comentario).length}`);
    console.log(`   Com vídeo: ${questoes.filter(q => q.possui_video).length}`);

    console.log('\n🎉 Processo concluído com sucesso!');
    console.log(`\n💡 Próximo passo: Rode "npm run import-questions" para importar para o Supabase.`);

  } catch (error) {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  }
}

// Executar
if (require.main === module) {
  main();
}
