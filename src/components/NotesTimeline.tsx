import React, { useState } from 'react';
import { Note } from '@/types/notes';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Edit3, Trash2, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NotesTimelineProps {
  notes: Note[];
  onUpdateNote: (id: string, content: string) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export const NotesTimeline: React.FC<NotesTimelineProps> = ({
  notes,
  onUpdateNote,
  onDeleteNote,
  isLoading = false
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const handleStartEdit = (note: Note) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  const handleSaveEdit = async () => {
    if (editingId && editContent.trim()) {
      await onUpdateNote(editingId, editContent.trim());
      setEditingId(null);
      setEditContent('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta anotação?')) {
      await onDeleteNote(id);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return 'Data inválida';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Carregando anotações...</span>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Nenhuma anotação encontrada.</p>
        <p className="text-sm mt-1">Adicione sua primeira anotação sobre este tópico!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-96 overflow-y-auto">
      {notes.map((note, index) => (
        <div key={note.id} className="relative">
          {/* Linha da timeline */}
          {index < notes.length - 1 && (
            <div className="absolute left-4 top-8 bottom-0 w-px bg-gray-200"></div>
          )}
          
          <div className="flex gap-3">
            {/* Ponto da timeline */}
            <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2 relative z-10"></div>
            
            {/* Conteúdo da anotação */}
            <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-200">
              {/* Header com data e ações */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">
                  {formatDate(note.created_at)}
                  {note.updated_at && note.updated_at !== note.created_at && (
                    <span className="ml-1">(editado)</span>
                  )}
                </span>
                
                {editingId !== note.id && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(note)}
                      className="h-6 w-6 p-0 hover:bg-blue-100"
                    >
                      <Edit3 className="w-3 h-3 text-gray-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(note.id)}
                      className="h-6 w-6 p-0 hover:bg-red-100"
                    >
                      <Trash2 className="w-3 h-3 text-gray-500" />
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Conteúdo */}
              {editingId === note.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[60px] text-sm"
                    placeholder="Digite sua anotação..."
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEdit}
                      className="h-7 px-2"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={!editContent.trim()}
                      className="h-7 px-2"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {note.content}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};