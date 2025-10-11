# 🔍 Análise Completa - Tabelas Supabase

## 📊 Situação Atual das Tabelas

### ✅ **Tabela `documents`** - CORRETA (com problemas)

#### Estrutura Atual:
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled Document',
  content JSONB DEFAULT '{}',
  content_text TEXT NULL,          -- ✅ Existe
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  user_id UUID REFERENCES auth.users(id),
  is_favorite BOOLEAN,             -- ✅ Existe
  tags TEXT[],                     -- ✅ Existe
  subtopic_id UUID REFERENCES subtopics(id) -- ✅ Existe
);
```

#### ✅ **O Que Está Correto:**
1. ✅ Campo `subtopic_id` existe e tem FK para `subtopics(id)`
2. ✅ Campo `content_text` existe (para busca full-text)
3. ✅ Campos `is_favorite` e `tags` existem
4. ✅ Trigger `update_updated_at_column` configurado
5. ✅ RLS (Row Level Security) habilitado
6. ✅ Policies corretas (users só veem seus próprios docs)
7. ✅ Índice `idx_documents_subtopic_id` criado

#### ❌ **PROBLEMA CRÍTICO IDENTIFICADO:**

**Constraint UNIQUE no `subtopic_id`:**
```sql
ALTER TABLE documents
ADD CONSTRAINT unique_subtopic_document
UNIQUE (subtopic_id);
```

**⚠️ PROBLEMA:** Esta constraint impede múltiplos documentos por subtópico!

**Consequências:**
- ❌ Se tentar criar 2º documento para o mesmo subtópico → ERRO
- ❌ Nosso código atual cria automaticamente sem checar
- ❌ Vai quebrar na primeira vez que usuário tentar criar 2 resumos

---

### ✅ **Tabela `subtopics`** - CORRETA

```sql
CREATE TABLE subtopics (
  id UUID PRIMARY KEY,
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  average_time INTEGER DEFAULT 0,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  last_access TIMESTAMP            -- ✅ Adicionado depois
);
```

**Status:** Tudo OK! ✅

---

### ✅ **Tabela `topics`** - CORRETA

```sql
CREATE TABLE topics (
  id UUID PRIMARY KEY,
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  last_access TIMESTAMP            -- ✅ Adicionado depois
);
```

**Status:** Tudo OK! ✅

---

### ✅ **Tabela `units`** - CORRETA

```sql
CREATE TABLE units (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Status:** Tudo OK! ✅

---

## 🚨 PROBLEMAS ENCONTRADOS

### **PROBLEMA #1: Constraint UNIQUE no subtopic_id** (CRÍTICO)

**Localização:**
- Migration: `20250127000002_add_subtopic_id_to_documents.sql`
- Linha 9-11

**O problema:**
```sql
ALTER TABLE documents
ADD CONSTRAINT unique_subtopic_document
UNIQUE (subtopic_id);
```

**Por que é problemático:**
1. Impede múltiplos documentos por subtópico
2. Nosso código atual assume que pode haver múltiplos
3. Causa erro ao tentar criar 2º documento
4. Limita muito a funcionalidade

**Decisão necessária:**
- **Opção A:** Manter constraint (1 doc por subtópico) - Remover lógica de múltiplos
- **Opção B:** Remover constraint (múltiplos docs) - Mais flexível

---

### **PROBLEMA #2: Falta user_id em units/topics/subtopics** (MÉDIO)

**Situação Atual:**
```sql
-- RLS permite QUALQUER usuário autenticado ver/editar TUDO
CREATE POLICY "Users can manage their own units" ON units
  FOR ALL USING (auth.uid() IS NOT NULL);
```

**O problema:**
- Todos os usuários compartilham mesmas units/topics/subtopics
- Não há isolamento por usuário
- Usuário A pode ver/editar units do Usuário B

**É intencional?**
- Se é um "edital público" compartilhado → OK ✅
- Se cada usuário tem seu próprio edital → PROBLEMA ❌

---

### **PROBLEMA #3: content_text não é usado para busca** (MENOR)

**Situação:**
- Campo `content_text` existe na tabela
- Mas não há índice GiST/GIN para busca full-text
- Busca será lenta em muitos documentos

**Solução:**
```sql
-- Adicionar índice para busca full-text
CREATE INDEX idx_documents_content_text_search
ON documents USING gin(to_tsvector('portuguese', content_text));
```

---

## 🔧 AÇÕES NECESSÁRIAS

### **DECISÃO OBRIGATÓRIA:**

**Você precisa decidir sobre múltiplos documentos por subtópico:**

#### **Opção A: 1 Documento por Subtópico (Simples)**
```sql
-- Manter constraint atual
-- Não fazer nada no banco

-- Atualizar código:
// src/pages/DocumentsOrganizationPage.tsx
const handlePlaySubtopic = (subtopicId, subtopicTitle) => {
  const doc = getDocumentsBySubtopic(subtopicId)[0];

  if (doc) {
    // Abrir existente
    navigate(`/plate-editor?doc=${doc.id}...`);
  } else {
    // Criar novo (único)
    navigate(`/plate-editor?subtopic=${subtopicId}...`);
  }
};
```

**Vantagens:**
- ✅ Mais simples
- ✅ 1 resumo = 1 subtópico (relação clara)
- ✅ Não precisa modal de seleção

**Desvantagens:**
- ❌ Menos flexível
- ❌ Usuário não pode ter múltiplas versões

---

#### **Opção B: Múltiplos Documentos por Subtópico (Flexível)**
```sql
-- Migration para REMOVER constraint
ALTER TABLE documents
DROP CONSTRAINT IF EXISTS unique_subtopic_document;
```

**Vantagens:**
- ✅ Mais flexível
- ✅ Múltiplas versões/rascunhos
- ✅ Mais casos de uso

**Desvantagens:**
- ❌ Precisa modal de seleção (FASE 1.3)
- ❌ Mais complexo de gerenciar

---

### **AÇÃO RECOMENDADA:**

#### **Criar migration de correção:**

```sql
-- supabase/migrations/20250110000000_fix_documents_constraints.sql

-- REMOVER constraint UNIQUE (permite múltiplos docs)
ALTER TABLE documents
DROP CONSTRAINT IF EXISTS unique_subtopic_document;

-- Adicionar índice para busca full-text
CREATE INDEX IF NOT EXISTS idx_documents_content_text_search
ON documents USING gin(to_tsvector('portuguese', coalesce(content_text, '')));

-- Melhorar índice de subtopic_id (já existe, mas garantir)
CREATE INDEX IF NOT EXISTS idx_documents_subtopic_user
ON documents(subtopic_id, user_id);

-- Comentário atualizado
COMMENT ON COLUMN documents.subtopic_id IS 'Referência ao subtópico associado (pode ter múltiplos documentos)';
```

---

## 📋 CHECKLIST DE AÇÕES

### **URGENTE (Antes de usar em produção):**

- [ ] **DECIDIR:** 1 doc por subtópico OU múltiplos?
  - [ ] Se múltiplos → Criar migration removendo constraint
  - [ ] Se único → Atualizar código para não tentar criar 2º

- [ ] **TESTAR:** Criar 2 documentos no mesmo subtópico
  - Vai dar erro atualmente!

- [ ] **ADICIONAR:** Índice de busca full-text (se quiser busca)

### **IMPORTANTE (Segurança):**

- [ ] **VERIFICAR:** Units/Topics/Subtopics devem ser por usuário?
  - [ ] Se sim → Adicionar `user_id` e atualizar RLS
  - [ ] Se não (compartilhado) → Documentar isso

### **OPCIONAL (Performance):**

- [ ] Índice composto `(subtopic_id, user_id)` para queries rápidas
- [ ] Índice GIN para busca full-text em `content_text`

---

## 🎯 MINHA RECOMENDAÇÃO

### **Para Múltiplos Documentos (Recomendado):**

1. **Criar migration de correção:**
```bash
# Criar arquivo
touch supabase/migrations/20250110000000_fix_documents_constraints.sql
```

2. **Conteúdo da migration:**
```sql
-- Remover constraint UNIQUE para permitir múltiplos docs
ALTER TABLE documents
DROP CONSTRAINT IF EXISTS unique_subtopic_document;

-- Adicionar índice para busca (português)
CREATE INDEX IF NOT EXISTS idx_documents_content_text_search
ON documents USING gin(to_tsvector('portuguese', coalesce(content_text, '')));

-- Índice composto para queries otimizadas
CREATE INDEX IF NOT EXISTS idx_documents_subtopic_user
ON documents(subtopic_id, user_id)
WHERE subtopic_id IS NOT NULL;

-- Atualizar comentários
COMMENT ON COLUMN documents.subtopic_id IS
'Referência ao subtópico associado. Permite múltiplos documentos por subtópico.';
```

3. **Aplicar migration:**
```bash
# Local
supabase db reset

# Produção
supabase db push
```

4. **Implementar FASE 1.3 (Modal de seleção)** quando houver múltiplos

---

## 🔍 COMO VERIFICAR O BANCO ATUAL

```sql
-- Ver constraints na tabela documents
SELECT
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'documents';

-- Ver se já existe documento duplicado para subtópico
SELECT subtopic_id, COUNT(*) as doc_count
FROM documents
WHERE subtopic_id IS NOT NULL
GROUP BY subtopic_id
HAVING COUNT(*) > 1;
```

---

## ✅ RESUMO EXECUTIVO

**Situação Atual:**
- ✅ Tabelas criadas corretamente
- ✅ Campos necessários existem
- ⚠️ **PROBLEMA:** Constraint UNIQUE impede múltiplos docs
- ⚠️ **ATENÇÃO:** Vai dar erro ao criar 2º documento

**Ação Obrigatória:**
1. Decidir: 1 doc OU múltiplos por subtópico
2. Se múltiplos → Criar migration removendo constraint
3. Adicionar índice de busca (opcional mas recomendado)

**Recomendação:**
- Remover constraint (permitir múltiplos)
- Adicionar índice de busca
- Implementar modal de seleção (FASE 1.3)
