# Painel de Moderação Premium — Design Spec

**Data:** 2026-03-31
**Status:** Aprovado
**Escopo:** Fase 1 — Infra + Reports de comentários + Gestão de usuários

---

## 1. Visão Geral

Hub de operações completo para moderação de conteúdo, gestão de usuários e auditoria. Dashboard dedicado em `/moderacao` com layout próprio, separado do app de estudo.

**O que entra na Fase 1:**
- Sistema de roles e permissões (user_roles + RLS)
- Layout do dashboard (ModerationShell + sidebar + routing)
- Overview com stats e reports recentes
- Fila de reports de comentários (página + drawer + filtros)
- Inline badges discretos no app de estudo (só moderadores)
- Gestão de usuários (tabela + drawer + ações)
- Log de auditoria unificado (moderation_log)

**Fases futuras (fora deste spec):**
- Fase 2: Reports de questões desatualizadas + dispositivos legais (Lei Seca)
- Fase 3: Billing/descontos + analytics avançado

---

## 2. Sistema de Roles e Permissões

### Tabela `user_roles`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | UNIQUE |
| `role` | text CHECK | `admin`, `moderator`, `teacher`, `user` |
| `granted_by` | uuid FK → auth.users | Quem elevou |
| `granted_at` | timestamptz | DEFAULT now() |

- Um user tem **uma role**. Default = `user` (row criada no signup ou lazy).
- RLS policies usam função SQL `get_user_role(uid)` que retorna a role.
- Hierarquia: admin > moderator > teacher > user.

### Matriz de Permissões

| Ação | user | teacher | moderator | admin |
|------|------|---------|-----------|-------|
| Ver painel `/moderacao` | - | - | sim | sim |
| Resolver reports | - | - | sim | sim |
| Pin/Endorse comentários | - | sim | sim | sim |
| Shadowban usuários | - | - | sim | sim |
| Banir usuários | - | - | sim | sim |
| Elevar/rebaixar roles | - | - | - | sim |
| Ver inline badges | - | sim (só pin/endorse) | sim | sim |
| Descontos/billing (futuro) | - | - | - | sim |

### Frontend

- `useUserRole()` hook — busca role do user logado via react-query, cacheia por 5min.
- `<RoleGate role="moderator">` — renderiza children só se role do user >= role especificada.
- `<ModerationRoute>` — wrapper que redireciona se role < moderator.

---

## 3. Design Language

### Princípios

- **Minimalista com vida** — limpo mas não morto
- **Tipografia como hierarquia** — peso de fonte e opacidade definem importância, não cor
- **Roxo estratégico** — cor de acento presente de forma intencional mas não dominante
- **Profundidade sutil** — sombras leves (0 1px 3px rgba(0,0,0,0.04)), sem bordas grossas
- **Resolvidos desbotam** — items resolvidos em cinza claro, atenção natural nos pendentes

### Paleta

- **Acento primário:** #7c3aed (roxo) — CTAs, item ativo, badges, links
- **Acento gradiente:** linear-gradient(135deg, #7c3aed, #a78bfa) — avatar, logo
- **Fundo sidebar:** #faf8ff (lavanda sutil)
- **Borda sidebar:** #ede9fe
- **Fundo área principal:** #f8f8f8
- **Fundo cards/tabelas:** white
- **Severidade alta:** #ef4444 (dot com box-shadow 0 0 0 3px #fef2f2)
- **Severidade média:** #f59e0b (dot com box-shadow 0 0 0 3px #fffbeb)
- **Resolvido:** #d4d4d8 (dot sem glow)
- **Positivo:** #22c55e (indicadores de melhoria nos stats)
- **Texto primário:** #18181b
- **Texto secundário:** #71717a
- **Texto terciário:** #a1a1aa
- **Hover rows:** #faf8ff (tint lavanda)

### Tipografia

- Font: Nunito (consistência com o app de estudo)
- Títulos: 22px, weight 700, letter-spacing -0.5px
- Subtítulos: 14px, weight 700, letter-spacing -0.2px
- Labels: 11px, uppercase, letter-spacing 0.5px, weight 600, #a1a1aa
- Stats números: 36px, weight 800, letter-spacing -1.5px, tabular-nums
- Corpo tabela: 13px, weight 500 (pendente) / 400 (normal)

### Ícones

- Lucide React (já usado no projeto)
- Sidebar: LayoutGrid, Flag, Users, HelpCircle, BookOpen, CreditCard
- 15px, stroke-width 2

---

## 4. Layout e Navegação

### Estrutura

- Rota `/moderacao/*` carrega `ModerationShell` — layout independente do app de estudo
- **Sidebar fixa esquerda** (210px):
  - Logo: ícone "M" com gradiente roxo + "Moderação" em #2e1065
  - Nav items com ícones Lucide, item ativo em branco com sombra + texto roxo
  - Badge roxo sólido (#7c3aed) com count de reports pendentes no item "Reports"
  - Separador sutil (#ede9fe) entre items ativos e futuros
  - Items futuros (Lei Seca, Billing) em #c4b5fd
  - User card no bottom: avatar gradiente + nome + role em roxo + botão sair
- **Área principal** (flex: 1):
  - Fundo #f8f8f8
  - Header branco com título + filtro de período
  - Conteúdo em cards brancos com border e sombra sutil

### Rotas

```
/moderacao           → OverviewPage
/moderacao/reports   → ReportsPage
/moderacao/usuarios  → UsersPage
```

### Navegação entre app e painel

- No app de estudo: link/botão pra `/moderacao` (visível só pra mod/admin)
- Na sidebar do painel: seta ← no user card volta pro app (`/`)

---

## 5. Overview (Dashboard)

### Stats Cards (grid 4 colunas)

Quatro cards brancos com border-radius 10px, sombra sutil, border #f0f0f0:

1. **Pendentes** — count + "+N hoje". Border #ede9fe (destaque roxo sutil). Dot roxo 8px no canto.
2. **Resolvidos (período)** — count + "↑ N%" em verde.
3. **Tempo médio de resolução** — "N.Nh" com "h" menor e cinza.
4. **Banidos ativos** — count + "este mês".

### Tabela de Reports Recentes

- Header: "Reports recentes" + link "Ver todos →" em roxo
- Colunas: Conteúdo, Tipo, Quando, Status
- Header da tabela: 11px uppercase, fundo #fafafa
- Rows: hover lavanda (#faf8ff)
- Dot de severidade 7px com glow ring pra urgentes
- Pendentes: texto preto, weight 500, status bold
- Resolvidos: texto #a1a1aa, dot cinza sem glow
- Clicar em row → abre Drawer de detalhes

---

## 6. Drawer de Detalhes (Report)

Drawer lateral direito, ~450px largura, sombra de overlay sutil.

### Header

- Tipo do report (Comentário / Questão / Lei Seca)
- Status (Pendente / Em análise / Resolvido)
- Timestamp

### Preview do Conteúdo

- **Comentário:** PlateStatic render (já existe), autor, link pra questão
- **Questão:** enunciado + alternativas + qual lei desatualizada
- **Lei Seca:** artigo + redação + o que o reporter indicou errado

### Info do Reporter

- Quem reportou, quando, motivo, descrição adicional
- Histórico: quantos reports esse user já fez (detectar abuso)

### Timeline de Ações

- Lista cronológica: avatar + nome + ação + timestamp
- Ex: "Reportado por João", "Visto por Maria", "Resolvido por Aldemir"
- Alimentada pela tabela `moderation_log`

### Barra de Ações (sticky bottom)

- **Resolver** — dropdown: procedente / improcedente
- **Shadowban** — aplica shadowban no autor do conteúdo
- **Banir** — ban completo (mod/admin)
- **Deletar conteúdo** — soft delete LGPD

---

## 7. Inline Badges (App de Estudo)

### Visibilidade

- Apenas users com role >= moderator vêem os badges
- Usuários comuns: zero alteração na interface
- Professores: continuam vendo só pin/endorse

### Aparência

- Dot roxo 6px + número ao lado (ex: `● 3`) no canto superior direito do comentário
- Sem badge colorido, sem texto "Reportado", sem ícone de alerta
- Consistente com design minimalista do dashboard

### Interação

- Clicar no dot → abre o Drawer (mesmo componente do dashboard) sobreposto na página
- Moderador resolve sem navegar pra `/moderacao`
- Dot some após resolução

### Onde aparece

- `CommunityCommentItem` — dot no canto do comentário
- `QuestionCard` (futuro) — dot no header se questão tem reports

---

## 8. Gestão de Usuários

Página `/moderacao/usuarios`.

### Tabela

- Colunas: Avatar + Nome, Email, Role, Status (ativo/shadowban/banido), Cadastro, Última atividade
- Filtros: por role, por status, busca por nome/email
- Mesmo estilo visual das outras tabelas

### Drawer de Usuário

**Header:**
- Avatar grande + nome + email
- Role com dropdown de elevação (só admin)

**Seção "Atividade":**
- Comentários postados (total + últimos 30d)
- Reports recebidos (total + quantos procedentes)
- Reports feitos por ele
- Upvotes recebidos

**Seção "Histórico de moderação":**
- Timeline cronológica das ações sofridas/executadas
- Alimentada por `moderation_log` filtrado por user

**Ações (sticky bottom):**
- Alterar role — dropdown (só admin)
- Shadowban — toggle (mod/admin)
- Banir — com motivo obrigatório (mod/admin)
- Desban — se banido

---

## 9. Modelo de Dados

### Tabelas novas

**`user_roles`** — descrita na Seção 2.

**`moderation_log`** — log de auditoria unificado (append-only):

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid PK | DEFAULT gen_random_uuid() |
| `actor_id` | uuid FK → auth.users | Quem executou |
| `target_type` | text | `user`, `comment`, `question`, `law_article` |
| `target_id` | uuid | ID do alvo |
| `action` | text | `ban`, `shadowban`, `unban`, `unshadowban`, `role_change`, `report_resolve`, `report_dismiss`, `delete_content` |
| `details` | jsonb | Metadados (motivo, role_anterior, role_nova, etc.) |
| `created_at` | timestamptz | DEFAULT now() |

- `target_type` texto é exceção deliberada ao padrão "sem polimorfismo" — logs são append-only, sem JOINs complexos, e a timeline unificada exige tabela única.
- Índice em `(target_type, target_id)` para queries de timeline por entidade.
- Índice em `actor_id` para histórico de ações de um moderador.

### Tabelas existentes (sem alteração)

- `question_comment_reports` — já existe, vira o módulo de reports de comentários direto
- `user_moderation` — já tem shadowban, complementa com dados do user_roles

### Tabelas futuras (fora deste spec)

- `question_reports` — Fase 2
- `law_article_reports` — Fase 2

---

## 10. Arquitetura — Módulos + Shared UI Kit

### Shared UI Kit

Componentes reutilizados por todos os módulos:

- `ModerationDrawer` — drawer lateral direito, 450px, overlay, animação slide-in
- `ModerationDataTable` — tabela com header, rows, hover, paginação, empty state
- `StatusDot` — dot 7px com glow ring opcional (severity prop)
- `ActionBar` — barra sticky bottom com botões de ação
- `Timeline` — lista cronológica de ações (usa moderation_log)
- `ContentPreview` — renderiza preview do conteúdo por tipo

### Estrutura de Pastas

```
src/
├── components/moderation/
│   ├── shared/
│   │   ├── ModerationDrawer.tsx
│   │   ├── ModerationDataTable.tsx
│   │   ├── StatusDot.tsx
│   │   ├── ActionBar.tsx
│   │   ├── Timeline.tsx
│   │   └── ContentPreview.tsx
│   ├── layout/
│   │   ├── ModerationShell.tsx
│   │   ├── ModerationSidebar.tsx
│   │   └── ModerationRoute.tsx
│   ├── overview/
│   │   ├── OverviewPage.tsx
│   │   └── StatsCards.tsx
│   ├── reports/
│   │   ├── ReportsPage.tsx
│   │   ├── ReportDrawer.tsx
│   │   └── ReportFilters.tsx
│   └── users/
│       ├── UsersPage.tsx
│       ├── UserDrawer.tsx
│       └── UserFilters.tsx
├── hooks/moderation/
│   ├── useUserRole.ts
│   ├── useReports.ts
│   ├── useModerationUsers.ts
│   └── useModerationLog.ts
├── types/
│   └── moderation.ts
└── components/questoes/comments/
    └── InlineReportBadge.tsx
```

---

## 11. Decisões Técnicas

- **React Query** pra todos os hooks de moderação — mesmo padrão do projeto
- **PlateStatic** pra preview de comentários no drawer — já existe e funciona
- **Supabase RLS** como enforcement real de permissões — frontend é só UX, backend é autoridade
- **`(supabase as any)`** temporário até regenerar database.ts com as novas tabelas
- **Drawer compartilhado** entre dashboard e inline badges — mesmo componente, contextos diferentes
- **Soft delete LGPD** via `handle_soft_delete` RPC existente
- **Lucide React** pra todos os ícones (já no projeto)

---

## 12. Decisões Adiadas para Implementação

Itens deliberadamente fora do spec — serão resolvidos no plano de implementação:

- **RPC `get_user_role(uid)`** — query SQL exata definida ao criar a tabela
- **Animações do drawer** — slide-in direction, duração, easing, overlay opacity
- **Paginação vs infinite scroll** — depende do volume de dados real; testar e escolher
- **Responsividade/mobile** — moderação é desktop-first; se necessário, spec separado
- **Empty states** — mensagens e ilustrações quando não há reports/usuários
- **Keyboard shortcuts** — atalhos pra navegar entre reports, resolver rápido
