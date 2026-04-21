# Objetivo — redesign do topo da página de Questões

**Data:** 2026-04-20
**Autor:** Aldemir + Claude Opus 4.7
**Status:** design aprovado — pronto pra plano de implementação

## Problema

A parte de filtragem da página de questões (`/questoes`) empilha 5 faixas horizontais com estilos inconsistentes (título, tabs de modo, pills, chips, results header, status tabs). Não há um ponto de partida visual claro para o aluno "escolher o que vai estudar hoje".

Concurseiros preparam há meses para um cargo específico. Hoje a experiência trata isso como mais um filtro manual entre outros — o aluno precisa lembrar quais bancas, anos e órgãos fazem sentido para PF-Agente, e configurar tudo à mão sempre que abre a página.

## Objetivo desta spec

Introduzir uma seção **OBJETIVO** no topo da página de questões que permita selecionar um (ou até três) cargos-alvo como delimitadores do universo de busca, e refinar o header existente com tipografia mais elegante. Não mexe em pills, chips, results header, status tabs, sort nem view mode.

## Fora do escopo

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
   - **Favorito**: estrela ★ 11px `#fbbf24` no canto superior esquerdo
   - Click = toggle foco (ativa/desativa)

3. **Seta `›`** como botão separado 32px à direita do carrossel (NÃO sobrepõe cards)
   - Fundo branco, borda 1px `#e2e8f0`, border-radius 10px
   - Hover: `#f8fafc`, borda `#cbd5e1`
   - Scroll behavior: `smooth`, rola ~3 cards

4. Campo **`Filtrar carreiras`** no header filtra o carrossel por nome (case-insensitive, substring match).

### (3) Modelo de foco (comportamento)

- **Até 3 focos simultâneos.** Ao tentar ativar o 4º, o sistema desativa automaticamente o foco mais antigo (FIFO) e ativa o novo. Sem modal/alerta.
- **Favorito**: UMA carreira pode ser marcada como favorita. Ela **inicia ativa** ao abrir a página. Marcação futura via painel admin (nesta spec, o favorito é hardcoded ou nulo — ver Data model).
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
  destaque boolean not null default false, -- aparece primeiro? (reservado)
  favorita boolean not null default false, -- inicia ativa ao abrir
  ativa boolean not null default false,  -- admin decide quando lançar
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_carreiras_area_ordem on carreiras(area, ordem) where ativa = true;
create unique index idx_carreiras_favorita on carreiras(favorita) where favorita = true;
```

### Coluna `carreira_id` em `cargos`

```sql
alter table cargos add column carreira_id uuid references carreiras(id) on delete set null;
create index idx_cargos_carreira on cargos(carreira_id) where carreira_id is not null;
```

- FK opcional: admin vincula N cargos de editais a 1 carreira (muitos-para-um)
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

**Listagem:**
- Tabela paginada de carreiras com colunas: Foto miniatura · Nome · Área · Cargos vinculados (count) · Ativa (toggle) · Destaque (toggle) · Favorita (radio) · Ordem (drag-handle ou input numérico)
- Filtros no topo: por área, por status (ativa/inativa), busca por nome
- Botão `+ Nova carreira`

**Drawer de edição (ModerationDrawer existente):**
- Upload de foto (drop zone com preview)
- Nome, slug (auto-gerado do nome, editável)
- Área (select entre as 9 iniciais — ver "Áreas iniciais" abaixo)
- Ordem (número)
- Toggles: Ativa, Destaque, Favorita
- **Cargos vinculados**: lista de cargos da tabela `cargos` com busca/filtro por edital, multi-select. Admin escolhe quais cargos específicos entram nessa carreira.

**Regra de favorita**: só uma carreira pode ter `favorita=true` (constraint unique partial index). Setar favorita numa limpa a flag da anterior (trigger ou update no client com transação).

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

**Novos:**
- `src/components/questoes/objetivo/ObjetivoSection.tsx` — container
- `src/components/questoes/objetivo/ObjetivoHeader.tsx` — label + limpar + busca
- `src/components/questoes/objetivo/AreaTabs.tsx` — tabs de área
- `src/components/questoes/objetivo/CarreiraCarousel.tsx` — carrossel com seta
- `src/components/questoes/objetivo/CarreiraCard.tsx` — card individual
- `src/hooks/useCarreiras.ts` — fetch + cache de carreiras ativas
- `src/hooks/useFocoObjetivo.ts` — estado dos focos ativos (session-scoped)
- `src/types/carreira.ts` — tipos
- Supabase migration: `carreiras` table + `cargos.carreira_id`
- `src/app/moderacao/objetivos/page.tsx` — nova aba admin
- `src/components/moderacao/objetivos/ObjetivoTable.tsx`
- `src/components/moderacao/objetivos/ObjetivoDrawer.tsx`

**Modificados:**
- `src/views/QuestoesPage.tsx` — substituir bloco do header atual + inserir `<ObjetivoSection />` entre header e pills
- `src/contexts/QuestoesContext.tsx` — adicionar leitura de focos ativos, integrar ao query builder de pills para escopar opções
- `src/hooks/useQuestoesV2.ts` — filtrar base de questões pelos cargos vinculados às carreiras ativas (parâmetro `carreira_ids`)
- `src/components/moderacao/ModerationShell.tsx` — adicionar entrada "Objetivos" na sidebar

**Não modificados:**
- `src/components/questoes/QuestoesFilterBar.tsx`, `FilterChipsBidirectional.tsx`, `QuestoesResultsHeader.tsx`, `QuestoesSearchBar.tsx`, `QuestoesFilterPopover.tsx`, `QuestoesFilterPill.tsx`, `QuestoesAdvancedPopover.tsx`, `VirtualizedQuestionList.tsx`, componentes de comentário.

## Mockups de referência

- `.superpowers/brainstorm/1258-1776734101/content/carreiras-section-v2.html` — visual final aprovado
- `.superpowers/brainstorm/1258-1776734101/content/foco-card-directions.html` — 3 direções iniciais (histórico)

## Decisões abertas pro plano de implementação

1. **Ordem do carrossel**: `ordem ASC` manual pelo admin. Alternativas descartadas: alfabética (não capta prioridade), popularidade (ainda não tem dados).
2. **Favorito default**: NULL até admin definir. Se NULL ao abrir a página, nenhum foco inicia ativo (card TODAS selecionado).
3. **Persistência dos focos ativos**: por sessão via `sessionStorage` (não persiste entre dias; favorita garante continuidade estável). Alternativa: localStorage (mais persistente) — decidir no plano.
4. **Queries de escopo**: o escopo do universo de questões pelos cargos da carreira pode exigir índices dedicados. Validar impacto no plano.
5. **Renderização do header da seção vs `QuestoesFilterOverlay` existente**: o overlay atual cobre a lista de questões quando popovers de pill estão abertos. Verificar se também cobre a seção OBJETIVO ou fica abaixo dela.
