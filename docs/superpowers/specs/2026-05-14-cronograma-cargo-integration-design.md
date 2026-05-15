# Cronograma V2 — Integração com Cargo, Herança de Edital e Distribuição Balanceada

**Data:** 2026-05-14
**Status:** Design aprovado · pendente plano de implementação
**Escopo:** Refatoração ampla do sistema de cronograma para integrar com cargo ativo, herdar tópicos do edital via IA, e distribuir atividades de forma balanceada por semana

---

## 1. Visão geral

O sistema atual de cronograma sofre de 3 problemas estruturais:

1. **Não integra com cargo ativo da navbar.** Usuário tem cargo selecionado globalmente (afeta questões, lei seca, etc.), mas o setup do cronograma pergunta tudo de novo, ignorando contexto.
2. **Não herda tópicos do edital.** Atividades geradas são genéricas ("Direito Constitucional — Parte 3") em vez dos subtópicos reais do edital ("Constituição Federal - Princípios Fundamentais").
3. **Distribuição greedy preenche a primeira semana com tudo.** Algoritmo aloca cada bloco no primeiro dia com capacidade, resultando em 30 items na semana 1 e poucas nas seguintes.

Esta spec descreve a refatoração completa: nova arquitetura, novos algoritmos, integração com sistemas existentes, e plano de migração V1→V2.

---

## 2. Decisões consolidadas

Sintetizadas do brainstorming:

| # | Decisão |
|---|---|
| D1 | **Cargo da navbar é fonte de verdade** do cronograma. Sem cargo ativo, o setup atua como porta de entrada do CargoSelector global. |
| D2 | **Granularidade dupla:** usuário marca disciplinas + nível (INI/INT/AVA); drill-down opcional permite desmarcar subtópicos individuais. |
| D3 | **Sync GraphQL → Supabase no momento de criar plano.** Disciplinas/tópicos do edital são puxados sob demanda; cache compartilhado entre users do mesmo cargo. |
| D4 | **Ritmo híbrido em duas fases:** absorção (1ª metade, mix rotativo de subtópicos novos) → consolidação (2ª metade, revisões FSRS + pendências). |
| D5 | **Distribuição balanceada é requisito não-negociável.** `subtopicos / semanas` por semana, com ±1 row de buffer. Nunca tudo na semana 1. |
| D6 | **Mega-tópicos decompostos por IA (Claude Haiku) no import**, formato `Pai - Filho` (ex: "Licitações - Pregão"). Cache compartilhado por edital. |
| D7 | **Troca de cargo com plano ativo:** modal pergunta antes de arquivar; uma única transação. |
| D8 | **Pendências (não "revisão"):** items não completos na semana viram pendências da semana seguinte com colocação inteligente (FSRS-aware). |
| D9 | **Modelo semanal puro:** items pertencem à semana, não ao dia. Sem agrupamento por dia. Capacidade calculada por semana. |
| D10 | **Mix híbrido:** semana respeita mix global do plano + garante ciclo teoria→questões em gap de 1-2 semanas. |
| D11 | **Nível de conhecimento ajusta 3 dimensões:** multiplicador de tempo (INI ×1.5, AVA ×0.7) + mix interno por disciplina (INI mais teoria, AVA mais questões) + drill-down opcional pra pular. |
| D12 | **Pontos fracos:** até 3 disciplinas marcadas, recebem +30% peso adicional. |
| D13 | **Simulados periódicos:** opcional (mensal/quinzenal/semanal); blocos de 3-4h em fim de semana. |
| D14 | **Redação/discursiva:** opcional; reserva ~1h/semana. |
| D15 | **Antecipação permitida pra teoria nova, proibida pra revisões FSRS.** Anti-burnout: limite de 1.5× carga média (ou P75 do behavioral quando disponível). |
| D16 | **Engine de predição:** `coverage_pct` máximo 100%; tempo extra vira sugestões (revisão de pontos fracos, simulados, folga). |
| D17 | **Drawer fica intacto.** Página `/cronograma` recebe ajuste mínimo (remover agrupamento por dia). Setup é o foco do redesign. |

---

## 3. Arquitetura — 8 camadas

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. UI (React Client)                                              │
│    CronogramaSetupPage · CronogramaPage · CronogramaSheet         │
│    CargoSelector global (já existe)                               │
├──────────────────────────────────────────────────────────────────┤
│ 2. Orquestração (Next.js API + Edge Functions)                   │
│    SyncEditalService · TopicoDecomposer · PlanoBuilder            │
│    EventDispatcher · PredictionEngine                             │
├──────────────────────────────────────────────────────────────────┤
│ 3. Alocação determinística (PL/pgSQL)                            │
│    gerar_cronograma_v2 · recalibrar_plano                         │
│    computar_pendencias · criar_plano_completo                     │
├──────────────────────────────────────────────────────────────────┤
│ 4. Event loop (Realtime + Triggers)                               │
│    Tabela plan_events append-only                                 │
│    Handlers PL/pgSQL (imediatos) + TS (assíncronos)               │
├──────────────────────────────────────────────────────────────────┤
│ 5. Background jobs                                                │
│    pg_cron (DB-side) · Vercel cron (I/O externo)                  │
├──────────────────────────────────────────────────────────────────┤
│ 6. Cache & observability                                          │
│    edital_cache · graphql_cache · materialized views              │
│    plan_decisions · dead_letters · métricas                       │
├──────────────────────────────────────────────────────────────────┤
│ 7. Sinais comportamentais                                         │
│    behavioral_signals (opt-in LGPD) · level_drift detection       │
├──────────────────────────────────────────────────────────────────┤
│ 8. Dados (Supabase Postgres)                                      │
│    Schema V2 (aditivo sobre V1)                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Princípios arquiteturais:**

- **Event-driven primeiro, cron como rede de segurança.** Recalibração imediata via event quando user completa semana antecipadamente; cron domingo só cobre o que escapou.
- **Cada camada faz o que faz bem.** PL/pgSQL para alocação atômica determinística; TypeScript para I/O externo (GraphQL, IA); React para UI/UX.
- **Idempotência em todos os handlers.** Eventos podem ser reprocessados sem efeito colateral.
- **Audit trail completo.** `plan_decisions` registra cada decisão do algoritmo com razão e inputs.

---

## 4. Modelo de dados

### 4.1 Novas tabelas

#### `plan_decisions` (audit trail do algoritmo)

```sql
CREATE TABLE plan_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID NOT NULL REFERENCES planos_estudo(id) ON DELETE CASCADE,
  week_number INTEGER,
  action TEXT NOT NULL,             -- 'initial_distribution' | 'recalibration' | 'fsrs_revision_created' | 'pendencia_placement'
  reason TEXT NOT NULL,             -- 'absorption_phase' | 'week_completed_early' | 'fsrs_optimal'
  inputs_hash TEXT,
  output_summary JSONB NOT NULL,
  algorithm_variant TEXT DEFAULT 'v2_default',
  triggered_by TEXT,                -- 'rpc_initial' | 'event_completed' | 'cron_weekly'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE INDEX ix_plan_decisions_plano_week ON plan_decisions(plano_id, week_number);
CREATE INDEX ix_plan_decisions_action_time ON plan_decisions(action, created_at DESC);
```

#### `behavioral_signals` (coleta passiva, opt-in LGPD)

```sql
CREATE TABLE behavioral_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plano_id UUID REFERENCES planos_estudo(id) ON DELETE SET NULL,
  schedule_item_id UUID REFERENCES schedule_items(id) ON DELETE SET NULL,
  signal_type TEXT NOT NULL,        -- 'session_start' | 'session_end' | 'completion' | 'skip' | 'level_drift'
  value JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(plano_id, schedule_item_id, signal_type, (occurred_at::date))
) PARTITION BY RANGE (occurred_at);

CREATE INDEX ix_behavioral_signals_user_type_time
  ON behavioral_signals(user_id, signal_type, occurred_at DESC);
```

#### `edital_cache` (compartilhado entre users do mesmo cargo)

```sql
CREATE TABLE edital_cache (
  cargo_id INTEGER NOT NULL,
  edital_id INTEGER NOT NULL,
  payload_hash TEXT NOT NULL,        -- hash composto: disciplina_ids + topico_ids + nomes
  decomposicao JSONB NOT NULL,
  ai_model TEXT NOT NULL,            -- 'claude-haiku-4.5'
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cargo_id, edital_id)
);
```

#### `plano_predictions_history` (append-only) + view `plano_predictions`

```sql
CREATE TABLE plano_predictions_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID NOT NULL REFERENCES planos_estudo(id) ON DELETE CASCADE,
  coverage_pct NUMERIC(5,2) NOT NULL CHECK (coverage_pct <= 100),
  slack_weeks NUMERIC(4,1),
  pace_index NUMERIC(4,2),
  weakest_disciplinas JSONB,
  recommendations JSONB,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_predictions_plano_time ON plano_predictions_history(plano_id, computed_at DESC);

CREATE VIEW plano_predictions AS
SELECT DISTINCT ON (plano_id) * FROM plano_predictions_history
ORDER BY plano_id, computed_at DESC;
```

#### `plan_events` (event bus, append-only)

```sql
CREATE TABLE plan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID REFERENCES planos_estudo(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,          -- 'item.completed' | 'week.completed' | etc.
  sequence_number BIGSERIAL,         -- ordering garantido
  payload JSONB NOT NULL,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  dead_letter BOOLEAN NOT NULL DEFAULT FALSE
) PARTITION BY RANGE (fired_at);

CREATE INDEX ix_plan_events_plano_fired ON plan_events(plano_id, fired_at DESC);
CREATE INDEX ix_plan_events_unprocessed ON plan_events(fired_at)
  WHERE processed_at IS NULL AND dead_letter = FALSE;
```

#### `dead_letters` (eventos não processados após 3 tentativas)

```sql
CREATE TABLE dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_event_id UUID,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT NOT NULL,
  attempts INT NOT NULL,
  first_failed_at TIMESTAMPTZ NOT NULL,
  last_failed_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT
);
```

#### `plano_config_history` (versionamento de config)

```sql
CREATE TABLE plano_config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID NOT NULL REFERENCES planos_estudo(id) ON DELETE CASCADE,
  version INT NOT NULL,
  snapshot JSONB NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(plano_id, version)
);
```

#### `feriados_nacionais` (compartilhado público)

```sql
CREATE TABLE feriados_nacionais (
  data DATE PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('nacional', 'estadual', 'municipal')),
  uf CHAR(2),
  cidade TEXT
);
-- Seed inicial via gov.br API + Carnaval/Páscoa móveis recalculados anualmente
```

#### `plan_templates` (templates oficiais + comunidade)

```sql
CREATE TABLE plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_id INT NOT NULL,
  nome TEXT NOT NULL,
  duracao_dias INT NOT NULL,
  config JSONB NOT NULL,            -- snapshot completo de plano_config + plano_disciplinas
  uses_count INT DEFAULT 0,
  success_rate NUMERIC(5,2),
  created_by UUID REFERENCES auth.users(id),
  visibility TEXT CHECK (visibility IN ('publico', 'privado', 'oficial')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ix_plan_templates_cargo_visibility ON plan_templates(cargo_id, visibility);
```

#### Auxiliares

```sql
-- graphql_cache: KV simples com TTL
CREATE TABLE graphql_cache (
  cache_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

-- analytics_events: funil UX
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,         -- 'wizard_step_started' | 'plan_created_success' | etc.
  properties JSONB DEFAULT '{}',
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

-- rate_limit_buckets: throttling
CREATE TABLE rate_limit_buckets (
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  count INT NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, action, window_start)
);

-- feature_flags: rollout controlado
CREATE TABLE feature_flags (
  flag_name TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_pct INT DEFAULT 0,
  user_allowlist UUID[] DEFAULT '{}',
  user_blocklist UUID[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ai_quality_feedback: feedback loop
CREATE TABLE ai_quality_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subtopico_id UUID REFERENCES subtopicos(id) ON DELETE CASCADE,
  rating SMALLINT CHECK (rating IN (-1, 1)),  -- -1 ruim, 1 bom
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Novas colunas em tabelas existentes

```sql
-- planos_estudo
ALTER TABLE planos_estudo
  ADD COLUMN cargo_snapshot JSONB,                  -- snapshot do cargo no momento da criação
  ADD COLUMN template_id UUID REFERENCES plan_templates(id) ON DELETE SET NULL,
  ADD COLUMN algorithm_variant TEXT DEFAULT 'v2_default',
  ADD COLUMN deleted_at TIMESTAMPTZ;                -- soft delete

-- plano_config
ALTER TABLE plano_config
  ADD COLUMN simulados_freq TEXT
    CHECK (simulados_freq IN ('nenhum', 'mensal', 'quinzenal', 'semanal'))
    DEFAULT 'mensal',
  ADD COLUMN tem_redacao BOOLEAN DEFAULT FALSE,
  ADD COLUMN tipo_material TEXT
    CHECK (tipo_material IN ('video', 'pdf', 'livro', 'questoes', 'misto'))
    DEFAULT 'misto',
  ADD COLUMN horario_preferido TEXT
    CHECK (horario_preferido IN ('manha', 'tarde', 'noite', 'madrugada', 'flexivel'))
    DEFAULT 'flexivel';

-- plano_disciplinas
ALTER TABLE plano_disciplinas
  ADD COLUMN nivel_conhecimento TEXT
    CHECK (nivel_conhecimento IN ('iniciante', 'intermediario', 'avancado'))
    NOT NULL DEFAULT 'intermediario',
  ADD COLUMN is_ponto_fraco BOOLEAN DEFAULT FALSE,
  ADD COLUMN excluded_subtopico_ids UUID[] DEFAULT '{}';

-- schedule_items
ALTER TABLE schedule_items
  ADD COLUMN is_anticipated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN fsrs_due_date DATE,
  ADD COLUMN parent_item_id UUID REFERENCES schedule_items(id) ON DELETE SET NULL,
  ADD COLUMN unlocked_early BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN version INT NOT NULL DEFAULT 1;  -- optimistic locking

-- topicos
ALTER TABLE topicos
  ADD COLUMN referencias_legais JSONB,
  ADD COLUMN ai_decomposed_at TIMESTAMPTZ,
  ADD COLUMN nome_curto TEXT;

-- auth.users.app_metadata (managed pelo Supabase Auth)
-- adicionar via update da app_metadata:
--   { signals_consent: bool, timezone: string, locale: string }

-- weekly_stats
ALTER TABLE weekly_stats
  ADD COLUMN unlocked_early BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN overflow BOOLEAN NOT NULL DEFAULT FALSE;
```

### 4.3 Triggers

| Trigger | Tabela | Quando | O que faz |
|---|---|---|---|
| `trg_publish_completion_event` | schedule_items | AFTER UPDATE OF status WHEN status='concluido' | Publica `item.completed` em `plan_events` |
| `trg_recalibrate_on_week_done` | weekly_stats | AFTER UPDATE WHEN completion_pct ≥ 100 | Publica `week.completed` |
| `trg_collect_behavioral_signal` | schedule_items | AFTER UPDATE | Insere em `behavioral_signals` (se consent=true) |
| `trg_invalidate_graphql_cache` | graphql_cache | Cron a cada 1h | DELETE expirados |
| `trg_compute_week_number` | schedule_items | BEFORE INSERT | Calcula `week_number` a partir de `scheduled_date` |
| `trg_update_plano_predictions` | weekly_stats | AFTER UPDATE | Insere row em `plano_predictions_history` |

### 4.4 RLS resumo

| Tabela | Política |
|---|---|
| `plan_decisions` | SELECT/INSERT via plano do user |
| `behavioral_signals` | SELECT/INSERT só do próprio user |
| `edital_cache` | SELECT público (authenticated); INSERT/UPDATE service role only |
| `plano_predictions_history` | SELECT via plano do user |
| `plan_events` | SELECT via plano do user; INSERT via trigger/service |
| `dead_letters` | Admin only |
| `feriados_nacionais` | SELECT público |
| `plan_templates` | SELECT visibility='publico' OR created_by=auth.uid() |
| `analytics_events` | INSERT do próprio user; SELECT admin |
| `feature_flags` | SELECT public; UPDATE admin |

---

## 5. Sync de edital + decomposição IA

### 5.1 Fluxo

1. **Trigger:** user chega no step 4 do wizard (disciplinas)
2. **Cache lookup:** `edital_cache` por `(cargo_id, edital_id)`
3. **Hash check:** se cache existe, compara `payload_hash` com hash atual do GraphQL
4. **Hit:** retorna `decomposicao` imediatamente (<100ms)
5. **Miss:**
   - Fetch GraphQL (`useEditais` client urql)
   - Calcular `payload_hash` composto
   - Para cada tópico longo (>200 chars OU >3 conceitos): chama Claude Haiku
   - IA retorna JSON estruturado (validado via Zod)
   - Fallback se IA falha: usa tópico inteiro como subtópico único
   - Salva em `edital_cache`
6. **Upsert per-user:** disciplinas → tópicos → subtópicos do edital criados na base do user (idempotente via `origin_disciplina_ref` / `origin_topico_ref`)

### 5.2 Prompt da IA (Claude Haiku)

```
Você é um especialista em editais de concurso. Dado o texto bruto de um
tópico do edital, decomponha em:

1. nome_curto: nome resumido (3-6 palavras)
2. conceitos_pai: até 3 grupos conceituais
3. subtopicos: lista com formato "<Conceito-pai> - <Subtópico>"
4. referencias_legais: leis/decretos extraídas
5. duracao_estimada_minutos: 25-75 por subtópico

Retorne JSON estrito, validado pelo schema:
{
  "nome_curto": string,
  "conceitos_pai": string[],
  "subtopicos": [
    { "nome": string, "duracao_min": number, "conceito_pai": string }
  ],
  "referencias_legais": string[]
}

TEXTO: <<<{topico_texto}>>>
```

### 5.3 Hash composto

```typescript
const hash = MD5(
  disciplinas.map(d => `${d.id}:${d.nome}`).sort().join('|') +
  '||' +
  topicos.map(t => `${t.id}:${t.disciplina_id}:${t.nome.slice(0, 50)}`).sort().join('|')
);
```

### 5.4 Custos e performance

| Cenário | Tempo | Custo IA |
|---|---|---|
| Cache hit | <100ms | $0 |
| Cache miss + IA (150 tópicos paralelos) | 8-15s | ~$0.15 |
| Edital popular (warmed) | <100ms | $0 (custo amortizado) |

`sync_edital_warmer` (Vercel cron diário) pré-popula top 10 cargos.

### 5.5 Rate limiting de IA

- Queue interna com `p-limit(3)`: max 3 chamadas Claude paralelas
- `daily_ai_spend_cents` em `app_settings`: hard cap diário
- Após cap: fallback regex (sem IA) + warning visível no UI

---

## 6. Algoritmo de distribuição (`gerar_cronograma_v2`)

### 6.1 Assinatura

```sql
CREATE FUNCTION gerar_cronograma_v2(p_plano_uuid UUID)
RETURNS JSONB
SECURITY INVOKER
LANGUAGE plpgsql AS $$ ... $$;
```

### 6.2 Passos

1. **Carrega contexto** (plano + config + disciplinas + subtopicos via TEMP tables)
2. **Ajusta por nível** — multiplicador de duração (INI ×1.5, INT ×1.0, AVA ×0.7)
3. **Aplica pontos fracos** — +30% nas disciplinas marcadas
4. **Gera blocks lógicos** — 1 teoria + 1 questões por subtópico, mix interno por disciplina
5. **Distribuição balanceada por semana:**
   - Calcula `total_semanas = ceil((data_prova - data_inicio) / 7)` (mínimo 2; abaixo dispara EXCEPTION)
   - Fase 1: semanas 1 a `floor(total_semanas / 2)` — absorção
   - Fase 2: restante — consolidação
   - Para cada semana, buffer de questões pendentes drenado primeiro
   - Round-robin por disciplina dentro da semana
6. **Garante ciclo teoria→questões em gap 1-2 semanas**
7. **Aloca simulados periódicos** (se config.simulados_freq != 'nenhum')
8. **Aloca redação** (se config.tem_redacao)
9. **Respeita feriados** (consulta `feriados_nacionais` pra reduzir capacidade)
10. **Bulk insert em `schedule_items`** + atualiza `weekly_stats`
11. **Loga em `plan_decisions`**

### 6.3 Garantias

- Soma `subtopicos / total_semanas` ± 1 row por semana
- Toda teoria tem questões agendadas em ≤2 semanas
- Mix global respeitado dentro de tolerância ±5%
- Operação atomica (transação implícita PL/pgSQL)
- Performance: <500ms P95 para 200 subtópicos × 24 semanas

### 6.4 Edge cases

| Cenário | Comportamento |
|---|---|
| `total_semanas < 2` | RAISE EXCEPTION 'Plano deve ter pelo menos 2 semanas' |
| Capacidade < menor bloco | RAISE EXCEPTION (já rejeitado no setup) |
| Total necessário > capacidade | Gera com `weekly_stats.overflow=TRUE` nas semanas apertadas. Predição mostra `coverage < 100`. |
| Disciplina sem subtópicos após sync | Warning + skip (não bloqueia geração) |
| FSRS revisões caem após data_prova | Não geradas. Warning. |

---

## 7. Setup flow

### 7.1 Estados de entrada

```
Tem plano ativo? → SIM → Modal: arquivar/editar/cancelar
                 → NÃO → continua

Tem rascunho recente? → SIM → "Continuar de onde parou?"
                      → NÃO → wizard limpo step 0
```

### 7.2 Steps do wizard

| # | Step | Conteúdo |
|---|---|---|
| 0 | Cargo | Reuso de `CargoSelectorContent` (pula se cargo ativo) |
| 1 | Tempo | Data prova + aviso de feriados + horário preferido |
| 2 | Ritmo | Horas/dia útil + horas/FdS + tipo material |
| 3 | Estilo | Templates da comunidade OU custom (sliders mix) |
| 4 | Foco | Disciplinas + nível + pontos fracos (≤3) + drill-down opcional |
| 5 | Extras | Simulados (freq) + redação (sim/não) |
| 6 | Conferência | Resumo + preview do 1º dia + viability ring + "Está certo?" |
| 7 | Criação | Loading narrativo com Papiro → navega pra /cronograma |

### 7.3 Sugestões IA durante wizard

- Após step 1: *"60 dias com seu cargo geralmente requer 4h/dia útil. Quer usar?"*
- Após step 4: *"Você marcou 9 disciplinas. Estatísticas mostram que quem cobre todas em 60d falha em 45%. Sugiro descartar [X, Y]."*
- Após step 6: *"Português é a disciplina com mais peso (15 questões). Considere marcar como ponto fraco."*

### 7.4 Orquestrador (endpoint TS)

`POST /api/cronograma/criar-plano`:
1. Valida input (Zod)
2. Verifica feature flag `cronograma_v2_enabled` por user
3. Verifica rate limit (max 5 planos/dia)
4. Sync edital (cache hit ou força refresh)
5. RPC `criar_plano_completo` (atômico, tipado)
6. RPC `compute_prediction`
7. Retorna `{ plano_id, items_created, warnings }`
8. UI navega pra `/cronograma`

### 7.5 RPC `criar_plano_completo`

```sql
CREATE FUNCTION criar_plano_completo(
  p_user_id UUID,
  p_cargo_id INT,
  p_cargo_snapshot JSONB,
  p_data_inicio DATE,
  p_data_prova DATE,
  p_weekday_minutes INT,
  p_weekend_minutes INT,
  p_block_duration_minutes INT,
  p_mix_ratio JSONB,
  p_simulados_freq TEXT,
  p_tem_redacao BOOLEAN,
  p_tipo_material TEXT,
  p_horario_preferido TEXT,
  p_disciplinas JSONB,    -- [{disciplina_id, nivel, is_ponto_fraco, excluded_subtopico_ids[]}]
  p_template_id UUID DEFAULT NULL
) RETURNS JSONB
SECURITY INVOKER LANGUAGE plpgsql AS $$ ... $$;
```

Função única, atômica, tipada (não JSONB blob). Validações no início; cada parâmetro com check defensivo.

### 7.6 Drafts persistidos

- Toda mudança no wizard `debounced 1s` → `INSERT INTO planos_estudo (status='rascunho', ...) ON CONFLICT UPDATE`
- Cron `cleanup_old_drafts` (diário) deleta drafts com `updated_at < NOW() - 7 days`
- Multi-device: começa no celular, termina no PC

### 7.7 A11y + Mobile

- Tab/Enter navegáveis; `aria-current` no progress; `aria-live` no painel direito
- Contraste WCAG AA verificado
- `prefers-reduced-motion` respeitado
- Mobile (<768px): bottom sheet layout; hero menor; preview em chip flutuante

---

## 8. Event loop + handlers reativos

### 8.1 Pipeline

```
Origem (trigger SQL / cron / TS)
  → INSERT em plan_events (append-only)
  → pg_notify('plan_event', id)
  → Supabase Realtime channel
  → Handlers PL/pgSQL (imediatos) + TS (assíncronos via Edge Functions)
  → Marca processed_at; em erro: retry com backoff exponencial até 3×
  → Após 3 falhas: dead_letter=TRUE + INSERT em dead_letters
```

### 8.2 Eventos canônicos

| Evento | Trigger | Handler principal |
|---|---|---|
| `item.completed` | UPDATE schedule_items.status='concluido' | Cria revisão FSRS + atualiza weekly_stats + behavioral_signal |
| `item.skipped` | UPDATE status='pulado' | Marca como skipped + behavioral_signal |
| `week.completed` | UPDATE weekly_stats.completion_pct≥100 | Destrava próxima semana + recalibra |
| `week.behind` | Cron detecta <60% na quarta | UI badge + predição recalculada |
| `pendencia.created` | Virada de semana | Colocação inteligente FSRS-aware |
| `level_drift.detected` | Aggregator semanal | Sugestão UI: reclassificar disciplina |
| `template.copied` | Plano usa template_id | Incrementa uses_count |

### 8.3 Ordering garantido

`plan_events.sequence_number BIGSERIAL`: UI processa em ordem; eventos fora de ordem bufferizados até receber anterior (timeout 500ms).

### 8.4 Idempotência

- `behavioral_signals` tem `UNIQUE(plano_id, schedule_item_id, signal_type, occurred_at::date)` + `ON CONFLICT DO NOTHING`
- `schedule_items` revisões: check `WHERE parent_item_id = $1 AND type = 'revisao'` antes de criar
- `plan_decisions` filtra por `inputs_hash`

### 8.5 FSRS reativo

Implementação inicial SM-2 simplificado, mas estrutura `fsrs_state JSONB` no formato FSRS-5 completo (migração futura sem refactor):

```
rating 'easy' → next_interval +14d
rating 'good' → next_interval +7d
rating 'hard' → next_interval +2d
rating 'again' → next_interval +1d
```

`fsrs_due_date` calculada e item criado na semana correspondente. Revisões **não movem** em recalibração — respeitam timing científico.

### 8.6 Recalibração (`recalibrar_plano`)

Disparada por:
- Evento `week.completed` (imediato)
- Cron domingo (rede de segurança)
- Botão "Recalibrar" manual no admin

Comportamento:
1. Não move items completados (history is sacred)
2. Não move revisões FSRS (timing fixo)
3. Move pendências pra slots disponíveis
4. Antecipação respeita limite anti-burnout (1.5× ou P75 do behavioral)
5. Atualiza `plano_predictions_history`
6. Loga em `plan_decisions`

### 8.7 Onde rodam os handlers

- **PL/pgSQL triggers** (immediate, dentro da transação): completion → revisão FSRS, weekly_stats update
- **Supabase Edge Functions** (reactive, Realtime listener): handlers assíncronos não-críticos
- **Vercel Cron** (scheduled): jobs com I/O externo, recalibração semanal

### 8.8 Optimistic UI

Frontend atualiza otimisticamente; Realtime confirma; em erro, reverte com toast.

---

## 9. Cron jobs + cache + observabilidade

### 9.1 Jobs

**pg_cron (DB-side):**

| Job | Frequência | Função |
|---|---|---|
| `cleanup_old_drafts` | Diário 03:00 | DELETE rascunhos >7d |
| `behavioral_signals_aggregator` | A cada 6h | REFRESH `behavioral_summary_mv` |
| `revisoes_pendentes_refresh` | A cada 1h | REFRESH `revisoes_pendentes_mv` |
| `detect_week_behind` | Diário 23:00 (UTC + user offset) | INSERT event `week.behind` |
| `template_stats_aggregator` | Domingo 04:00 | Recalcula uses_count/success_rate |
| `partition_maintainer` | 1º do mês 02:00 | Cria/dropa partições mensais |
| `cleanup_dead_letters` | Domingo 05:00 | DELETE dead_letters resolvidos >1 ano |
| `refresh_feriados` | 1º do ano | Atualiza feriados móveis |
| `cleanup_graphql_cache` | A cada 1h | DELETE expirados |

**Vercel Cron (I/O externo):**

| Job | Frequência | Função |
|---|---|---|
| `sync_edital_warmer` | Diário 02:00 | Pré-popula top 10 cargos no edital_cache |
| `recalibrate_unfinished_plans` | Diário 04:00 | Safety net pra planos sem evento >3d |
| `compute_predictions_weekly` | Domingo 06:00 | Roda engine de predição |
| `level_drift_aggregator` | Domingo 07:00 | Detecta drifts |

**Concorrência:** `pg_try_advisory_lock` por nome de job — só um lock-holder ativo por vez.

### 9.2 Cache (3 camadas)

| Cache | Tipo | TTL | Tamanho |
|---|---|---|---|
| `edital_cache` | Postgres compartilhado | Infinito até hash mudar (re-valida a cada 30d) | ~50KB/cargo |
| `graphql_cache` | Postgres KV | 6h queries diversas / 24h queries de edital | variável |
| Materialized views | Postgres MV | Conforme tabela 9.1 | variável |

### 9.3 Observabilidade

- **`plan_decisions`** — audit completo do algoritmo
- **`dead_letters`** — eventos não processados, dashboard admin
- **`analytics_events`** — funil UX (wizard step started/completed/abandoned)
- **`/api/metrics`** — endpoint Prometheus-style (Bearer admin)
- **`/api/cronograma/health`** — health check público
- **Admin dashboard `/admin/cronograma`** — visão operacional consolidada
- **Sentry** — erros inesperados (severity ≥ ERROR)

### 9.4 "Por que isso aconteceu?" (UI)

Dicionário de `reason_codes` → templates em PT:

```typescript
const REASON_TEMPLATES = {
  'absorption_phase': 'Caiu na 1ª metade (fase de absorção)',
  'consolidation_phase': 'Caiu na 2ª metade (consolidação + revisões)',
  'fsrs_optimal': 'Revisão agendada pelo FSRS com base no desempenho',
  'round_robin_disciplina': 'Round-robin pra balancear semana',
  'ponto_fraco_boost': 'Mais peso por ser ponto fraco declarado',
  // ...
};
```

Botão "Por que isso aconteceu?" em items abre modal com explicação.

### 9.5 Performance budget (CI falha se regredir)

| Operação | P50 | P95 | P99 |
|---|---|---|---|
| `criar_plano_completo` (cache hit) | <300ms | <800ms | <2s |
| `criar_plano_completo` (miss + IA) | <8s | <15s | <25s |
| `gerar_cronograma_v2` | <200ms | <500ms | <1.5s |
| `recalibrar_plano` | <150ms | <400ms | <1s |
| Sync edital (hit) | <50ms | <100ms | <200ms |
| Drawer load | <80ms | <200ms | <500ms |

### 9.6 LGPD/Privacy

- Opt-in explícito no primeiro login: *"Posso aprender com seus padrões? [Permitir] [Apenas o básico]"*
- `auth.users.app_metadata.signals_consent = true|false`
- Se opt-out: `behavioral_signals` não coletado, level_drift desabilitado
- Tabela `data_export_requests` (LGPD compliance) — fora do escopo desta spec mas anotada

### 9.7 Timezone awareness

- `auth.users.app_metadata.timezone` setado no signup (auto-detect)
- Crons calculam boundaries em UTC + offset por user, não em wall-clock servidor

### 9.8 Rate limiting

| Camada | Limite |
|---|---|
| Por user (criar plano) | 5/dia |
| Por IP (não autenticado) | 100 req/min |
| Por IA (global) | `daily_ai_spend_cents` cap |

### 9.9 Feature flags

`feature_flags` tabela + função `is_feature_enabled(flag, user_id)`. Rollout V2: 5% → 25% → 50% → 100% ao longo de 3 semanas.

### 9.10 Disaster Recovery

- **RPO:** 24h (Supabase PITR cobre ≤1h)
- **RTO:** 4h
- Backup mensal pra S3 das tabelas críticas (`plan_templates`, `edital_cache`, `plan_decisions`)
- DR drill trimestral em staging

---

## 10. Testing strategy + migração V1→V2

### 10.1 Testing — 4 camadas

| Camada | Tool | Foco | Coverage |
|---|---|---|---|
| Unit | Vitest | Funções puras, services TS | ≥80% / 100% em algoritmos |
| Integration | Vitest + Supabase local | RPCs, triggers, transações | Cenários críticos |
| E2E | Playwright | Fluxos completos do user | Happy + 5 edge cases |
| Load | k6 | Comportamento sob carga | Manual antes de releases |

**Golden test cases** (regressão de algoritmo):
- 60d / 4 disciplinas / INT / equilibrado → 96 items, 2 disc/semana
- AVA → 30% menos tempo
- Ponto fraco → +30% blocos
- FSRS easy → revisão +14d

**a11y** validado em CI via `axe-core` no Playwright.

**Synthetic monitoring**: cron horário cria + valida + deleta plano sintético. Falha → alerta crítico.

**Chaos drills mensais**: GraphQL down / Claude throttled / Supabase outage → validar fallbacks.

### 10.2 Test fixtures realistas

Versionados em `tests/fixtures/`:
- 5 editais reais com payloads autênticos
- 50 tópicos variados (incluindo mega-tópicos)
- Outputs de decomposição IA salvos
- User profiles: INI ansioso, AVA confiante, INT padrão

### 10.3 Migração V1 → V2 (60 dias)

**Fase 1 — Coexistência (semanas 1-2):**
- Deploy V2 alongside V1
- Feature flag `cronograma_v2_enabled` default false
- Habilita pra time interno (allowlist)
- V1 permanece operacional

**Fase 2 — Rollout gradual (semanas 3-5):**
- Dia 1: 5% → Dia 7: 25% → Dia 14: 50% → Dia 21: 100% novos planos
- Planos V1 continuam read-only
- Critérios de pausa: dead letters >1%, RPC p95 >2s, abandonment >60%

**Fase 3 — Opt-in migrate (semanas 5-8):**
- Botão "Atualizar plano" em planos V1
- `validate_migration(old, new)` verifica integridade
- Rollback automático se discrepância

**Fase 4 — Forced migration (dia 60+):**
- Banner persistente por 14d
- V1 retorna `DEPRECATED` após 14d
- DROP V1 após mais 14d

**Migrations aditivas:** novas colunas/tabelas, nada destrutivo durante rollout. `up.sql` + `down.sql` separados pra cada migração. Testadas em snapshot de prod antes de cada release.

### 10.4 Critérios pra produção

| Item | Status mínimo |
|---|---|
| Unit tests | ≥80% coverage |
| Integration tests | Cenários críticos passando |
| E2E | Happy path + 5 edge cases |
| Load | 100 concurrent users sem dead letter |
| Golden tests | Algoritmo bate expected |
| Security review | RLS validado + pentest |
| LGPD review | Opt-in signals funcionando |
| A11y | WCAG AA + axe-core CI green |
| Docs | API + runbook |
| Monitoring | Dashboards + alertas |
| DR | Drill recente passou |

---

## 11. Apêndices

### A. Mapeamento de payload `criar_plano_completo`

```typescript
{
  p_user_id: "uuid",
  p_cargo_id: 42,
  p_cargo_snapshot: {
    nome: "Polícia Federal · Agente",
    edital_id: 17,
    qtd_disciplinas: 10
  },
  p_data_inicio: "2026-05-14",
  p_data_prova: "2026-08-12",
  p_weekday_minutes: 180,
  p_weekend_minutes: 240,
  p_block_duration_minutes: 50,
  p_mix_ratio: { teoria: 0.40, questoes: 0.40, revisao: 0.15, flashcards: 0.05 },
  p_simulados_freq: "quinzenal",
  p_tem_redacao: false,
  p_tipo_material: "misto",
  p_horario_preferido: "manha",
  p_disciplinas: [
    {
      disciplina_id: "uuid",
      nivel_conhecimento: "intermediario",
      is_ponto_fraco: false,
      excluded_subtopico_ids: []
    },
    // ...
  ],
  p_template_id: null
}
```

### B. Exemplo de output da IA (decomposição de tópico)

```json
{
  "nome_curto": "Licitações e Contratos",
  "conceitos_pai": ["Licitações", "Contratos administrativos", "Convênios"],
  "subtopicos": [
    { "nome": "Licitações - Conceito e modalidades", "duracao_min": 45, "conceito_pai": "Licitações" },
    { "nome": "Licitações - Pregão", "duracao_min": 50, "conceito_pai": "Licitações" },
    { "nome": "Contratos administrativos - Conceito e regime", "duracao_min": 45, "conceito_pai": "Contratos administrativos" }
  ],
  "referencias_legais": ["Lei 8.666/93", "Lei 14.133/21", "Decreto 10.024/19"]
}
```

### C. Reason codes (UI explainer)

| Code | Label PT |
|---|---|
| `absorption_phase` | Fase de absorção de conteúdo novo |
| `consolidation_phase` | Fase de consolidação + revisões |
| `fsrs_optimal` | Timing FSRS calculado pelo desempenho |
| `round_robin_disciplina` | Round-robin entre disciplinas |
| `ponto_fraco_boost` | Mais peso por ponto fraco declarado |
| `nivel_iniciante_multiplier` | Tempo ampliado por nível iniciante |
| `nivel_avancado_multiplier` | Tempo reduzido por nível avançado |
| `pendencia_carryover` | Reagendado de semana anterior |
| `simulado_periodic` | Simulado periódico configurado |
| `redacao_weekly` | Bloco de redação semanal |
| `feriado_skip` | Pulado por feriado nacional |
| `week_completed_early` | Recalibrado por término antecipado |
| `week_behind` | Detectado atraso na semana |

### D. Glossário

- **Subtópico**: unidade de conteúdo do edital, formato "Pai - Filho" (ex: "Licitações - Pregão")
- **Bloco**: unidade de tempo agendada, geralmente teoria ou questões de um subtópico
- **Fase de absorção**: primeira metade do plano, conteúdo novo predomina
- **Fase de consolidação**: segunda metade, revisões e pendências priorizadas
- **Pendência**: item não completado na semana, reagendado pra próxima
- **Ponto fraco**: disciplina marcada com prioridade extra (até 3 por plano)
- **Nível de conhecimento**: declaração do user por disciplina (INI/INT/AVA), ajusta multiplicadores
- **FSRS**: Free Spaced Repetition Scheduler, algoritmo de revisão espaçada
- **Decomposição IA**: quebra de tópico longo em subtópicos via Claude Haiku

---

## 12. Produto e evolução

### 12.1 Roadmap pós-lançamento

V2 é a fundação. Sistema legendário tem trajetória clara de evolução. Cada release vem de hipótese validada (não chute).

**V2.1 — FSRS-5 completo** (Q3 2026)
- Migrar do SM-2 simplificado pro FSRS-5 real
- Parâmetros adaptativos por usuário (stability, difficulty)
- Otimização baseada em behavioral signals coletados
- Schema já preparado: `schedule_items.fsrs_state` está no formato FSRS-5

**V2.2 — A/B testing real** (Q3 2026)
- Variantes de algoritmo (`v2_default`, `v2_serial`, `v2_aggressive_revision`)
- Atribuição randomizada por user
- Métricas: completion rate por variante, retention 30d
- Promove ganhador estatisticamente significativo (≥5% improvement, p<0.05)

**V2.3 — Multi-país** (Q4 2026)
- i18n estrutural ativado (PT-BR, ES, EN)
- Feriados por país (`feriados.country_code`)
- Currency-aware
- Templates regionalizados

**V3.0 — Modo colaborativo** (Q4 2026)
- Grupos de estudo com plano compartilhado
- Ranking visível dentro do grupo
- Mentor pode acompanhar progresso de mentorado
- Chat opcional por disciplina

**V3.1 — Tutor IA durante atividades** (Q1 2027)
- Claude como tutor inline: tirar dúvidas em tempo real durante teoria
- Sugestões de simulados baseadas em fraquezas detectadas
- Resumos automáticos de tópicos estudados
- Custo controlado por usuário (limit semanal)

**V3.2 — Mobile native** (Q2 2027)
- React Native ou Expo
- Notifications push (recall sessions, achievements)
- Offline mode (study sem conexão, sync depois)

**V4.0 — Marketplace de templates** (Q3 2027)
- Templates pagos criados por experts (advogados aprovados, top scorers)
- Revenue share com criadores
- Verificação de qualidade automática

### 12.2 Métricas de sucesso (Product KPIs)

Métricas técnicas (P95 <500ms etc.) garantem que o sistema **funciona**. Estas garantem que **resolve o problema do usuário**.

**Métricas primárias (North Star + leading indicators):**

| Métrica | Meta MVP | Meta 6 meses | Como medir |
|---|---|---|---|
| **Plan completion rate** (% que termina sem desistir) | ≥40% | ≥60% | `weekly_stats` cobertura final >= 80% |
| **Wizard conversion** (criou plano / iniciou wizard) | ≥50% | ≥70% | `analytics_events`: ratio plan_created_success / wizard_step_started |
| **D7 retention** (estuda 7 dias após criar) | ≥45% | ≥65% | Tabela `behavioral_signals` filtrada por completion |
| **D30 retention** | ≥25% | ≥40% | Idem |
| **NPS pós-criação** (1 semana após criar) | ≥30 | ≥50 | Survey in-app one-shot |
| **NPS pós-prova** (após data_prova) | ≥20 | ≥40 | Survey opt-in |

**Métricas secundárias (engajamento profundo):**

| Métrica | Meta |
|---|---|
| Tempo médio do wizard | P50 ≤4min, P95 ≤8min |
| % de planos com pontos fracos marcados | ≥40% |
| % de users que usam drill-down | ≥15% |
| % de users que pulam ≥1 step | ≤20% |
| Drop-off por step do wizard | ≤15% por step |
| Items completados / items planejados (semanal) | ≥70% médio |
| Antecipações por mês (sinal de engajamento alto) | ≥1 a cada 3 weeks ativas |
| % de planos que migram de template | ≥25% |

**Métricas de qualidade IA:**

| Métrica | Meta |
|---|---|
| AI feedback positivo (👍) na decomposição | ≥80% |
| % de tópicos com decomposição rejeitada (👎) | ≤15% |
| Re-decomposição manual via admin | ≤5% dos editais |

**Métricas de custo:**

| Métrica | Meta |
|---|---|
| Custo IA por plano criado | ≤R$ 0,30 |
| Custo de armazenamento / user ativo / mês | ≤R$ 0,50 |
| Custo total Supabase / 10k MAU | ≤R$ 800/mês |

### 12.3 Hipóteses a validar (kill criteria)

A spec assume várias coisas. Cada uma é uma **hipótese testável**, com critério explícito pra matar a feature se errado.

**H1: Drill-down em subtópicos vale o esforço de implementar.**
- **Predição:** ≥15% dos users vão expandir disciplinas e desmarcar ≥1 subtópico
- **Como medir:** event `wizard_subtopic_excluded` em `analytics_events`
- **Janela:** primeiros 60 dias pós-launch
- **Kill criteria:** se <5% usa após 90 dias → remover drill-down, simplificar UI

**H2: Templates da comunidade vão crescer organicamente.**
- **Predição:** ≥30 templates públicos publicados após 6 meses
- **Como medir:** count em `plan_templates WHERE visibility='publico'`
- **Kill criteria:** se <10 após 6 meses → desativar feature, manter só `oficial`

**H3: IA decompõe mega-tópicos com qualidade suficiente.**
- **Predição:** ≥80% feedback positivo em `ai_quality_feedback`
- **Como medir:** ratio de 👍 vs 👎 por edital
- **Kill criteria:** se <60% em qualquer edital → re-treinar prompt; se persistir → fallback regex

**H4: FSRS reativo aumenta retenção.**
- **Predição:** users com FSRS ativo têm D30 retention ≥10% maior que sem
- **Como medir:** comparar coortes com/sem revisões geradas
- **Kill criteria:** se diferença <3% após 3 meses → manter mas marcar como "experimental"

**H5: Sugestões IA contextuais durante wizard aumentam conversion.**
- **Predição:** A/B test mostra +5% conversion no grupo com sugestões
- **Como medir:** feature flag binário, mede `plan_created_success`
- **Kill criteria:** se -2% ou neutro → remover sugestões (poluição de UX sem ganho)

**H6: Recalibração event-driven vs cron faz diferença.**
- **Predição:** users com recalibração imediata reportam ≥15% maior satisfação
- **Como medir:** A/B test entre handler imediato e cron-only
- **Kill criteria:** se diferença <5% → simplificar pra cron-only (menos infra)

**H7: Cargo da navbar como fonte de verdade reduz fricção.**
- **Predição:** wizard conversion sobe ≥10% com cargo pré-preenchido vs perguntar do zero
- **Como medir:** comparar coortes pré/pós-V2
- **Kill criteria:** se conversion não muda → reavaliar arquitetura de cargo

**H8: Pontos fracos (max 3) é a granularidade certa.**
- **Predição:** ≥40% dos users marcam ≥1 ponto fraco; ≤10% reclamam de limite
- **Como medir:** distribuição em `plano_disciplinas WHERE is_ponto_fraco=true`
- **Kill criteria:** se >25% querem >3 → aumentar limite ou tornar dinâmico

**Processo de validação:**
- Toda hipótese tem dashboard dedicado em `/admin/cronograma/hypotheses`
- Revisão mensal: status de cada hipótese (Validando / Confirmada / Refutada / Killed)
- Decisões de kill registradas em `docs/decisions/` (ADRs) com data + razão

### 12.4 Risk register

Riscos identificados e mitigações:

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Claude API rate limit/outage em scale | Média | Alto | Cache agressivo + fallback regex + circuit breaker |
| GraphQL externo cai por dias | Baixa | Alto | Cache stale serve | dados antigos + banner UI |
| Custo IA explode com viral growth | Baixa | Alto | `daily_ai_spend_cents` cap + alerta + degradação graceful |
| Schema migration trava produção | Média | Alto | Migrations aditivas + testadas em snapshot de prod |
| User vai embora durante 8-15s de IA | Alta | Médio | Stepper narrativo + cache warming dos top cargos |
| FSRS gera revisões "esquisitas" | Média | Médio | SM-2 simplificado é conservador; migração pra FSRS-5 só após dados |
| LGPD audit identifica problema | Baixa | Crítico | Opt-in explícito + dashboard de consents + data export request flow |
| Concorrente lança feature similar | Alta | Médio | Diferencial = qualidade da decomposição + templates comunidade |
| Spec fica desatualizada vs código | Alta | Médio | ADRs obrigatórios pra cada decisão de produto; spec atualizada mensalmente |

### 12.5 Decision Records (ADRs)

Cada decisão arquitetural significativa fica em `docs/decisions/YYYY-MM-DD-titulo.md` com formato:

```markdown
# ADR: <título>

**Data:** YYYY-MM-DD
**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-XXX
**Context:** <problema que motivou>
**Decision:** <o que decidimos>
**Consequences:** <trade-offs>
**Alternatives considered:** <outras opções e por que não>
```

Primeiras ADRs a criar imediatamente após esta spec:
- ADR-001: Por que PL/pgSQL + TS híbrido em vez de full TS
- ADR-002: Por que SM-2 simplificado em vez de FSRS-5 no MVP
- ADR-003: Por que cache compartilhado em edital_cache
- ADR-004: Por que feature flags em DB em vez de PostHog/LaunchDarkly
- ADR-005: Por que modelo semanal puro vs day-level scheduling

---

## 13. Próximos passos

1. **Spec approval** — usuário revisa este documento e aprova
2. **Implementation plan** — invocar skill `writing-plans` para detalhar tarefas executáveis
3. **Implementação faseada** (>= 8 sprints estimados):
   - Sprint 1-2: Schema + RPCs core (`criar_plano_completo`, `gerar_cronograma_v2`)
   - Sprint 3-4: Sync edital + IA decomposition
   - Sprint 5: Setup flow refactor (7 steps, Papiro, sugestões IA)
   - Sprint 6: Event loop + handlers
   - Sprint 7: Crons + cache + observability
   - Sprint 8: Migração V1→V2 + rollout
4. **Production rollout** — feature flag gradual ao longo de 21 dias

---

**Status:** Aprovado em brainstorming. Aguardando revisão final antes de partir para writing-plans.

**Autor:** Brainstorming session 2026-05-14
**Revisão:** Pendente
