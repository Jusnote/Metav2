import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xmtleqquivcukwgdexhc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdGxlcXF1aXZjdWt3Z2RleGhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzIyOTk5NywiZXhwIjoyMDY4ODA1OTk3fQ.a-n50z1KmRa7JRoREBJKf3kSoXfU9U-t8G_PXnBFqDI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    // Test creating a new document with subtopic_id
    console.log('Testing document creation with subtopic_id...');
    
    const testDocument = {
      title: 'Teste de Documento com Subtopic',
      content: { root: { children: [{ children: [{ detail: 0, format: 0, mode: "normal", style: "", text: "Conteúdo de teste", type: "text", version: 1 }], direction: "ltr", format: "", indent: 0, type: "paragraph", version: 1 }], direction: "ltr", format: "", indent: 0, type: "root", version: 1 } },
      content_text: 'Conteúdo de teste',
      subtopic_id: '550e8400-e29b-41d4-a716-446655440010', // Membrane structure
      user_id: '0bdf404e-7529-42b2-ba37-6b3fe2b37185'
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('documents')
      .insert([testDocument])
      .select();
    
    if (insertError) {
      console.error('Error inserting document:', insertError);
    } else {
      console.log('Document inserted successfully:', insertData);
    }
    
    // Query all documents to see current state
    const { data: allDocs, error: queryError } = await supabase
      .from('documents')
      .select('id, title, subtopic_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (queryError) {
      console.error('Error querying documents:', queryError);
    } else {
      console.log('Recent documents:', allDocs);
    }
    
  } catch (err) {
    console.error('Connection test failed:', err);
  }
}

testConnection();