-- Migração para adicionar índice e constraint ao campo subtopic_id existente
-- (O campo subtopic_id já existe na tabela documents)

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_documents_subtopic_id ON documents(subtopic_id);

-- Garantir que cada subtópico tenha no máximo 1 documento (relação 1:1)
ALTER TABLE documents 
ADD CONSTRAINT unique_subtopic_document 
UNIQUE (subtopic_id);

-- Comentário explicativo
COMMENT ON COLUMN documents.subtopic_id IS 'Referência ao subtópico associado ao documento (relação 1:1)';
COMMENT ON CONSTRAINT unique_subtopic_document ON documents IS 'Garante que cada subtópico tenha apenas um documento/resumo';