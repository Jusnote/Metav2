# 09 — Telas do Aluno (Specs Visuais)

> **IMPORTANTE:** Os mockups validados pelo cliente nas conversas anteriores são a **referência canônica visual**. Esta spec descreve a estrutura, comportamento e regras. A aparência deve seguir os mockups fielmente.

## Mapa de rotas do aluno

```
/app                       # Redireciona pra /app/semana
/app/semana                # Tela principal (modo livre)
/app/atividade/[id]        # Execução de atividade
/app/disciplinas           # Visão macro de progresso
/app/disciplinas/[id]      # Detalhe de disciplina
/app/memoria               # Mapa FSRS
/app/perfil                # Configurações pessoais
/onboarding                # Fluxo de primeiro acesso
```

## Tela 1 — Onboarding

**Rota:** `/onboarding`

Fluxo de 5 telas em sequência, com indicador de progresso no topo.

### Tela 1.1 — Boas-vindas

- Logo + tagline
- Nome (input)
- Avatar (opcional, upload)
- Botão "Continuar"

### Tela 1.2 — Concurso alvo

- Pergunta: "Qual concurso você está fazendo?"
- Search + lista de concursos publicados
- Cada concurso: nome, banca, cargo, data da prova, número de alunos atual (opcional)
- Botão "Continuar" desabilitado até seleção

### Tela 1.3 — Disponibilidade

- Pergunta: "Quantas horas por dia você consegue estudar?"
- 7 sliders horizontais, um por dia da semana
- Valor de 0 a 8 horas, com display de cada
- Total semanal calculado em destaque: "Total: 18h/semana"
- Aviso sutil se < 10h: "Cronograma será adaptado pra rotina mais leve"

### Tela 1.4 — Horário de pico

- Pergunta: "Qual seu melhor horário pra estudar conteúdo pesado?"
- 3 cards grandes selecionáveis: Manhã (6-12h), Tarde (12-18h), Noite (18-23h)
- Explicação: "Vamos sugerir tópicos mais densos nesse horário"

### Tela 1.5 — Resumo e início

- Card de resumo:
  - "X horas/semana"
  - "Y semanas até a prova"
  - "Z tópicos no edital"
- Mensagem: "Vamos começar sua jornada!"
- Botão grande "Começar"

Ao clicar, dispara `gerarSemana(alunoId, 1, true)` e redireciona pra `/app/semana`.

## Tela 2 — Tela principal (semana atual)

**Rota:** `/app/semana`

**ESTA É A TELA MAIS IMPORTANTE DO SISTEMA.** Aluno passa 80% do tempo aqui.

### Referência visual

O mockup validado nas conversas anteriores é a referência. Estrutura essencial:

```
┌─────────────────────────────────────────────────────────┐
│  Header da semana                                       │
│  [SEMANA ATUAL] - 5 disciplinas - 32 atividades         │
│  ✓ 8 de 32 ▓▓▓▓░░░░░░  + 6 reforços                    │
│                              ┌────────────────────────┐ │
│                              │ 🔒 PRÓXIMA SEMANA      │ │
│                              │ Semana 2 · libera 21/05│ │
│                              └────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  KPIs                                                   │
│  [Qualidade 87%] [Horas 4h35m/14h] [Q. 142/73%] [Ritmo]│
├─────────────────────────────────────────────────────────┤
│  💡 Banner Sugestão Inteligente (roxo)                  │
│  Você estudou Penal há 2h. Que tal Escrituração?       │
│                          [Começar] [outra]              │
├─────────────────────────────────────────────────────────┤
│  Tabs: Atividades (32) | Reforços (6)                   │
│  Filtros: [disciplinas] [tipos] [tempo] [só peso 5 🔥] │
├─────────────────────────────────────────────────────────┤
│  ▼ Contabilidade · Mecânica Contábil  ▓░░░ 1/4         │
│    ✓ ▓▓░░░ Atos e fatos administrativos       1h15  92%│
│    ○ ▓▓▓▓▓ Escrituração: lançamentos ⭐       1h30   - │
│    ○ ▓▓░░░ 30 questões Cebraspe              45m    - │
│    ○ ▓▓░░░ Lei 6.404 — arts. 176 a 188       50m    - │
│                                                          │
│  ▼ Direito Penal · Crimes contra a vida ▓▓▓░ 2/3       │
│    ...                                                   │
│                                                          │
│  ▶ Português · Concordância e regência     0/3         │
│                                                          │
│  + 22 atividades em outros 4 blocos     [expandir]      │
└─────────────────────────────────────────────────────────┘
```

### Componentes desta tela

#### `<HeaderSemana />`

Server Component. Dados:
- Número da semana
- Total e concluídas
- Próxima semana e data de liberação

Layout flex, info à esquerda, card de próxima semana à direita (220px fixo).

#### `<KPIsSemana />`

Grid 4 colunas (1.4 / 1 / 1 / 1):

1. **Card destaque (verde sutil):** "Qualidade da Semana" — % peso 5 coberto, número grande verde
2. **Card padrão:** "Estudadas" — relógio + Xh Ym
3. **Card padrão:** "Questões" — alvo + número + % acerto (verde se > 70%, âmbar 50-70%, vermelho < 50%)
4. **Card padrão:** "Ritmo" — texto colorido conforme estado ("adiantado", "no prazo", "atrasado")

#### `<SugestaoInteligente />`

Client Component (precisa fazer fetch da sugestão).

Estrutura:
- Borda roxa suave + fundo roxo translúcido + borda esquerda mais forte
- Avatar circular roxo com ícone Sparkles
- Texto explicativo com razão
- Tópico sugerido em destaque
- Tempo cabível mencionado
- Botões: "Começar" (primário roxo) e "outra" (secundário)

Mostra "carregando..." enquanto busca sugestão.

#### `<TabsAtividadesReforcos />`

Duas tabs com contadores em badges:
- "Atividades" (azul ativo) - número total da semana
- "Reforços" - número de cards FSRS due

A tab "Reforços" tem indicador vermelho pulsante se há cards atrasados.

#### `<FiltrosAtividades />`

Linha horizontal:
- Select "Todas disciplinas"
- Select "Todos tipos"
- Select "Qualquer tempo" (< 30min, 30-60min, > 60min)
- Botão toggle "🔥 só peso 5" (chip)

Estado preservado na URL via search params.

#### `<BlocoTematico />` (repetível)

Cabeçalho expansível:
- Chevron (down se aberto, right se fechado)
- Dot colorido da disciplina
- Nome: "Disciplina · Bloco"
- Contagem: "4 atividades · 3h 20m"
- Mini-progresso à direita: barrinha + "1/4"

Conteúdo (lista de atividades):
- Renderiza `<AtividadeRow />` por atividade
- Suporta animação de collapse/expand

#### `<AtividadeRow />`

Grid de 6 colunas: `[24px] [80px] [1fr] [70px] [60px] [60px]`

Colunas:
1. **Checkbox** (CheckCircle2 se concluída, Circle se pendente)
2. **Badge de tipo** (cor conforme tipo)
3. **Título** (com ícone sparkles se sugerida)
4. **Barrinhas de relevância** (5 barras coloridas conforme peso)
5. **Tempo** (texto pequeno)
6. **Desempenho** (% se concluída com sessão de questões, "—" se não)

Estados visuais:
- **Pendente:** fundo cinza sutil
- **Concluída:** fundo verde sutil + borda esquerda verde + título riscado
- **Sugerida:** fundo roxo sutil + borda esquerda roxa + ícone sparkles
- **FSRS due:** ícone de relógio âmbar antes do título

Clique abre `/app/atividade/[id]`.

### Estados especiais da tela

**Sem atividades pendentes:**
- Mensagem celebrativa: "Você terminou a semana! 🎯"
- CTA: "Aguardar próxima semana" ou "Praticar com reforços FSRS"

**Semana ainda não gerada (raro):**
- Loading state com skeleton
- Após 5s, botão "Gerar minha primeira semana"

## Tela 3 — Execução de atividade

**Rota:** `/app/atividade/[id]`

Layout varia conforme tipo da atividade.

### Layout comum (header)

Header fixo no topo:
- Botão voltar (esquerda)
- Título da atividade (centro, truncado)
- Cronômetro (direita) — começa quando aluno marca "iniciei"
- Botão "Concluir" (canto direito, ativa após início)

### Variação: Teoria / Lei seca / Resumo

Layout single-column max-width 760px centralizado.

- Hero com tipo de atividade (badge grande) + título + tempo estimado
- Botão "Iniciar leitura" se ainda não começou (registra `iniciada_em`)
- Conteúdo do Tiptap renderizado em modo leitura
- Botão "Concluir" no rodapé (após scroll)

Suporte a:
- Highlight de trechos (V2)
- Notas pessoais (V2)
- Fonte ajustável (A- / A+) — V2

### Variação: Questões / Revisão FSRS

Máquina de estados com 3 fases:

**Fase 1 — Briefing (5s):**
- "Você fará X questões de Y subtópicos"
- Botão "Começar"

**Fase 2 — Questões (uma por vez):**

```
┌─────────────────────────────────────────┐
│  Questão 3 de 20      Tempo: 1:32  ▓▓░ │
├─────────────────────────────────────────┤
│  Banca · Ano · Subtópico                │
│                                         │
│  Enunciado da questão aqui...           │
│                                         │
│  ○ A) Alternativa A                     │
│  ○ B) Alternativa B                     │
│  ○ C) Alternativa C                     │
│  ○ D) Alternativa D                     │
│  ○ E) Alternativa E                     │
│                                         │
│         [Responder]    [Pular]          │
└─────────────────────────────────────────┘
```

Após responder:
- Feedback imediato (acertou / errou) com cor
- Comentário pedagógico expandível (renderiza Tiptap)
- Botão "Próxima questão"

Cronômetro por questão registra `tempo_segundos`.

**Fase 3 — Dashboard pós-sessão:**

```
┌─────────────────────────────────────────┐
│  Sessão concluída!                      │
├─────────────────────────────────────────┤
│  Acertos: 16/20 (80%)                   │
│  Tempo: 18min                           │
├─────────────────────────────────────────┤
│  Por subtópico:                         │
│  ▓▓▓▓▓ Homicídio: 5/5 (100%)           │
│  ▓▓▓░░ Feminicídio: 3/5 (60%)          │
│  ▓▓▓▓░ Qualificadoras: 4/5 (80%)       │
│  ▓▓▓▓░ Outros: 4/5 (80%)               │
├─────────────────────────────────────────┤
│  Próximas revisões FSRS:                │
│  · Homicídio: em 14 dias                │
│  · Feminicídio: em 3 dias 🔥            │
│  · Qualificadoras: em 7 dias            │
│  · Outros: em 7 dias                    │
├─────────────────────────────────────────┤
│       [Voltar pra semana]               │
└─────────────────────────────────────────┘
```

Subtópico com taxa < 70% recebe destaque visual (chama).

### Variação: Simulado

Como Questões mas:
- Sem feedback imediato (vê tudo no final)
- Cronômetro regressivo (3min por questão por default)
- Não pode pular nem voltar

## Tela 4 — Visão de disciplinas

**Rota:** `/app/disciplinas`

Lista as disciplinas do concurso do aluno com progresso.

### Layout

Cards em grid responsivo (3 colunas desktop, 1 mobile).

Cada card:
- Cabeçalho: nome da disciplina + dot da cor
- Barra de progresso grande: tópicos com teoria concluída / total
- Stats inline:
  - X tópicos / Y subtópicos
  - Tempo estudado / tempo total
  - Taxa de acerto média
- Estado dos blocos (mini-cards):
  - Concluído (verde)
  - Em andamento (azul)
  - Não iniciado (cinza)

Clique no card abre `/app/disciplinas/[id]`.

### Tela detalhe `/app/disciplinas/[id]`

Estrutura mais detalhada:
- Header com nome, banca, cargo
- KPIs específicos da disciplina
- Lista de blocos com tópicos expandíveis
- Cada tópico mostra estado: não iniciado / teoria feita / questões feitas / em revisão FSRS

## Tela 5 — Mapa da Memória (FSRS visualizado)

**Rota:** `/app/memoria`

Esta é a tela que vende sofisticação do produto.

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  Mapa da Memória                                        │
│  Como está seu domínio dos tópicos estudados            │
├─────────────────────────────────────────────────────────┤
│  ⚠️ Em risco (R < 70%)                                  │
│  ─────────────────────                                  │
│  · Feminicídio    [▓▓░░░░ 45%]  Revisar hoje 🔥        │
│  · Concordância   [▓▓▓░░░ 62%]  Revisar amanhã         │
│                                                          │
│  📅 Próximas revisões                                   │
│  ──────────────────                                     │
│  · Homicídio simples       em 2 dias                   │
│  · Princípios penais       em 5 dias                   │
│  · Atos e fatos contábeis  em 8 dias                   │
│                                                          │
│  ✓ Estáveis (R > 90%)                                   │
│  ───────────────────                                    │
│  · Patrimônio              [▓▓▓▓▓ 94%] em 21 dias      │
│  · Conceitos contábeis     [▓▓▓▓▓ 96%] em 28 dias      │
└─────────────────────────────────────────────────────────┘
```

### Componentes

**`<CardMemoria />`** — cada item da lista:
- Nome do tópico/subtópico
- Mini-gráfico de retrievability (barra colorida)
- Estado de cada métrica em tooltip:
  - Difficulty: 4.2 (Médio)
  - Stability: 12 dias
  - Retrievability: 67%
- Botão "Revisar agora" se atrasado

**Filtros opcionais:**
- Por disciplina
- Por estado FSRS (new, learning, review, relearning)

## Tela 6 — Perfil

**Rota:** `/app/perfil`

Configurações pessoais e estatísticas gerais.

### Seções

1. **Identificação**
   - Avatar, nome, email
   - Botão editar

2. **Concurso**
   - Concurso atual
   - Data início
   - Botão "Trocar concurso" (V2)

3. **Disponibilidade**
   - Sliders horas/dia (igual onboarding, editável)
   - Horário de pico

4. **Estatísticas gerais**
   - Total de horas estudadas
   - Total de questões respondidas
   - Taxa de acerto média
   - Streak (dias consecutivos)

5. **Preferências**
   - Notificações por email (V2)
   - Tema (futuro)

6. **Conta**
   - Trocar senha
   - Logout
   - Excluir conta

## Adaptação mobile

### Tela principal `/app/semana` em mobile

- Header colapsa: progresso fica em barra fina no topo
- KPIs viram 2x2 (em vez de 4 em linha)
- Banner de sugestão ocupa largura total
- Atividades viram cards empilhados (não tabela)
- Cada card de atividade:
  ```
  ┌───────────────────────┐
  │ [Tipo]    ▓▓▓▓▓ peso 5│
  │ Escrituração          │
  │ ⏱ 1h30   ▶ Iniciar    │
  └───────────────────────┘
  ```

### Tela de questões em mobile

- Otimizada para uma mão
- Botões de resposta grandes (44px+ touch target)
- Comentário pedagógico vira sheet bottom

## Acessibilidade

- Todos botões com ícone têm aria-label
- Estados de loading anunciados via aria-live
- Navegação por teclado completa
- Suporte a screen readers em todas as telas críticas
- Contraste mínimo WCAG AA

## Performance crítica

- `/app/semana` deve renderizar em < 1.5s
- Lista de atividades virtualizada se > 50 itens
- Imagens lazy-loaded
- Suspense boundaries em volta de fetches lentos

## Decisões em aberto

1. **Notificações push:** PWA com push para FSRS due. **V2.**
2. **Modo offline:** leitura de teoria sem internet. **V2.**
3. **Cronômetro de estudo:** Pomodoro embutido na tela de atividade. **Default: V1 simples (só registra tempo total), V2 com Pomodoro opcional.**
