import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { FileText, Plus, Trash2, Clock } from 'lucide-react';
import { usePlateDocuments } from '../hooks/usePlateDocuments';

interface SubtopicDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtopicId: string;
  subtopicTitle: string;
  onSelectDocument: (documentId: string) => void;
  onCreateNew: () => void;
}

export function SubtopicDocumentsModal({
  isOpen,
  onClose,
  subtopicId,
  subtopicTitle,
  onSelectDocument,
  onCreateNew
}: SubtopicDocumentsModalProps) {
  const { getDocumentsBySubtopic, deleteDocument } = usePlateDocuments();

  const documents = getDocumentsBySubtopic(subtopicId);

  const handleDelete = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    if (confirm('Tem certeza que deseja excluir este documento?')) {
      await deleteDocument(docId);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentos - {subtopicTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Botão criar novo */}
          <Button
            onClick={() => {
              onClose();
              onCreateNew();
            }}
            className="w-full"
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar Novo Documento
          </Button>

          {/* Lista de documentos */}
          {documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum documento encontrado</p>
              <p className="text-sm">Clique em "Criar Novo Documento" para começar</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents
                .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())
                .map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => {
                      onClose();
                      onSelectDocument(doc.id);
                    }}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{doc.title}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(doc.updated_at || doc.created_at || '')}
                        </span>
                        {doc.is_favorite && (
                          <span className="text-yellow-500">★ Favorito</span>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDelete(e, doc.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
