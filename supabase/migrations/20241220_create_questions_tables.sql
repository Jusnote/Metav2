-- Criar tabela para armazenar perguntas do estudo dirigido
CREATE TABLE IF NOT EXISTS public.study_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id TEXT NOT NULL, -- ID do documento (pode ser URL ou identificador único)
    section_index INTEGER NOT NULL, -- Índice da seção H1 (0, 1, 2...)
    section_title TEXT NOT NULL, -- Título da seção H1
    question_type TEXT NOT NULL CHECK (question_type IN ('multiple', 'boolean', 'text')),
    question_text TEXT NOT NULL,
    options JSONB, -- Array de opções para múltipla escolha
    correct_answer JSONB NOT NULL, -- Resposta correta (string, number, boolean)
    explanation TEXT, -- Explicação opcional
    points INTEGER DEFAULT 10, -- Pontuação da questão
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_study_questions_document_id ON public.study_questions(document_id);
CREATE INDEX IF NOT EXISTS idx_study_questions_section ON public.study_questions(document_id, section_index);

-- Criar trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_study_questions_updated_at 
    BEFORE UPDATE ON public.study_questions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.study_questions ENABLE ROW LEVEL SECURITY;

-- Política para permitir acesso público (por enquanto - depois pode ser restrito por usuário)
CREATE POLICY "Allow public access to study questions" ON public.study_questions
    FOR ALL USING (true);

-- Comentários para documentação
COMMENT ON TABLE public.study_questions IS 'Armazena perguntas do sistema de estudo dirigido';
COMMENT ON COLUMN public.study_questions.document_id IS 'Identificador único do documento (URL ou ID)';
COMMENT ON COLUMN public.study_questions.section_index IS 'Índice da seção H1 no documento (0-based)';
COMMENT ON COLUMN public.study_questions.question_type IS 'Tipo da pergunta: multiple, boolean, ou text';
COMMENT ON COLUMN public.study_questions.options IS 'Array JSON com opções para múltipla escolha';
COMMENT ON COLUMN public.study_questions.correct_answer IS 'Resposta correta em formato JSON';

