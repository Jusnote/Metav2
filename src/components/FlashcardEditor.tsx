
import { BlockBasedFlashcardEditor } from '@/components/BlockBasedFlashcardEditor';

interface FlashcardEditorProps {
  onSave: (front: string, back: string, type?: 'traditional' | 'word-hiding' | 'true-false', hiddenWordIndices?: number[], hiddenWords?: string[], explanation?: string, parentId?: string, deckId?: string) => Promise<string | null>;
  onUpdateCard?: (cardId: string, front: string, back: string, explanation?: string, hiddenWords?: string[]) => Promise<void>;
  placeholder?: string;
  deckId?: string;
}

export function FlashcardEditor({ onSave, onUpdateCard, placeholder, deckId }: FlashcardEditorProps) {
  console.log("FlashcardEditor - onSave function:", typeof onSave);
  console.log("FlashcardEditor - onUpdateCard function:", typeof onUpdateCard);
  console.log("FlashcardEditor - rendering BlockBasedFlashcardEditor");
  
  return <BlockBasedFlashcardEditor onSave={onSave} onUpdateCard={onUpdateCard} placeholder={placeholder} deckId={deckId} />;
}
