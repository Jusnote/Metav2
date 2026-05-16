# 08 — Telas do Admin (Specs Visuais)

> Specs detalhadas de cada tela administrativa. Use o design system (`03-`) para todos os tokens visuais.

## Mapa de rotas admin

```
/admin/dashboard               # Visão geral
/admin/concursos               # Lista de concursos
/admin/concursos/novo          # Criar concurso e processar edital
/admin/concursos/[id]/revisar  # Revisar árvore após parsing IA
/admin/concursos/[id]/editar   # Edição contínua da árvore
/admin/topicos/[id]/conteudos  # Cadastrar conteúdos (Tiptap)
/admin/topicos/[id]/questoes   # Cadastrar questões
/admin/alunos                  # Lista de alunos
/admin/alunos/[id]             # Detalhes do aluno
/admin/feedback                # Mensagens dos alunos
```

## Tela 1 — Criar concurso e processar edital

**Rota:** `/admin/concursos/novo`

### Layout

Coluna única, max-width 720px, centralizada.

### Componentes

**Header simples:**
- Botão voltar (esquerda)
- Título "Novo concurso" (centro)
- Sem ações à direita

**Step 1 — Identificação do concurso:**

Card único com formulário:
- Nome do concurso (input texto) — "Agente da Polícia Federal 2025"
- Banca (select) — "Cebraspe", "FGV", "FCC", "Vunesp", "Outra"
- Cargo (input texto) — "Agente"
- Nível (select) — "Médio", "Superior"
- Data prevista da prova (date picker, opcional)

Botão "Continuar" no canto inferior direito do card. Desabilitado até nome, banca e cargo estarem preenchidos.

**Step 2 — Upload do edital:**

Aparece após Step 1 ser completado (transição suave, sem mudar de página).

Card único com tabs:
- **Tab "Colar texto"** (default): textarea grande (min 400px de altura) com placeholder "Cole o conteúdo programático do edital aqui..."
- **Tab "Upload PDF"**: drop zone para PDF

Abaixo das tabs: 
- Contador de caracteres
- Aviso: "A IA processará apenas o conteúdo programático. Pode ignorar disposições gerais."

Botão "Processar edital" no canto inferior direito. Mostra estado de loading: "Processando... (X de Y disciplinas)" com progresso.

**Step 3 — Aguardando processamento:**

Quando processamento inicia, substituir Step 2 por:
- Spinner central
- Lista de disciplinas identificadas (aparecendo conforme processadas)
- Cada disciplina: nome + ícone de estado (loading → check verde → erro vermelho)
- Tempo estimado: "~2 minutos restantes"

### Comportamentos

- Validação Zod no submit
- Não bloquear UI durante processamento (use Server Actions com streaming)
- Em caso de erro de IA, mostrar mensagem específica + botão "Tentar novamente para esta disciplina"
- Ao finalizar, redirect para `/admin/concursos/[id]/revisar`

## Tela 2 — Revisar árvore do edital (a tela MAIS IMPORTANTE do admin)

**Rota:** `/admin/concursos/[id]/revisar`

Esta é a tela que define a qualidade do produto. Aldemir gasta horas aqui ajustando.

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Header com nome do concurso + status + ações                │
├────────────────────┬─────────────────────────────────────────┤
│                    │                                          │
│   Árvore           │   Detalhes do nó selecionado             │
│   (panel left)     │   (panel right)                          │
│   30% largura      │   70% largura                            │
│                    │                                          │
│                    │                                          │
└────────────────────┴─────────────────────────────────────────┘
```

### Header

- Breadcrumb: "Concursos > Agente PF 2025"
- Título grande: "Revisar estrutura"
- Status atual (badge): "Em revisão"
- Botões à direita:
  - "Publicar concurso" (primário, verde) — só ativa se árvore válida
  - "Salvar rascunho" (secundário)
  - Menu "..." com: "Reprocessar com IA", "Exportar JSON", "Arquivar"

### Painel esquerdo — Árvore navegável

**Topo do painel:**
- Search box "Buscar tópico..."
- Botão "Expandir todos" / "Colapsar todos"
- Indicador: "X alertas da IA" (clicável, abre modal)

**Estrutura da árvore:**

Implementar com `@dnd-kit/core` para drag-and-drop hierárquico.

Cada nó renderiza:
```
[Disciplina] (clique expande)
├── [Bloco] (clique expande)
│   ├── [Tópico] peso 5 ⚠️
│   │   ├── [Subtópico]
│   │   └── [Subtópico]
│   └── [Tópico] peso 3
```

**Aparência de cada nível:**

- **Disciplina:** font-size 14px, weight 500, com badge de horas total e seta de expand
- **Bloco:** font-size 13px, weight 500, indentado 16px, com horas e contagem de tópicos
- **Tópico:** font-size 12px, indentado 32px, badge de peso (barrinhas), badge de natureza, ícone de alerta se IA marcou
- **Subtópico:** font-size 11px, indentado 48px, weight 400

**Interações:**
- Clique no nó: seleciona e abre detalhes no painel direito
- Arrastar: reordena (mesma profundidade) ou move (entre níveis compatíveis)
- Hover: mostra ícone "+" para adicionar filho e "..." para opções
- Menu de opções: Editar, Duplicar, Mover para..., Excluir

### Painel direito — Detalhes do nó

Conteúdo varia conforme tipo de nó selecionado.

**Para Tópico selecionado:**

Form com:
- **Nome** (input texto, 16px)
- **Bloco temático** (select para mover entre blocos)
- **Peso de incidência** (slider 1-5 + display visual das barrinhas)
- **Natureza** (select com as 8 opções)
- **Horas sugeridas** (input numérico com sufixo "h")
- **Tipo de revisão** (select)
- **Pré-requisito** (select de outros tópicos, opcional)
- **Observação estratégica** (textarea — vai aparecer pro aluno como dica do mentor)

Abaixo do form:
- **Subtópicos** (lista editável inline com botão "+ Adicionar subtópico")

Botão "Salvar alterações" no rodapé do painel (sticky).

**Para Disciplina selecionada:**

- Nome, horas totais, ordem, cor
- Observações globais (lista editável)
- Botão "Adicionar bloco temático"

### Modal de alertas da IA

Acessado pelo botão "X alertas da IA":

```
┌─────────────────────────────────────────────┐
│  ⚠️ Pontos para sua atenção                 │
├─────────────────────────────────────────────┤
│                                              │
│  1. Tópico 12 estava truncado no edital     │
│     enviado — confirmar continuação.         │
│                                              │
│  2. Não há menção a DFC ou DLPA — confirmar │
│     se ficaram de fora.                      │
│                                              │
│  ...                                         │
│                                              │
│             [Marcar como lido]               │
└─────────────────────────────────────────────┘
```

### Estado vazio

Se árvore estiver vazia (parsing falhou):
- Ilustração leve (ícone de árvore vazia)
- Mensagem: "Nenhuma disciplina processada"
- Botões: "Reprocessar com IA" / "Adicionar manualmente"

## Tela 3 — Conteúdos do tópico

**Rota:** `/admin/topicos/[id]/conteudos`

### Layout

Header + lista + modal de edição.

### Header

- Breadcrumb: "Direito Penal > Crimes contra a vida > Homicídio"
- Título: "Conteúdos"
- Botão "Novo conteúdo" (primário)

### Lista

Tabela com colunas:
- Tipo (badge colorido conforme tipo de atividade)
- Título
- Duração estimada
- Atualizado em
- Ações (editar, duplicar, desativar)

Filtros no topo:
- Por tipo (Teoria, Lei seca, Resumo, etc)
- Por status (Ativo, Inativo)

### Modal/Drawer de criação

Drawer lateral grande (60% da largura):

- Tipo (select com badges visuais)
- Título (input)
- Duração estimada (input em minutos)
- Subtópico vinculado (select, opcional)
- **Editor Tiptap** ocupando o resto do drawer

Configuração do Tiptap:
- StarterKit
- Image (com upload pro Supabase Storage)
- Table
- CodeBlock com syntax highlighting
- Highlight
- Subscript/Superscript
- Link
- Placeholder

Toolbar com botões de formatação no topo do editor.

Botões inferiores: "Salvar e fechar", "Salvar e novo", "Cancelar".

## Tela 4 — Questões do tópico

**Rota:** `/admin/topicos/[id]/questoes`

### Header
- Breadcrumb + título "Questões"
- Botões: "Nova questão", "Importar lote (JSON)"

### Lista

Tabela com:
- Banca + ano (badge)
- Enunciado (truncado em 100 chars)
- Tipo (certo/errado ou múltipla)
- Gabarito
- Dificuldade estimada (barrinhas)
- % de acerto entre alunos (calculado)
- Ações

### Form de questão

Drawer com:
- Banca + ano (campos pequenos lado a lado)
- Tipo (radio: certo/errado | múltipla escolha)
- Enunciado (textarea grande)
- Alternativas (se múltipla escolha): inputs A, B, C, D, E
- Gabarito (radio)
- Subtópico vinculado (select)
- Dificuldade estimada (slider 1-5)
- **Comentário pedagógico** (editor Tiptap completo) — este é onde o admin escreve a análise estilo Aldemir

Botão opcional "Gerar comentário com IA" (V2) que dispara o Prompt 4.

## Tela 5 — Dashboard do admin

**Rota:** `/admin/dashboard`

### Layout

Grid 12 colunas, responsivo.

### Cards de KPI (linha superior, 4 cards)

1. **Alunos ativos** — número grande + variação semanal
2. **Atividades concluídas hoje** — número + sparkline 7 dias
3. **Taxa média de acerto** — % + comparação com semana anterior
4. **Concursos publicados** — número + último publicado

### Gráficos (segunda linha)

- Engajamento ao longo do tempo (linha, últimos 30 dias)
- Distribuição de alunos por concurso (pizza)
- Tempo médio de estudo por dia da semana (barras)

### Listas (terceira linha)

Duas colunas:
- **Alunos em risco** (não estudaram nos últimos 5 dias) — lista clicável
- **Feedback recente** — últimas 5 mensagens dos alunos

## Tela 6 — Detalhes do aluno

**Rota:** `/admin/alunos/[id]`

Vista completa para suporte e acompanhamento.

### Header
- Avatar + nome + email
- Badges: concurso atual, dias desde início, status
- Ações: "Enviar mensagem", "Resetar progresso"

### Tabs
1. **Visão geral** — KPIs principais
2. **Cronograma atual** — semana atual do aluno
3. **Mapa da memória** — FSRS por tópico
4. **Histórico** — todas atividades concluídas
5. **Configurações** — horas disponíveis, etc

### Visão geral

Replica os KPIs que o aluno vê, mas com dados completos:
- Horas totais estudadas
- Taxa de acerto geral
- Tópicos cobertos vs restantes
- Aderência ao FSRS (% de cards revisados no prazo)
- Curva de evolução semanal

## Padrões visuais admin

Diferenças vs telas do aluno:

1. **Densidade maior:** admin precisa ver mais info por tela
2. **Tabelas, não cards:** dados estruturados em tabelas TanStack
3. **Acessível em desktop primário:** mobile é apenas leitura
4. **Cores mais sóbrias:** menos uso de cores semânticas decorativas
5. **Atalhos de teclado:** salvar com Cmd+S, navegação com J/K

## Decisões em aberto

1. **Tema do admin:** segue dark do aluno ou light dedicado? **Default: dark unificado.**
2. **Multi-edição:** selecionar 5 tópicos e mudar peso de todos? **V2.**
3. **Histórico de versões da árvore:** rollback se erro grave? **Default: salvar snapshot a cada publicação, mas sem UI de rollback no MVP.**
