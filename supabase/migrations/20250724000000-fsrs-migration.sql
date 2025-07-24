-- Migration to update flashcards table for FSRS algorithm
-- Remove old SuperMemo 2 fields and add FSRS fields

-- First, add new FSRS columns
ALTER TABLE public.flashcards 
ADD COLUMN IF NOT EXISTS difficulty_fsrs DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS stability DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS state INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS due TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS last_review_fsrs TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'traditional',
ADD COLUMN IF NOT EXISTS hidden_word_indices INTEGER[],
ADD COLUMN IF NOT EXISTS hidden_words TEXT[];

-- Update existing records to have proper FSRS defaults
UPDATE public.flashcards 
SET 
  difficulty_fsrs = 0,
  stability = 0,
  state = 0,
  due = COALESCE(next_review, now()),
  last_review_fsrs = last_reviewed,
  review_count = COALESCE(repetitions, 0),
  type = 'traditional'
WHERE difficulty_fsrs = 0;

-- Drop old SuperMemo 2 columns (after data migration)
-- We'll keep them for now to avoid data loss, but they should be removed in production
-- ALTER TABLE public.flashcards DROP COLUMN IF EXISTS interval_days;
-- ALTER TABLE public.flashcards DROP COLUMN IF EXISTS ease_factor;
-- ALTER TABLE public.flashcards DROP COLUMN IF EXISTS repetitions;

-- Update the difficulty column to be DOUBLE PRECISION instead of TEXT
-- First, add a new column with the correct type
ALTER TABLE public.flashcards 
ADD COLUMN IF NOT EXISTS difficulty_new DOUBLE PRECISION;

-- Migrate data from text difficulty to numeric (for existing records)
UPDATE public.flashcards 
SET difficulty_new = CASE 
  WHEN difficulty = 'easy' THEN 1.0
  WHEN difficulty = 'medium' THEN 5.0
  WHEN difficulty = 'hard' THEN 8.0
  WHEN difficulty = 'again' THEN 10.0
  ELSE 5.0
END
WHERE difficulty_new IS NULL;

-- Drop the old difficulty column and rename the new one
-- ALTER TABLE public.flashcards DROP COLUMN difficulty;
-- ALTER TABLE public.flashcards RENAME COLUMN difficulty_new TO difficulty;

-- For now, we'll use the new difficulty_fsrs column
ALTER TABLE public.flashcards 
ALTER COLUMN difficulty_fsrs SET NOT NULL;

-- Create indexes for better performance on FSRS fields
CREATE INDEX IF NOT EXISTS idx_flashcards_due ON public.flashcards(due);
CREATE INDEX IF NOT EXISTS idx_flashcards_state ON public.flashcards(state);
CREATE INDEX IF NOT EXISTS idx_flashcards_last_review_fsrs ON public.flashcards(last_review_fsrs);

-- Add comments to document the FSRS fields
COMMENT ON COLUMN public.flashcards.difficulty_fsrs IS 'FSRS difficulty value (double precision)';
COMMENT ON COLUMN public.flashcards.stability IS 'FSRS stability value (double precision)';
COMMENT ON COLUMN public.flashcards.state IS 'FSRS state (0=new, 1=learning, 2=review, 3=relearning)';
COMMENT ON COLUMN public.flashcards.due IS 'FSRS due date (timestamp)';
COMMENT ON COLUMN public.flashcards.last_review_fsrs IS 'FSRS last review date (timestamp)';
COMMENT ON COLUMN public.flashcards.review_count IS 'FSRS review count (integer)';

