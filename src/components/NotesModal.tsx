import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, FileText } from 'lucide-react';
import { useNotes } from '@/hooks/useNotes';
import { NotesTimeline } from '@/components/NotesTimeline';

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtopicId?: string;
  topicId?: string;
  title: string;
}

export const NotesModal: React.FC<NotesModalProps> = ({
  isOpen,
  onClose,
  subtopicId,
  topicId,
  title
}) => {
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const {
    notes,
    isLoading,
    error,
    createNote,
    updateNote,
    deleteNote,
    fetchNotes,
    clearNotes
  } = useNotes();

  // Carregar anotações quando o modal abrir
  useEffect(() => {
    if (isOpen && (subtopicId || topicId)) {
      fetchNotes(subtopicId, topicId);
    } else if (!isOpen) {
      setNewNoteContent('');
      setIsAddingNote(false);
    }
  }, [isOpen, subtopicId, topicId, fetchNotes]);

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;

    const result = await createNote({
      subtopic_id: subtopicId,
      topic_id: topicId,
      content: newNoteContent.trim()
    });

    if (result) {
      setNewNoteContent('');
      setIsAddingNote(false);
    }
  };

  const handleUpdateNote = async (id: string, content: string) => {
    await updateNote({ id, content });
  };

  const handleDeleteNote = async (id: string) => {
    await deleteNote(id);
  };

  const handleStartAddingNote = () => {
    setIsAddingNote(true);
  };

  const handleCancelAddingNote = () => {
    setIsAddingNote(false);
    setNewNoteContent('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Minhas Anotações - {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Seção para adicionar nova anotação */}
          <div className="border-b pb-4">
            {!isAddingNote ? (
              <Button
                onClick={handleStartAddingNote}
                className="w-full justify-start gap-2 h-10"
                variant="outline"
              >
                <Plus className="w-4 h-4" />
                Adicionar nova anotação
              </Button>
            ) : (
              <div className="space-y-3">
                <Textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Digite sua anotação sobre este tópico..."
                  className="min-h-[100px] resize-none"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    onClick={handleCancelAddingNote}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleAddNote}
                    disabled={!newNoteContent.trim()}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Seção de anotações existentes */}
          <div className="flex-1 overflow-hidden">
            <div className="mb-3">
              <h3 className="text-sm font-medium text-gray-700">
                Anotações ({notes.length})
              </h3>
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              <NotesTimeline
                notes={notes}
                onUpdateNote={handleUpdateNote}
                onDeleteNote={handleDeleteNote}
                isLoading={isLoading}
              />
            </div>
          </div>
        </div>

        {/* Footer com informações */}
        <div className="border-t pt-3">
          <p className="text-xs text-gray-500 text-center">
            Suas anotações são salvas automaticamente e ficam disponíveis apenas para você.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};