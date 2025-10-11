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
