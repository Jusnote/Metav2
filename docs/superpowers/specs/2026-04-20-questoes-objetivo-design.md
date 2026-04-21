# Objetivo — redesign do topo da página de Questões

**Data:** 2026-04-20
**Autor:** Aldemir + Claude Opus 4.7
**Status:** design aprovado — pronto pra plano de implementação

## Problema

A parte de filtragem da página de questões (`/questoes`) empilha 5 faixas horizontais com estilos inconsistentes (título, tabs de modo, pills, chips, results header, status tabs). Não há um ponto de partida visual claro para o aluno "escolher o que vai estudar hoje".

Concurseiros preparam há meses para um cargo específico. Hoje a experiência trata isso como mais um filtro manual entre outros — o aluno precisa lembrar quais bancas, anos e órgãos fazem sentido para PF-Agente, e configurar tudo à mão sempre que abre a página.

## Objetivo desta spec

Introduzir uma seção **OBJETIVO** no topo da página de questões que permita selecionar um (ou até três) cargos-alvo como delimitadores do universo de busca, e refinar o header existente com tipografia mais elegante. Não mexe em pills, chips, results header, status tabs, sort nem view mode.

## Implementação em duas fases

O design completo está descrito aqui, mas a entrega é **fracionada em duas fases** — a primeira enxuta (visual + admin pra popular fotos) sai agora; a segunda (integração real com dados de questões) entra em outro brainstorm onde a gente discute regras, matching, performance e edge cases a fundo.

### Fase 1 — visual + admin mínimo (esta sessão)

**Entregável:** seção OBJETIVO renderizada na página de questões, painel admin para cadastrar carreiras e subir fotos. Aluno vê a UI completa e bonita, mas **ativar foco não muda o que aparece na lista de questões**. É um catálogo visual — ainda não é um filtro funcional.

Inclui:
- Header refinado (título + tabs segmented control)
- Seção OBJETIVO completa na UI: header da seção, tabs de área, carrossel de cards, seta, busca por nome
- Estado local de focos ativos (React state) — card acende com ✓, TODAS deseleciona, limite de 3 via FIFO
- Tabela `carreiras` (versão mínima: SEM FK `cargos.carreira_id`)
- Bucket `carreira-images` + RLS
- Painel admin `/moderacao/objetivos` enxuto: listagem + drawer CRUD (nome, área, slug, ordem, ativa, upload de foto). SEM picker de cargos vinculados.
- Frontend lê carreiras reais da tabela (não mock)
- `SemanticScopeToggle` renderizado mas apenas visual (sem lógica de contagem/ampliação)

**Fora da Fase 1:**
- Integração foco → query de questões (foco não afeta o que aparece)
- Integração foco → pills (pills operam no universo completo como hoje)
- Toggle semântico funcional
- Auto-limpa de pills incompatíveis
- Persistência de focos entre sessões

### Fase 2 — backend e integração real (próximo brainstorm)

Entregável: modo foco funcional de verdade. Inclui:
- Coluna `cargos.carreira_id` + migração de dados
- Picker "Cargos vinculados" no drawer admin
- Integração na `useQuestoesV2`: escopar base de questões pelos cargos das carreiras ativas
- Adaptação dos popovers de pill: opções limitadas ao universo escopado
- Lógica real do `SemanticScopeToggle`: contagens `dentro_foco` / `fora_foco`, toggle ampliando escopo
- Regra de auto-limpa: ativar foco remove seleções de pill fora do universo com toast
- Persistência decidida (sessionStorage vs localStorage)
- Indexação e validação de performance das queries escopadas
- Regras de matching e edge cases de nomenclatura de cargos

Essa fase vai ter seu próprio brainstorm + spec + plano.

## Fora do escopo (das duas fases)

- Setter global de objetivo (sidebar, onboarding, perfil) — sessão futura
- Refinement strip de editais históricos — curadoria do admin + pills existentes cobrem
- Modo carreira app-wide (dashboards, progress, stats personalizados por cargo)
- Mudanças na `QuestoesFilterBar` ou qualquer componente abaixo da seção OBJETIVO

## Escopo

### (1) Header refinado

Renderização nova em `src/views/QuestoesPage.tsx`, substituindo o bloco atual do título + tabs de modo:

- Título `Banco de Questões.` em **Source Serif 4** 26px, weight 600, letter-spacing `-0.02em`, cor `#0f172a`. Ponto `.` em `#2563eb`.
- Tabs de modo (`Filtros` · `Filtro semântico` · `Cadernos`) como **segmented control** à direita, na mesma linha do título.
  - Container: padding 3px, fundo `#f1f5f9`, border-radius 999px
  - Tab inativa: texto `#64748b`, sem fundo, padding 6×14px, fontsize 12px, font-weight 500
  - Tab ativa: fundo branco, texto `#0f172a`, box-shadow sutil (1px + ring 1px)
  - Hover inativa: texto `#0f172a`
- Divisor `border-bottom: 1px solid #f1f5f9` abaixo do bloco.

### (2) Seção OBJETIVO

Nova seção abaixo do header e acima da `QuestoesFilterBar` existente.

#### (2.1) Header da seção

Linha horizontal com:
- **Label** à esquerda: ícone de alvo concêntrico 14px + palavra `OBJETIVO` em uppercase 11px, weight 600, letter-spacing `0.12em`, cor `#64748b`
- **Lado direito**: botão `Limpar objetivo` (estilo discreto, borda tracejada cinza, texto 11px, aparece só quando há foco ativo) + campo de busca `Filtrar carreiras` (200px, ícone de lupa, placeholder cinza claro)

#### (2.2) Tabs de área

Logo abaixo do header da seção, linha de tabs com underline:

```
Policial (47) · Fiscal (31) · Jurídica (58) · Tribunais (42) · Saúde (23) · Controle (18) · Legislativo (14) · Bancária (9) · Militar (27)
```

Nove áreas iniciais. Ordem fixa (não-alfabética; reflete a prioridade de demanda do público-alvo). Contagem = número de carreiras ativas (`ativa=true`) vinculadas àquela área.

- Tab ativa: texto `#0f172a` weight 600, contagem `#1e3a8a`, underline 2px `#1e3a8a`
- Tab inativa: texto `#64748b`, contagem `#94a3b8`
- Hover inativa: texto `#0f172a`
- Scroll horizontal em mobile; border-bottom 1px `#e2e8f0` percorre a linha toda

**Tabs de área não acionam foco** — só trocam o que o carrossel mostra abaixo.

#### (2.3) Carrossel de carreiras

Linha horizontal scrollável com cards 112×112px, gap 10px:

1. **Primeiro card `TODAS`** (fixo, sempre presente)
   - Fundo `#f8fafc`, borda 1.5px `#e2e8f0`
   - Ícone checklist 28px cinza + label `TODAS` uppercase 10px bold
   - Click = desativa todos os focos (= foco vazio = universo aberto)
   - Estado ativo quando não há nenhum foco selecionado

2. **Cards de carreira** (dinâmicos, da área selecionada, ordenados por `ordem` ASC)
   - Foto do cargo (full-bleed) com overlay gradient `rgba(15,23,42,0.1)` → `rgba(15,23,42,0.88)` no sentido top→bottom
   - Nome do cargo em **white 10px bold uppercase**, letter-spacing `0.03em`, line-clamp 2, na faixa inferior do card
   - Hover: lift 1px + shadow
   - **Ativo**: borda 2px `#1e3a8a` + ring externo `rgba(30,58,138,0.1)` + badge circular 18px `#1e3a8a` com ✓ no canto superior direito
   - Click = toggle foco (ativa/desativa)

3. **Seta `›`** como botão separado 32px à direita do carrossel (NÃO sobrepõe cards)
   - Fundo branco, borda 1px `#e2e8f0`, border-radius 10px
   - Hover: `#f8fafc`, borda `#cbd5e1`
   - Scroll behavior: `smooth`, rola ~3 cards

4. Campo **`Filtrar carreiras`** no header filtra o carrossel por nome (case-insensitive, substring match).

### (3) Modelo de foco (comportamento)

- **Até 3 focos simultâneos.** Ao tentar ativar o 4º, o sistema desativa automaticamente o foco mais antigo (FIFO) e ativa o novo. Sem modal/alerta.
- **Ao abrir a página, nenhum foco inicia ativo.** Card `TODAS` aparece selecionado por padrão — universo aberto. (Mecânica de "favorita inicia ativa" está fora do escopo — pode ser adicionada em sessão futura se necessário.)
- **Focos atravessam áreas**: ativar PF-Agente (área Policial) e AFRFB (área Fiscal) simultaneamente mantém ambos ativos mesmo ao trocar de aba de área.
- **Ao ativar/desativar foco**, a seção de questões re-renderiza com o universo atualizado.

### (4) Foco escopa o universo de busca (não aplica preset)

**Decisão-chave**: foco **não preenche pills** com valores predefinidos. Em vez disso, **escopa o universo de questões e as opções dos pills**.

Regras:

- **Nenhum foco ativo**: pills mostram universo completo (hoje já é assim).
- **1 ou mais focos ativos**:
  - Base de questões = união das questões dos cargos linkados aos focos ativos.
  - Pill `Bancas` → só bancas que têm questões nessa base.
  - Pill `Anos` → só anos com questões nessa base.
  - Pill `Matérias` → só matérias com questões nessa base.
  - Idem Órgãos, Cargos, Assuntos.
  - Pills começam vazios (sem pré-seleção). Usuário refina escolhendo valores dentro do universo escopado.

Consequência: não há estado "editado" nem botão "restaurar preset". O próprio escopo do pill é a indicação visual de que o foco está ativo. Zero tracking adicional.

### (5) Busca semântica fora do foco

Quando há foco ativo e o aluno está na aba `Filtro semântico` digitando uma query, o sistema detecta se existem questões relevantes **fora do universo do foco** e oferece um toggle discreto pra ampliar o escopo daquela busca.

**Comportamento:**
- Aba `Filtro semântico`, foco ativo, query digitada (ex: "tutela provisória")
- Sistema faz duas contagens: `dentro_foco` e `fora_foco`
- Se `fora_foco > 0`, aparece um chip/link abaixo da `QuestoesSearchBar`:
  ```
  [+ Incluir 230 resultados fora do foco]
  ```
- Click = toggle liga; busca re-roda ignorando o escopo do foco; chip passa a mostrar `[✓ incluindo fora do foco · remover]`
- Desativar foco ou apagar a query → toggle reseta (default off)
- Estado vive só na aba Semântico; ao voltar pra `Filtros`, o comportamento volta a ser "busca respeita o escopo"

**Default:** off. Busca sempre respeita o escopo do foco até o aluno explicitamente ampliar.

**Escopo desta spec:** toggle **só aparece na aba Filtro semântico**. Nas abas Filtros e Cadernos, a busca sempre respeita o escopo do foco (o aluno amplia desativando o foco manualmente).

## Modelo de dados

### Tabela `carreiras` (nova)

```sql
create table carreiras (
  id uuid primary key default gen_random_uuid(),
  area text not null,                    -- 'policial', 'fiscal', 'juridica', ...
  nome text not null,                    -- 'PF · Agente', 'PRF · Policial'
  slug text not null unique,             -- 'pf-agente', 'prf-policial'
  foto_url text,                         -- URL do bucket carreira-images
  ordem int not null default 0,          -- posição no carrossel da área
  ativa boolean not null default false,  -- admin decide quando lançar
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_carreiras_area_ordem on carreiras(area, ordem) where ativa = true;
```

### Coluna `carreira_id` em `cargos` _(Fase 2)_

```sql
alter table cargos add column carreira_id uuid references carreiras(id) on delete set null;
create index idx_cargos_carreira on cargos(carreira_id) where carreira_id is not null;
```

- FK opcional: admin vincula N cargos de editais a 1 carreira (muitos-para-um)
- **Esta migração não entra na Fase 1** — carreiras existem sem vínculo com cargos até Fase 2 definir a integração com questões.
- Cargo sem `carreira_id` = não aparece em nenhuma carreira mas continua acessível via filtros normais

### Storage

Bucket **`carreira-images`** no Supabase Storage:
- Público (leitura)
- Escrita restrita a admin/moderator (RLS via role)
- Tamanho máximo 2MB
- MIME types: `image/jpeg`, `image/webp`
- Upload client-side já redimensiona pra 400×400 (retina-ready pro card 112×112)

## Painel admin

Nova aba **`Objetivos`** em `/moderacao` (shell existente: `ModerationShell`).

### Fase 1 — CRUD básico + foto

**Listagem:**
- Tabela paginada de carreiras com colunas: Foto miniatura · Nome · Área · Ativa (toggle) · Ordem (input numérico)
- Filtros no topo: por área, por status (ativa/inativa), busca por nome
- Botão `+ Nova carreira`

**Drawer de edição (ModerationDrawer existente):**
- Upload de foto (drop zone com preview) — redimensiona client-side pra 400×400 antes de subir ao bucket
- Nome (input)
- Slug (auto-gerado do nome, editável)
- Área (select entre as 9 iniciais)
- Ordem (número)
- Toggle: Ativa

### Fase 2 — cargos vinculados

- **Cargos vinculados**: lista de cargos da tabela `cargos` com busca/filtro por edital, multi-select. Admin escolhe quais cargos específicos entram nessa carreira. _(Adicionado ao drawer da Fase 1)_
- Coluna "Cargos vinculados (count)" adicionada à listagem

## Áreas iniciais

Hardcoded como enum no frontend (não tabela; são poucas e estáveis):

1. **Policial** — PF, PRF, PCs estaduais, PMs, CBM, BOPE, ABIN, DEPEN, Perito Criminal
2. **Fiscal** — RFB, ICMS, ISS, TCU
3. **Jurídica** — OAB, Magistratura, MP, Defensoria, Procuradorias
4. **Tribunais** — TRT, TRE, TRF, TJ, STJ, STF
5. **Saúde** — enfermagem, médicos, agentes de saúde, odontologia
6. **Controle** — TCU, TCE, CGU
7. **Legislativo** — Câmara, Senado, Assembleias
8. **Bancária** — BB, CEF, BC, BNDES
9. **Militar** — EB, MB, FAB

Ordem fixa na UI (conforme lista acima). Cada uma vira um valor do enum `area`.

## Fallback de imagem

**Política:** admin só marca `ativa=true` quando sobe a foto. Logo, na prática, não existe carreira ativa sem foto.

Para robustez mesmo assim (caso `foto_url` venha NULL por bug ou deleção): placeholder com gradient neutro cinza/azul + sigla do cargo extraída do nome (ex: "PF" do "PF · Agente") em serifa branca 24px. Nunca card quebrado.

## Estados vazios

- **Área sem carreiras ativas**: carrossel mostra só o card `TODAS`, seguido de mensagem centralizada "Nenhuma carreira ativa em {area} ainda" em cinza sutil.
- **Busca sem match**: "Nenhuma carreira encontrada com este nome"
- **Nenhum foco ativo**: `TODAS` visualmente selecionado (fundo `#eff6ff`, borda `#1e3a8a`).

## Mobile

- Tabs de modo (`Filtros`/`Semântico`/`Cadernos`): continuam inline se caber, senão quebram para linha abaixo do título
- Header da seção OBJETIVO: label + botão + busca quebram em duas linhas se estreito
- Tabs de área: scroll horizontal
- Carrossel: mesmo comportamento desktop, scroll-snap opcional por card
- Cards podem reduzir para 96×96px abaixo de 640px

## Arquivos afetados

### Fase 1

**Novos:**
- `src/components/questoes/objetivo/ObjetivoSection.tsx` — container
- `src/components/questoes/objetivo/ObjetivoHeader.tsx` — label + limpar + busca
- `src/components/questoes/objetivo/AreaTabs.tsx` — tabs de área
- `src/components/questoes/objetivo/CarreiraCarousel.tsx` — carrossel com seta
- `src/components/questoes/objetivo/CarreiraCard.tsx` — card individual
- `src/components/questoes/objetivo/SemanticScopeToggle.tsx` — toggle visual "Incluir fora do foco" (sem lógica real na Fase 1)
- `src/hooks/useCarreiras.ts` — fetch + cache de carreiras ativas (read-only)
- `src/hooks/useFocoObjetivo.ts` — estado dos focos ativos (React state, sem persistência ainda)
- `src/types/carreira.ts` — tipos
- Supabase migration: tabela `carreiras` (versão mínima sem FK) + bucket `carreira-images` + RLS
- `src/app/moderacao/objetivos/page.tsx` — nova aba admin (CRUD básico + foto)
- `src/components/moderacao/objetivos/ObjetivoTable.tsx`
- `src/components/moderacao/objetivos/ObjetivoDrawer.tsx`
- `src/components/moderacao/objetivos/ObjetivoFotoUpload.tsx` — drop zone + resize client-side

**Modificados na Fase 1:**
- `src/views/QuestoesPage.tsx` — substituir bloco do header atual + inserir `<ObjetivoSection />` entre header e pills + renderizar `<SemanticScopeToggle />` (versão visual) abaixo de `QuestoesSearchBar` quando aba Semântico está ativa
- `src/components/moderacao/ModerationShell.tsx` — adicionar entrada "Objetivos" na sidebar

### Fase 2

**Novos:**
- Migration adicional: `cargos.carreira_id`

**Modificados:**
- `src/contexts/QuestoesContext.tsx` — adicionar leitura de focos ativos + flag `ignorarFocoNaBuscaSemantica`, integrar ao query builder de pills para escopar opções
- `src/hooks/useQuestoesV2.ts` — filtrar base de questões pelos cargos vinculados às carreiras ativas (parâmetro `carreira_ids`); respeitar flag da busca semântica
- `src/hooks/useFocoObjetivo.ts` — adicionar persistência (session ou local)
- `src/components/moderacao/objetivos/ObjetivoDrawer.tsx` — adicionar picker "Cargos vinculados"
- `src/components/moderacao/objetivos/ObjetivoTable.tsx` — coluna "Cargos vinculados (count)"
- `src/components/questoes/objetivo/SemanticScopeToggle.tsx` — implementar lógica real (contagens, ampliação de escopo)

### Não modificados (nas duas fases)

- `src/components/questoes/QuestoesFilterBar.tsx`, `FilterChipsBidirectional.tsx`, `QuestoesResultsHeader.tsx`, `QuestoesSearchBar.tsx`, `QuestoesFilterPopover.tsx`, `QuestoesFilterPill.tsx`, `QuestoesAdvancedPopover.tsx`, `VirtualizedQuestionList.tsx`, componentes de comentário.

## Mockups de referência

- `.superpowers/brainstorm/1258-1776734101/content/carreiras-section-v2.html` — visual final aprovado
- `.superpowers/brainstorm/1258-1776734101/content/foco-card-directions.html` — 3 direções iniciais (histórico)

## Decisões abertas pro plano de implementação

### Fase 1

1. **Ordem do carrossel**: `ordem ASC` manual pelo admin. Alternativas descartadas: alfabética (não capta prioridade), popularidade (ainda não tem dados).
2. **Renderização do header da seção vs `QuestoesFilterOverlay` existente**: o overlay atual cobre a lista de questões quando popovers de pill estão abertos. Verificar se também cobre a seção OBJETIVO ou fica abaixo dela.
3. **Resize de foto**: biblioteca cliente (`browser-image-compression` ou canvas nativo) — escolher no plano.
4. **RLS do bucket `carreira-images`**: leitura pública, escrita só para role admin/moderator. Validar política exata.

### Fase 2 (fora do escopo desta entrega)

- Persistência dos focos ativos (sessionStorage vs localStorage)
- Queries de escopo e indexação (`cargos.carreira_id`, índice parcial, performance)
- Contagem `fora_foco` no toggle semântico (query paralela vs estimativa via cache)
- Regras de matching e edge cases de nomenclatura de cargos
- Regra de auto-limpa de pills incompatíveis na ativação de foco
