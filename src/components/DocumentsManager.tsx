import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import PlaygroundApp from './lexical-playground/App';
import { Button } from './ui/button';
import { ArrowLeft, Save } from 'lucide-react';
import { useAutoSave, Document, useDocuments } from '../hooks/useDocuments';
import { useAuth } from '../hooks/useAuth';

type ViewMode = 'list' | 'editor';

export const DocumentsManager: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [documentTitle, setDocumentTitle] = useState('Documento sem título');
  const { user } = useAuth();
  
  const { debouncedSave, isSaving, lastSaved, currentDocumentId, setCurrentDocumentId, currentDocument: loadedDocument, isLoading } = useAutoSave();
  const { documents, createDocument, searchDocuments } = useDocuments(user);
  
  // Verificar se há parâmetros de subtópico na URL
  const subtopicId = searchParams.get('subtopic');
  const subtopicTitle = searchParams.get('title');

  // Efeito para lidar com subtópicos (relação 1:1)
  useEffect(() => {
    if (subtopicId && subtopicTitle) {
      // Procurar por um documento existente para este subtópico específico
      const existingDocument = documents.find(doc => 
        (doc as any).subtopic_id === subtopicId
      );

      if (existingDocument) {
        // Se encontrou um documento existente, abrir ele
        setCurrentDocumentId(existingDocument.id);
        setDocumentTitle(existingDocument.title);
        setViewMode('editor');
      } else {
        // Se não encontrou, criar automaticamente um novo resumo para o subtópico
        const newTitle = `Resumo: ${decodeURIComponent(subtopicTitle)}`;
        createDocument({
          title: newTitle,
          content: '',
          subtopic_id: subtopicId
        }).then((newDoc) => {
          if (newDoc) {
            setCurrentDocumentId(newDoc.id);
            setDocumentTitle(newDoc.title);
            setViewMode('editor');
          }
        });
      }
    }
  }, [subtopicId, subtopicTitle, documents, setCurrentDocumentId, createDocument]);

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
    if (subtopicId) {
      // Se veio de um subtópico, voltar para a página de organização
      navigate('/documents-organization');
    } else {
      // Se não, voltar para a lista de documentos
      setViewMode('list');
      setCurrentDocumentId(null);
    }
  }, [subtopicId, navigate, setCurrentDocumentId]);

  const formatLastSaved = (date: Date | null) => {
    if (!date) return '';
    return `Salvo às ${date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`;
  };

  // Se há subtópico, pular a lista e ir direto para o editor
  if (viewMode === 'list' && !subtopicId) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          {/* Lista de documentos removida - funcionalidade integrada na página de organização */}
          <div className="text-center py-8">
            <p className="text-gray-600">Funcionalidade movida para a página de organização de documentos</p>
          </div>
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
                className="text-lg font-medium bg-transparent border-none outline-hidden focus:bg-gray-50 px-2 py-1 rounded"
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
            debouncedSave={(data) => debouncedSave({ 
              ...data, 
              title: documentTitle,
              subtopic_id: subtopicId || undefined
            })}
          />
        </div>
    </div>
  );
};

export default DocumentsManager;