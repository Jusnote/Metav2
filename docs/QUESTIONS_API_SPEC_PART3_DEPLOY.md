# API Plataforma de Questões - Especificação Completa (Parte 3: Deploy & Integração)

## Índice
- [Segurança & Performance](#segurança--performance)
- [Monitoring & Observability](#monitoring--observability)
- [Deploy & Infraestrutura](#deploy--infraestrutura)
- [Integração com App Next.js](#integração-com-app-nextjs)
- [Roadmap](#roadmap)
- [Custos](#custos)

---

## Segurança & Performance

### Rate Limiting

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["1000/hour"]
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Rate limit por endpoint
@app.get("/questoes/search")
@limiter.limit("100/minute")
async def search_questoes(request: Request, ...):
    pass

@app.post("/ai/explain-question")
@limiter.limit("20/minute")  # IA é mais caro, limitar mais
async def explain_question(request: Request, ...):
    pass
```

---

### Cache Redis

```python
import redis.asyncio as redis
import json
from functools import wraps

redis_client = redis.from_url(os.getenv("REDIS_URL"))

def cache_result(ttl: int = 3600, key_prefix: str = ""):
    """Decorator para cachear resultados"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Gerar chave única
            cache_key = f"{key_prefix}:{func.__name__}:{hash(str(args) + str(kwargs))}"

            # Verificar cache
            cached = await redis_client.get(cache_key)
            if cached:
                return json.loads(cached)

            # Executar função
            result = await func(*args, **kwargs)

            # Salvar no cache
            await redis_client.setex(
                cache_key,
                ttl,
                json.dumps(result, default=str)
            )

            return result
        return wrapper
    return decorator

# Usar cache
@cache_result(ttl=3600, key_prefix="questao")
async def buscar_questao(questao_id: int):
    return await db.fetch_one("SELECT * FROM questoes WHERE id = $1", [questao_id])

@cache_result(ttl=300, key_prefix="search")
async def search_questoes_cached(filters: dict):
    return await typesense_search(filters)
```

---

### CORS Configuration

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://app.questoes.com",  # App Next.js produção
        "http://localhost:3000"       # App Next.js dev
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    max_age=3600
)
```

---

### SQL Injection Prevention

```python
# ❌ NUNCA fazer isso
query = f"SELECT * FROM questoes WHERE id = {questao_id}"

# ✅ Sempre usar parametrização
query = "SELECT * FROM questoes WHERE id = $1"
result = await db.fetch_one(query, [questao_id])

# ✅ Com múltiplos parâmetros
query = """
    SELECT * FROM questoes
    WHERE materia = $1 AND ano >= $2
    LIMIT $3
"""
result = await db.fetch_all(query, [materia, ano_min, limit])
```

---

## Monitoring & Observability

### Sentry (Erros)

```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastAPIIntegration

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    integrations=[FastAPIIntegration()],
    traces_sample_rate=0.1,
    environment=os.getenv("ENVIRONMENT", "production"),
    release=os.getenv("APP_VERSION", "1.0.0")
)

# Capturar exceção
@app.post("/ai/explain-question")
async def explain_question(...):
    try:
        result = await explicar_questao_com_rag(...)
        return result
    except Exception as e:
        sentry_sdk.capture_exception(e)
        raise HTTPException(500, "Erro ao gerar explicação")
```

---

### Prometheus + Grafana

```python
from prometheus_client import Counter, Histogram
from prometheus_fastapi_instrumentator import Instrumentator

# Métricas customizadas
questoes_buscadas = Counter(
    'questoes_buscadas_total',
    'Total de questões buscadas',
    ['materia', 'banca']
)

explicacoes_geradas = Counter(
    'explicacoes_ai_geradas_total',
    'Total de explicações geradas com IA'
)

latencia_busca = Histogram(
    'busca_questoes_latency_seconds',
    'Latência de busca de questões',
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0]
)

# Instrumentar FastAPI
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# Usar métricas
@app.get("/questoes/search")
async def search_questoes(...):
    with latencia_busca.time():
        results = await buscar_questoes(...)
        for q in results:
            questoes_buscadas.labels(
                materia=q.materia,
                banca=q.banca
            ).inc()
        return results
```

---

### Logs Estruturados

```python
import structlog

# Configurar structlog
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    logger_factory=structlog.stdlib.LoggerFactory(),
)

log = structlog.get_logger()

# Usar logs
@app.post("/ai/explain-question")
async def explain_question(data: ExplainRequest):
    log.info(
        "explicacao_solicitada",
        questao_id=data.questao_id,
        alternativa=data.alternativa_escolhida,
        weak_topics=data.user_context.weak_topics
    )

    # Output JSON:
    # {
    #   "event": "explicacao_solicitada",
    #   "level": "info",
    #   "timestamp": "2025-01-20T15:30:00Z",
    #   "questao_id": 3440688
    # }
```

---

## Deploy & Infraestrutura

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Dependências do sistema
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Código da aplicação
COPY . .

# Variáveis de ambiente
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Usuário não-root (segurança)
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Comando
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

---

### docker-compose.yml

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://user:pass@postgres:5432/questoes
      REDIS_URL: redis://redis:6379
      TYPESENSE_API_KEY: ${TYPESENSE_API_KEY}
      TYPESENSE_HOST: typesense
      R2_ACCOUNT_ID: ${R2_ACCOUNT_ID}
      R2_ACCESS_KEY_ID: ${R2_ACCESS_KEY_ID}
      R2_SECRET_ACCESS_KEY: ${R2_SECRET_ACCESS_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      SENTRY_DSN: ${SENTRY_DSN}
      API_KEY: ${API_KEY}
    depends_on:
      - postgres
      - redis
      - typesense
    restart: unless-stopped

  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: questoes
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
    restart: unless-stopped

  typesense:
    image: typesense/typesense:26
    environment:
      TYPESENSE_API_KEY: ${TYPESENSE_API_KEY}
      TYPESENSE_DATA_DIR: /data
    volumes:
      - typesense_data:/data
    ports:
      - "8108:8108"
    restart: unless-stopped

  worker:
    build: .
    command: python worker.py
    environment:
      REDIS_URL: redis://redis:6379
      DATABASE_URL: postgresql://user:pass@postgres:5432/questoes
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    depends_on:
      - redis
      - postgres
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana_data:/var/lib/grafana
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    depends_on:
      - prometheus
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  typesense_data:
  prometheus_data:
  grafana_data:
```

---

### .env.example

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/questoes

# Redis
REDIS_URL=redis://localhost:6379

# Typesense
TYPESENSE_API_KEY=xyz123
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108

# CloudFlare R2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET=questoes-bucket

# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Sentry
SENTRY_DSN=https://...@sentry.io/...

# API Key (admin endpoints)
API_KEY=your-super-secret-key

# Environment
ENVIRONMENT=production
APP_VERSION=1.0.0

# Grafana
GRAFANA_PASSWORD=admin
```

---

## Integração com App Next.js

### Service Layer (TypeScript)

```typescript
// src/services/questionsAPI.ts

const API_URL = process.env.NEXT_PUBLIC_QUESTIONS_API_URL || 'https://api.questoes.com/v1';

export const questionsAPI = {
  /**
   * Busca questões com filtros
   */
  async search(params: {
    q?: string;
    materia?: string;
    banca?: string;
    ano_min?: number;
    page?: number;
    limit?: number;
  }) {
    const queryParams = new URLSearchParams(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );

    const res = await fetch(`${API_URL}/questoes/search?${queryParams}`);
    if (!res.ok) throw new Error('Erro ao buscar questões');
    return res.json();
  },

  /**
   * Busca questão por ID
   */
  async getById(id: number) {
    const res = await fetch(`${API_URL}/questoes/${id}`);
    if (!res.ok) throw new Error('Questão não encontrada');
    return res.json();
  },

  /**
   * Busca semântica (RAG)
   */
  async semanticSearch(query: string, filters?: { materia?: string; limit?: number }) {
    const res = await fetch(`${API_URL}/ai/semantic-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, ...filters })
    });
    if (!res.ok) throw new Error('Erro na busca semântica');
    return res.json();
  },

  /**
   * ⚠️ ENDPOINT PRINCIPAL - Explica questão com IA + RAG + contexto
   */
  async explainQuestion(
    questao_id: number,
    alternativa_escolhida: string,
    user_context: {
      weak_topics: string[];
      fsrs_state: string;
      study_goal: string;
      recent_mistakes: number[];
    }
  ) {
    const res = await fetch(`${API_URL}/ai/explain-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questao_id,
        alternativa_escolhida,
        user_context
      })
    });
    if (!res.ok) throw new Error('Erro ao gerar explicação');
    return res.json();
  },

  /**
   * Registra visualização de questão
   */
  async incrementView(questao_id: number) {
    await fetch(`${API_URL}/stats/increment-view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questao_id })
    });
  },

  /**
   * Responder questão (valida + atualiza stats globais atomicamente)
   */
  async responderQuestao(
    questao_id: number,
    alternativa_escolhida: string,
    tempo_ms: number
  ) {
    const res = await fetch(`${API_URL}/questoes/${questao_id}/responder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alternativa_escolhida,
        tempo_resposta_ms: tempo_ms
      })
    });
    if (!res.ok) throw new Error('Erro ao registrar resposta');
    return res.json(); // { acertou, alternativa_correta, stats_globais_atualizadas, explicacao_rapida }
  },

  /**
   * Lista matérias
   */
  async getMaterias() {
    const res = await fetch(`${API_URL}/metadata/materias`);
    return res.json();
  },

  /**
   * Lista bancas
   */
  async getBancas() {
    const res = await fetch(`${API_URL}/metadata/bancas`);
    return res.json();
  }
};
```

---

### React Hooks

```typescript
// src/hooks/useQuestions.ts
import { useQuery } from '@tanstack/react-query';
import { questionsAPI } from '@/services/questionsAPI';

export function useQuestions(filters: any) {
  return useQuery({
    queryKey: ['questions', filters],
    queryFn: () => questionsAPI.search(filters),
    staleTime: 5 * 60 * 1000,
    keepPreviousData: true
  });
}

export function useQuestion(id: number) {
  return useQuery({
    queryKey: ['question', id],
    queryFn: () => questionsAPI.getById(id),
    staleTime: 10 * 60 * 1000,
    enabled: !!id
  });
}

export function useQuestionExplanation(
  questao_id: number,
  alternativa_escolhida: string,
  user_context: any,
  enabled: boolean = false
) {
  return useQuery({
    queryKey: ['explanation', questao_id, alternativa_escolhida],
    queryFn: () => questionsAPI.explainQuestion(questao_id, alternativa_escolhida, user_context),
    staleTime: Infinity,
    enabled
  });
}
```

---

### Exemplo de Componente

```typescript
// src/pages/QuestionPage.tsx
import { useQuestion, useQuestionExplanation } from '@/hooks/useQuestions';
import { useUser } from '@/hooks/useUser';
import { useServerFirst } from '@/hooks/useServerFirst';
import { questionsAPI } from '@/services/questionsAPI';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

export function QuestionPage({ questionId }: { questionId: number }) {
  const { data: question, isLoading } = useQuestion(questionId);
  const user = useUser();

  const { create: createAttempt } = useServerFirst({
    tableName: 'question_attempts'
  });

  const { create: createFlashcard } = useServerFirst({
    tableName: 'flashcards'
  });

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const { data: explanation, isLoading: isLoadingExplanation } = useQuestionExplanation(
    questionId,
    selectedAnswer!,
    {
      weak_topics: user.weakTopics || [],
      fsrs_state: 'learning',
      study_goal: user.studyGoal || '',
      recent_mistakes: user.recentMistakes || []
    },
    showExplanation
  );

  const handleAnswer = async (alternativa: string) => {
    setSelectedAnswer(alternativa);

    const startTime = Date.now();
    const timeSpent = Date.now() - startTime;

    // 1. Responder questão NA API (valida + atualiza stats globais atomicamente)
    const resultado = await questionsAPI.responderQuestao(questionId, alternativa, timeSpent);

    // resultado = {
    //   acertou: boolean,
    //   alternativa_correta: string,
    //   stats_globais_atualizadas: {...},
    //   explicacao_rapida: string,
    //   proxima_acao_sugerida: string
    // }

    // 2. Salvar tentativa NO SUPABASE (com dados validados pela API)
    await createAttempt({
      user_id: user.id,
      question_id: questionId,
      alternativa_escolhida: alternativa,
      correct: resultado.acertou,
      time_ms: timeSpent,
      stats_at_time: resultado.stats_globais_atualizadas
    });

    // 3. Se errou, criar flashcard
    if (!resultado.acertou) {
      const correctAlt = question.alternativas.find(a => a.letra === resultado.alternativa_correta)!;
      await createFlashcard({
        front: question.enunciado,
        back: `**Gabarito: ${resultado.alternativa_correta}**\n\n${correctAlt.texto}\n\n---\n\n${resultado.explicacao_rapida}`,
        type: 'traditional',
        source: `${question.banca} - ${question.orgao} (${question.ano})`,
        tags: [question.materia, question.assunto],
        metadata: {
          question_id: question.id,
          user_got_wrong: true,
          proxima_acao: resultado.proxima_acao_sugerida
        }
      });
    }

    // 4. Mostrar explicação
    setShowExplanation(true);
  };

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">{question.enunciado}</h2>

      <div className="space-y-2 mb-6">
        {question.alternativas.map(alt => (
          <button
            key={alt.letra}
            onClick={() => handleAnswer(alt.letra)}
            disabled={selectedAnswer !== null}
            className="w-full text-left p-4 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            <span className="font-bold">{alt.letra})</span> {alt.texto}
          </button>
        ))}
      </div>

      {showExplanation && (
        <div className="border-t pt-6">
          {isLoadingExplanation ? (
            <div>Gerando explicação com IA...</div>
          ) : (
            <>
              <h3 className="text-xl font-bold mb-4">Explicação Personalizada</h3>
              <div className="prose max-w-none">
                <ReactMarkdown>{explanation.explicacao}</ReactMarkdown>
              </div>

              <h4 className="text-lg font-bold mt-6 mb-2">Conceitos-chave:</h4>
              <ul className="list-disc pl-5">
                {explanation.conceitos_chave.map(c => <li key={c}>{c}</li>)}
              </ul>

              <h4 className="text-lg font-bold mt-6 mb-2">Questões similares:</h4>
              <ul className="space-y-2">
                {explanation.questoes_similares.map(q => (
                  <li key={q.id}>
                    <a href={`/questions/${q.id}`} className="text-blue-600 hover:underline">
                      {q.enunciado} ({q.banca} {q.ano})
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

---

### Fluxo Completo de Integração

```
1. User acessa /questions no App Next.js
   ↓
2. App chama API: GET /questoes/search?materia=direito_civil
   ↓
3. API retorna questões (Typesense)
   ↓
4. User clica em questão
   ↓
5. App chama API: GET /questoes/3440688
   App chama API: POST /stats/increment-view
   ↓
6. User responde (alternativa C)
   ↓
7. App chama API: POST /questoes/3440688/responder
   (valida resposta + atualiza stats globais atomicamente)
   ↓
8. API retorna: { acertou, alternativa_correta, stats_globais, explicacao_rapida }
   ↓
9. App salva NO SUPABASE: question_attempts (com dados validados pela API)
   ↓
10. Se errou, App cria flashcard NO SUPABASE (usando explicacao_rapida da API)
   ↓
11. User clica "Ver explicação detalhada"
   ↓
12. App busca contexto NO SUPABASE (weak_topics, recent_mistakes)
   ↓
13. App chama API: POST /ai/explain-question + user_context
   ↓
14. API processa (RAG + Claude)
   ↓
15. App exibe explicação + questões similares
```

---

## Roadmap

### Fase 1: Fundação (Semana 1-2)
- [ ] Setup FastAPI + PostgreSQL + pgvector
- [ ] CRUD básico de questões
- [ ] Deploy inicial (Railway/Render)
- [ ] Health check funcional

### Fase 2: Busca (Semana 3)
- [ ] Integração Typesense
- [ ] GET /questoes/search com filtros
- [ ] Importar 1M questões
- [ ] Latência < 200ms

### Fase 3: IA & RAG (Semana 4-5)
- [ ] BullMQ + Redis
- [ ] Gerar embeddings (OpenAI)
- [ ] POST /ai/semantic-search
- [ ] POST /ai/explain-question (Claude + RAG)
- [ ] 1M embeddings gerados

### Fase 4: Stats (Semana 6)
- [ ] POST /questoes/{id}/responder (validação + stats atômicos)
- [ ] GET /stats/global
- [ ] Job cron diário (recalcular stats)

### Fase 5: Storage (Semana 7)
- [ ] CloudFlare R2 setup
- [ ] POST /admin/upload-imagem
- [ ] Migrar imagens existentes

### Fase 6: Monitoring (Semana 8)
- [ ] Sentry (erros)
- [ ] Prometheus + Grafana (métricas)
- [ ] Logs estruturados (JSON)

### Fase 7: Performance (Semana 9)
- [ ] Cache Redis
- [ ] Rate limiting
- [ ] Otimizar queries

### Fase 8: Metadados (Semana 10)
- [ ] GET /metadata/materias
- [ ] GET /metadata/bancas
- [ ] Taxonomia completa

---

## Custos Estimados

### Infraestrutura (mensal)

| Serviço | Plano | Custo |
|---------|-------|-------|
| Railway/Render | Pro | $25 |
| PostgreSQL | Managed 25GB | $15 |
| Redis | Managed 1GB | $10 |
| CloudFlare R2 | 100GB | $1.50 |
| **TOTAL** | | **~$52/mês** |

### IA (por uso - 10k usuários)

| Serviço | Custo/unidade | Estimativa |
|---------|---------------|------------|
| OpenAI Embeddings | $0.02/1M tokens | $4 (inicial) |
| Claude Explicações | $0.016/explicação | $160/mês |
| **TOTAL** | | **~$164/mês** |

**Total geral: ~$216/mês** (10k usuários ativos)

**Receita potencial:** 10k × R$20/mês = R$200k/mês
**Margem:** 99.9%

---

## Conclusão

Esta especificação define uma API **stateless, escalável e IA-powered** para servir 1M+ questões.

**Próximos passos:**
1. Implementar Fase 1 (Fundação)
2. Testar integração com app
3. Iterar baseado em feedback

**Boa sorte! 🚀**
