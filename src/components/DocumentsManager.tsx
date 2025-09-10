import React, { useState, useCallback } from 'react';
import { DocumentsList } from './DocumentsList';
import PlaygroundApp from './lexical-playground/App';
import { Button } from './ui/button';
import { ArrowLeft, Save } from 'lucide-react';
import { useAutoSave, Document } from '../hooks/useDocuments';

type ViewMode = 'list' | 'editor';

export const DocumentsManager: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [documentTitle, setDocumentTitle] = useState('Documento sem título');
  
  const { debouncedSave, isSaving, lastSaved, currentDocumentId, setCurrentDocumentId, currentDocument: loadedDocument, isLoading } = useAutoSave();

  const handleSelectDocument = useCallback((document: Document) => {
    setCurrentDocumentId(document.id);
    setDocumentTitle(document.title);
    setViewMode('editor');
  }, [setCurrentDocumentId]);

  const handleCreateNew = useCallback(() => {
    setCurrentDocumentId(null);
    setDocumentTitle('Documento sem título');
    setViewMode('editor');
  }, [setCurrentDocumentId]);

  const handleBackToList = useCallback(() => {
    setViewMode('list');
    setCurrentDocumentId(null);
  }, [setCurrentDocumentId]);

  const formatLastSaved = (date: Date | null) => {
    if (!date) return '';
    return `Salvo às ${date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`;
  };

  if (viewMode === 'list') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <DocumentsList 
            onSelectDocument={handleSelectDocument}
            onCreateNew={handleCreateNew}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={handleBackToList}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                className="text-lg font-medium bg-transparent border-none outline-none focus:bg-gray-50 px-2 py-1 rounded"
                placeholder="Título do documento"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Status de salvamento */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>Salvando...</span>
                </>
              ) : lastSaved ? (
                <>
                  <Save className="h-4 w-4 text-green-600" />
                  <span>{formatLastSaved(lastSaved)}</span>
                </>
              ) : (
                <span>Não salvo</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="max-w-7xl mx-auto">

          <PlaygroundApp 
            initialDocument={currentDocumentId ? loadedDocument : null} 
            debouncedSave={(data) => debouncedSave({ ...data, title: documentTitle })}
          />
        </div>
    </div>
  );
};

export default DocumentsManager;