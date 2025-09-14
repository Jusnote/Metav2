-- Add subtopic_id column to documents table
ALTER TABLE documents ADD COLUMN subtopic_id UUID REFERENCES subtopics(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_documents_subtopic_id ON documents(subtopic_id);

-- Update RLS policy to include subtopic_id access
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
CREATE POLICY "Users can view their own documents" ON documents
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own documents" ON documents;
CREATE POLICY "Users can insert their own documents" ON documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own documents" ON documents;
CREATE POLICY "Users can update their own documents" ON documents
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own documents" ON documents;
CREATE POLICY "Users can delete their own documents" ON documents
  FOR DELETE USING (auth.uid() = user_id);