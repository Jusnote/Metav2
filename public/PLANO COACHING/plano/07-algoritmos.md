# 07 — Algoritmos Críticos

> Os três algoritmos que definem a experiência do aluno: geração de semana, sugestão inteligente, composição de mix pedagógico.

## Algoritmo 1 — Geração de semana

**Arquivo:** `/lib/algoritmos/gerar-semana.ts`

### Quando dispara

- Conclusão da última atividade da semana atual (gera próxima)
- Job semanal aos domingos 23h59 (fecha semana mesmo se incompleta)
- Onboarding do aluno (gera Semana 1)

### Entrada

```ts
interface GerarSemanaParams {
  alunoId: string
  numeroSemana: number
  ehPrimeira: boolean
}
```

### Lógica completa

```ts
export async function gerarSemana(params: GerarSemanaParams) {
  const supabase = createServerClient()
  
  // 1. Buscar contexto do aluno
  const aluno = await buscarAluno(params.alunoId)
  const concurso = await buscarConcurso(aluno.concurso_id)
  const horasDisponiveis = calcularHorasDisponiveis(aluno.horas_por_dia)
  
  // 2. Criar registro da semana
  const dataInicio = proximaSegunda()
  const dataFim = proximoDomingo(dataInicio)
  
  const { data: semana } = await supabase.from('semanas').insert({
    aluno_id: params.alunoId,
    numero: params.numeroSemana,
    data_inicio: dataInicio,
    data_fim: dataFim,
    status: 'atual',
    horas_planejadas: horasDisponiveis
  }).select().single()
  
  // 3. Calcular composição alvo
  const composicao = calcularComposicaoSemana({
    horasTotais: horasDisponiveis,
    ehPrimeira: params.ehPrimeira
  })
  
  // 4. Buscar FSRS due (prioridade máxima)
  const horasReservadasFSRS = composicao.horas_revisao_fsrs
  const cardsDue = await buscarCardsFSRSDueProximos7Dias(params.alunoId)
  await criarAtividadesFSRS(semana.id, params.alunoId, cardsDue, horasReservadasFSRS)
  
  // 5. Selecionar tópicos para teoria nova
  const horasParaTeoriaNova = composicao.horas_teoria_nova
  const topicosNovos = await selecionarProximosTopicos({
    concursoId: concurso.id,
    alunoId: params.alunoId,
    horasMax: horasParaTeoriaNova,
    respeitarPreRequisitos: true,
    priorizarPesoAlto: true
  })
  await criarAtividadesTeoria(semana.id, params.alunoId, topicosNovos)
  
  // 6. Selecionar tópicos para questões (que tiveram teoria há 7+ dias)
  const horasParaQuestoes = composicao.horas_questoes
  const topicosParaQuestoes = await selecionarTopicosParaQuestoes({
    alunoId: params.alunoId,
    horasMax: horasParaQuestoes,
    diasMinimoDesdeTeoria: 7
  })
  await criarAtividadesQuestoes(semana.id, params.alunoId, topicosParaQuestoes)
  
  // 7. Selecionar tópicos para lei seca (que tiveram questões há 7+ dias)
  const horasParaLeiSeca = composicao.horas_lei_seca
  const topicosParaLei = await selecionarTopicosParaLeiSeca({
    alunoId: params.alunoId,
    horasMax: horasParaLeiSeca,
    diasMinimoDesdeQuestoes: 7
  })
  await criarAtividadesLeiSeca(semana.id, params.alunoId, topicosParaLei)
  
  // 8. Balancear disciplinas (nenhuma > 40% do tempo semanal)
  await balancearDisciplinas(semana.id, params.alunoId, horasDisponiveis)
  
  // 9. Marcar semana anterior como concluída
  if (!params.ehPrimeira) {
    await marcarSemanaAnteriorConcluida(params.alunoId, params.numeroSemana - 1)
  }
  
  return semana
}
```

### Função: calcularComposicaoSemana

```ts
interface ComposicaoSemana {
  horas_teoria_nova: number      // 30-40%
  horas_questoes: number         // 25-35%
  horas_lei_seca: number         // 15-20%
  horas_revisao_fsrs: number     // 15-25% (dinâmico)
  horas_buffer: number           // 5-10%
}

export function calcularComposicaoSemana(params: {
  horasTotais: number
  ehPrimeira: boolean
}): ComposicaoSemana {
  if (params.ehPrimeira) {
    // Semana 1: sem FSRS ainda (cards não existem)
    return {
      horas_teoria_nova: params.horasTotais * 0.70,
      horas_questoes: params.horasTotais * 0.20, // primeira sessão de questões dos tópicos novos
      horas_lei_seca: params.horasTotais * 0.10,
      horas_revisao_fsrs: 0,
      horas_buffer: 0
    }
  }
  
  // Semanas 2+: mix calibrado
  return {
    horas_teoria_nova: params.horasTotais * 0.35,
    horas_questoes: params.horasTotais * 0.30,
    horas_lei_seca: params.horasTotais * 0.15,
    horas_revisao_fsrs: params.horasTotais * 0.15,
    horas_buffer: params.horasTotais * 0.05
  }
}
```

### Função: selecionarProximosTopicos

```ts
async function selecionarProximosTopicos(params: {
  concursoId: string
  alunoId: string
  horasMax: number
  respeitarPreRequisitos: boolean
  priorizarPesoAlto: boolean
}): Promise<TopicoComMetadata[]> {
  const supabase = createServerClient()
  
  // Buscar tópicos NÃO iniciados (sem atividade de teoria concluída)
  const { data: topicos } = await supabase.rpc('buscar_topicos_nao_iniciados', {
    p_concurso_id: params.concursoId,
    p_aluno_id: params.alunoId
  })
  
  if (!topicos) return []
  
  // Filtrar por pré-requisitos
  let candidatos = topicos
  if (params.respeitarPreRequisitos) {
    candidatos = await filtrarPorPreRequisitos(candidatos, params.alunoId)
  }
  
  // Ordenar por: peso (desc), ordem do edital (asc)
  if (params.priorizarPesoAlto) {
    candidatos.sort((a, b) => {
      if (a.peso_incidencia !== b.peso_incidencia) {
        return b.peso_incidencia - a.peso_incidencia
      }
      return a.ordem_global - b.ordem_global
    })
  }
  
  // Selecionar até horasMax
  const selecionados: TopicoComMetadata[] = []
  let horasAcumuladas = 0
  
  for (const topico of candidatos) {
    if (horasAcumuladas + topico.horas_sugeridas > params.horasMax) {
      // Se ainda cabe parcialmente, marca para divisão
      const horasRestantes = params.horasMax - horasAcumuladas
      if (horasRestantes >= 1) {
        selecionados.push({ ...topico, horas_alocadas: horasRestantes })
      }
      break
    }
    selecionados.push({ ...topico, horas_alocadas: topico.horas_sugeridas })
    horasAcumuladas += topico.horas_sugeridas
  }
  
  return selecionados
}
```

### Função: balancearDisciplinas

```ts
async function balancearDisciplinas(semanaId: string, alunoId: string, horasTotais: number) {
  const supabase = createServerClient()
  const MAX_PCT_POR_DISCIPLINA = 0.40
  const limiteHoras = horasTotais * MAX_PCT_POR_DISCIPLINA
  
  // Calcular horas por disciplina na semana
  const { data: agrupado } = await supabase.rpc('horas_por_disciplina_na_semana', {
    p_semana_id: semanaId
  })
  
  for (const grupo of agrupado!) {
    if (grupo.total_horas > limiteHoras) {
      // Remover atividades de menor peso até balancear
      const excesso = grupo.total_horas - limiteHoras
      await removerAtividadesDeMenorPeso(semanaId, grupo.disciplina_id, excesso)
    }
  }
}
```

## Algoritmo 2 — Sugestão inteligente

**Arquivo:** `/lib/algoritmos/sugerir-proxima.ts`

### Quando dispara

- Sempre que o aluno abre `/app/semana` (componente `SugestaoInteligente`)
- Quando aluno clica "outra" no banner de sugestão

### Lógica

```ts
export interface SugestaoAtividade {
  atividade: Atividade
  razao: string // texto explicando por que essa
  alternativas: Atividade[] // top 3 outras opções
}

export async function sugerirProximaAtividade(params: {
  alunoId: string
  tempoDisponivelMin?: number  // se aluno informou
  agora?: Date
}): Promise<SugestaoAtividade | null> {
  const supabase = createServerClient()
  const agora = params.agora ?? new Date()
  
  // 1. Buscar todas atividades pendentes da semana
  const { data: pendentes } = await supabase
    .from('atividades')
    .select(`
      *,
      topicos:topico_id(*, blocos_tematicos!inner(disciplinas(id, nome, cor)))
    `)
    .eq('aluno_id', params.alunoId)
    .eq('status', 'pendente')
  
  if (!pendentes || pendentes.length === 0) return null
  
  // 2. Aplicar filtros duros
  let candidatos = pendentes
  
  if (params.tempoDisponivelMin) {
    candidatos = candidatos.filter(a => a.duracao_estimada_min <= params.tempoDisponivelMin)
  }
  
  // 3. Calcular score para cada candidato
  const scored = candidatos.map(atividade => ({
    atividade,
    score: calcularScore(atividade, {
      ultimasAtividades: pendentes.filter(a => a.status === 'concluida').slice(-5),
      agora,
      horarioPico: 'manha' // buscar do aluno
    })
  }))
  
  // 4. Ordenar por score desc
  scored.sort((a, b) => b.score.total - a.score.total)
  
  const escolhida = scored[0]
  const alternativas = scored.slice(1, 4).map(s => s.atividade)
  
  return {
    atividade: escolhida.atividade,
    razao: gerarRazao(escolhida.score),
    alternativas
  }
}

interface Score {
  prioridade_fsrs: number    // 0-30: cards atrasados pesam muito
  peso_incidencia: number     // 0-25: peso 5 > peso 1
  variacao_disciplina: number // 0-15: evita repetir mesma disciplina
  alinhamento_horario: number // 0-15: peso alto em horário de pico
  novidade: number            // 0-10: tópicos não vistos recentemente
  cabe_no_tempo: number       // 0-5: bonus se tempo encaixa bem
  total: number
}

function calcularScore(atividade: any, contexto: any): Score {
  const s: Score = {
    prioridade_fsrs: 0,
    peso_incidencia: 0,
    variacao_disciplina: 0,
    alinhamento_horario: 0,
    novidade: 0,
    cabe_no_tempo: 0,
    total: 0
  }
  
  // FSRS due hoje → prioridade máxima
  if (atividade.origem === 'fsrs_due') {
    s.prioridade_fsrs = 30
  }
  
  // Peso de incidência
  s.peso_incidencia = (atividade.peso_incidencia ?? 3) * 5
  
  // Variação de disciplina (penalizar repetir)
  const disciplinasRecentes = contexto.ultimasAtividades
    .map((a: any) => a.topicos?.blocos_tematicos?.disciplinas?.id)
    .filter(Boolean)
  
  const disciplinaAtual = atividade.topicos?.blocos_tematicos?.disciplinas?.id
  const repeticoes = disciplinasRecentes.filter((d: string) => d === disciplinaAtual).length
  s.variacao_disciplina = Math.max(0, 15 - (repeticoes * 5))
  
  // Alinhamento com horário
  const hora = contexto.agora.getHours()
  const ehPicoCognitivo = (contexto.horarioPico === 'manha' && hora >= 6 && hora < 12)
    || (contexto.horarioPico === 'tarde' && hora >= 12 && hora < 18)
    || (contexto.horarioPico === 'noite' && hora >= 18 && hora < 23)
  
  if (ehPicoCognitivo) {
    // Em pico, prioriza teoria pesada
    if (atividade.tipo === 'teoria' && (atividade.peso_incidencia ?? 0) >= 4) {
      s.alinhamento_horario = 15
    }
  } else {
    // Fora do pico, prioriza tarefas mais leves
    if (['revisao_fsrs', 'mapa_mental', 'resumo'].includes(atividade.tipo)) {
      s.alinhamento_horario = 10
    }
  }
  
  s.total = Object.values(s).reduce((a, b) => a + b, 0) - s.total
  return s
}

function gerarRazao(score: Score): string {
  if (score.prioridade_fsrs > 0) {
    return 'Revisão FSRS pendente — não deixe a memória cair'
  }
  if (score.peso_incidencia >= 20 && score.alinhamento_horario >= 10) {
    return 'Tópico crítico e seu horário de pico — momento ideal'
  }
  if (score.variacao_disciplina >= 10) {
    return 'Variar disciplina ajuda a fixar melhor'
  }
  return 'Próxima atividade alinhada com seu progresso'
}
```

## Algoritmo 3 — Composição do dashboard de KPIs

**Arquivo:** `/lib/algoritmos/kpis-semana.ts`

```ts
export interface KPIsSemana {
  qualidade_pct: number          // % do peso 5 da semana já coberto
  horas_estudadas: number
  horas_planejadas: number
  questoes_resolvidas: number
  taxa_acerto_pct: number
  ritmo: 'adiantado' | 'no_prazo' | 'atrasado'
  ritmo_dias: number             // dias adiantado/atrasado em relação ao planejado
}

export async function calcularKPIsSemana(semanaId: string): Promise<KPIsSemana> {
  const supabase = createServerClient()
  
  const { data: atividades } = await supabase
    .from('atividades')
    .select('*')
    .eq('semana_id', semanaId)
  
  const { data: semana } = await supabase
    .from('semanas')
    .select('*')
    .eq('id', semanaId)
    .single()
  
  // 1. Qualidade: % do peso 5 coberto
  const peso5Total = atividades!.filter(a => a.peso_incidencia === 5).length
  const peso5Concluido = atividades!.filter(a => a.peso_incidencia === 5 && a.status === 'concluida').length
  const qualidade_pct = peso5Total === 0 ? 0 : (peso5Concluido / peso5Total) * 100
  
  // 2. Horas estudadas
  const horas_estudadas = atividades!
    .filter(a => a.status === 'concluida' && a.duracao_real_min)
    .reduce((acc, a) => acc + (a.duracao_real_min! / 60), 0)
  
  // 3. Questões e taxa
  const atividadesQuestoes = atividades!.filter(a => 
    (a.tipo === 'questoes' || a.tipo === 'revisao_fsrs') && a.status === 'concluida'
  )
  
  const { data: tentativas } = await supabase
    .from('tentativas_questoes')
    .select('acertou')
    .in('atividade_id', atividadesQuestoes.map(a => a.id))
  
  const questoes_resolvidas = tentativas?.length ?? 0
  const acertos = tentativas?.filter(t => t.acertou).length ?? 0
  const taxa_acerto_pct = questoes_resolvidas === 0 ? 0 : (acertos / questoes_resolvidas) * 100
  
  // 4. Ritmo
  const hoje = new Date()
  const inicio = new Date(semana!.data_inicio)
  const fim = new Date(semana!.data_fim)
  const diasTotal = Math.ceil((fim.getTime() - inicio.getTime()) / 86400000)
  const diasPassados = Math.ceil((hoje.getTime() - inicio.getTime()) / 86400000)
  const progressoEsperado = diasPassados / diasTotal
  const progressoReal = atividades!.filter(a => a.status === 'concluida').length / atividades!.length
  
  let ritmo: KPIsSemana['ritmo'] = 'no_prazo'
  const diferenca = progressoReal - progressoEsperado
  if (diferenca > 0.15) ritmo = 'adiantado'
  else if (diferenca < -0.15) ritmo = 'atrasado'
  
  return {
    qualidade_pct,
    horas_estudadas,
    horas_planejadas: semana!.horas_planejadas ?? 0,
    questoes_resolvidas,
    taxa_acerto_pct,
    ritmo,
    ritmo_dias: Math.round(diferenca * diasTotal)
  }
}
```

## Algoritmo 4 — Aviso pedagógico (Opção B do espaçamento)

Quando aluno tenta iniciar uma atividade que viola o espaçamento ideal, sistema avisa mas não bloqueia.

```ts
export async function verificarEspacamentoIdeal(atividadeId: string): Promise<{
  ok: boolean
  aviso?: string
  diasIdeais?: number
}> {
  const supabase = createServerClient()
  
  const { data: atividade } = await supabase
    .from('atividades')
    .select('*, topicos!inner(id)')
    .eq('id', atividadeId)
    .single()
  
  if (!atividade) return { ok: true }
  
  // Para questões: precisa de teoria concluída há 7+ dias
  if (atividade.tipo === 'questoes' && atividade.topico_id) {
    const { data: teoria } = await supabase
      .from('atividades')
      .select('concluida_em')
      .eq('aluno_id', atividade.aluno_id)
      .eq('topico_id', atividade.topico_id)
      .eq('tipo', 'teoria')
      .eq('status', 'concluida')
      .order('concluida_em', { ascending: false })
      .limit(1)
      .single()
    
    if (teoria?.concluida_em) {
      const diasDesdeTeoria = Math.floor(
        (Date.now() - new Date(teoria.concluida_em).getTime()) / 86400000
      )
      
      if (diasDesdeTeoria < 5) {
        return {
          ok: false,
          aviso: `Você concluiu a teoria há ${diasDesdeTeoria} dia${diasDesdeTeoria !== 1 ? 's' : ''}. Questões rendem mais depois de 5+ dias — o esforço de lembrar fixa o conteúdo. Deseja continuar mesmo assim?`,
          diasIdeais: 7 - diasDesdeTeoria
        }
      }
    }
  }
  
  return { ok: true }
}
```

## Funções SQL auxiliares

Algumas operações são mais eficientes como funções SQL:

```sql
-- /supabase/migrations/012_funcoes_auxiliares.sql

CREATE OR REPLACE FUNCTION buscar_topicos_nao_iniciados(
  p_concurso_id UUID,
  p_aluno_id UUID
)
RETURNS TABLE (
  id UUID,
  nome TEXT,
  peso_incidencia INT,
  horas_sugeridas NUMERIC,
  ordem_global INT,
  pre_requisito_topico_id UUID,
  disciplina_id UUID
) AS $$
  SELECT 
    t.id, t.nome, t.peso_incidencia, t.horas_sugeridas, 
    (d.ordem * 1000 + b.ordem * 100 + t.ordem) AS ordem_global,
    t.pre_requisito_topico_id,
    d.id AS disciplina_id
  FROM topicos t
  JOIN blocos_tematicos b ON b.id = t.bloco_id
  JOIN disciplinas d ON d.id = b.disciplina_id
  WHERE d.concurso_id = p_concurso_id
    AND NOT EXISTS (
      SELECT 1 FROM atividades a
      WHERE a.topico_id = t.id
        AND a.aluno_id = p_aluno_id
        AND a.tipo = 'teoria'
        AND a.status = 'concluida'
    )
  ORDER BY ordem_global;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION horas_por_disciplina_na_semana(p_semana_id UUID)
RETURNS TABLE (
  disciplina_id UUID,
  disciplina_nome TEXT,
  total_horas NUMERIC
) AS $$
  SELECT 
    d.id,
    d.nome,
    SUM(a.duracao_estimada_min) / 60.0 AS total_horas
  FROM atividades a
  JOIN topicos t ON t.id = a.topico_id
  JOIN blocos_tematicos b ON b.id = t.bloco_id
  JOIN disciplinas d ON d.id = b.disciplina_id
  WHERE a.semana_id = p_semana_id
  GROUP BY d.id, d.nome
  ORDER BY total_horas DESC;
$$ LANGUAGE SQL STABLE;
```

## Testes mínimos

Cada algoritmo crítico deve ter teste unitário básico:

```ts
// __tests__/gerar-semana.test.ts
describe('gerarSemana', () => {
  it('respeita limite de 40% por disciplina', async () => {
    const semana = await gerarSemana({ alunoId: 'test', numeroSemana: 1, ehPrimeira: true })
    const distribuicao = await calcularDistribuicaoDisciplinas(semana.id)
    
    for (const d of distribuicao) {
      expect(d.percentual).toBeLessThanOrEqual(0.4)
    }
  })
  
  it('não cria questões antes de teoria estar concluída há 7 dias', async () => {
    // setup: aluno com teoria concluída ontem
    const semana = await gerarSemana({ alunoId: 'test', numeroSemana: 2, ehPrimeira: false })
    const atividades = await buscarAtividades(semana.id)
    
    const questoesRecentes = atividades.filter(a => 
      a.tipo === 'questoes' && 
      diasDesdeTeoria(a.topico_id) < 7
    )
    expect(questoesRecentes).toHaveLength(0)
  })
})
```

## Decisões em aberto

1. **Percentual de buffer:** 5% ou 10%? **Default: 5% no MVP, ajustável.**
2. **Disciplina única dominante:** alguns concursos têm 60% de uma disciplina (Penal num concurso de Delegado). **Default: relaxar regra de 40% se concurso tiver disciplina-mãe declarada.**
3. **Tempo disponível "agora":** sistema pergunta ao aluno toda vez ou assume default? **Default: campo opcional, mostrado discreto no banner.**
