# API Plataforma de Questões - Especificação Completa (Parte 1: Core)

## Índice Geral
- **Parte 1 (este arquivo):** Visão Geral, Arquitetura, Stack, Schema, Endpoints Principais
- **Parte 2:** IA & RAG, Jobs Assíncronos, Storage
- **Parte 3:** Segurança, Monitoring, Deploy, Integração com App

---

## Visão Geral

API REST stateless para servir 1M+ questões com busca avançada, RAG semântico e explicações inteligentes via IA.

### Princípios arquiteturais

- **Stateless** - API NÃO gerencia usuários, tentativas ou progresso (isso é do app client)
- **Read-heavy** - Otimizada para leitura (questões são estáticas)
- **IA-powered** - RAG semântico + explicações contextuais
- **Escalável** - Arquitetura preparada para milhões de requests

### Escopo da API

**O que a API FAZ:**
- ✅ Servir questões (busca, filtros, detalhes)
- ✅ Busca semântica (pgvector + RAG)
- ✅ Explicações com IA (Claude + contexto do usuário)
- ✅ Estatísticas GLOBAIS (quantos % acertam cada questão)
- ✅ Metadados (matérias, bancas, taxonomia)

**O que a API NÃO FAZ (responsabilidade do app):**
- ❌ Autenticação de usuários (app gerencia via Supabase Auth)
- ❌ Histórico de tentativas (app salva no próprio banco)
- ❌ Sistema FSRS (app gerencia)
- ❌ Criação de flashcards (app decide quando criar)

---

## Arquitetura

```
┌─────────────────────────────────────────┐
│   App Next.js (Cliente)                 │
│   - Supabase Auth                       │
│   - FSRS                                │
│   - Flashcards                          │
│   - User stats                          │
└──────────┬──────────────────────────────┘
           │ HTTP REST
           ↓
┌─────────────────────────────────────────┐
│          FastAPI (Stateless)            │
│   - Serve questões                      │
│   - Busca semântica                     │
│   - Explicações IA                      │
│   - Stats globais                       │
└──────┬──────────────┬──────────────┬────┘
       │              │              │
       ↓              ↓              ↓
┌──────────┐   ┌──────────┐   ┌──────────┐
│PostgreSQL│   │Typesense │   │  Redis   │
│+pgvector │   │  Search  │   │  Cache   │
└──────────┘   └──────────┘   └─────┬────┘
                                     │
                                     ↓
                              ┌──────────┐
                              │  BullMQ  │
                              │  Queues  │
                              └──────────┘
       │
       ↓
┌─────────────────────────────────────────┐
│    CloudFlare R2 (Imagens/PDFs)         │
└─────────────────────────────────────────┘
```

### Separação de responsabilidades

| Componente | Responsabilidade |
|------------|------------------|
| **API Questions** | Questões, busca, IA, stats globais |
| **App Next.js** | Auth, user data, FSRS, flashcards, tentativas |
| **PostgreSQL** | Dados estruturados (questões) |
| **Typesense** | Busca full-text ultrarrápida |
| **pgvector** | Embeddings para RAG semântico |
| **Redis** | Cache de queries, rate limiting |
| **BullMQ** | Jobs assíncronos (embeddings, stats) |
| **CloudFlare R2** | Assets estáticos (imagens, PDFs) |

---

## Stack Tecnológica

| Componente | Tecnologia | Justificativa |
|------------|-----------|---------------|
| **Backend** | FastAPI (Python 3.11+) | REST API, validação Pydantic, async nativo |
| **Database** | PostgreSQL 16 | Dados estruturados, ACID |
| **Vector DB** | pgvector | Embeddings para RAG semântico |
| **Search** | Typesense | Busca full-text + filtros rápidos, typo tolerance |
| **Cache** | Redis 7 | Cache, rate limiting |
| **Queue** | BullMQ + Redis | Jobs assíncronos com retry automático |
| **Storage** | CloudFlare R2 | CDN grátis, compatível S3 |
| **IA Embeddings** | OpenAI text-embedding-3-small | 1536 dims, $0.02/1M tokens |
| **IA Explicações** | Claude 3.5 Sonnet | RAG + contexto personalizado |
| **Monitoring** | Sentry + Grafana + Prometheus | Erros + métricas + logs |
| **Deploy** | Docker + Railway/Render | Containerização + hosting |

### Por que FastAPI?

- ✅ Async nativo (performance)
- ✅ Type hints + Pydantic (validação automática)
- ✅ Docs auto-geradas (Swagger/ReDoc)
- ✅ Ecossistema Python (OpenAI, Claude, sklearn)
- ✅ Desenvolvimento rápido

---

## Schema do Banco de Dados

### PostgreSQL + pgvector

```sql
-- Extensão para vector search
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabela principal de questões
CREATE TABLE questoes (
    id BIGINT PRIMARY KEY,
    enunciado TEXT NOT NULL,
    materia VARCHAR(100) NOT NULL,
    assunto VARCHAR(200),
    banca VARCHAR(100),
    orgao VARCHAR(200),
    cargo VARCHAR(200),
    ano INTEGER,
    dificuldade VARCHAR(20), -- 'easy', 'medium', 'hard'
    anulada BOOLEAN DEFAULT FALSE,
    desatualizada BOOLEAN DEFAULT FALSE,
    imagem_url TEXT,
    pdf_prova_url TEXT,

    -- RAG Semântico
    embedding vector(1536),  -- OpenAI text-embedding-3-small

    -- Estatísticas GLOBAIS (não por usuário)
    views INTEGER DEFAULT 0,
    total_tentativas INTEGER DEFAULT 0,
    total_acertos INTEGER DEFAULT 0,
    taxa_acerto_global DECIMAL(5,2) DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Alternativas
CREATE TABLE alternativas (
    id BIGSERIAL PRIMARY KEY,
    questao_id BIGINT REFERENCES questoes(id) ON DELETE CASCADE,
    letra CHAR(1) NOT NULL,
    texto TEXT NOT NULL,
    correta BOOLEAN DEFAULT FALSE,
    CHECK (letra IN ('A', 'B', 'C', 'D', 'E'))
);

-- Estatísticas globais agregadas (cache de queries pesadas)
CREATE TABLE estatisticas_globais (
    id BIGSERIAL PRIMARY KEY,
    materia VARCHAR(100) UNIQUE NOT NULL,
    total_questoes INTEGER DEFAULT 0,
    taxa_acerto_media DECIMAL(5,2) DEFAULT 0,
    tempo_medio_ms INTEGER DEFAULT 0,
    questoes_respondidas INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Taxonomia de matérias (hierarquia)
CREATE TABLE taxonomia_materias (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    parent_id BIGINT REFERENCES taxonomia_materias(id),
    nivel INTEGER DEFAULT 0, -- 0=raiz, 1=matéria, 2=assunto, 3=tópico
    icone VARCHAR(50),
    cor VARCHAR(20),
    total_questoes INTEGER DEFAULT 0
);

-- Índices para performance
CREATE INDEX idx_questoes_materia ON questoes(materia);
CREATE INDEX idx_questoes_banca ON questoes(banca);
CREATE INDEX idx_questoes_ano ON questoes(ano);
CREATE INDEX idx_questoes_dificuldade ON questoes(dificuldade);
CREATE INDEX idx_questoes_assunto ON questoes(assunto);
CREATE INDEX idx_questoes_orgao ON questoes(orgao);

-- Índice vetorial para busca semântica (IMPORTANTE!)
CREATE INDEX idx_questoes_embedding ON questoes
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Índices compostos para filtros comuns
CREATE INDEX idx_questoes_materia_ano ON questoes(materia, ano);
CREATE INDEX idx_questoes_banca_ano ON questoes(banca, ano);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_questoes_updated_at
    BEFORE UPDATE ON questoes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Typesense Schema

```json
{
  "name": "questoes",
  "fields": [
    {"name": "id", "type": "string", "index": true},
    {"name": "enunciado", "type": "string", "index": true},
    {"name": "materia", "type": "string", "facet": true, "index": true},
    {"name": "assunto", "type": "string", "facet": true, "index": true, "optional": true},
    {"name": "banca", "type": "string", "facet": true, "index": true, "optional": true},
    {"name": "orgao", "type": "string", "facet": true, "index": true, "optional": true},
    {"name": "cargo", "type": "string", "facet": true, "index": true, "optional": true},
    {"name": "ano", "type": "int32", "facet": true, "index": true, "optional": true},
    {"name": "dificuldade", "type": "string", "facet": true, "index": true, "optional": true},
    {"name": "views", "type": "int32", "index": true},
    {"name": "taxa_acerto_global", "type": "float", "index": true}
  ],
  "default_sorting_field": "views"
}
```

---

## Endpoints da API

### Base URL
```
https://api.questoes.com/v1
```

**Importante:** API é **stateless** - não há autenticação de usuários. App cliente gerencia auth separadamente.

---

## 🔍 Busca & Filtros

### GET `/questoes/search`
Busca questões com filtros múltiplos (Typesense).

**Query Parameters:**
```typescript
{
  q?: string;                    // Texto de busca full-text
  materia?: string;              // Filtrar por matéria
  materias?: string[];           // Múltiplas matérias (ex: "direito_civil,direito_penal")
  banca?: string;                // Filtrar por banca
  bancas?: string[];             // Múltiplas bancas
  orgao?: string;                // Filtrar por órgão
  ano?: number;                  // Filtrar por ano exato
  ano_min?: number;              // Ano mínimo
  ano_max?: number;              // Ano máximo
  dificuldade?: 'easy'|'medium'|'hard';
  anulada?: boolean;             // Incluir anuladas (default: false)
  desatualizada?: boolean;       // Incluir desatualizadas (default: false)
  sort?: string;                 // "relevancia", "ano_desc", "ano_asc", "views_desc", "taxa_acerto_asc"
  page?: number;                 // Página (default: 1)
  limit?: number;                // Itens por página (default: 20, max: 100)
}
```

**Response:**
```json
{
  "total": 1542,
  "page": 1,
  "limit": 20,
  "pages": 78,
  "facets": {
    "materias": [
      {"value": "direito_civil", "count": 1200},
      {"value": "direito_penal", "count": 342}
    ],
    "bancas": [
      {"value": "CESPE", "count": 850},
      {"value": "FCC", "count": 692}
    ],
    "anos": [
      {"value": 2024, "count": 320},
      {"value": 2023, "count": 450}
    ]
  },
  "results": [
    {
      "id": 3440688,
      "enunciado": "No que se refere à responsabilidade civil...",
      "materia": "direito_civil",
      "assunto": "Responsabilidade Civil",
      "banca": "CESPE",
      "orgao": "TJ-SP",
      "cargo": "Juiz",
      "ano": 2024,
      "dificuldade": "medium",
      "alternativas": [
        {"letra": "A", "texto": "...", "correta": false},
        {"letra": "B", "texto": "...", "correta": true}
      ],
      "imagem_url": "https://cdn.questoes.com/questoes/3440688.webp",
      "taxa_acerto_global": 68.5,
      "views": 1523
    }
  ]
}
```

---

### GET `/questoes/{id}`
Busca questão por ID com detalhes completos.

**Response:**
```json
{
  "id": 3440688,
  "enunciado": "No que se refere à responsabilidade civil...",
  "materia": "direito_civil",
  "assunto": "Responsabilidade Civil",
  "banca": "CESPE",
  "orgao": "TJ-SP",
  "ano": 2024,
  "alternativas": [
    {"letra": "A", "texto": "...", "correta": false},
    {"letra": "B", "texto": "...", "correta": true}
  ],
  "imagem_url": "https://cdn.questoes.com/questoes/3440688.webp",
  "pdf_prova_url": "https://cdn.questoes.com/provas/cespe-2024-123.pdf",
  "views": 1523,
  "total_tentativas": 2340,
  "total_acertos": 1603,
  "taxa_acerto_global": 68.5
}
```

---

### POST `/questoes/batch`
Busca múltiplas questões por IDs (otimizado).

**Request:**
```json
{
  "ids": [3440688, 2787607, 2894229]
}
```

**Response:**
```json
{
  "total": 3,
  "results": [
    { "id": 3440688, "enunciado": "...", "alternativas": [...] },
    { "id": 2787607, "enunciado": "...", "alternativas": [...] },
    { "id": 2894229, "enunciado": "...", "alternativas": [...] }
  ]
}
```

---

### GET `/questoes/random`
Retorna questões aleatórias com filtros.

**Query Parameters:**
```typescript
{
  count?: number;          // Número de questões (default: 10, max: 50)
  materia?: string;        // Filtrar por matéria
  banca?: string;          // Filtrar por banca
  dificuldade?: string;    // Filtrar por dificuldade
  seed?: number;           // Seed para reproduzibilidade
}
```

**Response:**
```json
{
  "count": 20,
  "seed": 12345,
  "filters_applied": {
    "materia": "direito_civil",
    "dificuldade": "medium"
  },
  "results": [
    { "id": 3440688, "enunciado": "...", "alternativas": [...] }
  ]
}
```

---

## 🤖 IA & RAG Semântico

### POST `/ai/semantic-search`
Busca semântica usando embeddings (pgvector).

**Request:**
```json
{
  "query": "questões sobre princípio da simetria constitucional",
  "limit": 10,
  "threshold": 0.7,
  "filters": {
    "materia": "direito_constitucional",
    "ano_min": 2020
  }
}
```

**Response:**
```json
{
  "query": "questões sobre princípio da simetria constitucional",
  "total": 10,
  "results": [
    {
      "id": 2787607,
      "enunciado": "Acerca do princípio da simetria...",
      "similarity": 0.92,
      "materia": "direito_constitucional",
      "banca": "CESPE",
      "ano": 2023
    }
  ]
}
```

---

### POST `/ai/explain-question` ⚠️ PRINCIPAL

Explica questão usando Claude 3.5 Sonnet + RAG + contexto do usuário.

**Request:**
```json
{
  "questao_id": 3440688,
  "alternativa_escolhida": "C",
  "user_context": {
    "weak_topics": ["responsabilidade civil", "nexo causal"],
    "fsrs_state": "learning",
    "study_goal": "Concurso TJ-SP Juiz",
    "recent_mistakes": [2787607, 2894229],
    "difficulty_preference": "didatico"
  }
}
```

**Response:**
```json
{
  "questao_id": 3440688,
  "alternativa_escolhida": "C",
  "alternativa_correta": "B",
  "acertou": false,
  "explicacao": "Você escolheu a alternativa C, que está incorreta...\n\n## Por que a alternativa C está errada:\n\n...\n\n## Conceito correto (alternativa B):\n\n...\n\n## Como evitar esse erro:\n\n...",
  "conceitos_chave": [
    "Responsabilidade Civil Objetiva",
    "Teoria do Risco",
    "Código Civil Art. 927"
  ],
  "questoes_similares": [
    {
      "id": 2787607,
      "enunciado": "No âmbito da responsabilidade civil...",
      "similarity": 0.91,
      "banca": "CESPE",
      "ano": 2023
    }
  ],
  "artigos_relacionados": [
    "Código Civil - Art. 927, parágrafo único"
  ],
  "dicas_personalizadas": [
    "Você errou 3 questões sobre nexo causal recentemente. Revise este conceito."
  ]
}
```

---

## 📊 Estatísticas Globais

**⚠️ Importante:** API retorna apenas estatísticas GLOBAIS (agregadas de todos os usuários). App cliente gerencia estatísticas POR USUÁRIO.

### GET `/stats/global`
Estatísticas gerais da plataforma.

**Response:**
```json
{
  "questoes": {
    "total": 1000000,
    "com_embeddings": 987543,
    "pendentes_embeddings": 12457
  },
  "por_materia": [
    {
      "materia": "direito_civil",
      "total_questoes": 120000,
      "taxa_acerto_media": 72.3,
      "tempo_medio_ms": 42000
    }
  ],
  "por_banca": [
    {
      "banca": "CESPE",
      "total_questoes": 350000,
      "taxa_acerto_media": 70.2
    }
  ],
  "updated_at": "2025-01-20T02:00:00Z"
}
```

---

### GET `/stats/questao/{questao_id}`
Estatísticas de uma questão específica.

**Response:**
```json
{
  "questao_id": 3440688,
  "views": 1523,
  "total_tentativas": 2340,
  "total_acertos": 1603,
  "taxa_acerto_global": 68.5,
  "tempo_medio_ms": 42000,
  "distribuicao_alternativas": {
    "A": 234,
    "B": 1603,
    "C": 345,
    "D": 123,
    "E": 35
  }
}
```

---

### POST `/questoes/{id}/responder` ⚠️ ENDPOINT PRINCIPAL

Registra resposta do usuário e retorna resultado + atualiza stats globais.

**⚠️ Importante:** Este endpoint faz TUDO em uma chamada atômica:
1. Recebe resposta do usuário
2. Valida e retorna se acertou
3. Atualiza estatísticas globais da questão
4. Retorna dados para app salvar localmente

**Request:**
```json
{
  "alternativa_escolhida": "B",
  "tempo_resposta_ms": 42000
}
```

**Response:**
```json
{
  "questao_id": 3440688,
  "alternativa_escolhida": "B",
  "alternativa_correta": "B",
  "acertou": true,
  "tempo_resposta_ms": 42000,
  "stats_globais_atualizadas": {
    "total_tentativas": 2341,
    "total_acertos": 1604,
    "taxa_acerto_global": 68.6,
    "sua_posicao": "melhor que 68% dos usuários"
  },
  "explicacao_rapida": "Parabéns! Alternativa B está correta. Responsabilidade civil objetiva...",
  "proxima_acao_sugerida": "revisar_conceito" // ou "avancar", "criar_flashcard"
}
```

---

### POST `/stats/increment-view`
Incrementa contador de visualizações (chamado quando usuário abre questão).

**Request:**
```json
{
  "questao_id": 3440688
}
```

**Response:**
```json
{
  "questao_id": 3440688,
  "views": 1524
}
```

---

## 🏷️ Metadados & Taxonomia

### GET `/metadata/materias`
Lista todas as matérias com hierarquia.

**Response:**
```json
{
  "total": 42,
  "materias": [
    {
      "id": 1,
      "nome": "Direito Civil",
      "slug": "direito_civil",
      "icone": "⚖️",
      "cor": "#3B82F6",
      "total_questoes": 120000,
      "assuntos": [
        {
          "id": 12,
          "nome": "Responsabilidade Civil",
          "slug": "responsabilidade_civil",
          "total_questoes": 8500
        }
      ]
    }
  ]
}
```

---

### GET `/metadata/bancas`
Lista todas as bancas disponíveis.

**Response:**
```json
{
  "total": 28,
  "bancas": [
    {
      "nome": "CESPE",
      "slug": "cespe",
      "total_questoes": 350000,
      "anos_disponiveis": [2024, 2023, 2022],
      "orgaos": ["TJ-SP", "TRF-1", "STJ"]
    }
  ]
}
```

---

## 🔧 Admin (protegidos por API Key)

**Header obrigatório:** `X-API-Key: your_secret_key`

### POST `/admin/questoes/import`
Importa questões do JSON do scraper.

**Request:**
```json
{
  "questoes": [
    {
      "id": 3440688,
      "enunciado": "...",
      "alternativas": [...],
      "materia": "direito_civil"
    }
  ]
}
```

**Response:**
```json
{
  "total_importadas": 1000,
  "duplicatas_ignoradas": 23,
  "erros": 0,
  "job_embeddings_id": "emb-12345"
}
```

---

### POST `/admin/embeddings/generate`
Gera embeddings para questões (job assíncrono).

**Request:**
```json
{
  "questao_ids": [3440688, 2787607],
  "batch_size": 100
}
```

**Response:**
```json
{
  "job_id": "emb-12346",
  "status": "queued",
  "total_questoes": 2,
  "estimated_time_minutes": 5
}
```

---

### GET `/admin/jobs/{job_id}`
Verifica status de job assíncrono.

**Response:**
```json
{
  "job_id": "emb-12346",
  "status": "completed",
  "progress": 100,
  "completed": 2,
  "failed": 0,
  "started_at": "2025-01-20T10:00:00Z",
  "completed_at": "2025-01-20T10:05:23Z"
}
```

---

## 🏥 Health & Status

### GET `/health`
Health check completo.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-20T15:30:00Z",
  "version": "1.0.0",
  "checks": {
    "database": {"status": "healthy", "latency_ms": 5},
    "redis": {"status": "healthy", "latency_ms": 2},
    "typesense": {"status": "healthy", "latency_ms": 8}
  }
}
```

---

### GET `/metrics`
Métricas Prometheus (para Grafana).

**Response:**
```
# HELP questoes_search_latency_seconds Latência de busca
# TYPE questoes_search_latency_seconds histogram
questoes_search_latency_seconds_bucket{le="0.1"} 1234
...
```

---

**Continue na Parte 2:** IA detalhada, Jobs Assíncronos, Object Storage
