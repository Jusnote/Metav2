import { useCallback, Dispatch, SetStateAction } from 'react';

// Import the Block type from the component where it's defined
type BlockType = 'paragraph' | 'flashcard' | 'sub-flashcard' | 'title' | 'subtitle';
type FlashcardType = 'traditional' | 'word-hiding' | 'true-false';

interface Block {
  id: string;
  type: BlockType;
  content: string;
  order: number;
  flashcardType?: FlashcardType;
  flashcardData?: {
    id?: string;
    front: string;
    back: string;
    hiddenWords?: string[];
    explanation?: string;
  };
  isSubCard?: boolean;
  parentBlockId?: string;
  indentLevel?: number;
}

interface FlashcardHierarchy {
  createSubFlashcard: (parentId: string) => Promise<void>;
  getChildren: (parentId: string) => Block[];
  getParent: (childId: string) => Block | null;
  validateHierarchy: () => boolean;
}

export const useFlashcardHierarchy = (
  blocks: Block[], 
  setBlocks: Dispatch<SetStateAction<Block[]>>
): FlashcardHierarchy => {
  
  const createSubFlashcard = useCallback(async (parentId: string) => {
    // Lógica simplificada e focada apenas na hierarquia
    const parentBlock = blocks.find(block => block.id === parentId);
    if (!parentBlock) return;
    
    const newSubBlock: Block = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'paragraph',
      content: '',
      order: parentBlock.order + 0.1,
      isSubCard: true,
      parentBlockId: parentId,
      indentLevel: (parentBlock.indentLevel || 0) + 1
    };
    
    setBlocks(prevBlocks => {
      const updatedBlocks = [...prevBlocks, newSubBlock];
      return updatedBlocks.sort((a, b) => a.order - b.order);
    });
  }, [blocks, setBlocks]);
  
  const getChildren = useCallback((parentId: string): Block[] => {
    return blocks.filter(block => block.parentBlockId === parentId);
  }, [blocks]);
  
  const getParent = useCallback((childId: string): Block | null => {
    const childBlock = blocks.find(block => block.id === childId);
    if (!childBlock?.parentBlockId) return null;
    
    return blocks.find(block => block.id === childBlock.parentBlockId) || null;
  }, [blocks]);
  
  const validateHierarchy = useCallback((): boolean => {
    // Verifica se todos os sub-flashcards têm pais válidos
    const subCards = blocks.filter(block => block.isSubCard);
    
    for (const subCard of subCards) {
      if (!subCard.parentBlockId) return false;
      
      const parent = blocks.find(block => block.id === subCard.parentBlockId);
      if (!parent) return false;
      
      // Verifica se o pai não é também um sub-flashcard (evita hierarquias muito profundas)
      if (parent.isSubCard) return false;
    }
    
    return true;
  }, [blocks]);
  
  return { 
    createSubFlashcard, 
    getChildren, 
    getParent, 
    validateHierarchy 
  };
};