import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import NotesBlockEditor from '../components/NotesBlockEditor';
import SavedCardBlockNote from '../components/SavedCardBlockNote';
import { useQuickNotes } from '../hooks/useQuickNotes';
import { SyncStatusIndicator } from '../components/SyncStatusIndicator';
import { useBlockNoteFlashcards } from '../hooks/useBlockNoteFlashcards';

export default function NotesPage() {
  // SSR protection - return early if not in browser
  if (typeof window === 'undefined') {
    return <div>Loading...</div>;
  }

  // Hook para gerenciamento de notas rápidas
  const {
    localNotes,
    setLocalNotes,
    syncStatus,
    saveNoteInstantly,
    saveNoteEdit,
    deleteNote,
    forcSync,
    markNoteAsFlashcard
  } = useQuickNotes();

  // Hook para flashcards
  const { createFlashcardFromNote } = useBlockNoteFlashcards();

  // Estados locais
  const [currentContent, setCurrentContent] = useState<any>(null);
  const [shouldReset, setShouldReset] = useState(false);

  // Data atual formatada
  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNumber = today.getDate();
  const monthName = today.toLocaleDateString('en-US', { month: 'long' });

  // Função para salvar o card (agora com salvamento assíncrono)
  const handleFinish = async () => {
    if (!currentContent) return;

    // Extrair título (primeiro bloco se for heading)
    const firstBlock = currentContent[0];
    const title = firstBlock?.content?.[0]?.text || 'Untitled';
    
    // Salvamento instantâneo + queue assíncrona
    saveNoteInstantly(title, currentContent);
    
    // Limpar editor imediatamente
    setCurrentContent(null);
    setShouldReset(true); // Trigger reset do editor
  };

  // Função para alternar modo de edição de um card
  const toggleCardEdit = (cardId: string) => {
    setLocalNotes(prev => prev.map(card => 
      card.id === cardId 
        ? { ...card, isEditing: !card.isEditing }
        : { ...card, isEditing: false } // Fechar outros em edição
    ));
  };

  // Função para salvar alterações de um card
  const saveCardChanges = (cardId: string, newContent: any[]) => {
    const title = newContent[0]?.content?.[0]?.text || 'Untitled';
    
    // Atualizar localmente e marcar para edição
    setLocalNotes(prev => prev.map(card => 
      card.id === cardId 
        ? { 
            ...card, 
            content: newContent,
            title,
            isEditing: false 
          }
        : card
    ));

    // Adicionar à queue para sincronização
    saveNoteEdit(cardId, title, newContent);
  };

  // Função para atualizar conteúdo temporário sem salvar
  const updateCardContent = (cardId: string, newContent: any[]) => {
    setLocalNotes(prev => prev.map(card => 
      card.id === cardId 
        ? { ...card, content: newContent }
        : card
    ));
  };

  // Função para deletar uma nota
  const handleDeleteNote = async (cardId: string) => {
    await deleteNote(cardId);
  };

  // Função para converter nota em flashcard
  const handleConvertToFlashcard = async (cardId: string) => {
    const note = localNotes.find(n => n.id === cardId);
    if (!note) return;

    const flashcard = await createFlashcardFromNote(
      note.title, 
      note.content, 
      'Default Deck',
      cardId, // ID da nota para vincular
      markNoteAsFlashcard // Callback para atualizar a nota
    );
    
    if (flashcard) {
      // A vinculação já foi feita pelo callback markNoteAsFlashcard
      // Não precisa fazer mais nada aqui
    }
  };

  // Função para cancelar
  const handleCancel = () => {
    setCurrentContent(null);
    setShouldReset(true); // Trigger reset do editor
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Container principal */}
      <div className="max-w-2xl mx-auto min-h-screen">
        {/* Header com data e navegação - NA ÁREA CINZA */}
        <div className="flex items-center justify-between px-6 pt-8 pb-4">
          {/* Data circular */}
          <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full">
            <div className="text-center">
              <div className="text-xs font-medium text-green-800 leading-none">{dayName}</div>
              <div className="text-sm font-bold text-green-800 leading-none">{dayNumber}</div>
            </div>
          </div>

          {/* Navegação */}
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Título principal - NA ÁREA CINZA */}
        <div className="px-6 pb-2">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Today</h1>
          <p className="text-gray-600 text-sm">
            Good afternoon Aldemir. Here's everything from Today, {dayNumber}th {monthName}
          </p>
        </div>

        {/* Seção de Cards - Header - NA ÁREA CINZA */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-900 font-medium">{localNotes.length} Cards</span>
            <div className="flex items-center space-x-4">
              <SyncStatusIndicator 
                syncStatus={syncStatus}
                onForceSync={forcSync}
              />
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                <span className="text-gray-600 text-sm">Recent</span>
                <ChevronRight className="h-3 w-3 text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Card em Edição - CONTAINER BRANCO ESPECÍFICO */}
        <div className="px-6 pb-6">
          <div className="bg-white border-2 border-gray-200 rounded-2xl shadow-xs">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  {/* Área de entrada de texto com BlockNote */}
                  <div className="min-h-[150px]">
                  <NotesBlockEditor 
                    placeholder="Type notes or press / for additional elements..."
                    onChange={setCurrentContent}
                    reset={shouldReset}
                    onResetComplete={() => setShouldReset(false)}
                  />
                  </div>
                </div>
                <button className="text-gray-300 hover:text-gray-400 text-xl ml-4">
                  +
                </button>
              </div>
            </div>

            {/* Linha separadora */}
            <div className="border-t border-gray-200"></div>

            {/* Botões de ação */}
            <div className="p-6 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={handleCancel}
                    className="text-gray-500 text-sm hover:text-gray-700"
                  >
                    Cancel
                  </button>
                  <span className="text-gray-400 text-xs">Esc</span>
                </div>
                
                <div className="flex items-center space-x-6">
                  <button className="flex items-center space-x-2 text-gray-500 text-sm hover:text-gray-700">
                    <span className="text-gray-400">📋</span>
                    <span>Open the Cheatsheet</span>
                  </button>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={handleFinish}
                      disabled={!currentContent}
                      className="text-blue-500 text-sm font-medium hover:text-blue-600 disabled:text-gray-400"
                    >
                      Finish
                    </button>
                    <span className="text-gray-400 text-xs">Ctrl</span>
                    <span className="text-gray-400 text-xs">Enter</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cards Finalizados - CONTAINERS BRANCOS ESPECÍFICOS */}
        <div className="px-6 pt-2">
          {localNotes.map((card) => {
            const timeAgo = Math.floor((new Date().getTime() - card.createdAt.getTime()) / 60000);
            const displayTime = timeAgo < 1 ? 'just now' : 
                               timeAgo < 60 ? `${timeAgo} minutes ago` : 
                               timeAgo < 1440 ? `${Math.floor(timeAgo/60)} hours ago` : 
                               `${Math.floor(timeAgo/1440)} days ago`;
            
            return (
              <div key={card.id} className="bg-white border border-gray-200 rounded-2xl p-4 mb-4 shadow-xs relative">
                {/* Indicador de status de sincronização */}
                <div className="absolute top-2 right-2">
                  {card.syncStatus === 'pending' && (
                    <div className="w-2 h-2 bg-yellow-400 rounded-full" title="Aguardando sincronização" />
                  )}
                  {card.syncStatus === 'synced' && (
                    <div className="w-2 h-2 bg-green-400 rounded-full" title="Sincronizado" />
                  )}
                  {card.syncStatus === 'error' && (
                    <div className="w-2 h-2 bg-red-400 rounded-full" title="Erro de sincronização" />
                  )}
                </div>

                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    {/* BlockNote Document */}
                    <SavedCardBlockNote
                      content={card.content}
                      isEditing={!!card.isEditing}
                      onSave={(newContent) => updateCardContent(card.id, newContent)}
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <button 
                      onClick={() => {
                        if (card.isEditing) {
                          // Salvar e sair do modo edição
                          const newContent = card.content;
                          saveCardChanges(card.id, newContent);
                        } else {
                          // Entrar no modo edição
                          toggleCardEdit(card.id);
                        }
                      }}
                      className="text-gray-400 hover:text-gray-600 text-sm"
                    >
                      {card.isEditing ? 'Save' : 'Edit'}
                    </button>
                    <button 
                      onClick={() => handleConvertToFlashcard(card.id)}
                      className={`text-sm ${card.flashcardId ? 'text-green-500' : 'text-blue-400 hover:text-blue-600'}`}
                      title={card.flashcardId ? "Já convertido para flashcard" : "Converter para flashcard"}
                      disabled={!!card.flashcardId}
                    >
                      {card.flashcardId ? '✅' : '🃏'}
                    </button>
                    <button 
                      onClick={() => handleDeleteNote(card.id)}
                      className="text-red-400 hover:text-red-600 text-sm"
                      title="Deletar nota"
                    >
                      🗑️
                    </button>
                    <button className="text-gray-400 hover:text-gray-600">
                      <span className="text-lg">⋯</span>
                    </button>
                  </div>
                </div>
                
                {!card.isEditing && (
                  <div className="mt-3">
                    <div className="text-gray-400 text-xs">
                      {displayTime}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Mensagem quando não há cards */}
          {localNotes.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">Nenhum card salvo ainda.</p>
              <p className="text-xs mt-1">Escreva algo acima e clique em "Finish" para salvar.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
