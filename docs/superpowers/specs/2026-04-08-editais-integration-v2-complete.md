# Integração Editais × Documents-Organization — Design Spec v2

## Overview

Sistema de estudo adaptativo para concursos que integra editais (API GraphQL) ao Documents-Organization, com motor de otimização de nota, revisão por questões (CSSL), FlashQuestões, diagnóstico adaptativo, e pipeline de enriquecimento de dados.

**Princípio central:** Não é um agendador. É um **tutor adaptativo** que decide O QUÊ, QUANDO, COMO e QUANTO o aluno deve estudar para maximizar sua nota.

**Dois modos:**
- **Modo Edital** (tem data de prova): otimização ancorada na prova, triagem, compressão pré-prova
- **Modo Contínuo** (sem edital aberto): otimiza aprendizado por hora, sem restrição de data. Migra para Modo Edital quando um edital é vinculado.

---

## Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MOTOR DE DECISÃO                            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────┐     │
│  │  Diagnóstico  │  │  Otimizador de   │  │  Scheduler CSSL   │     │
│  │  Adaptativo   │→ │  Nota (Score     │→ │  (revisão híbrida │     │
│  │  (CAT)        │  │  Engine)         │  │  + constraint)    │     │
│  └──────────────┘  └──────────────────┘  └───────────────────┘     │
│         ↑                   ↑                      ↑                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              MODELO DE APRENDIZADO (por tópico)              │   │
│  │  mastery_score | learning_stage | question_accuracy |        │   │
│  │  retention | speed | error_patterns | peso_edital            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│         ↑                   ↑                      ↑                │
│  ┌─────────────┐  ┌──────────────────┐  ┌───────────────────┐     │
│  │ FlashQuestões│  │ Study Sessions   │  │ Score Snapshots   │     │
│  │ Engine       │  │ (compostas)      │  │ (projeção nota)   │     │
│  └─────────────┘  └──────────────────┘  └───────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────┬───────────────────────────────────────────┐
│   API Editais (GraphQL) │         Supabase (PostgreSQL)             │
│                         │                                           │
│   editais, cargos       │   planos_estudo, planos_editais          │
│   disciplinas, topicos  │   disciplinas, topicos (local, lazy)     │
│   subtopicos_enriquecidos│  questoes_log, study_sessions           │
│   dificuldade, frequência│  score_snapshots                        │
│   alternativas_metadata │   schedule_items, documents, notes       │
│   peso por disciplina   │   user_study_config                      │
└─────────────────────────┴───────────────────────────────────────────┘
```

### Separação de responsabilidades

| Dado | Fonte | Mutável pelo aluno? |
|------|-------|---------------------|
| Estrutura do edital (disciplinas, tópicos) | API Editais | Não |
| Subtópicos enriquecidos e frequência | API Editais | Não |
| Dificuldade das questões | API Editais (calculado) | Não |
| Peso por disciplina na prova | API Editais / admin | Não |
| Metadata de alternativas (confusão) | API Editais (pipeline) | Não |
| Planos de estudo, vínculos | Supabase | Sim |
| Progresso, mastery score, learning stage | Supabase | Sim (via sistema) |
| Questões respondidas (questoes_log) | Supabase | Sim |
| Sessões de estudo | Supabase | Sim |
| Score snapshots (nota estimada) | Supabase | Sim (via sistema) |
| Cronograma, schedule_items, revisões | Supabase | Sim |
| Resumos, notas, FlashQuestões criadas | Supabase | Sim |

---

## Pipeline de Enriquecimento de Dados (por edital, em lotes)

### Fontes de dados

| Dado | Fonte | Como obter |
|------|-------|-----------|
| Subtópicos de cada tópico | Cursinhos (Estratégia, Gran, Alfacon) | Scraping dos programas de curso por disciplina. Cada cursinho já detalha "Homicídio" em qualificado, privilegiado, culposo, etc. |
| Taxa de acerto por questão | Sites de questões (QConcursos, TEC) | Scraping das estatísticas públicas. Cada questão tem "X% acertaram". |
| Frequência de cobrança por subtópico | Análise das 253K provas | Categorizar questões por subtópico via NLP/IA. "Questão sobre feminicídio" → subtópico "Feminicídio (§2°-A)" do tópico "Homicídio". |
| Peso por disciplina na prova | Edital + histórico | Edital especifica qtd de questões. Se não, usar média histórica da banca. |
| Metadata de alternativas (conceito testado) | Análise por IA | Para cada alternativa de cada questão, identificar qual conceito ela testa. Se a alternativa errada corresponde a outro tópico → flag como par de confusão. |

### Processo por lote (por edital)

```
Para cada edital novo importado na API:

1. ENRIQUECER SUBTÓPICOS
   Para cada tópico do edital:
     - Buscar breakdown em cursinhos (scraping ou base curada)
     - Se não encontrar: gerar via IA (GPT/Claude) baseado no nome do tópico + artigos de lei
     - Salvar como subtopicos_enriquecidos (JSONB no tópico)
     - Validação: comparar com tópicos similares de outros editais já enriquecidos

2. CALCULAR FREQUÊNCIA POR SUBTÓPICO
   Buscar questões da mesma banca + disciplina nas 253K provas
   Categorizar por subtópico (NLP/IA)
   Resultado: frequencia (%) por subtópico
   Salvar no campo subtopicos_enriquecidos.frequencia

3. IMPORTAR DIFICULDADE DAS QUESTÕES
   Para questões que existem em QConcursos/TEC:
     Buscar taxa de acerto
     dificuldade = 1 - taxa_acerto
   Para questões sem dados:
     dificuldade_default = média da banca + disciplina
   Salvar no campo questao.dificuldade

4. ANALISAR ALTERNATIVAS PARA CONFUSÃO
   Para cada questão:
     Analisar cada alternativa via IA:
       "Qual conceito esta alternativa testa?"
     Se alternativa_errada.conceito ≠ questao.conceito:
       Registrar par de confusão (conceito_A, conceito_B)
   Salvar como metadata da questão

5. DEFINIR PESO POR DISCIPLINA
   Se edital especifica qtd de questões por disciplina:
     peso = qtd_questoes / total_questoes
   Se não especifica:
     Buscar últimas 5 provas da mesma banca + cargo similar
     peso = média histórica
   Salvar no campo disciplina.peso_edital
```

### Schema API para enriquecimento

```sql
-- Na API editais (PostgreSQL separado)

-- Subtópicos enriquecidos no tópico
ALTER TABLE topicos ADD COLUMN subtopicos_enriquecidos JSONB DEFAULT '[]';
-- Formato: [{"nome": "Qualificadoras (§2°)", "frequencia": 0.94, "peso_relativo": 0.35}]

-- Peso por disciplina
ALTER TABLE disciplinas ADD COLUMN peso_prova DECIMAL(5,2);
-- Se edital diz "15 questões de 100" → 0.15

-- Dificuldade por questão (tabela topico_questoes expandida)
ALTER TABLE topico_questoes ADD COLUMN dificuldade DECIMAL(3,2) DEFAULT 0.50;
ALTER TABLE topico_questoes ADD COLUMN taxa_acerto DECIMAL(3,2);
ALTER TABLE topico_questoes ADD COLUMN total_respostas INTEGER DEFAULT 0;
ALTER TABLE topico_questoes ADD COLUMN alternativas_metadata JSONB;
-- Formato: [{"letra": "A", "conceito": "homicidio_qualificado"}, {"letra": "B", "conceito": "homicidio_privilegiado"}, ...]
ALTER TABLE topico_questoes ADD COLUMN pares_confusao JSONB DEFAULT '[]';
-- Formato: [{"conceito_a": "qualificado", "conceito_b": "privilegiado"}]
```

---

## Motor de Revisão: CSSL (Concurso-Specific Spaced Learning)

### Princípio: Revisão = Questões

Toda revisão é baseada em questões, não em releitura. O Testing Effect (Roediger & Karpicke, 2006) mostra 50% mais retenção via teste vs releitura.

- **Revisão de um tópico** = responder 10-15 questões daquele tópico
- Se acertou 8+ → retenção boa → espaça mais
- Se acertou 6-7 → retenção ok → mantém intervalo
- Se acertou <6 → retenção ruim → intervalo curto + sugere releitura da teoria
- A teoria é material de CONSULTA quando erra, não material de REVISÃO

### FlashQuestões (substitui flashcards tradicionais)

Questões curtas, atômicas, no formato de questão de prova:
- 1 questão = 1 conceito
- Resposta em 30-60 segundos
- Dificuldade adaptativa (sobe/desce com performance)
- Agendadas pelo CSSL como flashcards eram
- Geradas por IA a partir da teoria OU importadas de bancos de questões
- Na UI: substitui o card "Flashcards" por "FlashQuestões"

### CSSL por tipo de atividade

| Atividade | Modelo de revisão | Lógica |
|-----------|------------------|--------|
| **FlashQuestões** | CSSL exam-anchored | Intervalos calculados para R máximo no dia da prova. Retention target proporcional ao peso da disciplina. |
| **Lei Seca** | CSSL exam-anchored (alta retenção) | retention_target: 0.92. Revisão por recall ativo ("O que diz o Art. 121 §2°?") |
| **Teoria** | Progressão por mastery levels | Nível 1→2→3→4 avaliado por tipo de questão. Sem intervalo fixo — avança quando demonstra competência. |
| **Questões de prova** | Performance adaptativa | Mais questões onde erra mais. Frequência proporcional ao gap de performance. |

### CSSL Exam-Anchored (para FlashQuestões e Lei Seca)

Em vez de FSRS padrão ("revise quando R cair a 0.90"):

```
DADO:
  exam_date = data da prova
  stability = estabilidade atual do item (FSRS calcula)
  retention_target = 0.85 a 0.95 (proporcional ao peso)

CALCULAR:
  Datas de revisão que MAXIMIZAM R no dia da prova
  
  Backplan do exam_date:
    última_revisão = exam_date - dias_para_R_target(stability, retention_target)
    penúltima = última_revisão - dias_para_R_target(stability × 0.8, retention_target)
    ... recursivamente até hoje

CONSTRAINT:
  Se revisão calha num dia com 0h disponíveis → adianta 1 dia
  Se total de revisões num dia > horas disponíveis → distribui nos dias adjacentes
```

**Modo Contínuo (sem data):** usa intervalos CSSL padrão sem anchoring. Se o aluno vincular um edital depois, o sistema recalcula as datas de revisão anchored.

### Fases do estudo por tópico

```
FASE 1 — APRENDIZADO (mastery 0-25):
  Dia 0: Teoria + FlashQuestões fáceis
  Dia 1: Questões básicas + Lei Seca vinculada
  Dia 3: Revisão via 10 questões (recall ativo)
  Dia 7: Revisão via 10 questões + 3 FlashQuestões

FASE 2 — CONSOLIDAÇÃO (mastery 25-50):
  Intervalo base: 7 dias
  Ajustado: × 0.7 se peso > 15%, × 1.3 se accuracy > 85%
  Tipo: questões médias + discriminação

FASE 3 — MANUTENÇÃO (mastery 50-75):
  Intervalo base: 14 dias
  Tipo: questões difíceis + casos práticos

FASE 4 — DOMÍNIO (mastery 75+):
  Intervalo base: 21 dias
  Tipo: questões de velocidade + simulados parciais

FASE PRÉ-PROVA (últimos 7 dias):
  TUDO em revisão diária
  Prioridade = peso × (1 - retenção)
  Zero material novo
  1 simulado completo cronometrado (dia -3)
```

### Auto-avaliação: peso mínimo

A auto-avaliação (Fácil/Médio/Difícil) tem apenas 10% de peso no cálculo do rating:

```
rating_efetivo = question_accuracy × 0.50 + recall_speed × 0.20 + discrimination × 0.20 + auto_avaliacao × 0.10
```

O aluno vê a auto-avaliação no form (é motivador), mas o scheduling usa primordialmente dados objetivos.

---

## Motor de Nota Estimada (Score Engine)

### Cálculo

```
nota_estimada = Σ(peso_disciplina_i × mastery_score_i / 100)

mastery_score = (
    theory_completion × 0.15      // Leu a teoria?
  + question_accuracy × 0.40     // % acerto nas últimas 20 questões
  + retention_score × 0.25       // % recall nas revisões
  + speed_score × 0.10           // Responde rápido?
  + discrimination × 0.10        // Distingue conceitos similares?
)
```

### Projeção

```
nota_projetada = Σ(peso_i × performance_projetada_i × retenção_no_dia_prova_i)

performance_projetada = min(0.95, accuracy_atual + taxa_aprendizado × horas_restantes^0.4)
retenção_no_dia_prova = e^(-dias_sem_revisão / stability)
```

### ROI por disciplina

```
roi = peso × (1 - accuracy_atual) × taxa_aprendizado / horas_já_investidas^0.6
```

Mostra: "Dir. Administrativo: +12.4 pontos possíveis com ROI de 2.1/hora ← PRIORIDADE"

### Interface

```
┌─────────────────────────────────────────────┐
│  Nota estimada: 76/100  ▲+4 esta semana     │
│  Projetada no dia da prova: 81/100          │
│  Probabilidade de aprovação: 67%            │
│  Meta: 80 pontos | Faltam: 4               │
├─────────────────────────────────────────────┤
│  █████████████░░ Dir. Const.   65%  +8.7pts │ ⭐
│  ████████████████ Dir. Penal    82%  +2.7pts │
│  ██████░░░░░░░░░ Dir. Admin.   38%  +12.4pts│ ⭐⭐
│  █████████████░░ Português     71%  +2.9pts │
│  ██░░░░░░░░░░░░░ Rac. Lógico  15%  +8.5pts │ ⭐
│                                              │
│  ⭐ = maior retorno por hora                 │
│  Recomendação: foque em Dir. Administrativo  │
└─────────────────────────────────────────────┘
```

---

## Cronograma Semanal — Cockpit de Estudo

### Filosofia: Sprint Semanal, Não Agenda Diária

O cronograma NÃO dita o dia do aluno. Ele dá um **sprint semanal** — um pacote de tarefas para completar até domingo. O aluno tem autonomia para decidir QUANDO e em que ORDEM fazer cada tarefa.

- Sem culpa por faltar um dia (compensa no dia seguinte)
- Sem rigidez de horário (o aluno escolhe)
- A semana é a unidade de planejamento, não o dia
- Tarefas não completadas rolam para a semana seguinte (com badge "atrasado")

### Interface: Cockpit com Lista Unificada + Abas

**Toggle** Edital/Cronograma no topo (mesmo toggle do layout 3-níveis)

**Acima do fold:**
- Header: toggle + seletor de semana (← 7-13 Abril →) + streak 🔥 + edital ref
- 4 anéis de progresso semanal (Estudo, Revisão, Questões, Lei Seca) — inspirado Apple Watch
- Nota estimada com gradient + trend + badge dias até prova
- Barra de progresso semanal linear (13/18)
- Quick session buttons: "Sessão automática · 50min" + "Rápida · 25min"
- Abas: **Tarefas** | **Insights** | **Sessões** | **E se?**

**Aba Tarefas (principal):**
Lista unificada de TODAS as tarefas da semana — sem divisões "sugerido" / "restante" / "concluídas".
- Nota sutil no topo: "Itens em destaque são sugeridos para hoje"
- Sugeridos: background lilás (#f5f3ff) + border-left roxo (#6c63ff)
- Regulares: fundo branco, sem destaque
- Concluídos: inline, check roxo preenchido + texto riscado + opacidade ~30%
- Cada tarefa mostra: checkbox, nome, disciplina, tipo (label texto), duração, pontos (+0.4 pts), deadline se revisão urgente
- Botão "Iniciar" roxo aparece no hover (ou visível nos sugeridos)

**Aba Insights:**
- Ponto fraco: disciplina com maior retorno
- Evolução: melhorias da semana (velocidade, accuracy)
- Projeção: se mantiver ritmo, nota no dia da prova

**Aba Sessões:**
- Lista de sessões recentes com horário, duração, descrição, pontos ganhos

**Aba E se? (simulador):**
- Slider interativo: "Se eu estudar [X h/dia] → nota Y"
- Projeções de cenários (mais horas, foco em disciplina específica)

**Footer:**
- "Fechar anéis: +4.7 pts · Projeção: 80.7" + ref edital

### 4 Anéis (progresso semanal por tipo)

| Anel | Cor | Conta |
|------|-----|-------|
| Estudo | #6c63ff (roxo principal) | sessões de estudo novo completadas / total |
| Revisão | #9b8afb (roxo claro) | revisões completadas / total |
| Questões | #b4acf9 (roxo mais claro) | sessões de questões completadas / total |
| Lei Seca | #4f46e5 (roxo escuro) | leituras completadas / total |

Fechar todos os 4 anéis = semana perfeita.

### Sugestão Automática de "Para Hoje"

O sistema seleciona 3-4 tarefas como "sugeridas para hoje" baseado em:
1. Urgência de revisão (CSSL: deadline dentro da semana)
2. Prioridade (peso × gap de performance)
3. Variedade (mix de pelo menos 2 tipos diferentes)
4. Tempo disponível (estimado do user_study_config)

São SUGESTÕES — o aluno pode ignorar e fazer qualquer tarefa do pool semanal.

### Otimizador Semanal

```
Para cada semana:
  horas_semanais = Σ horas_disponíveis(dia) para seg-dom
  
  1. OBRIGATÓRIO: Revisões com deadline nesta semana (CSSL)
     Cada revisão tem soft deadline ("até quarta")
     
  2. OTIMIZADO: Estudo novo + questões
     Para cada tópico não-dominado:
       ganho_marginal = peso × taxa_melhoria × retenção × (1 - accuracy)
     Selecionar tópicos que MAXIMIZAM nota dentro das horas disponíveis
     Respeitar: max ~10 tópicos novos/semana, dependências
     
  3. INTERLEAVING: Questões mistas
     ~20-30% da carga semanal = sessões de questões de múltiplas disciplinas
     
  4. TRIAGEM: Se horas insuficientes
     Mostrar ROI e recomendar foco
```

### Ciclos de estudo (macro-cronograma)

```
Ciclo 1 — Cobertura (0-40% do tempo até prova):
  Ver todos os tópicos superficialmente
  70% teoria + 30% questões básicas

Ciclo 2 — Profundidade (40-70%):
  Aprofundar fracos, revisar fortes
  40% teoria avançada + 40% questões + 20% revisão

Ciclo 3 — Aplicação (70-90%):
  Resolver questões de prova
  20% teoria (lacunas) + 60% questões + 20% revisão

Ciclo 4 — Pré-Prova (últimos 10%):
  Maximizar retenção
  0% teoria nova + 30% questões + 70% revisão + simulados
```

Transição automática baseada em % do tempo restante.

### Triagem (quando tempo insuficiente)

```
Se horas_necessárias > horas_disponíveis × 1.2:
  Calcular ROI por tópico
  Cortar do fundo até caber
  
  Mostrar transparentemente:
  "Com X horas restantes, foque nestas 14 disciplinas.
   Cobertura mínima nestas 4 (baixo retorno).
   Nota projetada: 77 (vs 71 se estudar tudo superficialmente)."
```

### Rollover semanal

Domingo à noite: tarefas não completadas viram "Atrasado" na semana seguinte (badge). O otimizador rebalanceia se a carga ultrapassou a capacidade.

### Efeito "Mais Um" (autoplay)

Após completar uma sessão:
```
"Sessão concluída! +0.8 pontos"
Próxima sessão em 5... 4... 3...
[Iniciar] [Parar por hoje]
```
Se o aluno não clica nada, a próxima sessão inicia. Cria hábito de "binge de estudo".

---

## Diagnóstico Adaptativo (CAT)

Antes do cronograma, para cada disciplina:

1. Apresentar questão de dificuldade 0.50
2. Acertou → dificuldade +0.15 | Errou → dificuldade -0.15
3. Após 10-15 questões: estimativa precisa do nível (0-100%)
4. Confiança aumenta com mais questões

**Resultado:** `baseline_score` por disciplina. O otimizador recebe e aloca proporcionalmente.

**Questões do diagnóstico:** vindas do banco de questões da banca (253K provas). Selecionadas por disciplina + dificuldade variada. Se não tem questões da banca específica, usa questões da mesma disciplina de bancas similares.

**Para alunos em Modo Contínuo:** diagnóstico é opcional. Se fizer, o sistema prioriza as disciplinas mais fracas.

---

## Detecção de Confusão de Conceitos

### Detecção automática (sem input do aluno)

```
1. ANÁLISE DE ALTERNATIVAS (pipeline de enriquecimento):
   Para cada questão, IA categoriza cada alternativa:
     Questão sobre homicídio qualificado:
       A) [conceito: homicídio_privilegiado] — ERRADA
       B) [conceito: homicídio_qualificado] — CORRETA
       C) [conceito: lesao_corporal_grave] — ERRADA
       D) [conceito: homicídio_culposo] — ERRADA
   
   Se aluno marca A → confundiu qualificado com privilegiado

2. PADRÃO ESTATÍSTICO (dados do aluno):
   Se aluno erra tópico A e B correlacionadamente:
     correlação_erro(A, B) > 0.5 → par de confusão
   
   Sistema gera exercício de discriminação:
   "Qual a diferença entre homicídio qualificado e privilegiado?"

3. INTERVENÇÃO:
   Quando par de confusão detectado:
     → Agendar FlashQuestões de discriminação
     → Mostrar no drawer: "Você confunde X com Y — pratique a diferença"
```

---

## Sessão de Estudo Composta

Quando o aluno clica "Sessão automática" ou "Iniciar" numa tarefa, o sistema compõe uma sessão:

```
SESSÃO (50min):

  Aquecimento (5min):
    3 questões rápidas de tópicos de ontem (interleaving automático)
    Ativa memória, recupera contexto

  Bloco Principal (30min):
    O tópico selecionado (ou escolhido pelo otimizador)
    Composição varia por ciclo:
      Ciclo 1: 60% teoria + 20% questões fáceis + 20% lei seca
      Ciclo 2: 20% review + 50% questões médias + 30% lei seca
      Ciclo 3: 10% review + 70% questões difíceis + 20% casos
      Ciclo 4: 100% simulado cronometrado

  Prática Mista (10min):
    5-10 questões de disciplinas DIFERENTES (interleaving)
    Selecionadas por: revisão pendente + fraquezas detectadas

  Encerramento (5min):
    Form de conclusão (modo rápido: 1 clique, detalhado: expandível)
    Score snapshot + CSSL update
    "Você ganhou +0.8 pontos. Projeção: 76.8/100"
    
  Autoplay "Mais Um" (5s countdown):
    "Próxima sessão em 5... 4... 3..."
    [Iniciar] [Parar por hoje]
```

### Dificuldade Adaptativa Dentro da Sessão

O sistema ajusta em tempo real:
- Errou 3 seguidas → próxima mais fácil (recuperar confiança)
- Acertou 5 seguidas → próxima mais difícil (desafiar)
- Respondendo lento → menos questões, mais tempo cada
- Respondendo rápido → questões extras bonus

### Companheiro IA Contextual (durante a sessão)

Micro-insights inline (não chat, não modal):
- Após errar: "Você confundiu qualificado com privilegiado. Dica: qualificadora = motivação torpe."
- Após acertar: "Exato! A Lei 13.104/15 incluiu feminicídio como qualificadora."
- Na teoria: "Compare com Art. 129 que você estudou ontem — mesma lógica."
- Fim de sessão: "Discriminação entre lesão grave/gravíssima melhorou 20%."

### Relatório Semanal Automático (domingo)

```
Relatório — Semana 7-13 Abril

Sessões: 12 completadas · 8h40 total
Anéis: Estudo 100% · Revisão 80% · Questões 60% · Lei Seca 100%
Nota: 72 → 76 (+4 pontos)

Destaque: Dir. Penal — retenção 89%
Atenção: Dir. Administrativo — não estudado
Meta próxima semana: foco em Administrativo (+3 pts)
```

Gerado de questoes_log + study_sessions + score_snapshots. Zero trabalho do aluno.

---

## Schema Supabase Completo

### Tabelas existentes (pós-rename + extensões)

```sql
-- Extensões na tabela topicos
ALTER TABLE topicos ADD COLUMN mastery_score DECIMAL(5,2) DEFAULT 0;
ALTER TABLE topicos ADD COLUMN learning_stage VARCHAR(20) DEFAULT 'new';
  -- 'new' | 'learning' | 'consolidating' | 'maintaining' | 'mastered'
ALTER TABLE topicos ADD COLUMN question_accuracy DECIMAL(5,2) DEFAULT 0;
ALTER TABLE topicos ADD COLUMN questions_total INTEGER DEFAULT 0;
ALTER TABLE topicos ADD COLUMN speed_avg_seconds DECIMAL(7,2);
ALTER TABLE topicos ADD COLUMN retention_score DECIMAL(5,2) DEFAULT 0;
ALTER TABLE topicos ADD COLUMN discrimination_score DECIMAL(5,2) DEFAULT 0;
ALTER TABLE topicos ADD COLUMN fsrs_stability DECIMAL(10,2) DEFAULT 1.0;
ALTER TABLE topicos ADD COLUMN fsrs_difficulty DECIMAL(5,2) DEFAULT 0.3;
ALTER TABLE topicos ADD COLUMN peso_edital DECIMAL(5,2);
ALTER TABLE topicos ADD COLUMN diagnostic_score DECIMAL(5,2);
ALTER TABLE topicos ADD COLUMN learning_rate DECIMAL(5,3) DEFAULT 0.15;
ALTER TABLE topicos ADD COLUMN marginal_gain DECIMAL(5,2);
ALTER TABLE topicos ADD COLUMN depends_on UUID[];

-- Extensões no plano de estudo
ALTER TABLE planos_estudo ADD COLUMN target_score DECIMAL(5,2);
ALTER TABLE planos_estudo ADD COLUMN current_cycle INTEGER DEFAULT 1;
ALTER TABLE planos_estudo ADD COLUMN triage_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE planos_estudo ADD COLUMN study_mode VARCHAR(20) DEFAULT 'continuo';
  -- 'continuo' | 'edital'

-- Extensões no user_study_config
ALTER TABLE user_study_config ADD COLUMN peak_hours TEXT[];
ALTER TABLE user_study_config ADD COLUMN session_duration INTEGER DEFAULT 50;
ALTER TABLE user_study_config ADD COLUMN break_duration INTEGER DEFAULT 10;
ALTER TABLE user_study_config ADD COLUMN max_new_topics_per_day INTEGER DEFAULT 3;
ALTER TABLE user_study_config ADD COLUMN questions_per_day INTEGER DEFAULT 30;
ALTER TABLE user_study_config ADD COLUMN interleaving BOOLEAN DEFAULT TRUE;
ALTER TABLE user_study_config ADD COLUMN revision_style VARCHAR(10) DEFAULT 'hybrid';
```

### Tabelas novas

```sql
-- Log detalhado de questões (cada resposta)
CREATE TABLE questoes_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    topico_id UUID REFERENCES topicos(id),
    questao_id INTEGER,
    correto BOOLEAN NOT NULL,
    tempo_resposta INTEGER,
    dificuldade DECIMAL(3,2),
    tipo_erro VARCHAR(30),
    conceito_confundido VARCHAR(100),
    session_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_questoes_log_user ON questoes_log(user_id);
CREATE INDEX idx_questoes_log_topico ON questoes_log(topico_id);
ALTER TABLE questoes_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own logs" ON questoes_log
    FOR ALL USING (auth.uid() = user_id);

-- Sessões de estudo
CREATE TABLE study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    plano_id UUID REFERENCES planos_estudo(id),
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    planned_minutes INTEGER,
    active_minutes INTEGER,
    activities JSONB,
    score_before DECIMAL(5,2),
    score_after DECIMAL(5,2),
    cycle INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sessions" ON study_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Snapshots de nota estimada (histórico)
CREATE TABLE score_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    plano_id UUID REFERENCES planos_estudo(id),
    score_current DECIMAL(5,2),
    score_projected DECIMAL(5,2),
    pass_probability DECIMAL(3,2),
    breakdown JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE score_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own snapshots" ON score_snapshots
    FOR ALL USING (auth.uid() = user_id);

-- FlashQuestões (substitui flashcards)
CREATE TABLE flash_questoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    topico_id UUID REFERENCES topicos(id),
    questao_texto TEXT NOT NULL,
    alternativas JSONB NOT NULL,
    resposta_correta VARCHAR(1) NOT NULL,
    dificuldade DECIMAL(3,2) DEFAULT 0.50,
    source VARCHAR(20) DEFAULT 'manual',
      -- 'manual' | 'ai_generated' | 'imported'
    fsrs_stability DECIMAL(10,2) DEFAULT 1.0,
    fsrs_difficulty DECIMAL(5,2) DEFAULT 0.3,
    next_review TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_flash_questoes_user ON flash_questoes(user_id);
CREATE INDEX idx_flash_questoes_topico ON flash_questoes(topico_id);
CREATE INDEX idx_flash_questoes_review ON flash_questoes(next_review);
ALTER TABLE flash_questoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own flash" ON flash_questoes
    FOR ALL USING (auth.uid() = user_id);
```

---

## Layout

Dois modos visuais na mesma página, alternados pelo toggle Edital/Cronograma:

### Modo Edital (3 níveis — já implementado)
- **Nível 1:** DisciplinesSidebar (coluna fixa com lista de disciplinas)
- **Nível 2:** Central (tópicos da disciplina selecionada, layout centralizado max-w-5xl)
- **Nível 3:** Drawer 45% (detalhes + ações + inteligência)

### Modo Cronograma (cockpit semanal)
- **Substitui os 3 níveis por uma view única centralizada** (mesmas margens do edital)
- Toggle + seletor de semana + streak no header
- 4 anéis + nota estimada
- Barra de progresso semanal
- Quick session buttons + abas (Tarefas | Insights | Sessões | E se?)
- Lista unificada de tarefas da semana (sugeridos destacados, concluídos inline)
- Paleta: roxo #6c63ff como accent em todo o cronograma (toggle, botões, border-left, checkmarks)

### Drawer v2 — conteúdo expandido

**Sempre visível:**
- Header: nome + artigo de lei
- Mastery score (barra 0-100 com cor)
- Learning stage badge (novo → aprendendo → consolidando → mantendo → dominado)
- "O que mais cai" (subtópicos enriquecidos com frequência)
- Editais que cobram, legislação, bancas
- Contribuição para nota: "+X pontos possíveis se dominar"
- ROI: "cada hora vale +Y pontos"

**Com progresso (blur removido):**
- Stats: accuracy, velocidade, tempo investido
- Revisões com datas e resultados
- Gráfico de desempenho
- Padrões de confusão detectados
- IA contextual
- FlashQuestões + Questões + Lei Seca + Resumo

**Sem progresso (blur parcial):**
- Inteligência visível e nítida
- Stats com blur → "Estude para desbloquear"
- "Registrar Estudo" ou "Iniciar Diagnóstico"

---

## Fluxo Completo

```
1. ALUNO SEM EDITAL (Modo Contínuo)
   └─ Cria plano manual → escolhe disciplinas
   └─ Diagnóstico opcional → baseline
   └─ Cronograma semanal otimizado para aprendizado/hora
   └─ Estuda via pool semanal ou sessão automática
   └─ Quando edital abre → vincula → migra para Modo Edital

2. ALUNO COM EDITAL (Modo Edital)
   └─ /editais → "Ver edital" → Documents-Organization (API read)
   └─ Explora disciplinas, tópicos, inteligência no drawer
   └─ "Criar Plano" → planos_estudo + planos_editais
   └─ Diagnóstico → baseline por disciplina
   └─ Score Engine calcula nota estimada e ROI
   └─ Cronograma semanal otimizado por nota (ganho marginal)
   └─ Sessões compostas (aquecimento + estudo + questões mistas + encerramento)
   └─ Conclusão via form rápido → nota atualizada
   └─ CSSL agenda revisões (exam-anchored, com soft deadlines semanais)
   └─ Triagem se tempo insuficiente
   └─ Compressão automática pré-prova (últimos 10%)

3. CICLO SEMANAL
   └─ Abre cronograma → cockpit com anéis + lista unificada
   └─ Escolhe tarefa sugerida ou qualquer do pool
   └─ Clica "Iniciar" → sessão composta automática
   └─ Conclusão → questoes_log + score_snapshot + CSSL update
   └─ Anéis avançam, nota atualiza em tempo real
   └─ "Mais Um" autoplay → próxima sessão em 5s
   └─ Domingo: relatório semanal automático
   └─ Segunda: nova semana, pool renovado, atrasados rolam
```

---

## Roadmap de Implementação

| Fase | O que | Impacto |
|------|-------|---------|
| **v1.0** | Plans 2-5 (integração API, cronograma semanal, forms, drawer) | Base funcional, superior à concorrência |
| **v1.1** | Anéis semanais + lista unificada + abas (Insights/Sessões/E se?) | Cockpit completo |
| **v1.2** | Sessão automática composta + autoplay "Mais Um" | UX premium, hábito |
| **v2.0** | Score Engine (nota estimada + projeção + ROI por disciplina) | Killer feature — aluno sabe onde investir |
| **v2.1** | CSSL (fases + exam-anchored + constraint-aware) | Retenção ótima no dia da prova |
| **v2.2** | Mastery score + learning stages + dificuldade adaptativa | Progressão clara e objetiva |
| **v2.3** | Simulador "E se?" interativo com slider | Decisão estratégica visual |
| **v3.0** | Pipeline de enriquecimento (subtópicos, dificuldade, frequência) | Dados reais alimentam o motor |
| **v3.1** | Otimizador semanal por ganho marginal | Hora de estudo vale mais |
| **v3.2** | Diagnóstico Adaptativo (CAT) | Cronograma nasce inteligente |
| **v3.3** | Detecção de confusão + discriminação automática | Intervenção direcionada |
| **v3.4** | Triagem inteligente + transparência de carga | Honesto quando tempo é curto |
| **v3.5** | Companheiro IA contextual (micro-insights durante sessão) | Coaching passivo |
| **v4.0** | Relatório semanal automático (domingo) | Feedback zero trabalho |
| **v4.1** | Streak semanal + gamificação sutil | Motivação sem pressão |
| **v4.2** | Ciclos automáticos + compressão pré-prova | Longo prazo otimizado |
| **v4.3** | Modo Contínuo (sem edital) completo | Público ampliado |
| **v4.4** | FlashQuestões (substitui flashcards tradicionais) | Revisão no formato do exame |

---

## Fora do Escopo (Futuro distante)

- Social/competitivo (ranking entre alunos)
- IA que gera questões a partir de teoria
- Cronograma com IA (sugestão via LLM em vez de algoritmo)
- Simulados adaptativos completos
- Gamificação (conquistas, streaks)
- Notificações push de revisão
- App mobile nativo
