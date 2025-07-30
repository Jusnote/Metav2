
import { BlockBasedFlashcardEditor } from '@/components/BlockBasedFlashcardEditor';

interface FlashcardEditorProps {
  onSave: (front: string, back: string, type?: 'traditional' | 'word-hiding' | 'true-false', hiddenWordIndices?: number[], hiddenWords?: string[], explanation?: string, parentId?: string, deckId?: string) => Promise<string | null>;
  placeholder?: string;
  deckId?: string;
}

export function FlashcardEditor({ onSave, placeholder, deckId }: FlashcardEditorProps) {
  console.log("FlashcardEditor - onSave function:", typeof onSave);
  console.log("FlashcardEditor - rendering BlockBasedFlashcardEditor");
  
  return <BlockBasedFlashcardEditor onSave={onSave} placeholder={placeholder} deckId={deckId} />;
}
