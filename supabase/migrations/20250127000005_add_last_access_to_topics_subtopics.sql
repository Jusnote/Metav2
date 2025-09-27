-- Add last_access field to topics and subtopics tables

-- Add last_access to topics table
ALTER TABLE topics 
ADD COLUMN last_access TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add last_access to subtopics table
ALTER TABLE subtopics 
ADD COLUMN last_access TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes for better performance on last_access queries
CREATE INDEX idx_topics_last_access ON topics(last_access);
CREATE INDEX idx_subtopics_last_access ON subtopics(last_access);

-- Create function to update last_access automatically
CREATE OR REPLACE FUNCTION update_last_access()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_access = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update last_access on UPDATE
CREATE TRIGGER trigger_topics_update_last_access
    BEFORE UPDATE ON topics
    FOR EACH ROW
    EXECUTE FUNCTION update_last_access();

CREATE TRIGGER trigger_subtopics_update_last_access
    BEFORE UPDATE ON subtopics
    FOR EACH ROW
    EXECUTE FUNCTION update_last_access();

-- Update existing records to have current timestamp
UPDATE topics SET last_access = NOW() WHERE last_access IS NULL;
UPDATE subtopics SET last_access = NOW() WHERE last_access IS NULL;