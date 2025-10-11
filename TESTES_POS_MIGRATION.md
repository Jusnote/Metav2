# ✅ Testes Pós-Migration - Validação Completa

## 🎯 Objetivo

Verificar se todas as correções estão funcionando corretamente após aplicar a migration.

---

## 📋 **TESTE 1: Verificar Migration Aplicada**

### **No Supabase Dashboard → SQL Editor:**

```sql
-- 1. Verificar se constraint foi removida (deve retornar 0 linhas)
SELECT conname
FROM pg_constraint
WHERE conname = 'unique_subtopic_document';
```

**Resultado esperado:** 0 linhas ✅

```sql
-- 2. Verificar índices criados (deve retornar 3 linhas)
SELECT indexname
FROM pg_indexes
WHERE tablename = 'documents'
  AND indexname IN (
    'idx_documents_content_text_search',
    'idx_documents_subtopic_user',
    'idx_documents_updated_at'
  );
```

**Resultado esperado:** 3 linhas ✅

---

## 📋 **TESTE 2: Testar Múltiplos Documentos**

### **Objetivo:** Verificar se pode criar 2+ documentos no mesmo subtópico

### **Via Aplicação:**

1. Acesse `/documents-organization`
2. Selecione um subtópico
3. Click no botão "Documento" 📄
4. Editor abre → Digite algo → Auto-save
5. **Volte** para Documents Organization
6. Selecione o **mesmo subtópico** novamente
7. Click "Documento" novamente
8. **Deve abrir o documento existente** (mais recente)

### **Teste Manual no SQL (Opcional):**

```sql
-- Criar 2 documentos no mesmo subtópico
INSERT INTO documents (user_id, title, content, subtopic_id)
VALUES
  (auth.uid(), 'Teste Doc 1', '[]'::jsonb, 'algum-subtopic-id'),
  (auth.uid(), 'Teste Doc 2', '[]'::jsonb, 'algum-subtopic-id');

-- Verificar (deve retornar 2 linhas)
SELECT id, title, subtopic_id
FROM documents
WHERE subtopic_id = 'algum-subtopic-id';
```

**Resultado esperado:** Sem erro, 2 documentos criados ✅

---

## 📋 **TESTE 3: Verificar user_id Sendo Salvo**

### **Via Aplicação:**

1. Acesse `/documents-organization`
2. **Crie uma nova Unit** (botão "+")
3. **Crie um novo Topic** dentro da unit
4. **Crie um novo Subtopic** dentro do topic

### **Verificar no SQL:**

```sql
-- Ver units criadas (deve ter user_id preenchido)
SELECT id, title, user_id, created_at
FROM units
ORDER BY created_at DESC
LIMIT 5;

-- Ver topics criados (deve ter user_id preenchido)
SELECT id, title, user_id, created_at
FROM topics
ORDER BY created_at DESC
LIMIT 5;

-- Ver subtopics criados (deve ter user_id preenchido)
SELECT id, title, user_id, created_at
FROM subtopics
ORDER BY created_at DESC
LIMIT 5;
```

**Resultado esperado:** Todos com `user_id` preenchido (não NULL) ✅

---

## 📋 **TESTE 4: Isolamento de Usuários**

### **Objetivo:** Verificar se cada usuário só vê seus próprios dados

### **Teste com 2 usuários:**

1. **Usuário A:** Crie uma unit chamada "Unit A"
2. **Logout** e faça login como **Usuário B**
3. **Usuário B:** Crie uma unit chamada "Unit B"
4. Verifique se:
   - ✅ Usuário A vê apenas "Unit A"
   - ✅ Usuário B vê apenas "Unit B"
   - ❌ Nenhum vê a unit do outro

### **Verificar no SQL:**

```sql
-- Ver contagem por usuário
SELECT user_id, COUNT(*) as total_units
FROM units
GROUP BY user_id;
```

**Resultado esperado:** Cada usuário tem contagem correta ✅

---

## 📋 **TESTE 5: Fluxo Completo de Documento**

### **Teste Completo do Sistema:**

1. **Criar Hierarquia:**
   - Acesse `/documents-organization`
   - Crie: Unit → Topic → Subtopic

2. **Criar Documento:**
   - Click no botão "Documento" do subtópico
   - Editor abre com título: "Resumo: {Nome do Subtópico}"
   - Digite algum conteúdo
   - Veja indicador: "Salvando..." → "Salvo" ✅

3. **Verificar Documento:**
   ```sql
   SELECT id, title, subtopic_id, user_id, updated_at
   FROM documents
   ORDER BY updated_at DESC
   LIMIT 1;
   ```
   - ✅ `title` correto
   - ✅ `subtopic_id` preenchido
   - ✅ `user_id` preenchido
   - ✅ `content` com dados do Plate

4. **Acessar Documento Recente:**
   - Vá para outra página
   - Olhe na **Sidebar** → Seção "Recentes"
   - Documento deve aparecer
   - Click → Abre editor direto ✅

5. **Editar Documento:**
   - Faça alterações no conteúdo
   - Auto-save deve funcionar
   - Indicador mostra status

6. **Criar 2º Documento no Mesmo Subtópico:**
   - Volte para Documents Organization
   - Mesmo subtópico → Click "Documento"
   - **Deve abrir o documento existente (mais recente)**

---

## 📋 **TESTE 6: Busca Full-Text (Preparação)**

### **Objetivo:** Verificar se índice de busca está funcionando

```sql
-- Criar alguns documentos com conteúdo
INSERT INTO documents (user_id, title, content, content_text)
VALUES
  (auth.uid(), 'Doc sobre React', '[]'::jsonb, 'React é uma biblioteca JavaScript'),
  (auth.uid(), 'Doc sobre Vue', '[]'::jsonb, 'Vue é um framework JavaScript'),
  (auth.uid(), 'Doc sobre Angular', '[]'::jsonb, 'Angular é um framework TypeScript');

-- Testar busca (deve ser rápida)
EXPLAIN ANALYZE
SELECT id, title, ts_rank(to_tsvector('portuguese', content_text), query) AS rank
FROM documents, to_tsquery('portuguese', 'react') query
WHERE to_tsvector('portuguese', content_text) @@ query
ORDER BY rank DESC;
```

**Resultado esperado:**
- Busca retorna "Doc sobre React"
- `EXPLAIN ANALYZE` mostra uso do índice GIN ✅

---

## 📋 **TESTE 7: Performance de Queries**

### **Verificar se índices estão sendo usados:**

```sql
-- Query por subtópico (deve usar índice)
EXPLAIN ANALYZE
SELECT * FROM documents
WHERE subtopic_id = 'algum-id'
  AND user_id = auth.uid();

-- Query por data (deve usar índice)
EXPLAIN ANALYZE
SELECT * FROM documents
WHERE user_id = auth.uid()
ORDER BY updated_at DESC
LIMIT 10;
```

**Resultado esperado:**
- Plano de execução mostra "Index Scan" ✅
- Não mostra "Seq Scan" (scan sequencial é lento) ✅

---

## ✅ **Checklist Final de Validação**

Marque cada teste conforme for completando:

### **Migration:**
- [ ] Constraint `unique_subtopic_document` foi removida
- [ ] Índice `idx_documents_content_text_search` criado
- [ ] Índice `idx_documents_subtopic_user` criado
- [ ] Índice `idx_documents_updated_at` criado

### **Funcionalidade:**
- [ ] Pode criar múltiplos documentos no mesmo subtópico
- [ ] Units criadas têm `user_id` preenchido
- [ ] Topics criados têm `user_id` preenchido
- [ ] Subtopics criados têm `user_id` preenchido
- [ ] Documentos criados têm `subtopic_id` vinculado

### **Segurança:**
- [ ] Usuário A não vê dados do Usuário B
- [ ] RLS está funcionando corretamente
- [ ] Queries filtram por `user_id` automaticamente

### **UX:**
- [ ] Auto-save funciona (indicador visual)
- [ ] Documentos recentes aparecem na sidebar
- [ ] Breadcrumb mostra hierarquia correta
- [ ] Botão "Voltar" retorna para lugar correto

### **Performance:**
- [ ] Queries usam índices (verificar EXPLAIN)
- [ ] Busca full-text é rápida
- [ ] Carregamento de documentos é instantâneo

---

## 🐛 **Troubleshooting**

### **Se units não aparecem:**
```sql
-- Verificar se RLS está bloqueando
SELECT * FROM units; -- Sem filtro (deve dar erro ou retornar vazio se RLS estrito)

-- Ver units com user_id NULL (problema!)
SELECT COUNT(*) FROM units WHERE user_id IS NULL;
```

### **Se documento não salva:**
- Verificar console do navegador (F12)
- Ver erros do Supabase
- Confirmar que usuário está autenticado

### **Se documentos recentes não aparecem:**
- Verificar se `updated_at` está sendo atualizado
- Confirmar que hook `usePlateDocuments` está carregando

---

## 🎯 **Resultado Esperado Final**

Se **TODOS** os testes passarem:

✅ Sistema 100% funcional
✅ Migration aplicada corretamente
✅ Isolamento de usuários garantido
✅ Múltiplos documentos por subtópico
✅ Performance otimizada
✅ Pronto para produção!

---

## 📞 **Se Algo Falhar**

1. Anotar qual teste falhou
2. Verificar mensagens de erro
3. Consultar logs do Supabase
4. Revisar código do `useUnitsManager.ts`
5. Confirmar que migration foi aplicada

---

## 🎉 **Próximos Passos Após Testes**

Se tudo passou:

1. ✅ Sistema está pronto!
2. ⏳ Opcional: Implementar FASE 1.3 (Modal de seleção de documentos)
3. ⏳ Opcional: Implementar FASE 2.2 (Busca global no header)
4. ⏳ Opcional: Implementar FASE 3 (Página `/my-documents`)

**Recomendação:** Use o sistema normalmente e monitore por alguns dias antes de implementar features adicionais.
