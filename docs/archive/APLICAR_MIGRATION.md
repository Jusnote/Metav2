# 🔧 Como Aplicar a Migration - Fix Documents Constraints

## 📋 O Que Esta Migration Faz

A migration `20250110000000_fix_documents_constraints.sql` corrige um problema crítico no banco de dados:

### **Mudanças:**
1. ✅ Remove constraint `UNIQUE(subtopic_id)` - Permite múltiplos documentos por subtópico
2. ✅ Adiciona índice GIN para busca full-text em português
3. ✅ Adiciona índice composto `(subtopic_id, user_id)` para queries rápidas
4. ✅ Adiciona índice de ordenação por `updated_at`
5. ✅ Atualiza comentários explicativos

---

## 🚀 Como Aplicar (Passo a Passo)

### **Opção 1: Supabase CLI (Recomendado)**

Se você tem o Supabase CLI instalado:

```bash
# 1. Verificar se está conectado ao projeto
supabase status

# 2. Aplicar migration ao banco local (desenvolvimento)
supabase db reset

# 3. OU aplicar somente esta migration
supabase db push

# 4. Para aplicar em produção
supabase db push --linked
```

---

### **Opção 2: Supabase Dashboard (Manual)**

Se você não tem o CLI instalado:

#### **Passo 1: Acessar o Supabase Dashboard**
1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **SQL Editor** (ícone de código na sidebar)

#### **Passo 2: Executar o SQL**
1. Click em **"New Query"**
2. Cole o conteúdo abaixo:

```sql
-- Migration para permitir múltiplos documentos por subtópico
-- Remove constraint UNIQUE e adiciona índices de performance

-- REMOVER constraint UNIQUE (permite múltiplos documentos por subtópico)
ALTER TABLE documents
DROP CONSTRAINT IF EXISTS unique_subtopic_document;

-- Adicionar índice GIN para busca full-text em português
CREATE INDEX IF NOT EXISTS idx_documents_content_text_search
ON documents USING gin(to_tsvector('portuguese', coalesce(content_text, '')));

-- Criar índice composto para queries otimizadas (subtopic_id + user_id)
CREATE INDEX IF NOT EXISTS idx_documents_subtopic_user
ON documents(subtopic_id, user_id)
WHERE subtopic_id IS NOT NULL;

-- Adicionar índice para ordenação por data de atualização
CREATE INDEX IF NOT EXISTS idx_documents_updated_at
ON documents(updated_at DESC);

-- Atualizar comentários explicativos
COMMENT ON COLUMN documents.subtopic_id IS
'Referência ao subtópico associado. Permite múltiplos documentos/resumos por subtópico para maior flexibilidade.';

COMMENT ON TABLE documents IS
'Tabela de documentos criados com Plate Editor. Cada documento pode estar vinculado a um subtópico (opcional) e permite múltiplas versões/rascunhos por subtópico.';
```

3. Click em **"Run"** ou pressione `Ctrl+Enter`
4. Verificar mensagem de sucesso

#### **Passo 3: Verificar**

Execute este SQL para confirmar:

```sql
-- Verificar se constraint foi removida
SELECT
    con.conname AS constraint_name,
    con.contype AS constraint_type
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'documents'
  AND con.conname = 'unique_subtopic_document';
-- Deve retornar 0 linhas se foi removida ✅

-- Verificar índices criados
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'documents'
  AND indexname LIKE 'idx_documents%';
-- Deve mostrar os novos índices ✅
```

---

### **Opção 3: psql (Linha de Comando)**

Se você tem acesso direto ao PostgreSQL:

```bash
# 1. Conectar ao banco
psql -h seu-host -U postgres -d seu-banco

# 2. Executar migration
\i supabase/migrations/20250110000000_fix_documents_constraints.sql

# 3. Verificar
SELECT * FROM pg_constraint WHERE conname = 'unique_subtopic_document';
```

---

## ✅ Como Verificar Se Funcionou

### **Teste 1: Criar múltiplos documentos**

```sql
-- Inserir 2 documentos no mesmo subtópico (deve funcionar agora!)
INSERT INTO documents (user_id, title, content, subtopic_id)
VALUES
  ('seu-user-id', 'Resumo 1', '{}', 'algum-subtopic-id'),
  ('seu-user-id', 'Resumo 2', '{}', 'algum-subtopic-id');

-- Se NÃO der erro → Sucesso! ✅
```

### **Teste 2: Verificar índices**

```sql
-- Ver índices criados
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE tablename = 'documents';

-- Deve aparecer:
-- idx_documents_content_text_search ✅
-- idx_documents_subtopic_user ✅
-- idx_documents_updated_at ✅
```

---

## 🐛 Troubleshooting

### **Erro: "constraint does not exist"**
- Não é problema! Significa que a constraint já tinha sido removida antes
- Comando `DROP CONSTRAINT IF EXISTS` é seguro

### **Erro: "index already exists"**
- Não é problema! Significa que o índice já existia
- Comando `CREATE INDEX IF NOT EXISTS` é seguro

### **Erro: "permission denied"**
- Você precisa ser admin/owner do banco
- Entre com usuário `postgres` ou equivalente

---

## 📊 Impacto da Migration

### **Performance:**
- ✅ Busca full-text será muito mais rápida (índice GIN)
- ✅ Queries por subtópico serão otimizadas (índice composto)
- ✅ Listagem de documentos recentes será rápida (índice updated_at)

### **Funcionalidade:**
- ✅ Permite criar múltiplos documentos/rascunhos por subtópico
- ✅ Usuário pode ter versões diferentes do mesmo resumo
- ✅ Mais flexibilidade de uso

### **Compatibilidade:**
- ✅ Não quebra dados existentes
- ✅ Código atual continua funcionando
- ✅ Apenas remove limitação artificial

---

## 🎯 Próximos Passos Após Aplicar

1. ✅ Testar criar 2 documentos no mesmo subtópico
2. ✅ Testar busca de documentos (vai ficar mais rápida)
3. ⏳ Implementar modal de seleção (FASE 1.3) quando usuário tiver múltiplos
4. ⏳ Implementar busca global (FASE 2.2) usando o novo índice

---

## ❓ Perguntas Frequentes

### **Q: Posso aplicar sem medo?**
A: Sim! A migration é segura e não quebra nada. Apenas remove uma limitação.

### **Q: Vai deletar meus documentos?**
A: Não! Nenhum dado é alterado, apenas constraints e índices.

### **Q: Preciso fazer backup antes?**
A: Recomendado sempre, mas esta migration é muito simples e segura.

### **Q: Preciso reiniciar a aplicação?**
A: Não! Mudanças são apenas no banco, código já está preparado.

### **Q: E se eu já tiver documentos duplicados?**
A: Impossível! A constraint atual impedia isso. Após remover, você poderá criar.

---

## 📞 Suporte

Se tiver problemas ao aplicar:

1. Verifique logs de erro do Supabase
2. Confirme permissões de admin
3. Teste queries de verificação acima
4. Entre em contato com suporte do Supabase se persistir

---

## ✅ Checklist Final

Após aplicar a migration, confirme:

- [ ] Constraint `unique_subtopic_document` foi removida
- [ ] Índice `idx_documents_content_text_search` foi criado
- [ ] Índice `idx_documents_subtopic_user` foi criado
- [ ] Índice `idx_documents_updated_at` foi criado
- [ ] Consegue criar 2 documentos no mesmo subtópico sem erro
- [ ] Aplicação continua funcionando normalmente

**Se todos os checkboxes estiverem ✅ → Migration aplicada com sucesso!** 🎉
