-- Create documents table for Lexical editor content
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Document',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_text TEXT, -- For search purposes
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- Enable Row Level Security
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Create policies for documents
CREATE POLICY "Users can view their own documents" 
ON public.documents 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own documents" 
ON public.documents 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents" 
ON public.documents 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents" 
ON public.documents 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates on documents
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to extract text content from Lexical JSON
CREATE OR REPLACE FUNCTION public.extract_text_from_lexical(content JSONB)
RETURNS TEXT AS $$
DECLARE
  result TEXT := '';
  node JSONB;
BEGIN
  -- Extract text from Lexical editor state
  IF content ? 'root' AND content->'root' ? 'children' THEN
    FOR node IN SELECT jsonb_array_elements(content->'root'->'children')
    LOOP
      IF node ? 'children' THEN
        -- Handle paragraph nodes with children
        SELECT string_agg(child->>'text', '') INTO result
        FROM jsonb_array_elements(node->'children') AS child
        WHERE child ? 'text';
      ELSIF node ? 'text' THEN
        -- Handle direct text nodes
        result := result || (node->>'text');
      END IF;
    END LOOP;
  END IF;
  
  RETURN COALESCE(result, '');
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update content_text when content changes
CREATE OR REPLACE FUNCTION public.update_document_content_text()
RETURNS TRIGGER AS $$
BEGIN
  NEW.content_text = public.extract_text_from_lexical(NEW.content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_document_content_text_trigger
BEFORE INSERT OR UPDATE OF content ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_document_content_text();

-- Create indexes for better performance
CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_documents_created_at ON public.documents(created_at DESC);
CREATE INDEX idx_documents_updated_at ON public.documents(updated_at DESC);
CREATE INDEX idx_documents_is_favorite ON public.documents(is_favorite) WHERE is_favorite = true;
CREATE INDEX idx_documents_content_text ON public.documents USING gin(to_tsvector('english', content_text));
CREATE INDEX idx_documents_tags ON public.documents USING gin(tags);

-- Add comments to document the table structure
COMMENT ON TABLE public.documents IS 'Stores Lexical editor documents for users';
COMMENT ON COLUMN public.documents.content IS 'Lexical editor state as JSONB';
COMMENT ON COLUMN public.documents.content_text IS 'Plain text extracted from Lexical content for search';
COMMENT ON COLUMN public.documents.tags IS 'Array of tags for document organization';
COMMENT ON COLUMN public.documents.is_favorite IS 'Whether the document is marked as favorite';