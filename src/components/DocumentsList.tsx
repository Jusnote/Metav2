import React, { useState, useEffect } from 'react';
import { useDocuments, Document } from '../hooks/useDocuments';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Trash2, Edit, Plus, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DocumentsListProps {
  onSelectDocument?: (document: Document) => void;
  onCreateNew?: () => void;
}

export const DocumentsList: React.FC<DocumentsListProps> = ({
  onSelectDocument,
  onCreateNew
}) => {
  const { user } = useAuth();
  const { documents, loading, error, deleteDocument, refetch } = useDocuments(user);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Remove useEffect que causa loop infinito
  // O hook useDocuments já carrega os documentos automaticamente

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este documento?')) {
      setDeletingId(id);
      try {
        await deleteDocument(id);
        await refetch(); // Refresh the list
      } catch (error) {
        console.error('Erro ao excluir documento:', error);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Carregando documentos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">Erro ao carregar documentos: {error}</p>
        <Button 
          onClick={() => refetch()} 
          className="mt-2"
          variant="outline"
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Meus Documentos</h2>
        {onCreateNew && (
          <Button onClick={onCreateNew} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Documento
          </Button>
        )}
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum documento encontrado
            </h3>
            <p className="text-gray-500 text-center mb-4">
              Comece criando seu primeiro documento no editor.
            </p>
            {onCreateNew && (
              <Button onClick={onCreateNew}>
                Criar Primeiro Documento
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{doc.title}</span>
                  <div className="flex items-center gap-1">
                    {onSelectDocument && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDocument(doc);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(doc.id);
                      }}
                      disabled={deletingId === doc.id}
                    >
                      {deletingId === doc.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                      ) : (
                        <Trash2 className="h-4 w-4 text-red-600" />
                      )}
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  Atualizado {formatDistanceToNow(new Date(doc.updated_at), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  {truncateText(doc.content_text || 'Documento vazio')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentsList;