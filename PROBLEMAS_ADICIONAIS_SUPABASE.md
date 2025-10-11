# 🔍 Análise dos Problemas Adicionais - Supabase

## ✅ **PROBLEMA #2: Falta user_id** - JÁ RESOLVIDO (Parcialmente)

### **Situação Atual:**

#### ✅ **No Banco de Dados (Supabase):**
```sql
-- Migration 20250127000004_add_user_id_and_fields.sql
ALTER TABLE units ADD COLUMN user_id UUID;
ALTER TABLE topics ADD COLUMN user_id UUID;
ALTER TABLE subtopics ADD COLUMN user_id UUID;

-- RLS atualizado corretamente
CREATE POLICY "Users can manage their own units" ON units
  FOR ALL USING (auth.uid() = user_id);
```

**Status:** ✅ Campos existem no banco!

#### ❌ **No Código (useUnitsManager.ts):**

**PROBLEMA:** O código **NÃO está enviando** o `user_id` ao criar/atualizar!

**Linha 137-145 (addUnit):**
```typescript
const { data: unitData, error: unitError } = await supabase
  .from('units')
  .insert({
    title: title,
    subject: subject,
    total_chapters: 0
    // ❌ FALTANDO: user_id: user.id
  })
  .select()
  .single();
```

**Consequências:**
- ❌ Units/Topics/Subtopics são criados com `user_id = NULL`
- ❌ RLS vai **bloquear** porque `auth.uid() = NULL` → FALSE
- ❌ Usuário não consegue ver o que criou!

---

## 🔧 **PROBLEMA #3: Busca Full-Text** - RESOLVIDO na Migration

### **Situação:**

#### ✅ **Já Corrigido:**
A migration `20250110000000_fix_documents_constraints.sql` já adiciona:

```sql
CREATE INDEX IF NOT EXISTS idx_documents_content_text_search
ON documents USING gin(to_tsvector('portuguese', coalesce(content_text, '')));
```

**Status:** ✅ Será corrigido ao aplicar a migration!

---

## 🚨 **AÇÃO NECESSÁRIA:**

### **Problema Crítico: user_id não está sendo enviado**

Preciso corrigir o `useUnitsManager.ts` em **3 lugares:**

1. **addUnit()** - Linha ~137
2. **addTopic()** - Verificar
3. **addSubtopic()** - Verificar

---

## 💡 **Solução Proposta:**

### **1. Corrigir addUnit:**

```typescript
const addUnit = useCallback(async (title: string, subject: string = 'Biologia e Bioquímica') => {
  if (!user) {
    console.error('User not authenticated');
    return null;
  }

  try {
    const { data: unitData, error: unitError } = await supabase
      .from('units')
      .insert({
        title: title,
        subject: subject,
        total_chapters: 0,
        user_id: user.id  // ✅ ADICIONAR
      })
      .select()
      .single();

    if (unitError) {
      console.error('Error creating unit in database:', unitError);
      return null;
    }

    // Resto do código...
  } catch (error) {
    console.error('Error in addUnit:', error);
    return null;
  }
}, [user]); // ✅ ADICIONAR user na dependência
```

### **2. Corrigir addTopic:**

```typescript
const addTopic = useCallback(async (unitId: string, title: string) => {
  if (!user) {
    console.error('User not authenticated');
    return null;
  }

  try {
    const { data: topicData, error: topicError } = await supabase
      .from('topics')
      .insert({
        unit_id: unitId,
        title: title,
        total_aulas: 0,
        user_id: user.id  // ✅ ADICIONAR
      })
      .select()
      .single();

    // Resto...
  } catch (error) {
    console.error('Error in addTopic:', error);
    return null;
  }
}, [user]); // ✅ ADICIONAR user
```

### **3. Corrigir addSubtopic:**

```typescript
const addSubtopic = useCallback(async (unitId: string, topicId: string, title: string) => {
  if (!user) {
    console.error('User not authenticated');
    return null;
  }

  try {
    const { data: subtopicData, error: subtopicError } = await supabase
      .from('subtopics')
      .insert({
        topic_id: topicId,
        title: title,
        average_time: 0,
        status: 'not-started',
        tempo: '0min',
        user_id: user.id  // ✅ ADICIONAR
      })
      .select()
      .single();

    // Resto...
  } catch (error) {
    console.error('Error in addSubtopic:', error);
    return null;
  }
}, [user]); // ✅ ADICIONAR user
```

### **4. Corrigir loadUnitsFromDatabase:**

```typescript
const loadUnitsFromDatabase = useCallback(async () => {
  if (!user) {
    return;
  }

  setIsLoading(true);
  try {
    const { data: unitsData, error: unitsError } = await supabase
      .from('units')
      .select(`
        *,
        topics (
          *,
          subtopics (*)
        )
      `)
      .eq('user_id', user.id)  // ✅ ADICIONAR FILTRO
      .order('created_at', { ascending: true })
      .order('created_at', { foreignTable: 'topics', ascending: true })
      .order('created_at', { foreignTable: 'topics.subtopics', ascending: true });

    // Resto...
  } catch (error) {
    console.error('Error loading units:', error);
  }
}, [user]);
```

---

## 🎯 **Resumo das Correções Necessárias:**

### **useUnitsManager.ts - 4 funções para corrigir:**

| Função | Linha Aprox | Correção |
|--------|-------------|----------|
| `addUnit` | ~137 | Adicionar `user_id: user.id` no insert |
| `addTopic` | ~200 | Adicionar `user_id: user.id` no insert |
| `addSubtopic` | ~260 | Adicionar `user_id: user.id` no insert |
| `loadUnitsFromDatabase` | ~62 | Adicionar `.eq('user_id', user.id)` |

### **Impacto:**
- ✅ Units/Topics/Subtopics serão criados com dono correto
- ✅ RLS vai funcionar (usuários só veem seus próprios dados)
- ✅ Isolamento entre usuários garantido
- ✅ Segurança aprimorada

---

## 📋 **Checklist de Ações:**

### **Obrigatório (Antes de Produção):**
- [ ] Corrigir `addUnit()` para enviar `user_id`
- [ ] Corrigir `addTopic()` para enviar `user_id`
- [ ] Corrigir `addSubtopic()` para enviar `user_id`
- [ ] Corrigir `loadUnitsFromDatabase()` para filtrar por `user_id`
- [ ] Adicionar validação `if (!user)` em todas as funções
- [ ] Adicionar `user` nas dependências dos callbacks

### **Já Resolvido (Migration):**
- ✅ Índice de busca full-text criado
- ✅ Índices de performance adicionados

### **Opcional (Melhorias):**
- [ ] Adicionar tratamento de erro melhor
- [ ] Adicionar loading states
- [ ] Adicionar retry logic

---

## 🐛 **Como Testar Se Está Correto:**

### **Antes da Correção:**
```sql
-- Ver units sem user_id (PROBLEMA!)
SELECT id, title, user_id FROM units WHERE user_id IS NULL;
-- Deve retornar registros com user_id NULL ❌
```

### **Depois da Correção:**
```sql
-- Todas units devem ter user_id
SELECT id, title, user_id FROM units WHERE user_id IS NULL;
-- Deve retornar 0 linhas ✅

-- Cada usuário só vê seus próprios dados
SELECT COUNT(*) FROM units WHERE user_id = 'user-id-aqui';
-- Deve retornar apenas contagem dos dados deste usuário ✅
```

---

## ⚠️ **IMPORTANTE:**

**Dados Existentes:**
- Se já existem units/topics/subtopics no banco com `user_id = NULL`
- Eles **não aparecerão** para ninguém após corrigir RLS
- Precisará fazer migração de dados (opcional)

**Migration de Dados (se necessário):**
```sql
-- Atribuir todos os dados existentes a um usuário específico
UPDATE units SET user_id = 'user-id-do-admin' WHERE user_id IS NULL;
UPDATE topics SET user_id = 'user-id-do-admin' WHERE user_id IS NULL;
UPDATE subtopics SET user_id = 'user-id-do-admin' WHERE user_id IS NULL;
```

---

## ✅ **Conclusão:**

### **Problema #2 (user_id):**
- ✅ Banco: Correto (campos existem)
- ❌ Código: Incorreto (não envia user_id)
- 🔧 **AÇÃO:** Corrigir useUnitsManager.ts

### **Problema #3 (busca):**
- ✅ Resolvido na migration
- ✅ Índice será criado ao aplicar migration
- ✅ Nenhuma ação adicional necessária

**Quer que eu corrija o `useUnitsManager.ts` agora?**
