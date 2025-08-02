import { createClient } from '@supabase/supabase-js';
import type { Block } from '@/components/BlockBasedFlashcardEditor';
import type { Database } from '@/types/database';

// Cliente específico para drafts com tipos corretos
const SUPABASE_URL = "https://xmtleqquivcukwgdexhc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdGxlcXF1aXZjdWt3Z2RleGhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMjk5OTcsImV4cCI6MjA2ODgwNTk5N30.7_MFUfXszXysh0kFrezS_i5kjcnvMqKJZlhoCEsX58E";

const supabaseDrafts = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

export interface DeckDraft {
  id: string;
  deck_id: string;
  user_id: string;
  blocks_data: Block[];
  created_at: string;
  updated_at: string;
}

// Salvar rascunho
export async function saveDraftToDatabase(deckId: string, blocks: Block[]): Promise<void> {
  const { data: { user } } = await supabaseDrafts.auth.getUser();
  
  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  // Verificar se já existe um rascunho para este deck
  const { data: existingDraft } = await supabaseDrafts
    .from('deck_drafts')
    .select('id')
    .eq('deck_id', deckId)
    .eq('user_id', user.id)
    .single();

  if (existingDraft) {
    // Atualizar rascunho existente
    const { error } = await supabaseDrafts
      .from('deck_drafts')
      .update({
        blocks_data: blocks,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingDraft.id);

    if (error) {
      throw new Error(`Erro ao atualizar rascunho: ${error.message}`);
    }
  } else {
    // Criar novo rascunho
    const { error } = await supabaseDrafts
      .from('deck_drafts')
      .insert({
        deck_id: deckId,
        user_id: user.id,
        blocks_data: blocks
      });

    if (error) {
      throw new Error(`Erro ao criar rascunho: ${error.message}`);
    }
  }
}

// Carregar rascunho
export async function loadDraftFromDatabase(deckId: string): Promise<Block[] | null> {
  const { data: { user } } = await supabaseDrafts.auth.getUser();
  
  if (!user) {
    return null;
  }

  const { data, error } = await supabaseDrafts
    .from('deck_drafts')
    .select('blocks_data')
    .eq('deck_id', deckId)
    .eq('user_id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Nenhum rascunho encontrado
      return null;
    }
    throw new Error(`Erro ao carregar rascunho: ${error.message}`);
  }

  return data.blocks_data as Block[];
}

// Deletar rascunho
export async function deleteDraftFromDatabase(deckId: string): Promise<void> {
  const { data: { user } } = await supabaseDrafts.auth.getUser();
  
  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { error } = await supabaseDrafts
    .from('deck_drafts')
    .delete()
    .eq('deck_id', deckId)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(`Erro ao deletar rascunho: ${error.message}`);
  }
}