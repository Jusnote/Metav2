# Integração Editais × Documents-Organization — Design Spec

## Overview

Integrar o conteúdo programático de editais (API GraphQL externa) ao Documents-Organization, permitindo que o aluno explore editais, crie planos de estudo vinculados, estude com cronograma automatizado, e acompanhe progresso — tudo sem duplicar dados estruturais no Supabase.

**Princípio central:** API editais é a fonte de verdade para estrutura e inteligência. Supabase armazena exclusivamente dados pessoais do aluno (progresso, materiais, agendamentos).

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                       │
│                                                                 │
│  /editais                    /documents-organization            │
│  Lista/busca editais         3 níveis:                          │
│  Clica cargo → "Ver edital"  - Sidebar slim (disciplinas)       │
│  Navega para docs-org        - Central (tópicos/subtópicos)     │
│  com ?editalId&cargoId       - Drawer 45% (detalhes + ações)    │
│                                                                 │
├─────────────────────────┬───────────────────────────────────────┤
│   API Editais (GraphQL) │         Supabase (PostgreSQL)         │
│   Fonte: estrutura      │         Fonte: dados pessoais         │
│                         │                                       │
│   editais               │   planos_estudo                       │
│   cargos                │   planos_editais                      │
│   disciplinas           │   disciplinas (local, com api ref)    │
│   topicos               │   topicos (local, com api ref)        │
│   inteligência          │   subtopicos                          │
│   (incidência, bancas,  │   schedule_items, documents, notes    │
│    leis, cross-ref)     │   study_goals, user_study_config      │
└─────────────────────────┴───────────────────────────────────────┘
```

### Princípio de fonte unificada

Todas as referências internas (schedule_items, documents, notes, study_goals) apontam para UUIDs das tabelas locais do Supabase (disciplinas, topicos, subtopicos). Nunca para IDs da API diretamente.

**Momentos de criação dos registros locais:**
- **"Ver edital"** → zero escrita. Estrutura vem da API via React Query.
- **"Registrar Estudo" manual / criar nota / criar documento** → cria APENAS o tópico interagido (lazy, 1 row em `topicos` + 1 row em `disciplinas` se não existir).
- **"Criar Cronograma"** → cria TODOS os tópicos do plano de uma vez (bulk insert, ~15 disciplinas + ~80 tópicos = ~95 rows) + schedule_items.

Os registros locais são finos: UUID + user_id + api_topico_id + campos de progresso. Nomes e estrutura continuam vindo da API. O campo `api_topico_id` permite cruzar dados locais (progresso) com dados da API (inteligência).

### Separação de responsabilidades

| Dado | Fonte | Mutável pelo aluno? |
|------|-------|---------------------|
| Disciplinas, tópicos, nomes, hierarquia | API Editais | Não |
| Incidência, bancas, leis, "o que mais cai" | API Editais | Não |
| Cross-reference entre editais | API Editais | Não |
| Planos de estudo, vínculos com editais | Supabase | Sim |
| Progresso por tópico, tempo investido | Supabase | Sim |
| Cronograma, schedule_items, revisões | Supabase | Sim |
| Resumos, flashcards, questões feitas | Supabase | Sim |
| Notas, comentários | Supabase | Sim |

---

## Layout — 3 Níveis

O Documents-Organization usa um padrão de 3 níveis de profundidade progressiva (padrão Spotify):

### Nível 1: Sidebar slim (DisciplinesSidebar)
- Coluna fixa dentro da página (~64-80px)
- Lista de disciplinas como botões com ícone, nome curto, barra de progresso
- Toggle Edital / Cronograma no topo
- Badge do edital no rodapé
- Já implementado em `src/components/documents-organization/DisciplinesSidebar.tsx`

### Nível 2: Central (área principal)
- **Modo Edital:** header da disciplina selecionada + lista de tópicos como cards com: status (check/ring/vazio), nome, artigo de lei, info contextual, 4 dots de progresso segmentado (estudo/revisão/questões/lei seca), seta para abrir drawer
- **Modo Cronograma:** header do dia + progress bar + lista de atividades do dia com tipo (📖 Parte 1, 🔄 Revisão, ❓ Questões, ⚖️ Lei Seca), duração, status, botão de ação

### Nível 3: Drawer (TopicDetailDrawer)
- Slide-in da direita, ~45% da tela (max 640px, min 400px)
- Desktop: drawer lateral com backdrop
- Mobile: bottom sheet com drag
- Conteúdo adapta ao estado do tópico (action-first)
- Já implementado em `src/components/documents-organization/TopicDetailDrawer.tsx`

---

## Drawer — Design Action-First

O drawer lidera com a ação mais relevante baseada no estado real do tópico. A inteligência do edital (API) está sempre presente. As estatísticas pessoais (Supabase) aparecem somente quando existem dados.

### Conteúdo do drawer

O drawer (TopicDetailDrawer) já possui os painéis de estatísticas, revisões, desempenho e IA implementados. A estrutura se mantém — o que muda é o preenchimento baseado em dados reais vs estado vazio.

**Estrutura fixa do drawer (sempre presente):**
- Header: nome do tópico + referência legal (ex: Art. 121, CP)
- Importância (ring de prioridade)
- Material pills (contadores)
- Stats row: último acesso, tempo investido, anotações
- Revisões: lista com datas e % de desempenho
- Gráfico de desempenho: DesempenhoChart (ECharts)
- IA Assistente: insights contextuais
- Materiais: grid 2x2
- "Registrar Estudo": botão sempre disponível

**Sem progresso (nunca estudou):**
- Inteligência do edital (API): "O que mais cai", editais que cobram, legislação, bancas — **visível e nítida**
- Painel de desempenho (estatísticas, revisões, gráfico, IA): **visível mas com blur** — o aluno vê que existe mas o conteúdo está vazio/borrado
- CTA: "Registrar Estudo" para primeira interação (cria registro em `topicos` lazy)
- A presença do painel com blur comunica: "estude para desbloquear suas estatísticas"

**Com progresso (já estudou):**
- Inteligência: mesma seção (sempre presente, nítida)
- Painel de desempenho: **blur removido, dados reais preenchidos**
- Action card adapta ao estado:
  - Agendado para o futuro → data + "Daqui a X dias" + Antecipar/Reagendar
  - Tarefa de hoje → "Estudar Agora" + barra 0% + materiais prontos
  - Em andamento → ring de % + "Continuar" + onde parou
  - Concluído → check + stats finais + próxima revisão
- Progresso segmentado: 4 cards (📖 Estudo, 🔄 Revisão, ❓ Questões, ⚖️ Lei Seca)
- Revisões: lista real com datas e %
- Gráfico de desempenho: dados reais
- IA: feedback baseado no desempenho
- "Registrar Estudo" manual: sempre disponível

---

## Planos de Estudo

O plano de estudo é o workspace do aluno — o elo entre editais (API) e estudo pessoal (Supabase).

### Conceito
- O aluno cria um plano (ex: "TRF 2026")
- Vincula um ou mais editais/cargos ao plano
- O plano agrega disciplinas/tópicos dos editais vinculados
- Cronograma, metas, progresso — tudo pertence ao plano
- Suporta: plano com edital, plano manual, plano combinado (múltiplos editais)

### Fluxo de criação

1. Aluno acessa `/editais`, navega editais, clica num cargo
   - Se **não tem plano** para esse edital/cargo → botão **"Ver edital"**
   - Se **já tem plano** → botão **"Continuar"** (leva direto ao plano existente)
2. Navega para `/documents-organization?editalId=X&cargoId=Y`
3. Documents-Organization lê estrutura da API (React Query cache, zero Supabase)
4. Aluno explora disciplinas, tópicos, drawer com inteligência
5. Quando decidir estudar, pode:
   a. **Criar plano de estudo** → cria `planos_estudo` + `planos_editais` no Supabase
   b. **Registrar estudo manual** no drawer → cria registro em `topicos` lazy
   c. **Criar cronograma** (via GoalCreationDialog) → distribuição automática

### Verificação "já tem plano?"
Na página `/editais`, para cada cargo: `SELECT id FROM planos_editais WHERE edital_id = ? AND cargo_id = ? AND plano_id IN (SELECT id FROM planos_estudo WHERE user_id = ?)`. Se retorna, mostra "Continuar". Se não, mostra "Ver edital".

### Filtro por contexto no Documents-Organization

A página `/documents-organization` adapta o conteúdo baseado nos query params:

| URL | Comportamento |
|-----|---------------|
| `?editalId=X&cargoId=Y` | Mostra disciplinas/tópicos daquele cargo (da API). Cruza com registros locais por `api_disciplina_id` para exibir progresso. |
| `?planoId=Z` | Mostra disciplinas/tópicos vinculados ao plano (locais + API para inteligência). |
| Sem params | Mostra conteúdo manual do aluno (`source_type='manual'`). Comportamento atual. |

---

## Schema Supabase — Tabelas

### Novas tabelas

#### planos_estudo
```sql
CREATE TABLE planos_estudo (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    nome            VARCHAR(200) NOT NULL,
    data_prova      TIMESTAMPTZ,
    source_type     VARCHAR(20) DEFAULT 'edital',  -- 'edital' | 'manual' | 'combined'
    ativo           BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_planos_estudo_user ON planos_estudo(user_id);
ALTER TABLE planos_estudo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own plans" ON planos_estudo
    FOR ALL USING (auth.uid() = user_id);
```

#### planos_editais
```sql
CREATE TABLE planos_editais (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plano_id        UUID NOT NULL REFERENCES planos_estudo(id) ON DELETE CASCADE,
    edital_id       INTEGER NOT NULL,   -- ID na API editais (integer)
    cargo_id        INTEGER NOT NULL,   -- ID na API editais (integer)
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plano_id, edital_id, cargo_id)
);

CREATE INDEX idx_planos_editais_plano ON planos_editais(plano_id);
ALTER TABLE planos_editais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own plan links" ON planos_editais
    FOR ALL USING (
        plano_id IN (SELECT id FROM planos_estudo WHERE user_id = auth.uid())
    );
```

### Tabelas existentes (renomeadas + campos adicionados)

#### disciplinas (renomeada de units)
```sql
-- Migration: ALTER TABLE units RENAME TO disciplinas;
-- Campos existentes renomeados: title → nome
-- ALTER TABLE disciplinas RENAME COLUMN title TO nome;
-- Campos mantidos: id, user_id, nome, subject, total_chapters, created_at, updated_at
-- Campos adicionados:
ALTER TABLE disciplinas ADD COLUMN api_disciplina_id INTEGER;  -- ref API (nullable, manual não tem)
ALTER TABLE disciplinas ADD COLUMN plano_id UUID REFERENCES planos_estudo(id) ON DELETE SET NULL;
ALTER TABLE disciplinas ADD COLUMN source_type VARCHAR(20) DEFAULT 'manual';  -- 'manual' | 'edital'

CREATE INDEX idx_disciplinas_api ON disciplinas(api_disciplina_id) WHERE api_disciplina_id IS NOT NULL;
CREATE INDEX idx_disciplinas_plano ON disciplinas(plano_id) WHERE plano_id IS NOT NULL;
-- Evita duplicata: mesmo tópico da API no mesmo plano
CREATE UNIQUE INDEX idx_disciplinas_unique_api ON disciplinas(user_id, plano_id, api_disciplina_id)
    WHERE api_disciplina_id IS NOT NULL;
```

#### topicos (renomeada de topics)
```sql
-- Migration: ALTER TABLE topics RENAME TO topicos;
-- ALTER TABLE topicos RENAME COLUMN unit_id TO disciplina_id;
-- Campos existentes renomeados: title → nome
-- ALTER TABLE topicos RENAME COLUMN title TO nome;
-- Campos mantidos: id, user_id, disciplina_id, nome, total_aulas, estimated_duration_minutes, last_access, created_at, updated_at
-- Campos adicionados:
ALTER TABLE topicos ADD COLUMN api_topico_id INTEGER;  -- ref API (nullable, manual não tem)
ALTER TABLE topicos ADD COLUMN source_type VARCHAR(20) DEFAULT 'manual';  -- 'manual' | 'edital'
ALTER TABLE topicos ADD COLUMN tempo_investido INTEGER DEFAULT 0;  -- minutos
ALTER TABLE topicos ADD COLUMN teoria_finalizada BOOLEAN DEFAULT FALSE;
ALTER TABLE topicos ADD COLUMN questoes_acertos INTEGER DEFAULT 0;
ALTER TABLE topicos ADD COLUMN questoes_erros INTEGER DEFAULT 0;
ALTER TABLE topicos ADD COLUMN leis_lidas TEXT;
ALTER TABLE topicos ADD COLUMN completed_at TIMESTAMPTZ;

CREATE INDEX idx_topicos_api ON topicos(api_topico_id) WHERE api_topico_id IS NOT NULL;
CREATE UNIQUE INDEX idx_topicos_unique_api ON topicos(user_id, disciplina_id, api_topico_id)
    WHERE api_topico_id IS NOT NULL;
```

#### subtopicos (renomeada de subtopics)
```sql
-- Migration: ALTER TABLE subtopics RENAME TO subtopicos;
-- ALTER TABLE subtopicos RENAME COLUMN topic_id TO topico_id;
-- Campos existentes mantidos sem alteração
-- Subtópicos são sempre criados pelo aluno (não vêm do edital)
```

### Tabelas dependentes (rename de FKs)
```sql
-- documents
ALTER TABLE documents RENAME COLUMN subtopic_id TO subtopico_id;
ALTER TABLE documents RENAME COLUMN topic_id TO topico_id;

-- notes
ALTER TABLE notes RENAME COLUMN subtopic_id TO subtopico_id;
ALTER TABLE notes RENAME COLUMN topic_id TO topico_id;

-- schedule_items
ALTER TABLE schedule_items RENAME COLUMN unit_id TO disciplina_id;
ALTER TABLE schedule_items RENAME COLUMN topic_id TO topico_id;
ALTER TABLE schedule_items RENAME COLUMN subtopic_id TO subtopico_id;

-- study_goals
ALTER TABLE study_goals RENAME COLUMN unit_id TO disciplina_id;
```

### Vantagem da unificação
Todas as referências internas (schedule_items, documents, notes, study_goals, FSRS) apontam para `topicos.id` (UUID). Funciona igual para tópicos manuais e de edital. Sem referência polimórfica, sem tabela separada de progresso. O campo `api_topico_id` é usado apenas para cruzar com dados da API (inteligência, nomes atualizados).

---

## Rename — Nomenclatura do Domínio

As tabelas e código existentes usam "units/topics/subtopics" genéricos. Renomear para a linguagem do domínio de concursos:

### Tabelas
- `units` → `disciplinas`
- `topics` → `topicos`
- `subtopics` → `subtopicos`

### Colunas FK em tabelas dependentes
- `documents.subtopic_id` → `documents.subtopico_id`
- `documents.topic_id` → `documents.topico_id`  
- `notes.subtopic_id` → `notes.subtopico_id`
- `notes.topic_id` → `notes.topico_id`
- `schedule_items.unit_id` → `schedule_items.disciplina_id`
- `schedule_items.topic_id` → `schedule_items.topico_id`
- `schedule_items.subtopic_id` → `schedule_items.subtopico_id`
- `study_goals.unit_id` → `study_goals.disciplina_id`

### Código (50+ arquivos)
- `useUnitsManager` → `useDisciplinasManager`
- `Unit`, `Topic`, `Subtopic` types → `Disciplina`, `Topico`, `Subtopico`
- `unitId`, `topicId`, `subtopicId` → `disciplinaId`, `topicoId`, `subtopicId`
- `unit.title` → `disciplina.nome`, `topic.title` → `topico.nome`
- `DocumentsOrganizationContext` — atualizar todos os state names
- Todos os componentes que referenciam unit/topic/subtopic/title
- Migration SQL com `ALTER TABLE RENAME` + `ALTER COLUMN RENAME`

### Arquivos impactados
- 9 migrations
- 3 type files (database.ts, notes.ts, plate-document.ts)
- 11 hooks
- 25+ components
- 4 views
- 1 context
- 1 lib (schedule-distribution.ts)

---

## Cronograma — Toggle Edital/Cronograma

### Sidebar slim
O toggle no topo da DisciplinesSidebar alterna entre:
- **Modo Edital:** lista de disciplinas com progresso
- **Modo Cronograma:** calendário mensal preenchendo a sidebar, com dias coloridos (verde=concluído, indigo=agendado, vermelho=prova), stats do dia selecionado

### Área central
- **Modo Edital:** tópicos da disciplina selecionada (cards com progresso segmentado)
- **Modo Cronograma:** planner do dia selecionado (lista de atividades com tipo, duração, status, botão de ação)

### Tipos de atividade no cronograma
O cronograma não agenda "tópicos" — agenda **atividades** sobre tópicos:
- 📖 Estudo Parte 1 (60% da duração estimada)
- 📖 Estudo Parte 2 (40% da duração estimada)
- 🔄 Revisão N (duração baseada no tipo de revisão FSRS)
- ❓ Questões (sessão de questões sobre o tópico)
- ⚖️ Lei Seca (leitura dos artigos vinculados)

### Planner do dia (CronogramaDayView)
```
┌─────────────────────────────────────────┐
│  Header: "Terça, 8 de Abril"           │
│  4 atividades · 1h50 total · 25%       │
│  [===========........................] │
├─────────────────────────────────────────┤
│  ✓ Homicídio — Parte 1 · 40min         │ (concluída, opaca)
│                                         │
│  ▶ Dir. Fundamentais — Revisão 2        │ (próxima, destaque,
│    Dir. Constitucional · 15min          │  botão "Iniciar Revisão"
│    [▶ Iniciar Revisão] [Adiar]          │  + "Adiar")
│                                         │
│  ○ Atos Admin. — Questões · 30min       │ (pendente)
│                                         │
│  ○ Poder Judiciário — Lei Seca · 25min  │ (pendente)
└─────────────────────────────────────────┘
```

---

## Form de Conclusão de Atividade

Ao finalizar um item do cronograma, um form aparece com dois modos:

### Modo Rápido (default)
O aluno acabou de estudar e quer seguir para o próximo. Mínimo de fricção:
- **Auto-avaliação:** 3 botões grandes — Fácil / Médio / Difícil
- **Botão "Confirmar"**
- Total: **1 clique + 1 confirmação**

### Modo Detalhado (expandível)
Link "Adicionar detalhes ›" expande campos extras:
- **Tempo real gasto:** pré-preenchido com estimado, editável
- **Resumos:** quantos criou/revisou (0 por padrão)
- **Questões:** acertos / erros (0/0 por padrão)
- **Lei Seca:** artigos lidos — range (pré-preenchido se o tópico tem legislação vinculada)
- **Teoria finalizada:** checkbox
- **Comentários:** texto livre (opcional)

### FSRS Rating
- **Modo rápido:** auto-avaliação é o input direto do FSRS
  - Fácil → Rating.Easy, Médio → Rating.Good, Difícil → Rating.Hard
- **Modo detalhado:** se o aluno preencheu questões acertos/erros, o sistema calcula rating combinado:
  ```
  finalRating = timeScore × 0.25 + questionsScore × 0.35 + completionScore × 0.30 + autoAvaliacao × 0.10
  ```
  E mostra: *"Baseado no seu desempenho, próxima revisão em X dias"* — transparente, sem surpresa.

### Comportamento ao salvar
- Atualiza `topicos` no Supabase (tempo_investido, questoes_acertos/erros, status, completed_at)
- FSRS calcula próxima revisão
- `schedule_items` marcado como concluído
- Drawer atualiza mostrando novo progresso
- No edital verticalizado, tópico reflete novo status (dots de progresso atualizam)

---

## Registro de Estudo Manual (Drawer)

O drawer sempre oferece "Registrar Estudo" para log fora do cronograma.

### Campos
Mesmos do form de conclusão, mas sem o contexto do schedule_item.

### Comportamento
- Cria registro em `topicos` no Supabase (lazy — primeira interação com o tópico)
- Se existia um item agendado no cronograma para esse tópico:
  - Sistema detecta e adapta: remove ou converte em revisão
  - Redistribui tempo liberado para outros tópicos pendentes
- Se não existia cronograma: registra normalmente, independente

---

## Progresso Segmentado (4 dots)

Cada tópico na árvore do edital mostra 4 indicadores visuais:

| Dot | Tipo | Verde | Amarelo | Cinza |
|-----|------|-------|---------|-------|
| 1 | 📖 Estudo | P1+P2 concluídos | P1 feito, P2 pendente | Não iniciado |
| 2 | 🔄 Revisão | Todas feitas | Pendente/agendada | Nenhuma |
| 3 | ❓ Questões | ≥ 10 respondidas | 1-9 respondidas | 0 |
| 4 | ⚖️ Lei Seca | Artigos lidos | Parcial | Não lido |

Os dots são calculados a partir da tabela `topicos` (campos de progresso) + `schedule_items` no Supabase, cruzados com o `api_topico_id`.

---

## Inteligência do Edital (API)

Dados que o drawer mostra vindos da API editais:

### "O que mais cai"
- Subtópicos/aspectos do tópico ranqueados por frequência em provas
- Barras de % com gradiente (ex: Qualificadoras 94%, Feminicídio 87%, Privilegiado 62%)
- Requer: query na API que retorna frequência por subtópico/aspecto

### Editais que cobram
- Lista de outros editais que contêm o mesmo tópico (cross-reference)
- Badges compactos (TRF 1ª, TRF 5ª, STJ, MPF)
- Requer: query `editaisPorDisciplina` existente na API ou nova query por tópico

### Legislação vinculada
- Artigos de lei relacionados ao tópico (clicáveis, abrem Lei Seca)
- Requer: mapeamento tópico → artigos (pode ser manual/curado ou via IA)

### Bancas
- Quais bancas mais cobram esse tópico
- Requer: dados de bancas nos editais da API

**Nota:** Algumas dessas queries já existem na API (rankingDisciplinas, disciplinasEmComum, editaisPorDisciplina). Outras precisam ser criadas ou os dados precisam ser enriquecidos.

---

## Fluxo Completo — Ponta a Ponta

```
1. /editais
   └─ Aluno navega editais, clica "Ver edital" num cargo
   └─ Navega para /documents-organization?editalId=X&cargoId=Y

2. /documents-organization (modo exploração)
   └─ Lê estrutura da API editais (React Query cache)
   └─ Sidebar slim: disciplinas do cargo
   └─ Central: tópicos da disciplina selecionada
   └─ Drawer: inteligência do tópico (API)
   └─ Zero escrita no Supabase

3. Aluno interage (qualquer ação pessoal cria registro local)
   └─ Opção A: "Registrar Estudo" no drawer (form rápido: 1 clique)
   │  └─ Cria disciplina + topico local (lazy, 2 rows) com api_topico_id
   │  └─ Se tem cronograma → adapta (remove/converte item agendado)
   │
   └─ Opção B: Criar nota / documento sobre o tópico
   │  └─ Mesmo trigger: cria registro local se não existir
   │
   └─ Opção C: "Criar Plano de Estudo"
      └─ Cria planos_estudo + planos_editais (2-3 rows)
      └─ Pode criar cronograma (GoalCreationDialog)
      └─ Cronograma cria TODOS os tópicos do plano (bulk, ~95 rows)
      └─ Distribuição automática (schedule-distribution.ts)
      └─ FSRS agenda revisões após completar

4. Aluno estuda via cronograma
   └─ Toggle "Cronograma" na sidebar → calendário
   └─ Central: planner do dia com atividades tipadas (📖🔄❓⚖️)
   └─ Clica "Iniciar" → executa atividade
   └─ Finaliza → form de conclusão (modo rápido: 1 clique, ou detalhado)
   └─ FSRS calcula próxima revisão (rating simples ou combinado)
   └─ Cronograma se adapta (incluindo estudo manual registrado via drawer)

5. Aluno volta ao edital
   └─ Tópicos mostram status (check, ring, dots)
   └─ Drawer mostra inteligência + estatísticas + revisões
   └─ Ciclo continua
```

---

## Dados no Supabase — Impacto Mínimo

### Cenário: aluno explorando (zero Supabase)
| Tabela | Rows |
|--------|------|
| (todas) | 0 |

### Cenário: aluno registrou estudo manual em 3 tópicos
| Tabela | Rows |
|--------|------|
| disciplinas | ~3 (lazy, 1 por disciplina interagida) |
| topicos | 3 (lazy, 1 por tópico interagido) |

### Cenário: aluno com plano + cronograma completo (1 edital)
| Tabela | Rows |
|--------|------|
| planos_estudo | 1 |
| planos_editais | 1 |
| disciplinas | ~15 (bulk, todas do cargo) |
| topicos | ~80 (bulk, todos do cargo) |
| schedule_items | ~200 (distribuição do cronograma) |
| documents | ~20-50 (resumos criados pelo aluno) |
| notes | ~10-20 |

Total: ~370 rows. Compatível com Supabase gratuito mesmo com múltiplos planos.

---

## Offline e Cache

### Estratégia
- **React Query `persistQueryClient`** com `localStorage` para dados da API editais
- Editais já visitados: estrutura servida do cache local. Funciona offline.
- Editais nunca visitados: sem internet, mensagem "Conecte-se para explorar novos editais"
- Progresso: totalmente offline (Supabase offline queue existente no app)
- Inteligência (incidência, bancas): cacheada junto com estrutura. Placeholder se nunca visitou.

### Cache da API
- `staleTime`: 24h (editais mudam raramente)
- `cacheTime`: 7 dias
- Invalidação manual ao receber notificação de atualização do edital

---

## Editais Visitados Recentemente

Na página `/editais`, seção "Vistos recentemente" mostra editais que o aluno já explorou. Dados vêm do React Query persist (localStorage), não do Supabase. Se o aluno quer guardar permanentemente, cria um plano de estudo.

---

## Fora do Escopo (Futuro)

- Vínculo automático tópico ↔ questão (tabela topico_questoes na API)
- Cronograma automático com IA (sugestão de distribuição baseada em inteligência)
- Edital combinado automático (sistema encontra sobreposição entre editais)
- Domínio editais.projetopapiro.com.br (DNS)
- Notificações de revisão (push/email)
- Gamificação (conquistas, streaks)
- Clean de marca d'água dos PDFs do PCI
