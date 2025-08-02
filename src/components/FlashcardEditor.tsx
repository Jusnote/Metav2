
import { BlockBasedFlashcardEditor, type FlashcardType } from '@/components/BlockBasedFlashcardEditor';
import { saveDraftToDatabase, loadDraftFromDatabase } from '@/integrations/supabase/drafts';

interface FlashcardEditorProps {
  onSave: (front: string, back: string, type?: FlashcardType, hiddenWordIndices?: number[], hiddenWords?: string[], explanation?: string, parentId?: string, deckId?: string) => Promise<string | null>;
  onUpdateCard?: (cardId: string, front: string, back: string, explanation?: string, hiddenWords?: string[]) => Promise<void>;
  onDeleteCard?: (cardId: string, deleteOption?: 'cascade' | 'promote') => Promise<void>;
  placeholder?: string;
  deckId?: string;
}

export function FlashcardEditor({ onSave, onUpdateCard, onDeleteCard, placeholder, deckId }: FlashcardEditorProps) {
  return (
    <BlockBasedFlashcardEditor
      onSave={onSave}
      onUpdateCard={onUpdateCard}
      onDeleteCard={onDeleteCard}
      onSaveDraft={saveDraftToDatabase}
      onLoadDraft={loadDraftFromDatabase}
      placeholder={placeholder}
      deckId={deckId}
    />
  );
}
