# 11 — Orientações de Integração com a API Externa de Questões

> Este documento orienta Claude Code a investigar, integrar e consumir a API de questões do cliente (hospedada no Coolify). O contrato exato da API **não está documentado aqui** — Claude Code deve descobrir trabalhando junto com o admin no VS Code.

## Contexto

O cliente possui um banco de 3,4 milhões de questões com **disciplinas** e **assuntos** definidos, exposto via API REST/GraphQL hospedada em sua infraestrutura (Coolify/VPS). Esta API é a **fonte única da verdade** das questões. O sistema novo:

- **NÃO duplica** as questões no Supabase
- **Consome** via HTTP a cada necessidade
- **Mapeia** assuntos da API → tópicos/subtópicos do sistema
- **Calcula** peso empírico de tópicos baseado em estatísticas da API
- **Persiste** apenas tentativas dos alunos (referenciando IDs externas)

## Tarefas do Claude Code (a executar com o admin)

### Tarefa 1 — Descobrir o contrato da API

**Investigar com o admin:**
1. Tipo da API (REST, GraphQL, RPC) e formato (JSON, outro)
2. Autenticação (Bearer token, API key, OAuth, sessão)
3. Endpoints disponíveis e seus payloads
4. Rate limiting e latência típica
5. Versionamento (se houver)

**Entregável:** arquivo `/lib/questoes-api/types.ts` com tipos TypeScript que refletem fielmente o contrato. Usar Zod para schemas de validação de runtime.

**Heurística:** ao descobrir cada endpoint relevante, criar interface TypeScript e schema Zod correspondente. Não confiar cegamente na API — validar respostas.

### Tarefa 2 — Implementar cliente HTTP robusto

**Entregável:** `/lib/questoes-api/client.ts` com:

- Wrapper `fetch` ou `axios` com:
  - Auth automática via env vars
  - Timeout configurável (default 10s)
  - Retry com backoff exponencial (3 tentativas em erros 5xx ou network)
  - Logging estruturado (mas sem expor secrets)
  - Tratamento de rate limit (header `Retry-After` se houver)
- Métodos tipados para cada operação (não usar `any`)
- Erros customizados: `QuestoesAPIError`, `QuestoesAPITimeoutError`, `QuestoesAPIRateLimitError`

**Caching estratégico:**

| Operação | Cache | TTL |
|----------|-------|-----|
| Listar todos os assuntos | Next.js cache + tag | 1 hora |
| Contar questões por assunto+banca | Next.js cache | 6 horas |
| Buscar questões para sessão | Sem cache (precisa rotatividade) | — |
| Buscar questão por ID | Cache curto | 5 minutos |

Usar `revalidateTag` quando admin disparar resync manual.

**Fallback gracioso:**
- Se API estiver fora, sistema continua funcionando para teoria/lei seca/revisão FSRS
- Sessões novas de questões mostram mensagem clara: *"Banco de questões temporariamente indisponível. Tente em alguns minutos."*
- Nunca quebrar a UX inteira por falha da API externa

### Tarefa 3 — Tabela de mapeamento no Supabase

Adicionar migração ao schema existente:

```sql
-- /supabase/migrations/012_mapeamento_assuntos.sql

CREATE TABLE mapeamento_assuntos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Lado API externa
  assunto_id_api TEXT NOT NULL,          -- ID do assunto na API do cliente
  assunto_nome_api TEXT NOT NULL,        -- Nome descritivo (cache)
  disciplina_nome_api TEXT NOT NULL,     -- Para contexto e busca
  
  -- Lado sistema (pelo menos UM dos dois é obrigatório)
  topico_id UUID REFERENCES topicos(id) ON DELETE CASCADE,
  subtopico_id UUID REFERENCES subtopicos(id) ON DELETE CASCADE,
  
  -- Metadata do match
  confianca NUMERIC(3,2) CHECK (confianca BETWEEN 0 AND 1),
  metodo TEXT CHECK (metodo IN ('automatico_embedding', 'automatico_fuzzy', 'manual', 'manual_corrigido')),
  validado_por UUID REFERENCES alunos(id),  -- admin que aprovou
  validado_em TIMESTAMPTZ,
  
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  
  -- Um assunto-API pode mapear para múltiplos tópicos (raro) ou vice-versa
  -- Mas não pode haver duplicata exata
  UNIQUE(assunto_id_api, topico_id, subtopico_id),
  
  -- Garante que ao menos um lado do sistema está preenchido
  CHECK (topico_id IS NOT NULL OR subtopico_id IS NOT NULL)
);

CREATE INDEX idx_mapeamento_assunto_api ON mapeamento_assuntos(assunto_id_api);
CREATE INDEX idx_mapeamento_topico ON mapeamento_assuntos(topico_id) WHERE topico_id IS NOT NULL;
CREATE INDEX idx_mapeamento_subtopico ON mapeamento_assuntos(subtopico_id) WHERE subtopico_id IS NOT NULL;

CREATE TRIGGER trg_mapeamento_atualizado
  BEFORE UPDATE ON mapeamento_assuntos
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

-- Tabela auxiliar: estatísticas pré-calculadas por tópico
CREATE TABLE estatisticas_topico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topico_id UUID NOT NULL REFERENCES topicos(id) ON DELETE CASCADE,
  banca TEXT,                            -- NULL = todas as bancas
  
  total_questoes INT NOT NULL DEFAULT 0,
  questoes_ultimos_3_anos INT NOT NULL DEFAULT 0,
  questoes_ultimos_5_anos INT NOT NULL DEFAULT 0,
  peso_empirico INT CHECK (peso_empirico BETWEEN 1 AND 5),
  peso_normalizado NUMERIC(4,3),         -- 0.000 a 1.000 relativo ao concurso
  
  calculado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(topico_id, banca)
);

CREATE INDEX idx_estatisticas_topico ON estatisticas_topico(topico_id, banca);

-- View para consulta rápida do peso considerando a banca do concurso
CREATE OR REPLACE FUNCTION peso_topico_para_banca(p_topico_id UUID, p_banca TEXT)
RETURNS INT AS $$
  SELECT COALESCE(
    (SELECT peso_empirico FROM estatisticas_topico WHERE topico_id = p_topico_id AND banca = p_banca),
    (SELECT peso_empirico FROM estatisticas_topico WHERE topico_id = p_topico_id AND banca IS NULL),
    3  -- default se não houver estatística
  );
$$ LANGUAGE SQL STABLE;
```

**Ajustar tabela `tentativas_questoes`:**

Em vez de `questao_id UUID REFERENCES questoes(id)`, usar `questao_id_externa TEXT NOT NULL` (ID na API do cliente). A tabela `questoes` no Supabase **pode ser removida** ou mantida vazia para futuras questões internas (decisão do admin).

```sql
-- Ajuste a fazer em tentativas_questoes
ALTER TABLE tentativas_questoes 
  DROP CONSTRAINT IF EXISTS tentativas_questoes_questao_id_fkey,
  DROP COLUMN questao_id,
  ADD COLUMN questao_id_externa TEXT NOT NULL,
  ADD COLUMN assunto_id_api TEXT,           -- snapshot do assunto na hora da tentativa
  ADD COLUMN banca TEXT,                    -- snapshot
  ADD COLUMN ano INT;                       -- snapshot

CREATE INDEX idx_tentativas_questao_externa ON tentativas_questoes(questao_id_externa);
```

**Por que snapshot?** Se a API mudar/remover uma questão, ainda preservamos contexto da tentativa do aluno para histórico e FSRS.

### Tarefa 4 — Matching automático assunto-API ↔ tópico-sistema

**Quando dispara:** após admin processar edital e revisar a árvore, antes de publicar.

**Entregável:** `/lib/questoes-api/matching.ts` com:

```typescript
export interface SugestaoMatch {
  assunto_id_api: string
  assunto_nome_api: string
  disciplina_nome_api: string
  topico_id: string
  topico_nome: string
  confianca: number  // 0..1
  metodo: 'embedding' | 'fuzzy' | 'exact'
  total_questoes_disponiveis: number
}

export async function sugerirMatchesParaConcurso(concursoId: string): Promise<SugestaoMatch[]>
```

**Estratégia em camadas (tentar nesta ordem por tópico):**

1. **Match exato (case-insensitive, normalizado):** comparar `topico.nome` ↔ `assunto.nome` removendo acentos, hífens, parênteses. Se bater, confiança = 0.95.

2. **Match fuzzy via pg_trgm:** se exato falhou, usar similarity threshold ≥ 0.7. Confiança = similarity score.

3. **Match semântico via embeddings:** se fuzzy falhou ou produziu múltiplos candidatos próximos:
   - Gerar embedding do nome do tópico via Anthropic ou OpenAI (decisão do admin — recomendo `text-embedding-3-small` da OpenAI por preço)
   - Comparar com embeddings dos assuntos da API (gerados uma vez, armazenados em tabela `embeddings_assuntos` com `pgvector`)
   - Top 3 mais similares viram sugestões com confiança = cosine_similarity

**Tabela de embeddings (criar se for usar busca semântica):**

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE embeddings_assuntos (
  assunto_id_api TEXT PRIMARY KEY,
  assunto_nome TEXT NOT NULL,
  disciplina_nome TEXT NOT NULL,
  embedding vector(1536),  -- text-embedding-3-small = 1536 dims
  gerado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON embeddings_assuntos USING hnsw (embedding vector_cosine_ops);
```

**Sincronização inicial:** rodar uma vez ao integrar, popular `embeddings_assuntos` com todos os assuntos da API. Custo estimado: ~R$ 5-15 dependendo do volume de assuntos distintos.

**Re-sincronização:** semanal ou disparada manualmente pelo admin quando ele cadastrar assuntos novos.

### Tarefa 5 — Tela de validação dos matches

**Adicionar à tela** `/admin/concursos/[id]/revisar` (descrita em `08-telas-admin.md`):

No painel direito, quando admin selecionar um tópico, mostrar **nova seção "Questões da API"**:

```
┌──────────────────────────────────────────────────────┐
│  Questões da API                                     │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Assuntos sugeridos pelo sistema:                     │
│                                                       │
│  ✓ Homicídio simples           [Cebraspe: 234 q.]    │
│    confiança 96%  ·  match exato                     │
│                                          [Confirmar] │
│                                                       │
│  ? Homicídio - tipo simples    [Cebraspe: 12 q.]    │
│    confiança 78%  ·  fuzzy match                     │
│                                          [Confirmar] │
│                                                       │
│  ? Crime de homicídio          [Cebraspe: 8 q.]     │
│    confiança 71%  ·  semântico                       │
│                                          [Confirmar] │
│                                                       │
│  [+ Buscar outro assunto manualmente]                 │
├──────────────────────────────────────────────────────┤
│  Peso empírico calculado: 5  (vs IA: 4)              │
│  Total: 254 questões disponíveis · 89 nos últimos 3a │
└──────────────────────────────────────────────────────┘
```

**Comportamento:**
- Admin pode confirmar múltiplos assuntos para um tópico (ex: "Homicídio" agrega 3 assuntos diferentes da API)
- Cada confirmação cria registro em `mapeamento_assuntos`
- Quando admin confirma, recalcula peso empírico **na hora** e mostra comparação com peso sugerido pela IA
- Se diferença for grande (≥ 2), destacar visualmente para revisão extra
- Botão "Buscar outro" abre dropdown searchable com todos os assuntos da disciplina

### Tarefa 6 — Cálculo de peso empírico

**Entregável:** `/lib/questoes-api/estatisticas.ts`

**Fórmula recomendada (pode ser refinada com dados):**

```
peso_empirico = f(frequencia_normalizada, recencia_ponderada, exclusividade_banca)

Onde:
  frequencia_normalizada = total_questoes_topico / max(total_questoes_disciplina)
  recencia_ponderada = (questoes_3_anos * 2 + questoes_5_anos) / (total_questoes * 3)
  exclusividade_banca = questoes_banca_alvo / total_questoes (peso maior se banca cobra muito)

Score = (frequencia_normalizada * 0.5 + recencia_ponderada * 0.3 + exclusividade_banca * 0.2)
```

**Mapeamento score → peso (1-5):**

| Score | Peso | Interpretação |
|-------|------|---------------|
| ≥ 0.8 | 5 | Cai sempre |
| 0.6 - 0.8 | 4 | Cai muito |
| 0.4 - 0.6 | 3 | Médio |
| 0.2 - 0.4 | 2 | Cai pouco |
| < 0.2 | 1 | Raro |

**Quando recalcular:**
- Após cada novo match confirmado pelo admin
- Job semanal para todos os concursos publicados (caso API tenha novas questões)
- Disparado manualmente pelo admin via botão "Recalcular pesos do concurso"

**Quem decide o peso final:**
- Sistema calcula `peso_empirico` e armazena em `estatisticas_topico`
- Admin pode **sobrescrever manualmente** o `peso_incidencia` em `topicos` (peso editorial)
- Sistema usa peso editorial se houver, senão usa empírico (ver função SQL `peso_topico_para_banca`)

### Tarefa 7 — Sessão de questões consumindo a API

**Modificar a Fase 8** (execução de atividade tipo `questoes` ou `revisao_fsrs`):

Quando aluno inicia sessão de questões de um tópico:

```typescript
// Pseudo-código
async function iniciarSessaoQuestoes(atividadeId: string) {
  const atividade = await buscarAtividade(atividadeId)
  
  // 1. Buscar assuntos mapeados ao tópico/subtópico
  const assuntos = await buscarAssuntosMapeados(atividade.topico_id, atividade.subtopico_id)
  
  // 2. Buscar questões dos assuntos via API externa
  //    Priorizando: banca do concurso > outras bancas, recentes > antigas
  const questoes = await questoesAPI.buscarQuestoes({
    assunto_ids: assuntos.map(a => a.assunto_id_api),
    banca_preferida: concurso.banca,
    quantidade: 10,
    excluir_ids: tentativasRecentes  // não repetir questões dos últimos 7 dias
  })
  
  // 3. Apresentar ao aluno (cliente)
  return questoes
}
```

**Importante:** ao registrar tentativa em `tentativas_questoes`, salvar **snapshot** dos metadados (banca, ano, assunto) caso a API mude depois.

### Tarefa 8 — Detectar e tratar erros de integração

**Cenários a tratar:**

| Cenário | Comportamento |
|---------|---------------|
| API offline (timeout/network) | Mensagem amigável + sugerir voltar depois + log no Sentry |
| API retorna formato inesperado | Validação Zod falha → log + retornar erro genérico |
| Assunto deletado na API | Marcar mapeamento como `inativo`, avisar admin |
| Rate limit excedido | Aguardar `Retry-After`, exibir loading |
| Auth falhou (401) | Alertar admin para revisar `QUESTOES_API_KEY` |

**Telemetria mínima:**
- Logar cada falha em `eventos` com tipo `questoes_api_erro` e payload
- Dashboard admin tem widget: "Saúde da API de Questões" (verde/amarelo/vermelho)

## Checklist de validação

Ao finalizar a integração, Claude Code deve validar:

- [ ] Contrato da API documentado em `/lib/questoes-api/types.ts` com schemas Zod
- [ ] Cliente HTTP com retry, timeout, cache implementado
- [ ] Tabela `mapeamento_assuntos` criada com índices
- [ ] Tabela `estatisticas_topico` criada
- [ ] `tentativas_questoes` ajustada para usar `questao_id_externa`
- [ ] Matching automático funcionando (exato + fuzzy + semântico opcional)
- [ ] Tela de revisão da árvore mostra sugestões e contagens da API
- [ ] Admin consegue confirmar matches e ver peso empírico recalculado
- [ ] Sessão de questões consome a API corretamente
- [ ] Fallback gracioso quando API está fora
- [ ] Logs de erro funcionando

## Prompt sugerido para iniciar a integração

```
Vamos integrar a API externa de questões do cliente. Leia o documento
11-orientacoes-api-externa.md por completo.

Antes de codar:
1. Me peça os detalhes da API (URL, auth, endpoints, exemplos de payload)
2. Faça chamadas de teste para validar acesso
3. Documente o contrato em types.ts antes de partir pra implementação

Comece pela Tarefa 1 (descobrir contrato) e Tarefa 2 (cliente HTTP).
As Tarefas 3-8 só depois da minha validação dos contratos descobertos.
```

## Decisões em aberto (para o admin decidir)

1. **Provider de embeddings:** OpenAI `text-embedding-3-small` ou Anthropic Claude (futuro endpoint)? **Recomendação: OpenAI por agora — custo baixo, qualidade comprovada.**
2. **Manter tabela `questoes` no Supabase?** Para questões internas/customizadas. **Recomendação: manter vazia, usar apenas se admin quiser adicionar questões próprias além da API.**
3. **Sincronização de assuntos:** automática semanal ou manual? **Recomendação: ambas — botão manual + cron semanal.**
4. **Estatísticas pré-calculadas ou on-demand?** Cálculo via SQL diretamente vs job. **Recomendação: job semanal popula `estatisticas_topico`, leitura é cache hit.**
