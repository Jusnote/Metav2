-- ========================================
-- SCRIPT COMPLETO DE VERIFICAÇÃO DA TABELA DOCUMENTS
-- Execute TODO este script no Supabase SQL Editor
-- ========================================

-- 1. VERIFICAR SE EXISTEM MÚLTIPLAS TABELAS COM NOME "documents"
SELECT
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE tablename LIKE '%document%'
ORDER BY schemaname, tablename;

-- 2. VERIFICAR ESTRUTURA COMPLETA DA TABELA documents
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'documents'
ORDER BY ordinal_position;

-- 3. VERIFICAR TODAS AS CONSTRAINTS (não apenas UNIQUE)
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

-- 4. VERIFICAR TODOS OS ÍNDICES (incluindo UNIQUE)
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'documents'
ORDER BY indexname;

-- 5. VERIFICAR SE EXISTE CONSTRAINT UNIQUE EM subtopic_id ESPECIFICAMENTE
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'documents'::regclass
    AND contype = 'u'  -- UNIQUE constraints
    AND pg_get_constraintdef(oid) LIKE '%subtopic_id%';

-- 6. TESTAR INSERT DIRETO (vai dar erro se constraint existir)
-- IMPORTANTE: Substitua '456d0343-c431-4f3a-8057-12afd9760c94' pelo subtopic_id real que você está testando
DO $$
BEGIN
    -- Tentar inserir primeiro documento
    INSERT INTO documents (title, content, subtopic_id, user_id)
    VALUES (
        'Teste 1 - Verificação Constraint',
        '[]'::jsonb,
        '456d0343-c431-4f3a-8057-12afd9760c94',
        auth.uid()
    );

    RAISE NOTICE 'Primeiro documento inserido com sucesso!';

    -- Tentar inserir SEGUNDO documento com MESMO subtopic_id
    INSERT INTO documents (title, content, subtopic_id, user_id)
    VALUES (
        'Teste 2 - Verificação Constraint',
        '[]'::jsonb,
        '456d0343-c431-4f3a-8057-12afd9760c94',
        auth.uid()
    );

    RAISE NOTICE 'Segundo documento inserido com sucesso! ✅ CONSTRAINT NÃO EXISTE';

    -- Limpar documentos de teste
    DELETE FROM documents
    WHERE title IN ('Teste 1 - Verificação Constraint', 'Teste 2 - Verificação Constraint');

    RAISE NOTICE 'Documentos de teste removidos.';

EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION '❌ ERRO: Constraint UNIQUE ainda existe! Detalhes: %', SQLERRM;
    WHEN OTHERS THEN
        RAISE EXCEPTION '❌ ERRO inesperado: %', SQLERRM;
END $$;

-- 7. VERIFICAR TRIGGERS
SELECT
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'documents'
ORDER BY trigger_name;

-- 8. VERIFICAR POLÍTICAS RLS
SELECT
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'documents'
ORDER BY policyname;
