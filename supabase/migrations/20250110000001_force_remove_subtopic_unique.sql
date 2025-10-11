-- Script para remover FORÇADAMENTE todas as constraints UNIQUE em subtopic_id da tabela documents
-- Este script deve ser executado manualmente no Supabase SQL Editor

-- 1. Listar todas as constraints UNIQUE relacionadas a subtopic_id
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Loop através de todas as constraints UNIQUE da tabela documents que envolvem subtopic_id
    FOR constraint_name IN
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'documents'
            AND tc.constraint_type = 'UNIQUE'
            AND ccu.column_name = 'subtopic_id'
    LOOP
        -- Remover a constraint
        EXECUTE format('ALTER TABLE documents DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Constraint % removida', constraint_name;
    END LOOP;
END $$;

-- 2. Verificar se ainda existem constraints UNIQUE em subtopic_id
DO $$
DECLARE
    constraint_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'documents'
        AND tc.constraint_type = 'UNIQUE'
        AND ccu.column_name = 'subtopic_id';

    IF constraint_count > 0 THEN
        RAISE EXCEPTION 'Ainda existem % constraints UNIQUE em subtopic_id!', constraint_count;
    ELSE
        RAISE NOTICE 'Sucesso: Nenhuma constraint UNIQUE em subtopic_id encontrada';
    END IF;
END $$;

-- 3. Garantir que o índice básico ainda existe (não é UNIQUE)
CREATE INDEX IF NOT EXISTS idx_documents_subtopic_id ON documents(subtopic_id);

-- 4. Atualizar comentários para refletir nova relação 1:N (um subtópico pode ter múltiplos documentos)
COMMENT ON COLUMN documents.subtopic_id IS 'Referência ao subtópico associado ao documento (relação 1:N - um subtópico pode ter múltiplos documentos)';
