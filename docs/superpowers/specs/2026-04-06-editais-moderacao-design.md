# Moderacao de Editais — Design Spec

## Overview

Painel administrativo para gerenciar editais, cargos, disciplinas e topicos dentro do painel de moderacao existente (`/moderacao/editais`). Somente admin (role 3) pode editar. Moderadores veem read-only. Backend adiciona mutations GraphQL na api-editais. Frontend segue patterns existentes (ModerationDataTable, ModerationDrawer, ActionBar, Timeline).

**Objetivo:** Admin pode editar metadados, criar novos itens, ativar/inativar, soft/hard delete, bulk actions, reordenar topicos, tudo com audit log completo.

## Permissoes

| Role | Acesso |
|------|--------|
| Admin (3) | CRUD completo + bulk + hard delete |
| Moderador (2) | Read-only — ve a secao mas acoes bloqueadas |
| Teacher/User | Sem acesso (ModerationRoute bloqueia) |

## Backend — Mutations GraphQL

Adicionadas ao schema existente da api-editais (Fastify/Mercurius). Protegidas por auth admin (JWT + role check).

### Schema das mutations

```graphql
input EditalInput {
  nome: String
  sigla: String
  esfera: String
  tipo: String
  descricao: String
  dataPublicacao: String
  dataEncerramento: String
  dataInicioInscricao: String
  dataFimInscricao: String
  link: String
  cidade: String
  previsto: Boolean
  cancelado: Boolean
  autorizado: Boolean
  ativo: Boolean
  destaque: Boolean
}

input CargoInput {
  nome: String
  vagas: Int
  remuneracao: Int
  dataProva: String
  ativo: Boolean
}

input DisciplinaInput {
  nome: String
  nomeEdital: String
  ativo: Boolean
}

input TopicoInput {
  nome: String
  ordem: Int
  ativo: Boolean
}

type MutationResult {
  success: Boolean!
  message: String
  id: Int
}

type BulkResult {
  success: Boolean!
  affected: Int!
}

type Mutation {
  # Editais
  criarEdital(input: EditalInput!): MutationResult!
  atualizarEdital(id: Int!, input: EditalInput!): MutationResult!
  deletarEdital(id: Int!): MutationResult!

  # Cargos
  criarCargo(editalId: Int!, input: CargoInput!): MutationResult!
  atualizarCargo(id: Int!, input: CargoInput!): MutationResult!
  deletarCargo(id: Int!): MutationResult!

  # Disciplinas
  criarDisciplina(cargoId: Int!, input: DisciplinaInput!): MutationResult!
  atualizarDisciplina(id: Int!, input: DisciplinaInput!): MutationResult!
  deletarDisciplina(id: Int!): MutationResult!

  # Topicos
  criarTopico(disciplinaId: Int!, input: TopicoInput!): MutationResult!
  atualizarTopico(id: Int!, input: TopicoInput!): MutationResult!
  deletarTopico(id: Int!): MutationResult!
  reordenarTopicos(disciplinaId: Int!, topicoIds: [Int!]!): MutationResult!

  # Bulk
  bulkAtivar(tipo: String!, ids: [Int!]!, ativo: Boolean!): BulkResult!
  bulkDeletar(tipo: String!, ids: [Int!]!): BulkResult!
}
```

### Auth nas mutations

- Extrair JWT do header Authorization
- Validar com SUPABASE_JWT_SECRET (ja existente)
- Extrair `sub` (user_id) do JWT payload
- Consultar role do usuario via Supabase REST API: `GET /rest/v1/user_roles?user_id=eq.{sub}&select=role` usando SUPABASE_SERVICE_ROLE_KEY
- Cache a role por 5 minutos em memoria (evita query a cada mutation)
- Somente role = 'admin' pode executar mutations
- Rejeitar com 403 se nao for admin
- Env vars necessarias no Coolify: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

### Validacao

- Criar/editar: verificar duplicata de nome no mesmo nivel (ex: dois cargos com mesmo nome no mesmo edital)
- Deletar: hard delete com CASCADE (ja configurado no schema SQL)
- Bulk: maximo 100 itens por operacao

### Audit log

Toda mutation registra na tabela `moderation_log` do Supabase:
- `actor_id`: user_id do admin
- `target_type`: 'edital' | 'cargo' | 'disciplina' | 'topico'
- `target_id`: id do item (como string)
- `action`: 'create' | 'update' | 'delete' | 'activate' | 'deactivate' | 'bulk_activate' | 'bulk_deactivate' | 'bulk_delete' | 'reorder'
- `details`: JSON com campos alterados (ex: `{"nome": {"old": "PF", "new": "Policia Federal"}}`)

A API faz INSERT direto no Supabase usando o service role key (ja disponivel no backend como DATABASE_URL nao — precisa adicionar SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY como env vars no Coolify, ou logar direto no PostgreSQL do editais em tabela local).

**Decisao:** Criar tabela `admin_log` no PostgreSQL da api-editais (mesmo banco, evita dependencia cruzada com Supabase). Schema:

```sql
CREATE TABLE admin_log (
  id SERIAL PRIMARY KEY,
  actor_id UUID NOT NULL,
  target_type VARCHAR(20) NOT NULL,
  target_id INTEGER NOT NULL,
  action VARCHAR(30) NOT NULL,
  details JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_log_target ON admin_log(target_type, target_id);
CREATE INDEX idx_admin_log_actor ON admin_log(actor_id);
```

Query GraphQL para ler o log:

```graphql
type AdminLogEntry {
  id: Int!
  actorId: String!
  targetType: String!
  targetId: Int!
  action: String!
  details: String
  criadoEm: String!
}

extend type Query {
  adminLog(targetType: String!, targetId: Int!): [AdminLogEntry!]!
}
```

## Frontend — Navegacao hibrida (drill-down + drawer)

### Rota

`/moderacao/editais` — nova rota filha de `/moderacao` no App.tsx.

### Sidebar

Adicionar item no ModerationSidebar.tsx:
- Label: "Editais"
- Href: `/moderacao/editais`
- Icon: `ClipboardList` (lucide)
- Sem badge (nao tem pending count)

### Fluxo de navegacao

Estado gerenciado por um unico componente `EditaisModerationPage` que controla:
- `level`: 'editais' | 'cargos' | 'disciplinas' | 'topicos'
- `parentChain`: array de { id, nome, tipo } para o breadcrumb
- `selectedItem`: item aberto no drawer

**Nivel 1 — Editais:**
- Tabela com colunas: checkbox, sigla, nome, esfera, tipo, cargos, disc, topicos, ativo, acoes
- Busca por nome/sigla
- Filtros: esfera (select), tipo (select), ativo (todos/ativos/inativos), ordenacao (nome/data/cargos)
- Botao "+ Novo Edital"
- Barra de bulk actions quando ha selecao: Ativar | Inativar | Excluir
- Clica na linha → drawer abre com metadados editaveis

**Nivel 2 — Cargos (de um edital):**
- Breadcrumb: Editais > [Sigla do edital] (N cargos)
- Tabela: checkbox, nome, vagas, remuneracao, disc, topicos, ativo
- Busca por nome
- Botao "+ Novo Cargo"
- Bulk actions
- Clica → drawer com metadados + botao "Gerenciar Disciplinas"

**Nivel 3 — Disciplinas (de um cargo):**
- Breadcrumb: Editais > [Sigla] > [Cargo] (N disciplinas)
- Tabela: checkbox, nome, nome_edital, topicos, ativo
- Busca por nome
- Botao "+ Nova Disciplina"
- Bulk actions
- Clica → drawer com metadados + botao "Gerenciar Topicos"

**Nivel 4 — Topicos (de uma disciplina):**
- Breadcrumb: Editais > [Sigla] > [Cargo] > [Disciplina] (N topicos)
- Tabela: checkbox, ordem, nome, ativo
- Busca por nome
- Botao "+ Novo Topico"
- Bulk actions
- Drag-and-drop para reordenar (ou botoes cima/baixo)
- Clica → drawer com nome + ordem editaveis

### Drawer (todos os niveis)

- Campos editaveis do item (inputs, selects, toggles)
- Toggle ativo/inativo (switch grande e visivel)
- Badge amarelo "Pai inativo" se o pai na hierarquia esta inativo
- Botao "Gerenciar [filhos]" (exceto topicos) — fecha drawer, faz drill-down
- Secao "Historico" com Timeline component mostrando admin_log
- Footer (ActionBar): Salvar | Cancelar | Excluir permanentemente
- "Excluir permanentemente" abre confirmacao dupla: primeiro confirma intencao, depois digita nome do item

### Drawer de criacao

Mesmo layout do drawer de edicao, mas:
- Titulo "Novo [Edital/Cargo/Disciplina/Topico]"
- Campos vazios
- Validacao: nome obrigatorio, verificacao de duplicata ao salvar
- Footer: Criar | Cancelar

### Cascata visual

Quando um edital esta `ativo: false`:
- Todos os cargos filhos mostram badge amarelo "Edital inativo" na tabela
- O admin entende que mesmo que o cargo individual esteja ativo, ele nao aparece no frontend publico

Mesma logica para cargo inativo → disciplinas filhas mostram "Cargo inativo".

### Bulk actions

- Checkboxes na primeira coluna da tabela
- Quando >= 1 item selecionado, barra de acoes aparece acima da tabela
- Acoes: "Ativar selecionados" | "Inativar selecionados" | "Excluir selecionados"
- "Excluir selecionados" requer confirmacao ("Excluir N itens permanentemente?")
- Maximo 100 itens por operacao

### Reordenacao de topicos

No nivel 4 (topicos), alem da tabela normal:
- Botoes seta cima/baixo em cada linha para mover posicao
- Ao mover, atualiza visualmente e envia mutation `reordenarTopicos` com a nova ordem completa
- Alternativa futura: drag-and-drop (mas botoes sao mais simples e acessiveis para v1)

### Contadores no breadcrumb

Cada nivel do breadcrumb mostra a contagem de filhos:
- Editais > PF (41 cargos)
- Editais > PF > Delegado (24 disciplinas)
- Editais > PF > Delegado > Direito Penal (15 topicos)

## Componentes a criar

### Backend (api-editais)
- `src/resolvers/mutations.ts` — todas as mutations
- `src/auth.ts` — adicionar verificacao de role admin (alem do JWT existente)
- `src/schema.ts` — adicionar tipos e mutations ao schema
- `scripts/migrate-admin-log.sql` — criar tabela admin_log

### Frontend (Metav2)
- `src/components/moderation/editais/EditaisModerationPage.tsx` — pagina principal com state machine de niveis
- `src/components/moderation/editais/EditaisTable.tsx` — tabela nivel 1
- `src/components/moderation/editais/EditaisDrawer.tsx` — drawer de edicao/criacao para todos os niveis
- `src/components/moderation/editais/EditaisBreadcrumb.tsx` — breadcrumb com contadores
- `src/components/moderation/editais/EditaisBulkBar.tsx` — barra de acoes em lote
- `src/components/moderation/editais/HierarchyTable.tsx` — tabela generica reutilizada nos niveis 2-4 (cargos, disciplinas, topicos)
- `src/hooks/moderation/useEditaisAdmin.ts` — hook com mutations e queries GraphQL para o painel

## Arquivos a modificar

- `src/App.tsx` — adicionar rota `/moderacao/editais`
- `src/components/moderation/layout/ModerationSidebar.tsx` — adicionar nav item "Editais"
- `api-editais/src/schema.ts` — mutations + inputs + types
- `api-editais/src/index.ts` — registrar novos resolvers
- `api-editais/src/auth.ts` — adicionar role check

## Fora do escopo

- Import de novos editais via arquivo (usa o script existente `importar.ts`)
- Drag-and-drop para reordenacao (v1 usa botoes cima/baixo)
- Edicao inline na tabela (sempre via drawer)
- Historico de versoes / diff visual (audit log e suficiente)
- Notificacoes quando admin edita algo
