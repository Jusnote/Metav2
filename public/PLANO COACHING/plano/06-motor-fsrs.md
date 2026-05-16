# 06 — Motor FSRS (Repetição Espaçada)

> Implementação completa da repetição espaçada usando a biblioteca `ts-fsrs`. Este documento define como FSRS se conecta com o restante do sistema.

## Conceito básico

FSRS (Free Spaced Repetition Scheduler) calcula o próximo intervalo de revisão para cada "card" (no nosso caso, **subtópico**) com base em três variáveis:

- **Difficulty (D):** quão difícil é esse conteúdo para esse aluno específico
- **Stability (S):** quantos dias o conteúdo "aguenta" antes de cair abaixo do threshold de memória
- **Retrievability (R):** probabilidade atual de o aluno lembrar (0-1)

O scheduler recebe uma **avaliação** (Rating: Again/Hard/Good/Easy) e devolve um novo estado com `due_date` atualizada.

## Decisão crítica: granularidade

**Modelo escolhido: card = subtópico** (agregado).

Cada par `(aluno_id, subtopico_id)` é um card. A avaliação é gerada a partir da **taxa de acerto** numa sessão de questões daquele subtópico.

**Por que não card = questão:** mil questões × cem alunos = cem mil cards, ingerenciável.  
**Por que não card = tópico:** perde granularidade — aluno pode dominar "Homicídio simples" mas não "feminicídio".  
**Trade-off do agregado:** dentro de um subtópico, o sistema não sabe qual questão exata está fraca. Mitigamos isso com **flag de cluster de erro**: se 3+ tentativas erradas vêm do mesmo subtópico em sessões diferentes, marca para reforço extra.

## Setup da biblioteca

**Arquivo:** `/lib/fsrs/scheduler.ts`

```ts
import { fsrs, generatorParameters, Rating, State, type Card, type ReviewLog } from 'ts-fsrs'

// Parâmetros padrão calibrados — podemos refinar com dataset próprio depois
const PARAMS = generatorParameters({
  request_retention: 0.9, // queremos 90% de chance de lembrar
  maximum_interval: 365,  // máximo 1 ano entre revisões
  enable_fuzz: true,      // adiciona ruído pra evitar empilhamento de revisões no mesmo dia
  enable_short_term: true // ativa fase de aprendizagem curta
})

export const scheduler = fsrs(PARAMS)

export { Rating, State }
export type { Card, ReviewLog }
```

## Mapeamento taxa de acerto → Rating

**Arquivo:** `/lib/fsrs/parametros.ts`

A taxa de acerto da sessão de questões é convertida em Rating do FSRS:

```ts
import { Rating } from './scheduler'

export function mapearTaxaParaRating(taxaAcerto: number): Rating {
  // taxaAcerto vem como decimal (0.0 a 1.0)
  if (taxaAcerto < 0.5)  return Rating.Again  // < 50%: errou demais, voltar logo
  if (taxaAcerto < 0.7)  return Rating.Hard   // 50-70%: difícil, intervalo curto
  if (taxaAcerto < 0.9)  return Rating.Good   // 70-90%: bom, intervalo padrão
  return Rating.Easy                           // 90%+: dominou, intervalo longo
}
```

**Estes thresholds podem ser ajustados** após coletarmos dados reais. Sugestão: revisar após 1000 reviews ou 1 mês de produção.

## Inicializar card

**Arquivo:** `/lib/fsrs/inicializar.ts`

Quando o aluno faz a **primeira sessão de questões** de um subtópico, cria-se o card FSRS.

```ts
import { createServerClient } from '@/lib/supabase/server'
import { scheduler, State, type Card } from './scheduler'

export async function inicializarCard(alunoId: string, subtopicoId: string): Promise<Card> {
  const supabase = createServerClient()
  
  // Verifica se já existe
  const { data: existente } = await supabase
    .from('fsrs_cards')
    .select('*')
    .eq('aluno_id', alunoId)
    .eq('subtopico_id', subtopicoId)
    .maybeSingle()
  
  if (existente) return existente as unknown as Card
  
  // Cria card novo no estado inicial
  const cardInicial: Card = {
    due: new Date(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: State.New,
    last_review: undefined
  }
  
  const { data, error } = await supabase
    .from('fsrs_cards')
    .insert({
      aluno_id: alunoId,
      subtopico_id: subtopicoId,
      difficulty: cardInicial.difficulty,
      stability: cardInicial.stability,
      state: 'new',
      due_date: cardInicial.due.toISOString(),
      review_count: 0,
      lapse_count: 0,
      scheduled_days: 0,
      elapsed_days: 0
    })
    .select()
    .single()
  
  if (error) throw new Error(`Falha ao criar card FSRS: ${error.message}`)
  return data as unknown as Card
}
```

## Processar revisão

**Arquivo:** `/lib/fsrs/revisar.ts`

Após uma sessão de questões, atualiza o card e retorna a próxima `due_date`.

```ts
import { createServerClient } from '@/lib/supabase/server'
import { scheduler, Rating, State, type Card } from './scheduler'
import { mapearTaxaParaRating } from './parametros'

export interface ResultadoRevisao {
  cardId: string
  dueAnterior: Date
  dueProxima: Date
  diasAteProxima: number
  rating: Rating
  difficultyAntes: number
  difficultyDepois: number
  stabilityAntes: number
  stabilityDepois: number
}

export async function processarRevisao(params: {
  alunoId: string
  subtopicoId: string
  acertos: number
  totalQuestoes: number
  duracaoSegundos: number
}): Promise<ResultadoRevisao> {
  const supabase = createServerClient()
  
  // 1. Buscar card atual
  const { data: cardData, error: cardErr } = await supabase
    .from('fsrs_cards')
    .select('*')
    .eq('aluno_id', params.alunoId)
    .eq('subtopico_id', params.subtopicoId)
    .single()
  
  if (cardErr || !cardData) {
    throw new Error(`Card FSRS não encontrado: ${cardErr?.message}`)
  }
  
  // 2. Reconstruir tipo Card a partir do banco
  const cardAtual: Card = {
    due: new Date(cardData.due_date),
    stability: cardData.stability,
    difficulty: cardData.difficulty,
    elapsed_days: cardData.elapsed_days,
    scheduled_days: cardData.scheduled_days,
    reps: cardData.review_count,
    lapses: cardData.lapse_count,
    state: stateFromString(cardData.state),
    last_review: cardData.last_review ? new Date(cardData.last_review) : undefined
  }
  
  // 3. Calcular rating a partir da performance
  const taxaAcerto = params.acertos / params.totalQuestoes
  const rating = mapearTaxaParaRating(taxaAcerto)
  
  // 4. Aplicar scheduler — retorna 4 opções (Again/Hard/Good/Easy), pegamos a nossa
  const agora = new Date()
  const opcoes = scheduler.repeat(cardAtual, agora)
  const escolha = opcoes[rating]
  const cardNovo = escolha.card
  
  // 5. Atualizar card no banco
  const { error: updErr } = await supabase
    .from('fsrs_cards')
    .update({
      difficulty: cardNovo.difficulty,
      stability: cardNovo.stability,
      state: stateToString(cardNovo.state),
      due_date: cardNovo.due.toISOString(),
      last_review: agora.toISOString(),
      review_count: cardNovo.reps,
      lapse_count: cardNovo.lapses,
      scheduled_days: cardNovo.scheduled_days,
      elapsed_days: cardNovo.elapsed_days,
      retrievability: calcularRetrievability(cardNovo, agora)
    })
    .eq('id', cardData.id)
  
  if (updErr) throw new Error(`Falha ao atualizar card: ${updErr.message}`)
  
  // 6. Registrar log
  await supabase.from('fsrs_reviews_log').insert({
    card_id: cardData.id,
    aluno_id: params.alunoId,
    rating,
    acertos: params.acertos,
    total_questoes: params.totalQuestoes,
    taxa_acerto: taxaAcerto * 100,
    duracao_segundos: params.duracaoSegundos,
    difficulty_antes: cardAtual.difficulty,
    stability_antes: cardAtual.stability,
    difficulty_depois: cardNovo.difficulty,
    stability_depois: cardNovo.stability,
    due_anterior: cardAtual.due.toISOString(),
    due_proxima: cardNovo.due.toISOString()
  })
  
  return {
    cardId: cardData.id,
    dueAnterior: cardAtual.due,
    dueProxima: cardNovo.due,
    diasAteProxima: cardNovo.scheduled_days,
    rating,
    difficultyAntes: cardAtual.difficulty,
    difficultyDepois: cardNovo.difficulty,
    stabilityAntes: cardAtual.stability,
    stabilityDepois: cardNovo.stability
  }
}

// Helpers
function stateFromString(s: string): State {
  return { new: State.New, learning: State.Learning, review: State.Review, relearning: State.Relearning }[s] as State
}

function stateToString(s: State): string {
  return { [State.New]: 'new', [State.Learning]: 'learning', [State.Review]: 'review', [State.Relearning]: 'relearning' }[s]
}

function calcularRetrievability(card: Card, agora: Date): number {
  if (card.stability === 0) return 0
  const diasDesdeUltima = card.last_review 
    ? (agora.getTime() - card.last_review.getTime()) / 86400000
    : 0
  // Fórmula FSRS: R = exp(-t/S * ln(0.9) / 0.9)
  return Math.exp(-diasDesdeUltima / card.stability * Math.log(0.9))
}
```

## Cron diário: calcular dues do dia

**Arquivo:** `/supabase/functions/calcular-fsrs-due/index.ts`

Roda às 4h da manhã (Brasília). Para cada aluno ativo:
1. Buscar cards com `due_date <= hoje`
2. Criar atividade `revisao_fsrs` na semana atual

```ts
// Edge Function (Deno)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // Autenticação via header secret
  if (req.headers.get('Authorization') !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('Não autorizado', { status: 401 })
  }
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  const hoje = new Date()
  
  // 1. Buscar todos alunos ativos
  const { data: alunos } = await supabase
    .from('alunos')
    .select('id')
    .is('deletado_em', null)
  
  let totalAtividadesCriadas = 0
  
  for (const aluno of alunos!) {
    // 2. Cards due
    const { data: cardsDue } = await supabase
      .from('fsrs_cards')
      .select(`
        id, subtopico_id, due_date, retrievability,
        subtopicos!inner(nome, topicos!inner(nome, peso_incidencia))
      `)
      .eq('aluno_id', aluno.id)
      .lte('due_date', hoje.toISOString())
    
    if (!cardsDue || cardsDue.length === 0) continue
    
    // 3. Semana atual
    const { data: semana } = await supabase
      .from('semanas')
      .select('id')
      .eq('aluno_id', aluno.id)
      .eq('status', 'atual')
      .maybeSingle()
    
    if (!semana) continue
    
    // 4. Agrupar cards por urgência e criar atividades
    // Cards com retrievability < 0.7 viram atividades individuais (críticos)
    // Outros podem ser agrupados em "sessão de revisão"
    
    const criticos = cardsDue.filter(c => c.retrievability !== null && c.retrievability < 0.7)
    const normais = cardsDue.filter(c => c.retrievability === null || c.retrievability >= 0.7)
    
    // Criar atividade individual para cada crítico
    for (const card of criticos) {
      await supabase.from('atividades').insert({
        semana_id: semana.id,
        aluno_id: aluno.id,
        subtopico_id: card.subtopico_id,
        tipo: 'revisao_fsrs',
        titulo: `Revisão urgente: ${card.subtopicos.nome}`,
        duracao_estimada_min: 15,
        origem: 'fsrs_due',
        peso_incidencia: card.subtopicos.topicos.peso_incidencia,
        status: 'pendente'
      })
      totalAtividadesCriadas++
    }
    
    // Se houver muitos normais, agrupar em sessão
    if (normais.length >= 3) {
      await supabase.from('atividades').insert({
        semana_id: semana.id,
        aluno_id: aluno.id,
        tipo: 'revisao_fsrs',
        titulo: `Sessão de revisão (${normais.length} tópicos)`,
        duracao_estimada_min: normais.length * 5,
        origem: 'fsrs_due',
        status: 'pendente'
      })
      totalAtividadesCriadas++
    } else {
      for (const card of normais) {
        await supabase.from('atividades').insert({
          semana_id: semana.id,
          aluno_id: aluno.id,
          subtopico_id: card.subtopico_id,
          tipo: 'revisao_fsrs',
          titulo: `Revisar: ${card.subtopicos.nome}`,
          duracao_estimada_min: 10,
          origem: 'fsrs_due',
          peso_incidencia: card.subtopicos.topicos.peso_incidencia,
          status: 'pendente'
        })
        totalAtividadesCriadas++
      }
    }
  }
  
  return new Response(JSON.stringify({ 
    sucesso: true, 
    atividades_criadas: totalAtividadesCriadas 
  }))
})
```

**Agendamento via Supabase pg_cron:**

```sql
SELECT cron.schedule(
  'calcular-fsrs-due-diario',
  '0 7 * * *', -- 04h Brasília = 07h UTC
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/calcular-fsrs-due',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret'))
  );
  $$
);
```

## Cluster de erro (V2)

Quando um subtópico aparecer em 3+ tentativas erradas em sessões distintas, marcar como "cluster de erro" e priorizar:

```ts
async function detectarClusterErro(alunoId: string, subtopicoId: string) {
  const supabase = createServerClient()
  
  // Buscar últimas 5 tentativas desse subtópico
  const { data: tentativas } = await supabase
    .from('tentativas_questoes')
    .select(`acertou, respondida_em, questoes!inner(subtopico_id)`)
    .eq('aluno_id', alunoId)
    .eq('questoes.subtopico_id', subtopicoId)
    .order('respondida_em', { ascending: false })
    .limit(5)
  
  if (!tentativas) return false
  
  const erros = tentativas.filter(t => !t.acertou).length
  return erros >= 3
}
```

Se for cluster de erro:
- Forçar Rating = Again no FSRS (independente da taxa)
- Sugerir revisão de teoria do subtópico antes de mais questões

## Visão "Mapa da Memória"

Os dados FSRS alimentam a tela `/app/memoria`:

```ts
export async function buscarMapaMemoria(alunoId: string) {
  const supabase = createServerClient()
  
  const { data } = await supabase
    .from('fsrs_cards')
    .select(`
      id, difficulty, stability, retrievability, due_date, state,
      subtopicos!inner(
        id, nome,
        topicos!inner(
          id, nome, peso_incidencia,
          blocos_tematicos!inner(
            nome,
            disciplinas!inner(id, nome, cor)
          )
        )
      )
    `)
    .eq('aluno_id', alunoId)
    .order('due_date', { ascending: true })
  
  // Classificar em buckets:
  // - "Em risco" (R < 0.7)
  // - "Atrasado" (due_date < hoje)
  // - "Devido em breve" (due_date < +7d)
  // - "Estável" (resto)
  
  const hoje = new Date()
  const proximaSemana = new Date(Date.now() + 7 * 86400000)
  
  return {
    em_risco: data!.filter(c => c.retrievability !== null && c.retrievability < 0.7),
    atrasado: data!.filter(c => new Date(c.due_date) < hoje),
    proximo: data!.filter(c => {
      const due = new Date(c.due_date)
      return due >= hoje && due <= proximaSemana
    }),
    estavel: data!.filter(c => new Date(c.due_date) > proximaSemana)
  }
}
```

## Parâmetros customizados por aluno (V2)

Após coletar dados, ajustar parâmetros FSRS por aluno usando o algoritmo de otimização da própria biblioteca `ts-fsrs`. Mantém modelo geral inicialmente e migra alunos individuais quando tiverem 100+ reviews.

## Decisões em aberto

1. **Threshold de retrievability:** 0.7 para "em risco" ou customizar por banca? **Default: 0.7 para todos no MVP.**
2. **Iniciar FSRS na primeira sessão de questões ou na primeira sessão correta?** **Default: primeira sessão, qualquer que seja a taxa.**
3. **O que acontece se aluno pula uma revisão FSRS?** **Default: card vira "atrasado", próxima revisão aplica penalty automático (intervalo menor).**
