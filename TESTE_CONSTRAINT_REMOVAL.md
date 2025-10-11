# 🔧 Guia: Remover Constraint UNIQUE de subtopic_id

## Problema Identificado

O erro 409 (Conflict) ocorre porque existe uma constraint UNIQUE na coluna `subtopic_id` da tabela `documents`. Esta constraint foi criada na migration `20250127000002_add_subtopic_id_to_documents.sql` (linha 10-11):

```sql
ALTER TABLE documents
ADD CONSTRAINT unique_subtopic_document
UNIQUE (subtopic_id);
```

Esta constraint impede que você crie múltiplos documentos para o mesmo subtópico.

## Passos para Correção

### Passo 1: Verificar Constraints Atuais

Execute no **Supabase SQL Editor**:

```sql
SELECT tc.constraint_name, tc.constraint_type, ccu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'documents'
    AND tc.constraint_type = 'UNIQUE'
    AND ccu.column_name = 'subtopic_id';
```

**Resultado esperado**: Deve mostrar 1 ou mais constraints UNIQUE envolvendo `subtopic_id`.

### Passo 2: Executar Script de Remoção

Copie e execute **TODO** o conteúdo do arquivo:
```
supabase/migrations/20250110000001_force_remove_subtopic_unique.sql
```

No **Supabase SQL Editor**.

**Resultado esperado**:
```
NOTICE: Constraint unique_subtopic_document removida
NOTICE: Sucesso: Nenhuma constraint UNIQUE em subtopic_id encontrada
```

### Passo 3: Verificar Remoção

Execute novamente a query do Passo 1.

**Resultado esperado**: `Success. No rows returned` (nenhuma constraint UNIQUE em subtopic_id)

### Passo 4: Testar Criação de Múltiplos Documentos

Execute no **Supabase SQL Editor**:

```sql
-- Inserir 2 documentos com o MESMO subtopic_id para testar
INSERT INTO documents (title, content, subtopic_id, user_id)
VALUES
  ('Teste 1', '[]'::jsonb, '456d0343-c431-4f3a-8057-12afd9760c94', auth.uid()),
  ('Teste 2', '[]'::jsonb, '456d0343-c431-4f3a-8057-12afd9760c94', auth.uid());
```

**Resultado esperado**: `Success. 2 rows added.`

Se der erro 409 ou qualquer constraint violation, significa que a constraint ainda existe.

### Passo 5: Limpar Documentos de Teste

```sql
-- Remover documentos de teste criados no Passo 4
DELETE FROM documents
WHERE title IN ('Teste 1', 'Teste 2')
  AND subtopic_id = '456d0343-c431-4f3a-8057-12afd9760c94';
```

### Passo 6: Testar na Aplicação

1. Reinicie o servidor Next.js (`Ctrl+C` e `npm run dev`)
2. Abra `/documents-organization`
3. Clique no botão "Play" do subtópico "OI"
4. Deve criar um novo documento sem erro 409
5. Volte para `/documents-organization`
6. Clique novamente no botão "Play" do subtópico "OI"
7. Deve abrir o documento mais recente (ou criar outro, dependendo da lógica)

## Troubleshooting

### Se ainda der erro 409 após executar a migration:

Execute este comando para **forçar** a remoção manual:

```sql
-- Remover constraint pelo nome específico
ALTER TABLE documents DROP CONSTRAINT IF EXISTS unique_subtopic_document;

-- Verificar se foi removida
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'documents'
  AND constraint_type = 'UNIQUE'
  AND constraint_name LIKE '%subtopic%';
```

### Se der erro de permissão:

Certifique-se de estar executando como **administrador do projeto** no Supabase Dashboard.

### Se a constraint não aparecer na lista:

Execute este comando mais abrangente:

```sql
-- Listar TODAS as constraints da tabela documents
SELECT
    tc.constraint_name,
    tc.constraint_type,
    STRING_AGG(ccu.column_name, ', ') AS columns
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'documents'
GROUP BY tc.constraint_name, tc.constraint_type
ORDER BY tc.constraint_type, tc.constraint_name;
```

Procure por qualquer constraint que envolva `subtopic_id`.

## Explicação Técnica

O problema ocorreu porque:

1. **Migration 20250127000002**: Criou constraint `unique_subtopic_document UNIQUE (subtopic_id)`
2. **Migration 20250110000000**: Tentou remover com `DROP CONSTRAINT IF EXISTS unique_subtopic_document`
3. **Problema**: A constraint pode ter um nome diferente no banco de dados (ex: `documents_subtopic_id_key`)

O novo script (`20250110000001_force_remove_subtopic_unique.sql`) usa um loop dinâmico que:
- Busca **todas** as constraints UNIQUE que envolvem `subtopic_id`
- Remove cada uma usando `DROP CONSTRAINT` com o nome real
- Verifica se a remoção foi bem-sucedida
- Lança erro se ainda existir alguma constraint

## Resultado Final

Após executar corretamente, você poderá:
✅ Criar múltiplos documentos para o mesmo subtópico
✅ Não mais receber erro 409 ao criar documentos
✅ Ter uma relação 1:N entre subtópicos e documentos (um subtópico pode ter vários documentos)
