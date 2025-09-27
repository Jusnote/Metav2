-- Add topic_id to notes table to allow linking notes to both topics and subtopics

-- Add topic_id column to notes table
ALTER TABLE public.notes 
ADD COLUMN topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE;

-- Create index for topic_id
CREATE INDEX IF NOT EXISTS idx_notes_topic_id ON public.notes(topic_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_topic ON public.notes(user_id, topic_id);

-- Add constraint to ensure a note is linked to either a topic OR a subtopic (but not both)
ALTER TABLE public.notes 
ADD CONSTRAINT check_topic_or_subtopic 
CHECK (
    (topic_id IS NOT NULL AND subtopic_id IS NULL) OR 
    (topic_id IS NULL AND subtopic_id IS NOT NULL)
);

-- Update the existing constraint on subtopic_id to allow NULL
ALTER TABLE public.notes 
ALTER COLUMN subtopic_id DROP NOT NULL;

-- Update RLS policies to include topic_id access
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can insert their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;

-- Create new RLS policies that work with both topic_id and subtopic_id
CREATE POLICY "Users can view their own notes" ON public.notes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes" ON public.notes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" ON public.notes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" ON public.notes
    FOR DELETE USING (auth.uid() = user_id);