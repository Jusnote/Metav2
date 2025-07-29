import { useState, useCallback, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, EyeOff, Check, Plus, X, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Tipos de bloco
type BlockType = 'paragraph' | 'flashcard' | 'sub-flashcard' | 'title' | 'subtitle';
type FlashcardType = 'traditional' | 'word-hiding' | 'true-false';

interface Block {
  id: string;
  type: BlockType;
  content: string;
  order: number;
  flashcardType?: FlashcardType;
  flashcardData?: {
    id?: string; // Adicionado para armazenar o ID do Supabase
    front: string;
    back: string;
    hiddenWords?: string[];
    explanation?: string;
  };
  // Novos campos para hierarquia
  isSubCard?: boolean;
  parentBlockId?: string;
  indentLevel?: number;
}

interface BlockBasedFlashcardEditorProps {
  onSave: (front: string, back: string, type?: FlashcardType, hiddenWordIndices?: number[], hiddenWords?: string[], explanation?: string, parentId?: string, deckId?: string) => Promise<string | null>;
  placeholder?: string;
  deckId?: string;
}

// Componente de bloco individual
interface BlockComponentProps {
  block: Block;
  isActive: boolean;
  isPendingFlashcard?: FlashcardType | null;
  onUpdate: (id: string, content: string) => void;
  onFocus: (id: string) => void;
  onKeyDown: (e: React.KeyboardEvent, blockId: string) => void;
  onConvertToFlashcard: (blockId: string, type: FlashcardType) => void;
  onCreateSubFlashcard: (blockId: string) => void;
  flashcardsWithSubOption: string[];
}

function BlockComponent({
  block,
  isActive,
  isPendingFlashcard,
  onUpdate,
  onFocus,
  onKeyDown,
  onConvertToFlashcard,
  onCreateSubFlashcard,
  flashcardsWithSubOption
}: BlockComponentProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = '0px';
      textarea.style.height = Math.max(textarea.scrollHeight, 16) + 'px';
    }
  }, [block.content]);

  // Focus no textarea quando o bloco fica ativo
  useEffect(() => {
    if (isActive && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isActive]);

  if (block.type === 'flashcard' && block.flashcardData) {
    return (
      <div className="group relative">
        {/* Barra lateral indicadora de flashcard */}
        <div className={cn(
          "absolute left-0 top-0 w-1 h-full rounded-full z-10",
          block.flashcardType === 'traditional' && "bg-blue-500",
          block.flashcardType === 'word-hiding' && "bg-amber-500",
          block.flashcardType === 'true-false' && "bg-green-500"
        )} />
        
        <Card className="ml-4 p-3 bg-gradient-to-r from-primary/5 to-secondary/5 border-l-4 border-l-primary">
          <div className="space-y-1">
            <div className="text-sm font-medium text-primary">
              {block.flashcardType === 'traditional' && 'Flashcard Tradicional'}
              {block.flashcardType === 'word-hiding' && 'Ocultação de Palavras'}
              {block.flashcardType === 'true-false' && 'Verdadeiro/Falso'}
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Frente:</span> {block.flashcardData.front}
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Verso:</span> {block.flashcardData.back}
            </div>
            {block.flashcardData.hiddenWords && block.flashcardData.hiddenWords.length > 0 && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Palavras ocultas:</span> {block.flashcardData.hiddenWords.join(', ')}
              </div>
            )}
            {block.flashcardData.explanation && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Explicação:</span> {block.flashcardData.explanation}
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn(
      "group relative min-h-0",
      // Visual para sub-flashcards
      block.isSubCard && "ml-8 pl-4 relative"
    )}>
      {/* Bolinha azul indicadora de sub-flashcard */}
      {block.isSubCard && (
        <div className="absolute -left-6 top-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
          <div className="w-2 h-2 bg-white rounded-full"></div>
        </div>
      )}
      
      {/* Linha conectora sutil */}
      {block.isSubCard && (
        <div className="absolute -left-4 top-0 bottom-0 w-px bg-blue-300/40"></div>
      )}
      
      {/* Barrinha lateral dinâmica - aparece quando clica nos ícones ou quando há flashcard salvo */}
      {(isPendingFlashcard || (block.content.includes(' → ') && !block.flashcardData)) && (
        <div className={cn(
          "absolute left-0 top-0 w-1 h-full rounded-full transition-all duration-300 ease-out z-10",
          // Para flashcards pendentes (semitransparente)
          isPendingFlashcard && isPendingFlashcard === 'traditional' && "bg-blue-400 opacity-80",
          isPendingFlashcard && isPendingFlashcard === 'word-hiding' && "bg-amber-400 opacity-80",
          isPendingFlashcard && isPendingFlashcard === 'true-false' && "bg-green-400 opacity-80",
          // Para flashcards salvos como texto (opacidade total)
          !isPendingFlashcard && block.content.includes(' → ') && "bg-blue-500 opacity-100"
        )} />
      )}
      
      {/* Botões flutuantes verticais - 3 botões originais */}
      {isActive && 
       block.type === 'paragraph' && 
       block.content.trim() && 
       !block.content.includes(' → ') && 
       !flashcardsWithSubOption.includes(block.id) && (
        <div className="absolute -right-16 top-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onConvertToFlashcard(block.id, 'traditional')}
            className="h-8 w-8 p-0 bg-background shadow-sm hover:bg-blue-50 hover:border-blue-300"
            title="Converter para Flashcard Tradicional"
          >
            <FileText className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onConvertToFlashcard(block.id, 'word-hiding')}
            className="h-8 w-8 p-0 bg-background shadow-sm hover:bg-amber-50 hover:border-amber-300"
            title="Converter para Ocultação de Palavras"
          >
            <EyeOff className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onConvertToFlashcard(block.id, 'true-false')}
            className="h-8 w-8 p-0 bg-background shadow-sm hover:bg-green-50 hover:border-green-300"
            title="Converter para Verdadeiro/Falso"
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {/* Botão de sub-flashcard - aparece APENAS quando um tipo foi selecionado */}
      {isActive && flashcardsWithSubOption.includes(block.id) && (
        <div className="absolute -right-16 top-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCreateSubFlashcard(block.id)}
            className="h-8 w-8 p-0 bg-background shadow-sm hover:bg-blue-50 hover:border-blue-300"
            title="Criar Sub-Flashcard"
          >
            <Link2 className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <textarea
        ref={textareaRef}
        data-block-id={block.id}
        value={block.content}
        onChange={(e) => onUpdate(block.id, e.target.value)}
        onFocus={() => onFocus(block.id)}
        onKeyDown={(e) => onKeyDown(e, block.id)}
        placeholder="Digite seu texto aqui..."
        className={cn(
          "w-full border-none bg-transparent resize-none overflow-hidden",
          "focus:outline-none focus:ring-0 text-foreground",
          "placeholder:text-muted-foreground/50",
          isActive && "ring-2 ring-primary/20 rounded-md",
          "p-0 m-0 leading-tight block",
          (isPendingFlashcard || block.content.includes(' → ')) && "pl-4" // adicionar padding quando há barrinha
        )}
        style={{ 
          height: 'auto',
          minHeight: '1.2em',
          lineHeight: '1.2',
          paddingTop: '0px',
          paddingBottom: '0px',
          marginTop: '0px',
          marginBottom: '0px',
          display: 'block'
        }}
      />
    </div>
  );
}

export function BlockBasedFlashcardEditor({ onSave, placeholder, deckId }: BlockBasedFlashcardEditorProps) {
  const generateBlockId = () => `block-${Date.now()}-${Math.random()}`;
  const getStorageKey = () => `flashcard-editor-blocks-${deckId || 'default'}`;
  
  // Função para carregar estado salvo
  const loadSavedState = useCallback((): Block[] => {
    try {
      const saved = localStorage.getItem(getStorageKey());
      if (saved) {
        const parsedBlocks = JSON.parse(saved);
        console.log('Carregando estado salvo:', parsedBlocks);
        return parsedBlocks;
      }
    } catch (error) {
      console.error('Erro ao carregar estado salvo:', error);
    }
    
    // Estado inicial se não houver nada salvo
    return [{ 
      id: generateBlockId(), 
      type: 'paragraph', 
      content: '', 
      order: 0 
    }];
  }, [deckId]);

  const [blocks, setBlocks] = useState<Block[]>(loadSavedState);
  const [activeBlockId, setActiveBlockId] = useState<string>(() => {
    const initialBlocks = loadSavedState();
    return initialBlocks[0]?.id || generateBlockId();
  });
  const [selectedText, setSelectedText] = useState('');
  const [pendingFlashcardType, setPendingFlashcardType] = useState<{blockId: string, type: FlashcardType} | null>(null);
  const [pendingWordHiding, setPendingWordHiding] = useState<{blockId: string, words: string[]} | null>(null);
  const [pendingTrueFalse, setPendingTrueFalse] = useState<{blockId: string, statement: string} | null>(null);
  
  // Novos estados para sub-flashcards
  const [flashcardsWithSubOption, setFlashcardsWithSubOption] = useState<string[]>([]);
  const [activeParentForSub, setActiveParentForSub] = useState<string | null>(null);

  // Função para salvar estado automaticamente
  const saveState = useCallback((blocksToSave: Block[]) => {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(blocksToSave));
      console.log('Estado salvo automaticamente:', blocksToSave);
    } catch (error) {
      console.error('Erro ao salvar estado:', error);
    }
  }, [deckId]);

  // Salvar automaticamente sempre que os blocos mudarem
  useEffect(() => {
    saveState(blocks);
  }, [blocks, saveState]);

  // Limpar estado quando mudar de deck
  useEffect(() => {
    const newBlocks = loadSavedState();
    setBlocks(newBlocks);
    setActiveBlockId(newBlocks[0]?.id || generateBlockId());
  }, [deckId, loadSavedState]);

  const updateBlock = useCallback((id: string, content: string) => {
    setBlocks(prev => {
      const updated = prev.map(block => 
        block.id === id ? { ...block, content } : block
      );
      return updated;
    });
  }, []);

  const addNewBlock = useCallback((afterBlockId: string) => {
    const currentBlock = blocks.find(b => b.id === afterBlockId);
    if (!currentBlock) return;

    const newBlock: Block = {
      id: generateBlockId(),
      type: 'paragraph',
      content: '',
      order: currentBlock.order + 1
    };

    setBlocks(prev => {
      const updatedBlocks = prev.map(block => 
        block.order > currentBlock.order 
          ? { ...block, order: block.order + 1 }
          : block
      );
      const newBlocks = [...updatedBlocks, newBlock].sort((a, b) => a.order - b.order);
      return newBlocks;
    });

    setActiveBlockId(newBlock.id);
  }, [blocks]);

  const convertToFlashcard = useCallback((blockId: string, flashcardType: FlashcardType) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block || !block.content.trim()) return;

    // Definir tipo de flashcard pendente para mostrar a barrinha
    setPendingFlashcardType({ blockId, type: flashcardType });

    // NOVO: Adicionar à lista de flashcards que podem ter sub-flashcard
    setFlashcardsWithSubOption(prev => {
      if (!prev.includes(blockId)) {
        return [...prev, blockId];
      }
      return prev;
    });

    if (flashcardType === 'traditional') {
      // Para flashcard tradicional, apenas inserir o símbolo " → " ao final do texto
      const currentContent = block.content;
      const newContent = currentContent + ' → ';
      
      // Atualizar o conteúdo do bloco sem converter ainda
      updateBlock(blockId, newContent);
      
      // Focar no textarea após inserir o símbolo
      setTimeout(() => {
        const textarea = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLTextAreaElement;
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(newContent.length, newContent.length);
        }
      }, 0);
      
    } else if (flashcardType === 'word-hiding') {
      setPendingWordHiding({ blockId, words: [] });
    } else if (flashcardType === 'true-false') {
      setPendingTrueFalse({ blockId, statement: block.content });
    }
  }, [blocks, updateBlock]);

  const updateFlashcardBlock = useCallback((blockId: string, flashcardType: FlashcardType, flashcardData: any) => {
    setBlocks(prev => {
      const updated = prev.map(block => 
        block.id === blockId 
          ? { 
              ...block, 
              type: 'flashcard' as BlockType, 
              flashcardType,
              flashcardData 
            }
          : block
      );
      return updated;
    });
  }, []);

  // Função para criar sub-flashcard
  const createSubFlashcard = useCallback(async (parentBlockId: string) => {
    const parentBlock = blocks.find(b => b.id === parentBlockId);
    if (!parentBlock) {
      console.error("Bloco pai não encontrado para o ID:", parentBlockId);
      return;
    }

    console.log("Parent Block para sub-flashcard:", parentBlock);

    let actualParentId: string | undefined = undefined;

    // Tentar salvar o flashcard pai se ele ainda não foi salvo como um flashcard completo
    if (!parentBlock.flashcardData && parentBlock.content.includes(" → ")) {
      const parts = parentBlock.content.split(" → ");
      if (parts.length === 2) {
        const front = parts[0].trim();
        const back = parts[1].trim();
        if (front && back) {
          const savedParentId = await onSave(front, back, "traditional", [], [], undefined, undefined, deckId);
          console.log("savedParentId from onSave:", savedParentId);
          if (savedParentId) {
            actualParentId = savedParentId;
            // Atualizar o bloco pai no estado local para refletir que ele foi salvo
            setBlocks(prev => prev.map(block => 
              block.id === parentBlockId 
                ? { 
                    ...block, 
                    type: 'flashcard' as BlockType, 
                    flashcardType: 'traditional',
                    flashcardData: { id: savedParentId, front, back } 
                  }
                : block
            ));
          } else {
            console.error("Erro ao salvar o flashcard pai. ID não retornado.");
          }
        } else {
          console.error("Conteúdo do flashcard pai incompleto para salvar.");
        }
      }
    } else if (parentBlock.flashcardData && parentBlock.flashcardData.id) {
      // Se o flashcard pai já foi salvo e tem um ID, use-o
      actualParentId = parentBlock.flashcardData.id;
    } else if (parentBlock.flashcardData && !parentBlock.flashcardData.id) {
      // Se o flashcard pai tem flashcardData mas não tem ID (erro de estado), tentar salvar novamente
      const front = parentBlock.flashcardData.front;
      const back = parentBlock.flashcardData.back;
      if (front && back) {
        const savedParentId = await onSave(front, back, "traditional", [], [], undefined, undefined, deckId);
        console.log("savedParentId from onSave (re-save):", savedParentId);
        if (savedParentId) {
          actualParentId = savedParentId;
          setBlocks(prev => prev.map(block => 
            block.id === parentBlockId 
              ? { 
                  ...block, 
                  flashcardData: { ...block.flashcardData, id: savedParentId } 
                }
              : block
          ));
        } else {
          console.error("Erro ao salvar o flashcard pai novamente. ID não retornado.");
        }
      }
    }

    if (!actualParentId) {
      console.error("Não foi possível determinar o ID do flashcard pai para o sub-flashcard. actualParentId:", actualParentId);
      return;
    }

    // Criar novo bloco sub-flashcard
    const newSubBlock: Block = {
      id: generateBlockId(),
      type: 'paragraph', // Inicia como parágrafo, será convertido depois
      content: '',
      order: parentBlock.order + 0.1, // Ordem ligeiramente maior que o pai
      isSubCard: true,
      parentBlockId: actualParentId, // Usar o ID salvo do pai
      indentLevel: (parentBlock.indentLevel || 0) + 1
    };

    // Adicionar o novo bloco e reorganizar as ordens
    setBlocks(prev => {
      // Ajustar as ordens dos blocos subsequentes
      const adjustedBlocks = prev.map(block => {
        if (block.order > parentBlock.order) {
          return { ...block, order: block.order + 1 };
        }
        return block;
      });
      
      // Adicionar o novo sub-bloco
      const newBlocks = [...adjustedBlocks, newSubBlock];
      return newBlocks.sort((a, b) => a.order - b.order);
    });

    // Focar no novo sub-bloco
    setActiveBlockId(newSubBlock.id);
    
    // Marcar o pai como tendo sub-flashcard ativo
    setActiveParentForSub(actualParentId);
    
  }, [blocks, generateBlockId, onSave, deckId]);

  // Nova função para finalizar flashcard tradicional quando pressionar Enter
  const finalizeTraditionalFlashcard = useCallback(async (blockId: string, content: string) => {
    if (!content.includes(' → ')) return false;
    
    const parts = content.split(' → ');
    if (parts.length !== 2) return false;
    
    const front = parts[0].trim();
    const back = parts[1].trim();
    
    if (!front || !back) return false;
    
    // Verificar se é um sub-flashcard
    const currentBlock = blocks.find(b => b.id === blockId);
    const parentId = currentBlock?.isSubCard ? currentBlock.parentBlockId : undefined;
    
    // Salvar o flashcard
    const savedId = await onSave(front, back, 'traditional', [], [], undefined, parentId, deckId);
    
    if (savedId) {
      // Atualizar o bloco para mostrar como flashcard salvo
      updateFlashcardBlock(blockId, 'traditional', { id: savedId, front, back });
      
      // Limpar o tipo pendente
      setPendingFlashcardType(null);
      
      // Adicionar novo bloco após este
      addNewBlock(blockId);
    }
    
    return true;
  }, [blocks, onSave, deckId, updateFlashcardBlock, addNewBlock]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    if (e.key === 'Enter') {
      // Se o bloco contém " → " e tem frente e verso, finalizar o flashcard
      if (block.content.includes(' → ')) {
        e.preventDefault();
        if (finalizeTraditionalFlashcard(blockId, block.content)) {
          return;
        }
      }
      
      // Comportamento padrão: criar novo bloco
      e.preventDefault();
      addNewBlock(blockId);
    }
  }, [blocks, finalizeTraditionalFlashcard, addNewBlock]);

  const handleFocus = useCallback((blockId: string) => {
    setActiveBlockId(blockId);
  }, []);

  const getPendingFlashcardType = useCallback((blockId: string): FlashcardType | null => {
    return pendingFlashcardType?.blockId === blockId ? pendingFlashcardType.type : null;
  }, [pendingFlashcardType]);

  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-2">
      {blocks.map((block) => (
        <BlockComponent
          key={block.id}
          block={block}
          isActive={activeBlockId === block.id}
          isPendingFlashcard={getPendingFlashcardType(block.id)}
          onUpdate={updateBlock}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          onConvertToFlashcard={convertToFlashcard}
          onCreateSubFlashcard={createSubFlashcard}
          flashcardsWithSubOption={flashcardsWithSubOption}
        />
      ))}
    </div>
  );
}

