-- Adicionar coluna flashcard_id à tabela quick_notes
ALTER TABLE public.quick_notes 
ADD COLUMN flashcard_id UUID REFERENCES public.flashcards(id) ON DELETE SET NULL;

-- Adicionar índice para melhor performance
CREATE INDEX idx_quick_notes_flashcard_id ON public.quick_notes(flashcard_id);

-- Comentário para documentação
COMMENT ON COLUMN public.quick_notes.flashcard_id IS 'ID do flashcard vinculado a esta nota (se houver)';
