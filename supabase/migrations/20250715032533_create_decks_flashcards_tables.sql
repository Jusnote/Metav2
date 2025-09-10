-- Create decks table
CREATE TABLE public.decks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  card_count INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#3B82F6'
);

-- Create flashcards table
CREATE TABLE public.flashcards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_reviewed TIMESTAMP WITH TIME ZONE,
  next_review TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  interval_days INTEGER NOT NULL DEFAULT 0,
  ease_factor DECIMAL NOT NULL DEFAULT 2.5,
  repetitions INTEGER NOT NULL DEFAULT 0,
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard', 'again')),
  
  -- Hierarchy fields
  parent_id UUID REFERENCES public.flashcards(id) ON DELETE CASCADE,
  child_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  level INTEGER NOT NULL DEFAULT 0,
  card_order INTEGER NOT NULL DEFAULT 0
);

-- Enable Row Level Security
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- Create policies for decks
CREATE POLICY "Users can view their own decks" 
ON public.decks 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own decks" 
ON public.decks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own decks" 
ON public.decks 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own decks" 
ON public.decks 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for flashcards
CREATE POLICY "Users can view their own flashcards" 
ON public.flashcards 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own flashcards" 
ON public.flashcards 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own flashcards" 
ON public.flashcards 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own flashcards" 
ON public.flashcards 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update deck card count
CREATE OR REPLACE FUNCTION public.update_deck_card_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.decks 
    SET card_count = card_count + 1 
    WHERE id = NEW.deck_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.decks 
    SET card_count = GREATEST(0, card_count - 1) 
    WHERE id = OLD.deck_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for card count
CREATE TRIGGER update_deck_card_count_on_insert
  AFTER INSERT ON public.flashcards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_deck_card_count();

CREATE TRIGGER update_deck_card_count_on_delete
  AFTER DELETE ON public.flashcards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_deck_card_count();

-- Create indexes for better performance
CREATE INDEX idx_flashcards_deck_id ON public.flashcards(deck_id);
CREATE INDEX idx_flashcards_user_id ON public.flashcards(user_id);
CREATE INDEX idx_flashcards_parent_id ON public.flashcards(parent_id);
CREATE INDEX idx_flashcards_next_review ON public.flashcards(next_review);
CREATE INDEX idx_decks_user_id ON public.decks(user_id);