-- SCRIPT DE EMERGÊNCIA: Forçar remoção da constraint
-- Execute este SQL no Supabase Dashboard se a constraint ainda existir

-- 1. Verificar se constraint existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'unique_subtopic_document'
    ) THEN
        RAISE NOTICE 'CONSTRAINT ENCONTRADA! Removendo...';

        -- Remover a constraint
        ALTER TABLE documents DROP CONSTRAINT unique_subtopic_document;

        RAISE NOTICE 'CONSTRAINT REMOVIDA COM SUCESSO!';
    ELSE
        RAISE NOTICE 'Constraint não encontrada (já foi removida)';
    END IF;
END $$;

-- 2. Verificar novamente (deve retornar 0 linhas)
SELECT conname
FROM pg_constraint
WHERE conname = 'unique_subtopic_document';

-- 3. Ver documentos duplicados (se houver)
SELECT subtopic_id, COUNT(*) as total
FROM documents
WHERE subtopic_id IS NOT NULL
GROUP BY subtopic_id
HAVING COUNT(*) > 1;

-- 4. Adicionar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_documents_content_text_search
ON documents USING gin(to_tsvector('portuguese', coalesce(content_text, '')));

CREATE INDEX IF NOT EXISTS idx_documents_subtopic_user
ON documents(subtopic_id, user_id)
WHERE subtopic_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_updated_at
ON documents(updated_at DESC);

-- 5. Verificar índices criados
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'documents'
  AND indexname LIKE 'idx_documents%';
