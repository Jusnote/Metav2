-- Migration to create notes table for user annotations
-- This table will store user notes/annotations for specific subtopics

-- Create notes table
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subtopic_id UUID NOT NULL REFERENCES public.subtopics(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_subtopic_id ON public.notes(subtopic_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON public.notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_user_subtopic ON public.notes(user_id, subtopic_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own notes
CREATE POLICY "Users can view their own notes" ON public.notes
    FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own notes
CREATE POLICY "Users can insert their own notes" ON public.notes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own notes
CREATE POLICY "Users can update their own notes" ON public.notes
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own notes
CREATE POLICY "Users can delete their own notes" ON public.notes
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at on notes table
CREATE TRIGGER handle_notes_updated_at
    BEFORE UPDATE ON public.notes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.notes IS 'User annotations/notes for specific subtopics';
COMMENT ON COLUMN public.notes.id IS 'Unique identifier for the note';
COMMENT ON COLUMN public.notes.user_id IS 'Reference to the user who created the note';
COMMENT ON COLUMN public.notes.subtopic_id IS 'Reference to the subtopic this note belongs to';
COMMENT ON COLUMN public.notes.content IS 'The actual note content/text';
COMMENT ON COLUMN public.notes.created_at IS 'Timestamp when the note was created';
COMMENT ON COLUMN public.notes.updated_at IS 'Timestamp when the note was last updated';