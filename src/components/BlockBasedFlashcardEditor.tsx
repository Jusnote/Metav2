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
  onUpdateCard?: (cardId: string, front: string, back: string, explanation?: string, hiddenWords?: string[]) => Promise<void>;
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
  // Novos props para edição inline
  isEditing: boolean;
  onStartEdit: (blockId: string) => void;
  onSaveEdit: (blockId: string, front: string, back: string, hiddenWords?: string[], explanation?: string) => void;
  onCancelEdit: (blockId: string) => void;
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
  flashcardsWithSubOption,
  isEditing,
  onStartEdit,
  onSaveEdit,
  onCancelEdit
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

  // Estados locais para edição
  const [editingFront, setEditingFront] = useState('');
  const [editingBack, setEditingBack] = useState('');
  const [editingHiddenWords, setEditingHiddenWords] = useState<string[]>([]);
  const [editingExplanation, setEditingExplanation] = useState('');
  const [originalData, setOriginalData] = useState<any>(null);

  // Inicializar dados de edição quando entrar em modo de edição
  useEffect(() => {
    if (isEditing && block.flashcardData) {
      setEditingFront(block.flashcardData.front || '');
      setEditingBack(block.flashcardData.back || '');
      setEditingHiddenWords(block.flashcardData.hiddenWords || []);
      setEditingExplanation(block.flashcardData.explanation || '');
      setOriginalData(block.flashcardData);
    }
  }, [isEditing, block.flashcardData]);

  // Função para lidar com teclas durante a edição
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSaveEdit(block.id, editingFront, editingBack, editingHiddenWords, editingExplanation);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelEdit(block.id);
    }
  };

  if (block.type === 'flashcard' && block.flashcardData) {
    return (
      <div className={cn("group relative", block.isSubCard && "ml-8")}>
        {/* Barra lateral indicadora de flashcard */}
        <div className={cn(
          "absolute left-0 top-0 w-1 h-full rounded-full z-10",
          block.flashcardType === 'traditional' && "bg-blue-500",
          block.flashcardType === 'word-hiding' && "bg-amber-500",
          block.flashcardType === 'true-false' && "bg-green-500"
        )} />
        
        <div className="ml-4 p-0">
          {isEditing ? (
            // Modo de edição
            <div className="space-y-2 p-2 border border-primary/20 rounded-md bg-background">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Frente:</label>
                <textarea
                  value={editingFront}
                  onChange={(e) => setEditingFront(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className="w-full mt-1 p-2 text-sm border rounded resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                  rows={2}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Verso:</label>
                <textarea
                  value={editingBack}
                  onChange={(e) => setEditingBack(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className="w-full mt-1 p-2 text-sm border rounded resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                  rows={2}
                />
              </div>
              {block.flashcardType === 'word-hiding' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Palavras ocultas (separadas por vírgula):</label>
                  <input
                    type="text"
                    value={editingHiddenWords.join(', ')}
                    onChange={(e) => setEditingHiddenWords(e.target.value.split(',').map(w => w.trim()).filter(w => w))}
                    onKeyDown={handleEditKeyDown}
                    className="w-full mt-1 p-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Pressione Enter para salvar, Esc para cancelar
              </div>
            </div>
          ) : (
            // Modo de visualização (clicável para editar)
            <div 
              className="cursor-pointer hover:bg-muted/50 p-1 rounded transition-colors"
              onClick={() => onStartEdit(block.id)}
              title="Clique para editar"
            >
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Frente:</span> {block.flashcardData.front}
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Verso:</span> {block.flashcardData.back}
              </div>
              {block.flashcardData.hiddenWords && block.flashcardData.hiddenWords.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Palavras ocultas:</span> {block.flashcardData.hiddenWords.join(", ")}
                </div>
              )}
            </div>
          )}
        </div>
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

export function BlockBasedFlashcardEditor({ onSave, onUpdateCard, placeholder, deckId }: BlockBasedFlashcardEditorProps) {
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

  // Estados para edição inline
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

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

    console.log("BlockBasedFlashcardEditor - addNewBlock called for:", afterBlockId);

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

    // Focar no novo bloco após um pequeno delay para garantir que foi renderizado
    setTimeout(() => {
      setActiveBlockId(newBlock.id);
      console.log("BlockBasedFlashcardEditor - setActiveBlockId to:", newBlock.id);
    }, 0);
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
      const currentContent = block.content;
      const newContent = currentContent + ' {{palavra}}';
      updateBlock(blockId, newContent);
      setTimeout(() => {
        const textarea = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLTextAreaElement;
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(newContent.length, newContent.length);
        }
      }, 0);
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

  // Adicionar estas funções ANTES da função createSubFlashcard (por volta da linha 460-470)
  
  // Função para validar se o bloco pai existe e é válido
  const validateParentBlock = useCallback((parentBlockId: string): Block | null => {
    const parentBlock = blocks.find(block => block.id === parentBlockId);
    
    if (!parentBlock) {
      console.error('Bloco pai não encontrado:', parentBlockId);
      return null;
    }
    
    if (parentBlock.isSubCard) {
      console.error('Não é possível criar sub-flashcard de outro sub-flashcard');
      return null;
    }
    
    return parentBlock;
  }, [blocks]);
  
  // Função para criar um novo sub-bloco
  const createSubBlock = useCallback((parentBlock: Block): Block => {
    const newSubBlock: Block = {
      id: generateBlockId(),
      type: 'paragraph',
      content: '',
      order: parentBlock.order + 0.1, // Posicionar logo após o pai
      isSubCard: true,
      parentBlockId: parentBlock.id,
      indentLevel: (parentBlock.indentLevel || 0) + 1
    };
    
    return newSubBlock;
  }, []);
  
  // Função para adicionar um bloco à lista
  const addBlock = useCallback((newBlock: Block) => {
    setBlocks(prev => {
      // Ajustar a ordem dos blocos subsequentes
      const updatedBlocks = prev.map(block => 
        block.order > newBlock.order 
          ? { ...block, order: block.order + 0.1 }
          : block
      );
      
      // Adicionar o novo bloco e ordenar
      const newBlocks = [...updatedBlocks, newBlock].sort((a, b) => a.order - b.order);
      return newBlocks;
    });
  }, []);
  
  // Função para criar sub-flashcard
  // Sempre salvar o pai antes de criar sub-flashcards
  const ensureParentIsSaved = async (parentBlock: Block): Promise<string | null> => {
    if (parentBlock.flashcardData?.id) {
      return parentBlock.flashcardData.id; // Já salvo
    }
    
    if (parentBlock.content.includes(' → ')) {
      const [front, back] = parentBlock.content.split(' → ').map(s => s.trim());
      if (front && back) {
        const savedId = await onSave(front, back, 'traditional', [], [], undefined, undefined, deckId);
        
        if (savedId) {
          // IMPORTANTE: Atualizar o estado local do bloco pai para evitar duplicação
          setBlocks(prev => prev.map(block => 
            block.id === parentBlock.id 
              ? { 
                  ...block, 
                  type: 'flashcard' as BlockType, 
                  flashcardType: 'traditional',
                  flashcardData: { id: savedId, front, back } 
                }
              : block
          ));
        }
        
        return savedId;
      }
    }
    
    return null;
  };
  
  const createSubFlashcard = useCallback(async (parentBlockId: string) => {
    const parentBlock = validateParentBlock(parentBlockId);
    if (!parentBlock) return;
    
    // Sempre garantir que o pai está salvo primeiro
    const parentId = await ensureParentIsSaved(parentBlock);
    if (!parentId) {
      console.error('Não foi possível salvar o flashcard pai');
      return;
    }
    
    // Criar sub-flashcard com pai já salvo
    const subBlock = createSubBlock(parentBlock);
    addBlock(subBlock);
    setActiveBlockId(subBlock.id);
  }, [blocks, onSave, deckId, validateParentBlock, createSubBlock, addBlock]);

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
    let parentId: string | undefined = undefined;
    
    if (currentBlock?.isSubCard && currentBlock?.parentBlockId) {
      console.log("BlockBasedFlashcardEditor - currentBlock:", currentBlock);
      console.log("BlockBasedFlashcardEditor - parentBlockId:", currentBlock.parentBlockId);
      console.log("BlockBasedFlashcardEditor - all blocks:", blocks);
      
      // Encontrar o bloco pai
      const parentBlock = blocks.find(b => b.id === currentBlock.parentBlockId);
      console.log("BlockBasedFlashcardEditor - parentBlock found:", parentBlock);
      
      if (parentBlock?.flashcardData?.id) {
        // Se o pai já foi salvo, usar o ID dele
        parentId = parentBlock.flashcardData.id;
        console.log("BlockBasedFlashcardEditor - sub-flashcard with parent ID:", parentId);
      } else if (parentBlock?.content.includes(" → ")) {
        // Se o pai não foi salvo mas tem conteúdo, salvar o pai primeiro
        console.log("BlockBasedFlashcardEditor - saving parent first, then sub-flashcard");
        const parts = parentBlock.content.split(" → ");
        if (parts.length === 2) {
          const parentFront = parts[0].trim();
          const parentBack = parts[1].trim();
          if (parentFront && parentBack) {
            try {
              // Salvar o pai primeiro
              const savedParentId = await onSave(parentFront, parentBack, "traditional", [], [], undefined, undefined, deckId);
              console.log("BlockBasedFlashcardEditor - parent saved with ID:", savedParentId);
              
              if (savedParentId) {
                // Atualizar o bloco pai no estado local
                setBlocks(prev => prev.map(block => 
                  block.id === currentBlock.parentBlockId 
                    ? { 
                        ...block, 
                        type: 'flashcard' as BlockType, 
                        flashcardType: 'traditional',
                        flashcardData: { id: savedParentId, front: parentFront, back: parentBack } 
                      }
                    : block
                ));
                
                // Usar o ID do pai salvo para o sub-flashcard
                parentId = savedParentId;
                console.log("BlockBasedFlashcardEditor - sub-flashcard will use parent ID:", parentId);
              }
            } catch (error) {
              console.error("BlockBasedFlashcardEditor - error saving parent:", error);
            }
          }
        }
      } else {
        console.log("BlockBasedFlashcardEditor - parentBlock has no flashcardData or ID");
      }
    }
    
    // Verificar se o bloco já foi salvo
    if (currentBlock?.flashcardData?.id) {
      console.log("BlockBasedFlashcardEditor - block already saved, skipping save:", currentBlock.flashcardData.id);
      // Adicionar novo bloco após este
      addNewBlock(blockId);
      return true;
    }
    
    console.log("BlockBasedFlashcardEditor - currentBlock details:", {
      id: currentBlock?.id,
      isSubCard: currentBlock?.isSubCard,
      parentBlockId: currentBlock?.parentBlockId,
      content: currentBlock?.content,
      flashcardData: currentBlock?.flashcardData
    });
    

    
    console.log("BlockBasedFlashcardEditor - finalizeTraditionalFlashcard - saving new flashcard:", { front, back, parentId });
    
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

  // Adicionar função para finalizar flashcard de word-hiding
  const finalizeWordHidingFlashcard = useCallback(async (blockId: string, content: string) => {
    // Verificar se o texto contém sintaxe {{palavra}}
    if (!/\{\{[^}]+\}\}/.test(content)) return false;
    
    // Parse das palavras ocultas
    const hiddenWords: string[] = [];
    const cleanText = content.replace(/\{\{([^}]+)\}\}/g, (match, word) => {
      hiddenWords.push(word.trim());
      return word.trim();
    });
    
    // Criar pergunta com ____
    const questionText = content.replace(/\{\{([^}]+)\}\}/g, '____');
    
    // Verificar se é um sub-flashcard
    const currentBlock = blocks.find(b => b.id === blockId);
    let parentId: string | undefined = undefined;
    
    if (currentBlock?.isSubCard && currentBlock.parentBlockId) {
      const parentBlock = blocks.find(b => b.id === currentBlock.parentBlockId);
      if (parentBlock?.flashcardData?.id) {
        parentId = parentBlock.flashcardData.id;
      }
    }
    
    console.log("Salvando flashcard word-hiding:", { questionText, cleanText, hiddenWords, parentId });
    
    // Salvar o flashcard
    const savedId = await onSave(questionText, cleanText, 'word-hiding', [], hiddenWords, undefined, parentId, deckId);
    
    if (savedId) {
      // Atualizar o bloco para mostrar como flashcard salvo
      updateFlashcardBlock(blockId, 'word-hiding', { 
        id: savedId, 
        front: questionText, 
        back: cleanText, 
        hiddenWords 
      });
      
      // Limpar o tipo pendente
      setPendingWordHiding(null);
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
      console.log("BlockBasedFlashcardEditor - Enter pressed for block:", block);
      
      // Verificar se é um flashcard de word-hiding pendente
      if (pendingWordHiding?.blockId === blockId && /\{\{[^}]+\}\}/.test(block.content)) {
        e.preventDefault();
        if (finalizeWordHidingFlashcard(blockId, block.content)) {
          return;
        }
      }
      
      // Se o bloco contém " → " e tem frente e verso, finalizar o flashcard
      if (block.content.includes(' → ')) {
        e.preventDefault();
        
        // Verificar se é um sub-flashcard - se sim, não processar o pai
        if (block.isSubCard) {
          console.log("BlockBasedFlashcardEditor - processing sub-flashcard, skipping parent");
          if (finalizeTraditionalFlashcard(blockId, block.content)) {
            return;
          }
        } else {
          // Verificar se este bloco tem sub-flashcards ativos
          const hasActiveSubCards = blocks.some(b => b.isSubCard && b.parentBlockId === blockId);
          console.log("BlockBasedFlashcardEditor - checking for active sub-cards:", {
            blockId,
            hasActiveSubCards,
            subCards: blocks.filter(b => b.isSubCard && b.parentBlockId === blockId)
          });
          
          if (hasActiveSubCards) {
            console.log("BlockBasedFlashcardEditor - parent has active sub-cards, skipping parent save");
            // Não salvar o pai aqui - ele será salvo quando o sub-flashcard for salvo
            // Adicionar novo bloco após este
            addNewBlock(blockId);
            return;
          }
          
          if (finalizeTraditionalFlashcard(blockId, block.content)) {
            return;
          }
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

  // Funções para edição inline
  const handleStartEdit = useCallback((blockId: string) => {
    setEditingBlockId(blockId);
  }, []);

  const handleSaveEdit = useCallback(async (blockId: string, front: string, back: string, hiddenWords?: string[]) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block || !block.flashcardData) return;

    try {
      // Salvar no backend se houver um ID (flashcard já existe) e a função onUpdateCard estiver disponível
      if (block.flashcardData.id && onUpdateCard) {
        console.log("Salvando alterações no backend para flashcard:", block.flashcardData.id);
        
        await onUpdateCard(block.flashcardData.id, front, back, undefined, hiddenWords);
        
        console.log("Flashcard atualizado no backend com sucesso");
      }

      // Atualizar o bloco localmente após salvar no backend
      setBlocks(prev => prev.map(b => 
        b.id === blockId 
          ? { 
              ...b, 
              flashcardData: { 
                ...b.flashcardData!, 
                front, 
                back, 
                hiddenWords: hiddenWords || [], 
              } 
            }
          : b
      ));

      setEditingBlockId(null);
      console.log("Flashcard editado e salvo com sucesso");
    } catch (error) {
      console.error("Erro ao salvar edição:", error);
      // Em caso de erro, recarregar os dados ou reverter as alterações
      // toast({
      //   title: "Erro ao salvar alterações",
      //   description: "Não foi possível salvar as alterações do flashcard.",
      //   variant: "destructive",
      // });
    }
  }, [blocks, onUpdateCard]);

  const handleCancelEdit = useCallback((blockId: string) => {
    // Simplesmente sair do modo de edição sem salvar
    // Os dados originais serão restaurados automaticamente pelo estado local
    setEditingBlockId(null);
    console.log('Edição cancelada para bloco:', blockId);
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
          isEditing={editingBlockId === block.id}
          onStartEdit={handleStartEdit}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
        />
      ))}
    </div>
  );
}

// Usar inteiros sequenciais em vez de decimais
const reorderBlocks = (blocks: Block[]): Block[] => {
  return blocks
    .sort((a, b) => {
      // Primeiro por nível de hierarquia
      const aLevel = a.indentLevel || 0;
      const bLevel = b.indentLevel || 0;
      if (aLevel !== bLevel) return aLevel - bLevel;
      
      // Depois por ordem original
      return a.order - b.order;
    })
    .map((block, index) => ({ ...block, order: index * 10 })); // Usar múltiplos de 10
};

// Usar uma máquina de estados para gerenciar o ciclo de vida dos flashcards
type FlashcardState = 'draft' | 'pending' | 'saved' | 'editing';

interface BlockWithState extends Block {
  state: FlashcardState;
  parentState?: FlashcardState;
}

const getNextState = (currentState: FlashcardState, action: string): FlashcardState => {
  switch (currentState) {
    case 'draft':
      return action === 'convert' ? 'pending' : 'draft';
    case 'pending':
      return action === 'save' ? 'saved' : action === 'cancel' ? 'draft' : 'pending';
    case 'saved':
      return action === 'edit' ? 'editing' : 'saved';
    case 'editing':
      return action === 'save' ? 'saved' : action === 'cancel' ? 'saved' : 'editing';
    default:
      return currentState;
  }
};

