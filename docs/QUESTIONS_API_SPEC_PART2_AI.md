# API Plataforma de Questões - Especificação Completa (Parte 2: IA & Jobs)

## Índice
- [Integração com IA](#integração-com-ia)
- [Jobs Assíncronos](#jobs-assíncronos)
- [Object Storage](#object-storage)

---

## Integração com IA

### OpenAI (Embeddings)

```python
from openai import AsyncOpenAI
import os

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

async def gerar_embedding(texto: str) -> list[float]:
    """
    Gera embedding para busca semântica usando OpenAI.

    Model: text-embedding-3-small
    Dimensions: 1536
    Cost: $0.02 / 1M tokens
    """
    response = await client.embeddings.create(
        model="text-embedding-3-small",
        input=texto,
        dimensions=1536
    )
    return response.data[0].embedding

# Uso: Gerar embedding ao importar questão
embedding = await gerar_embedding(questao.enunciado)
await db.execute(
    "UPDATE questoes SET embedding = $1 WHERE id = $2",
    [embedding, questao.id]
)
```

**Custos estimados:**
- 1M questões × ~200 tokens = 200M tokens
- **Total: ~$4 USD** para gerar todos os embeddings (uma vez)

---

### Claude 3.5 Sonnet (Explicações RAG)

```python
from anthropic import AsyncAnthropic

client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

async def explicar_questao_com_rag(
    questao: Questao,
    alternativa_escolhida: str,
    user_context: UserContext,
    questoes_similares: list[Questao]
) -> str:
    """
    Explica questão usando RAG + contexto do usuário.

    Model: claude-3-5-sonnet-20250929
    Cost: $3/1M input tokens, $15/1M output tokens
    Avg cost per explanation: ~$0.016 USD
    """

    # Construir contexto RAG
    contexto_rag = "\n\n".join([
        f"Questão similar {i+1}:\n{q.enunciado}\nGabarito: {q.gabarito}\n"
        for i, q in enumerate(questoes_similares)
    ])

    # Prompt engineering
    prompt = f"""Você é um professor experiente preparando alunos para concursos públicos.

CONTEXTO DO ALUNO:
- Dificuldade em: {', '.join(user_context.weak_topics)}
- Nível de aprendizado: {user_context.fsrs_state}
- Meta: {user_context.study_goal}
- Histórico recente de erros: {len(user_context.recent_mistakes)} questões erradas

QUESTÃO RESPONDIDA:
{questao.enunciado}

ALTERNATIVAS:
{format_alternativas(questao.alternativas)}

RESPOSTA DO ALUNO: Alternativa {alternativa_escolhida}
GABARITO CORRETO: Alternativa {questao.gabarito}

QUESTÕES SIMILARES DA BASE DE DADOS (para contexto adicional):
{contexto_rag}

INSTRUÇÕES:
1. Explique didaticamente por que a alternativa {alternativa_escolhida} está errada
2. Ensine o conceito jurídico correto de forma clara
3. Cite artigos de lei quando relevante
4. Considere as dificuldades específicas do aluno (especialmente {user_context.weak_topics[0] if user_context.weak_topics else 'conceitos básicos'})
5. Sugira como evitar esse erro em questões futuras
6. Use tom encorajador e motivacional
7. Formate em Markdown com seções claras (## Por que a alternativa X está errada, ## Conceito correto, ## Como evitar esse erro, etc)
8. Seja conciso mas completo (máximo 500 palavras)

Sua explicação:"""

    # Chamar Claude
    response = await client.messages.create(
        model="claude-3-5-sonnet-20250929",
        max_tokens=2048,
        temperature=0.7,
        messages=[{"role": "user", "content": prompt}]
    )

    return response.content[0].text
```

---

### Busca Semântica com pgvector

```python
async def buscar_similares_pgvector(
    embedding: list[float],
    limit: int = 5,
    threshold: float = 0.7,
    filters: dict = None
) -> list[Questao]:
    """
    Busca questões semanticamente similares usando pgvector.

    Args:
        embedding: Vetor de embeddings (1536 dims)
        limit: Número máximo de resultados
        threshold: Similaridade mínima (0-1)
        filters: Filtros adicionais (materia, ano_min, etc)

    Returns:
        Lista de questões ordenadas por similaridade
    """

    # Query base
    query = """
        SELECT
            id, enunciado, materia, assunto, banca, ano,
            1 - (embedding <=> $1) AS similarity
        FROM questoes
        WHERE embedding IS NOT NULL
        AND 1 - (embedding <=> $1) > $2
    """

    params = [embedding, threshold]
    param_count = 2

    # Adicionar filtros dinâmicos
    if filters:
        if filters.get('materia'):
            param_count += 1
            query += f" AND materia = ${param_count}"
            params.append(filters['materia'])

        if filters.get('ano_min'):
            param_count += 1
            query += f" AND ano >= ${param_count}"
            params.append(filters['ano_min'])

    # Ordenar por similaridade
    query += f" ORDER BY embedding <=> $1 LIMIT ${param_count + 1}"
    params.append(limit)

    # Executar query
    rows = await db.fetch_all(query, params)
    return [Questao(**row) for row in rows]
```

---

### Endpoint completo de explicação

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class UserContext(BaseModel):
    weak_topics: list[str] = []
    fsrs_state: str = "new"
    study_goal: str = ""
    recent_mistakes: list[int] = []
    difficulty_preference: str = "didatico"

class ExplainRequest(BaseModel):
    questao_id: int
    alternativa_escolhida: str
    user_context: UserContext

@app.post("/ai/explain-question")
async def explain_question(data: ExplainRequest):
    """
    Endpoint principal de explicação com IA + RAG.

    Fluxo:
    1. Buscar questão no banco
    2. Buscar questões similares (pgvector)
    3. Gerar explicação com Claude (RAG + contexto)
    4. Retornar explicação + sugestões
    """

    # 1. Buscar questão
    questao = await db.fetch_one(
        "SELECT * FROM questoes WHERE id = $1",
        [data.questao_id]
    )
    if not questao:
        raise HTTPException(404, "Questão não encontrada")

    # 2. Buscar questões similares (RAG)
    questoes_similares = await buscar_similares_pgvector(
        embedding=questao.embedding,
        limit=5,
        threshold=0.75
    )

    # 3. Gerar explicação com Claude
    explicacao = await explicar_questao_com_rag(
        questao=questao,
        alternativa_escolhida=data.alternativa_escolhida,
        user_context=data.user_context,
        questoes_similares=questoes_similares
    )

    # 4. Extrair conceitos-chave (regex simples)
    conceitos = extrair_conceitos(explicacao)

    # 5. Artigos relacionados (se houver)
    artigos = extrair_artigos_lei(explicacao)

    # 6. Dicas personalizadas baseadas no contexto
    dicas = gerar_dicas_personalizadas(data.user_context, questao)

    return {
        "questao_id": data.questao_id,
        "alternativa_escolhida": data.alternativa_escolhida,
        "alternativa_correta": questao.gabarito,
        "acertou": data.alternativa_escolhida == questao.gabarito,
        "explicacao": explicacao,
        "conceitos_chave": conceitos,
        "questoes_similares": [
            {
                "id": q.id,
                "enunciado": q.enunciado[:100] + "...",
                "similarity": round(q.similarity, 2),
                "banca": q.banca,
                "ano": q.ano
            }
            for q in questoes_similares
        ],
        "artigos_relacionados": artigos,
        "dicas_personalizadas": dicas
    }

def extrair_conceitos(texto: str) -> list[str]:
    """Extrai conceitos-chave da explicação"""
    import re
    # Padrão: palavras capitalizadas ou termos técnicos
    conceitos = re.findall(r'[A-Z][a-zà-ú]+(?: [A-Z][a-zà-ú]+)*', texto)
    return list(set(conceitos[:5]))  # Top 5 únicos

def extrair_artigos_lei(texto: str) -> list[str]:
    """Extrai referências a artigos de lei"""
    import re
    # Padrão: "Art. 123" ou "Artigo 123"
    artigos = re.findall(r'Art(?:igo)?\.?\s+\d+[^\n]*', texto)
    return list(set(artigos))

def gerar_dicas_personalizadas(
    user_context: UserContext,
    questao: Questao
) -> list[str]:
    """Gera dicas baseadas no histórico do usuário"""
    dicas = []

    # Dica 1: Baseada em tópicos fracos
    if questao.assunto in user_context.weak_topics:
        dicas.append(
            f"Você tem dificuldade em {questao.assunto}. "
            f"Recomendo revisar este conceito antes de continuar."
        )

    # Dica 2: Baseada em erros recentes
    if len(user_context.recent_mistakes) > 5:
        dicas.append(
            f"Você errou {len(user_context.recent_mistakes)} questões recentemente. "
            f"Considere revisar os conceitos básicos."
        )

    # Dica 3: Baseada na banca
    if questao.banca == "CESPE":
        dicas.append(
            "CESPE costuma cobrar muita interpretação. "
            "Leia com atenção cada palavra do enunciado."
        )

    return dicas[:3]  # Max 3 dicas
```

---

## Jobs Assíncronos

### BullMQ Configuration

```typescript
// queues/config.ts
import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

export const createQueue = (name: string) => {
  return new Queue(name, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: 1000,
      removeOnFail: 5000
    }
  });
};
```

---

### Fila de Embeddings

```typescript
// queues/embeddings.ts
import { createQueue } from './config';
import { Worker } from 'bullmq';
import { gerarEmbedding } from '../services/openai';
import { db } from '../db';

export const embeddingsQueue = createQueue('embeddings');

// Worker
const embeddingsWorker = new Worker(
  'embeddings',
  async (job) => {
    const { questao_id, enunciado } = job.data;

    // Gerar embedding via OpenAI
    const embedding = await gerarEmbedding(enunciado);

    // Salvar no Postgres
    await db.query(
      'UPDATE questoes SET embedding = $1, updated_at = NOW() WHERE id = $2',
      [embedding, questao_id]
    );

    // Atualizar progresso
    await job.updateProgress(100);

    return { questao_id, success: true };
  },
  {
    connection: redis,
    concurrency: 10,  // Processar 10 jobs em paralelo
    limiter: {
      max: 3000,  // OpenAI rate limit: 3000 RPM
      duration: 60000
    }
  }
);

embeddingsWorker.on('completed', (job) => {
  console.log(`✅ Embedding gerado para questão ${job.data.questao_id}`);
});

embeddingsWorker.on('failed', (job, err) => {
  console.error(
    `❌ Erro ao gerar embedding para questão ${job?.data?.questao_id}:`,
    err.message
  );
});

// Adicionar job único
export async function enqueueEmbedding(questao_id: number, enunciado: string) {
  await embeddingsQueue.add('generate', { questao_id, enunciado });
}

// Adicionar múltiplos jobs (bulk)
export async function enqueueEmbeddingsBulk(
  questoes: Array<{id: number, enunciado: string}>
) {
  const jobs = questoes.map(q => ({
    name: 'generate',
    data: { questao_id: q.id, enunciado: q.enunciado }
  }));

  await embeddingsQueue.addBulk(jobs);
}
```

---

### Fila de Estatísticas (Cron Diário)

```typescript
// queues/stats.ts
import { createQueue } from './config';
import { Worker } from 'bullmq';
import { db } from '../db';

export const statsQueue = createQueue('stats');

// Adicionar job recorrente (executa todo dia às 2 AM)
await statsQueue.add(
  'recalculate-global',
  {},
  {
    repeat: {
      pattern: '0 2 * * *',  // Cron: 2 AM todo dia
      tz: 'America/Sao_Paulo'
    }
  }
);

// Worker
const statsWorker = new Worker(
  'stats',
  async (job) => {
    console.log('🔄 Recalculando estatísticas globais...');

    // Recalcular taxa de acerto por matéria
    await db.query(`
      INSERT INTO estatisticas_globais (
        materia,
        taxa_acerto_media,
        questoes_respondidas,
        tempo_medio_ms
      )
      SELECT
        materia,
        AVG(taxa_acerto_global) as taxa_acerto_media,
        SUM(total_tentativas) as questoes_respondidas,
        AVG(tempo_medio_ms) as tempo_medio_ms
      FROM questoes
      WHERE total_tentativas > 0
      GROUP BY materia
      ON CONFLICT (materia) DO UPDATE SET
        taxa_acerto_media = EXCLUDED.taxa_acerto_media,
        questoes_respondidas = EXCLUDED.questoes_respondidas,
        tempo_medio_ms = EXCLUDED.tempo_medio_ms,
        updated_at = NOW()
    `);

    console.log('✅ Estatísticas globais recalculadas!');

    return { success: true, updated_at: new Date() };
  },
  { connection: redis }
);

statsWorker.on('completed', () => {
  console.log('📊 Job de estatísticas concluído');
});
```

---

### Fila de Sync Typesense

```typescript
// queues/sync.ts
import { createQueue } from './config';
import { Worker } from 'bullmq';
import Typesense from 'typesense';
import { db } from '../db';

export const syncQueue = createQueue('sync');

const typesenseClient = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST,
    port: 8108,
    protocol: 'http'
  }],
  apiKey: process.env.TYPESENSE_API_KEY
});

// Job recorrente (a cada 1 hora)
await syncQueue.add(
  'sync-typesense',
  {},
  {
    repeat: {
      pattern: '0 * * * *'  // A cada hora
    }
  }
);

// Worker
const syncWorker = new Worker(
  'sync',
  async (job) => {
    console.log('🔄 Sincronizando Postgres → Typesense...');

    // Buscar questões modificadas na última hora
    const questoes = await db.query(`
      SELECT
        id, enunciado, materia, assunto, banca, orgao,
        cargo, ano, dificuldade, views, taxa_acerto_global
      FROM questoes
      WHERE updated_at > NOW() - INTERVAL '1 hour'
    `);

    if (questoes.length === 0) {
      console.log('✅ Nenhuma questão modificada');
      return { synced: 0 };
    }

    // Upsert no Typesense
    const result = await typesenseClient
      .collections('questoes')
      .documents()
      .import(
        questoes.map(q => ({
          id: q.id.toString(),
          enunciado: q.enunciado,
          materia: q.materia,
          assunto: q.assunto || '',
          banca: q.banca || '',
          orgao: q.orgao || '',
          cargo: q.cargo || '',
          ano: q.ano || 0,
          dificuldade: q.dificuldade || '',
          views: q.views,
          taxa_acerto_global: q.taxa_acerto_global || 0
        })),
        { action: 'upsert' }
      );

    console.log(`✅ ${questoes.length} questões sincronizadas no Typesense`);

    return { synced: questoes.length, errors: 0 };
  },
  { connection: redis }
);

syncWorker.on('completed', (job, result) => {
  console.log(`🔄 Sync concluído: ${result.synced} questões`);
});
```

---

## Object Storage

### CloudFlare R2 Setup

```python
import boto3
from botocore.config import Config
import os

# Configurar cliente R2 (compatível com S3)
r2_client = boto3.client(
    's3',
    endpoint_url=f'https://{os.getenv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com',
    aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
    config=Config(signature_version='s3v4', region_name='auto')
)

BUCKET_NAME = 'questoes-bucket'
CDN_BASE_URL = 'https://cdn.questoes.com'
```

---

### Upload de Imagem

```python
from fastapi import UploadFile, HTTPException, Depends, Header
from PIL import Image
import io
import uuid

def require_api_key(x_api_key: str = Header(...)):
    """Middleware para validar API Key (admin endpoints)"""
    if x_api_key != os.getenv("API_KEY"):
        raise HTTPException(401, "Invalid API key")

@app.post("/admin/upload-imagem")
async def upload_imagem(
    questao_id: int,
    file: UploadFile,
    _: None = Depends(require_api_key)
):
    """
    Upload de imagem para questão.

    Features:
    - Validação de tipo/tamanho
    - Otimização automática
    - Conversão para WebP
    - CDN CloudFlare
    """

    # 1. Validar tipo de arquivo
    if not file.content_type.startswith('image/'):
        raise HTTPException(400, "Apenas imagens são permitidas")

    # 2. Validar tamanho (max 5MB)
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(400, "Imagem muito grande (max 5MB)")

    # 3. Otimizar imagem
    img = Image.open(io.BytesIO(content))

    # Redimensionar se muito grande
    max_width = 1200
    if img.width > max_width:
        ratio = max_width / img.width
        new_height = int(img.height * ratio)
        img = img.resize((max_width, new_height), Image.LANCZOS)

    # Converter para WebP (melhor compressão)
    output = io.BytesIO()
    img.save(output, format='WEBP', quality=85)
    output.seek(0)

    # 4. Gerar nome único
    filename = f"{uuid.uuid4()}.webp"
    key = f"questoes/{questao_id}/{filename}"

    # 5. Upload para R2
    r2_client.upload_fileobj(
        output,
        BUCKET_NAME,
        key,
        ExtraArgs={
            'ContentType': 'image/webp',
            'CacheControl': 'public, max-age=31536000'  # Cache 1 ano
        }
    )

    # 6. URL pública via CDN
    cdn_url = f"{CDN_BASE_URL}/{key}"

    # 7. Salvar URL no banco
    await db.execute(
        "UPDATE questoes SET imagem_url = $1, updated_at = NOW() WHERE id = $2",
        [cdn_url, questao_id]
    )

    return {
        "url": cdn_url,
        "questao_id": questao_id,
        "size_kb": len(output.getvalue()) // 1024
    }
```

---

### Download de PDF (URL assinada)

```python
@app.get("/provas/{banca}/{ano}/{prova_id}")
async def download_prova(banca: str, ano: int, prova_id: str):
    """
    Gera URL assinada para download de prova em PDF.

    URL válida por 1 hora.
    """

    key = f"provas/{banca}/{ano}/{prova_id}.pdf"

    # Verificar se arquivo existe
    try:
        r2_client.head_object(Bucket=BUCKET_NAME, Key=key)
    except:
        raise HTTPException(404, "Prova não encontrada")

    # Gerar URL assinada (válida por 1h)
    url = r2_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': BUCKET_NAME, 'Key': key},
        ExpiresIn=3600
    )

    return {
        "download_url": url,
        "expires_in_seconds": 3600
    }
```

---

### Migração de imagens existentes

```python
import asyncio
from pathlib import Path

async def migrar_imagens_para_r2(diretorio_origem: str):
    """
    Script para migrar imagens existentes para R2.

    Uso:
    python migrate_images.py /caminho/para/imagens
    """

    path = Path(diretorio_origem)
    imagens = list(path.glob("**/*.{jpg,jpeg,png,webp}"))

    print(f"📁 Encontradas {len(imagens)} imagens para migrar")

    for i, img_path in enumerate(imagens, 1):
        # Extrair questao_id do nome do arquivo
        questao_id = int(img_path.stem)

        # Ler arquivo
        with open(img_path, 'rb') as f:
            content = f.read()

        # Converter para WebP
        img = Image.open(io.BytesIO(content))
        output = io.BytesIO()
        img.save(output, format='WEBP', quality=85)
        output.seek(0)

        # Upload para R2
        key = f"questoes/{questao_id}/{img_path.stem}.webp"
        r2_client.upload_fileobj(
            output,
            BUCKET_NAME,
            key,
            ExtraArgs={'ContentType': 'image/webp'}
        )

        # Atualizar banco
        cdn_url = f"{CDN_BASE_URL}/{key}"
        await db.execute(
            "UPDATE questoes SET imagem_url = $1 WHERE id = $2",
            [cdn_url, questao_id]
        )

        print(f"✅ [{i}/{len(imagens)}] Migrada: {questao_id}")

        # Rate limit (evitar sobrecarregar R2)
        if i % 100 == 0:
            await asyncio.sleep(1)

    print(f"🎉 Migração concluída! {len(imagens)} imagens no R2")

# Executar
if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Uso: python migrate_images.py /caminho/para/imagens")
        sys.exit(1)

    asyncio.run(migrar_imagens_para_r2(sys.argv[1]))
```

---

**Continue na Parte 3:** Segurança, Monitoring, Deploy, Docker, Integração com App
