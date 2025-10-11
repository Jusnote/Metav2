# 🔍 Debug: Erro 409 ao Criar Documentos

## Status Atual

✅ Constraint UNIQUE em `subtopic_id` **já foi removida**
❌ Ainda recebendo erro 409 ao criar documentos

## Possíveis Causas do Erro 409

### 1. Índice UNIQUE (diferente de constraint)

Execute no Supabase SQL Editor:

```sql
-- Listar TODOS os índices da tabela documents
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'documents'
ORDER BY indexname;
```

**Procure por**: Qualquer índice com a palavra `UNIQUE` que envolva `subtopic_id`.

### 2. Triggers que podem estar bloqueando

Execute no Supabase SQL Editor:

```sql
-- Listar todos os triggers da tabela documents
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'documents'
ORDER BY trigger_name;
```

### 3. Testar INSERT direto no banco

Execute no Supabase SQL Editor:

```sql
-- Tentar criar um documento diretamente (substitua YOUR_USER_ID pelo seu user_id)
INSERT INTO documents (title, content, subtopic_id, user_id)
VALUES (
    'Teste Debug 409',
    '[]'::jsonb,
    '456d0343-c431-4f3a-8057-12afd9760c94',
    auth.uid()
)
RETURNING id, title, subtopic_id;
```

**Resultado esperado**: Deve criar o documento sem erro.

**Se der erro**: Copie a mensagem de erro completa e me envie.

### 4. Verificar se já existe documento "fantasma"

Execute no Supabase SQL Editor:

```sql
-- Buscar TODOS os documentos do subtópico (incluindo de outros usuários)
SELECT id, title, subtopic_id, user_id, created_at
FROM documents
WHERE subtopic_id = '456d0343-c431-4f3a-8057-12afd9760c94'
ORDER BY created_at DESC;
```

**Se retornar algum documento**: Pode ser que o cache do `useServerFirst` não esteja vendo por causa do filtro `user_id`.

### 5. Verificar políticas RLS

Execute no Supabase SQL Editor:

```sql
-- Listar todas as políticas RLS da tabela documents
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'documents'
ORDER BY policyname;
```

## Teste Rápido

Execute TODOS os comandos acima e me envie:

1. ✅ A lista de índices (query 1)
2. ✅ A lista de triggers (query 2)
3. ✅ O resultado do INSERT direto (query 3) - **Este é o mais importante!**
4. ✅ A lista de documentos existentes (query 4)
5. ✅ As políticas RLS (query 5)

Com essas informações, conseguirei identificar a causa exata do erro 409.
