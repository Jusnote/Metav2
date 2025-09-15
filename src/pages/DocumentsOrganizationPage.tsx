import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Clock, FileText, Zap, HelpCircle, Play, CreditCard, ArrowLeft, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUnitsManager, Unit, Topic, Subtopic } from '@/hooks/useUnitsManager';
import { InlineEditor } from '@/components/InlineEditor';
import { AddUnitButton, AddTopicButton, AddSubtopicButton } from '@/components/AddButton';
import { ContextMenu, ContextMenuIcons } from '@/components/ContextMenu';
import { EditModeToggle } from '@/components/EditModeToggle';
import PlaygroundApp from '@/components/lexical-playground/App';
import { useAutoSave, useDocuments } from '@/hooks/useDocuments';
import { useAuth } from '@/hooks/useAuth';

const DocumentsOrganizationPage = () => {
  const navigate = useNavigate();
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [currentSubtopic, setCurrentSubtopic] = useState<{id: string, title: string} | null>(null);
  const [documentTitle, setDocumentTitle] = useState('Documento sem título');
  
  const { user } = useAuth();
  const { debouncedSave, isSaving, lastSaved, currentDocumentId, setCurrentDocumentId, currentDocument: loadedDocument, isLoading } = useAutoSave(user);
  const { documents, createDocument, updateDocument, refetch: fetchDocuments } = useDocuments(user);

  // Recarregar documentos quando o usuário muda
  useEffect(() => {
    if (user) {
      fetchDocuments();
    }
  }, [user, fetchDocuments]);

  // Função para abrir o editor do subtópico
  const handlePlaySubtopic = async (subtopicId: string, subtopicTitle: string) => {
    console.log('🎯 handlePlaySubtopic called:', { subtopicId, subtopicTitle });
    console.log('🔍 subtopicId type:', typeof subtopicId, 'value:', subtopicId);
    console.log('📚 Available documents:', documents.length);
    console.log('📋 Documents details:', documents.map(doc => ({ id: doc.id, title: doc.title, subtopic_id: (doc as any).subtopic_id })));
    
    setCurrentSubtopic({ id: subtopicId, title: subtopicTitle });
    setShowEditor(true);
    
    // Procurar por um documento existente para este subtópico específico
    // Primeiro tenta buscar por subtopic_id, depois por título como fallback
    const expectedTitle = `Resumo: ${subtopicTitle}`;
    
    const existingDocument = documents.find(doc => 
      (doc as any).subtopic_id === subtopicId || 
      (doc.title === expectedTitle && (!(doc as any).subtopic_id || (doc as any).subtopic_id === ''))
    );
    
    console.log('🔍 Searching for document with subtopicId:', subtopicId);
    console.log('🔍 Expected title:', expectedTitle);
    console.log('📋 Available documents:', documents.map(doc => ({
      id: doc.id,
      title: doc.title,
      subtopic_id: (doc as any).subtopic_id || 'empty'
    })));
    
    console.log('🔍 Existing document found:', existingDocument ? existingDocument.id : 'none');

    if (existingDocument) {
      // Se encontrou um documento existente, abrir ele
      console.log('📖 Opening existing document:', existingDocument.id);
      
      // Se o documento foi encontrado por título mas não tem subtopic_id, atualizar
      if (!(existingDocument as any).subtopic_id || (existingDocument as any).subtopic_id === '') {
        console.log('🔧 Updating document subtopic_id:', existingDocument.id);
        updateDocument(existingDocument.id, { subtopic_id: subtopicId });
      }
      
      setCurrentDocumentId(existingDocument.id);
      setDocumentTitle(existingDocument.title);
    } else {
      // Se não encontrou, criar automaticamente um novo resumo para o subtópico
      console.log('📝 Creating new document for subtopic:', subtopicId);
      const newTitle = `Resumo: ${subtopicTitle}`;
      setDocumentTitle(newTitle);
      
      try {
        console.log('🔧 Creating document with subtopicId:', subtopicId, 'type:', typeof subtopicId);
        const newDoc = await createDocument({
          title: newTitle,
          content: {
            "root": {
              "children": [
                {
                  "children": [],
                  "direction": null,
                  "format": "",
                  "indent": 0,
                  "type": "paragraph",
                  "version": 1
                }
              ],
              "direction": null,
              "format": "",
              "indent": 0,
              "type": "root",
              "version": 1
            }
          },
          content_text: '',
          subtopic_id: subtopicId
        });
        console.log('📄 Document created:', newDoc ? newDoc.id : 'failed');
        
        if (newDoc) {
          console.log('✅ New document created with ID:', newDoc.id);
          setCurrentDocumentId(newDoc.id);
          // Recarregar a lista de documentos após criar um novo
          fetchDocuments();
        } else {
          console.log('⚠️ Failed to create document, setting temporary ID');
          // Criar um ID temporário para permitir salvamento
          const tempId = `temp-${Date.now()}-${subtopicId}`;
          setCurrentDocumentId(tempId);
        }
    } catch (error) {
      console.error('Erro ao criar documento:', error);
      // Criar um ID temporário para permitir salvamento
      const tempId = `temp-${Date.now()}-${subtopicId}`;
      setCurrentDocumentId(tempId);
    }
    }
  };

  // Função para voltar à lista de organização
  const handleBackToOrganization = () => {
    setShowEditor(false);
    setCurrentSubtopic(null);
    setCurrentDocumentId(null);
  };

  // Inicializar o hook de gerenciamento de unidades (sem dados iniciais)
  const {
    units,
    addUnit,
    updateUnit,
    deleteUnit,
    addTopic,
    updateTopic,
    deleteTopic,
    addSubtopic,
    updateSubtopic,
    deleteSubtopic,
    startEditing,
    stopEditing,
    isEditing
  } = useUnitsManager();

  // Debug: Log dos dados carregados
  console.log('🔍 Units loaded from useUnitsManager:', units);

  const toggleTopicExpansion = (topicId: string) => {
    setOpenTopic(prev => prev === topicId ? null : topicId);
  };

  const getStatusIcon = (status: 'not-started' | 'in-progress' | 'completed') => {
    switch (status) {
      case 'completed':
        return <div className="w-4 h-4 rounded bg-green-500 flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>;
      case 'in-progress':
        return <div className="w-4 h-4 rounded bg-yellow-500 flex items-center justify-center">
          <div className="w-2 h-2 bg-white rounded"></div>
        </div>;
      case 'not-started':
        return <div className="w-4 h-4 rounded border-2 border-gray-300 bg-white"></div>;
      default:
        return <div className="w-4 h-4 rounded border-2 border-gray-300 bg-white"></div>;
    }
  };

  // Renderização condicional: Editor ou Lista de Organização
  if (showEditor && currentSubtopic) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header do Editor */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToOrganization}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{documentTitle}</h1>
                <p className="text-sm text-gray-500">Subtópico: {currentSubtopic.title}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {isSaving && (
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Save className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </div>
              )}
              {lastSaved && (
                <span className="text-sm text-gray-500">
                  Salvo às {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Editor Lexical */}
        <div className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Carregando documento...</span>
            </div>
          ) : (
            <PlaygroundApp
              key={`editor-${currentDocumentId}-${loadedDocument?.updated_at || 'new'}`}
              initialDocument={(() => {
                console.log('🔍 Determining initial document:', {
                  currentDocumentId,
                  hasLoadedDocument: !!loadedDocument,
                  loadedDocumentId: loadedDocument?.id,
                  isLoading,
                  currentSubtopic: currentSubtopic?.title
                });
                
                if (currentDocumentId && loadedDocument && loadedDocument.id === currentDocumentId) {
                  console.log('📄 Using loaded document content:', {
                    contentType: typeof loadedDocument.content,
                    hasContent: !!loadedDocument.content
                  });
                  return {
                    id: currentDocumentId,
                    content: loadedDocument.content,
                    title: loadedDocument.title || currentSubtopic?.title || 'Novo Documento'
                  };
                } else {
                  console.log('📝 Using default empty document');
                  return {
                    id: currentDocumentId || 'new-document',
                    content: {
                      "root": {
                        "children": [
                          {
                            "children": [],
                            "direction": null,
                            "format": "",
                            "indent": 0,
                            "type": "paragraph",
                            "version": 1
                          }
                        ],
                        "direction": null,
                        "format": "",
                        "indent": 0,
                        "type": "root",
                        "version": 1
                      }
                    },
                    title: currentSubtopic?.title || 'Novo Documento'
                  };
                }
              })()}
              debouncedSave={(data) => debouncedSave({
                ...data,
                title: documentTitle,
                subtopic_id: currentSubtopic?.id
              })}
            />
          )}
        </div>
      </div>
    );
  }

  // Renderização da Lista de Organização
  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-white">
      {/* Cabeçalho com controle de modo de edição */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organização de Documentos</h1>
          <p className="text-sm text-gray-600 mt-1">Gerencie suas unidades, tópicos e subtópicos</p>
        </div>
        <EditModeToggle 
          isEditMode={isEditMode}
          onToggle={() => setIsEditMode(!isEditMode)}
        />
      </div>
      
      <div className="space-y-6">
        {units.map((unit) => (
          <div key={unit.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="w-full">
              {/* Cabeçalho da Unidade */}
              {isEditMode ? (
                <ContextMenu
                  options={[
                    {
                      id: 'edit-unit',
                      label: 'Editar nome',
                      icon: ContextMenuIcons.Edit,
                      onClick: () => startEditing('unit', unit.id)
                    },
                    {
                      id: 'add-topic',
                      label: 'Adicionar tópico',
                      icon: ContextMenuIcons.Add,
                      onClick: () => {
                        const title = prompt('Nome do novo tópico:');
                        if (title?.trim()) {
                          addTopic(unit.id, title.trim());
                        }
                      }
                    },
                    {
                      id: 'delete-unit',
                      label: 'Excluir unidade',
                      icon: ContextMenuIcons.Delete,
                      variant: 'danger',
                      onClick: () => {
                        if (confirm(`Tem certeza que deseja excluir a unidade "${unit.title}"?`)) {
                          deleteUnit(unit.id);
                        }
                      }
                    }
                  ]}
                >
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold text-gray-900" onDoubleClick={() => startEditing('unit', unit.id)}>
                          <InlineEditor
                            value={unit.title}
                            onSave={(newTitle) => {
                              updateUnit(unit.id, { title: newTitle });
                              stopEditing();
                            }}
                            onCancel={stopEditing}
                            isEditing={isEditing('unit', unit.id)}
                            className="text-lg font-semibold"
                          />
                        </h2>
                        <span className="text-sm text-gray-500">• {unit.totalChapters} capítulos</span>
                        <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 rounded text-xs text-purple-700">
                          <span>🧬</span>
                          <span>{unit.subject}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </ContextMenu>
              ) : (
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-gray-900">{unit.title}</h2>
                      <span className="text-sm text-gray-500">• {unit.totalChapters} capítulos</span>
                      <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 rounded text-xs text-purple-700">
                        <span>🧬</span>
                        <span>{unit.subject}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Lista de Tópicos */}
              <div className="divide-y divide-gray-100">
                {unit.topics.map((topic) => (
                  <Collapsible
                     key={topic.id}
                     open={openTopic === topic.id}
                     onOpenChange={() => toggleTopicExpansion(topic.id)}
                   >
                     <div className={`${openTopic === topic.id && topic.subtopics ? 'border-2 border-blue-200 rounded-lg p-1' : ''}`}>
                       {isEditMode ? (
                         <ContextMenu
                           options={[
                             {
                               id: 'edit-topic',
                               label: 'Editar nome',
                               icon: ContextMenuIcons.Edit,
                               onClick: () => startEditing('topic', topic.id, unit.id)
                             },
                             {
                               id: 'add-subtopic',
                               label: 'Adicionar subtópico',
                               icon: ContextMenuIcons.Add,
                               onClick: () => {
                                 const title = prompt('Nome do novo subtópico:');
                                 if (title?.trim()) {
                                   addSubtopic(unit.id, topic.id, title.trim());
                                 }
                               }
                             },
                             {
                               id: 'delete-topic',
                               label: 'Excluir tópico',
                               icon: ContextMenuIcons.Delete,
                               variant: 'danger',
                               onClick: () => {
                                 if (confirm(`Tem certeza que deseja excluir o tópico "${topic.title}"?`)) {
                                   deleteTopic(unit.id, topic.id);
                                 }
                               }
                             }
                           ]}
                         >
                           <CollapsibleTrigger asChild>
                             <div className="px-4 py-3 hover:bg-gray-50 cursor-pointer group">
                               <div className="flex items-center justify-between">
                                 <div className="flex-1 flex items-center gap-2">
                                   <h3 className="text-sm font-medium text-gray-900 mb-1" onDoubleClick={() => startEditing('topic', topic.id, unit.id)}>
                                     <InlineEditor
                                       value={topic.title}
                                       onSave={(newTitle) => {
                                         updateTopic(unit.id, topic.id, { title: newTitle });
                                         stopEditing();
                                       }}
                                       onCancel={stopEditing}
                                       isEditing={isEditing('topic', topic.id)}
                                       className="text-sm font-medium"
                                     />
                                   </h3>
                                 </div>
                               </div>
                             </div>
                           </CollapsibleTrigger>
                         </ContextMenu>
                       ) : (
                         <CollapsibleTrigger asChild>
                           <div className="px-4 py-3 hover:bg-gray-50 cursor-pointer group">
                             <div className="flex items-center justify-between">
                               <div className="flex-1 flex items-center gap-2">
                                 <h3 className="text-sm font-medium text-gray-900 mb-1">{topic.title}</h3>
                               </div>
                               <div className="flex items-center gap-4 text-xs text-gray-500">
                                 <div className="flex items-center gap-1">
                                   <div className="w-3 h-3 rounded-full border border-gray-300 bg-white"></div>
                                   <span>{topic.date}</span>
                                 </div>
                                 <span>{topic.totalAulas} Aulas</span>
                                 {topic.subtopics ? (
                                   openTopic === topic.id ? (
                                     <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                                   ) : (
                                     <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                                   )
                                 ) : null}
                               </div>
                             </div>
                           </div>
                         </CollapsibleTrigger>
                       )}
                       
                       {topic.subtopics && (
                           <CollapsibleContent>
                            <div className="bg-gray-50 rounded-b-md">
                              {topic.subtopics.map((subtopic) => {
                              return (
                                <div key={subtopic.id}>
                                  {isEditMode ? (
                                    <ContextMenu
                                      options={[
                                        {
                                          id: 'edit-subtopic',
                                          label: 'Editar nome',
                                          icon: ContextMenuIcons.Edit,
                                          onClick: () => startEditing('subtopic', subtopic.id, unit.id, topic.id)
                                        },
                                        {
                                          id: 'delete-subtopic',
                                          label: 'Excluir subtópico',
                                          icon: ContextMenuIcons.Delete,
                                          variant: 'danger',
                                          onClick: () => {
                                            if (confirm(`Tem certeza que deseja excluir o subtópico "${subtopic.title}"?`)) {
                                              deleteSubtopic(unit.id, topic.id, subtopic.id);
                                            }
                                          }
                                        }
                                      ]}
                                    >
                                      <div className="border-b border-gray-100 hover:bg-gray-50 last:border-b-0 flex">
                                    {/* Coluna esquerda - 10% - Tempo médio com fundo cinza */}
                                    <div className="w-[10%] bg-gray-50 px-4 py-3 flex items-center justify-center border-r border-gray-200 rounded-l-lg">
                                      <div className="flex items-center gap-1.5 text-xs text-gray-700">
                                        <Clock className="w-3 h-3 text-gray-500" />
                                        <span className="font-medium">
                                          {subtopic.tempo}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    {/* Coluna direita - 90% - Conteúdo principal com fundo branco */}
                                    <div className="w-[90%] bg-white px-6 py-3">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 flex-1">
                                          {getStatusIcon(subtopic.status)}
                                          <div className="flex items-center gap-4 flex-1">
                                            <h4 className="text-xs font-medium text-gray-700 min-w-0 flex-shrink-0" onDoubleClick={() => startEditing('subtopic', subtopic.id, unit.id, topic.id)}>
                                              <InlineEditor
                                                value={subtopic.title}
                                                onSave={(newTitle) => {
                                                  updateSubtopic(unit.id, topic.id, subtopic.id, { title: newTitle });
                                                  stopEditing();
                                                }}
                                                onCancel={stopEditing}
                                                isEditing={isEditing('subtopic', subtopic.id)}
                                                className="text-xs font-medium"
                                              />
                                            </h4>
                                          <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-3 text-xs text-gray-600 bg-gradient-to-r from-gray-50 to-white px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm">
                                              <div className="flex items-center gap-1.5 hover:text-green-600 transition-colors duration-200">
                                                <FileText className="w-3 h-3 text-green-500" />
                                                <span className="font-medium">{subtopic.resumosVinculados}</span>
                                              </div>
                                              <div className="flex items-center gap-1.5 hover:text-purple-600 transition-colors duration-200">
                                                <CreditCard className="w-3 h-3 text-purple-500" />
                                                <span className="font-medium">{subtopic.flashcardsVinculados}</span>
                                              </div>
                                              <div className="flex items-center gap-1.5 hover:text-orange-600 transition-colors duration-200">
                                                <HelpCircle className="w-3 h-3 text-orange-500" />
                                                <span className="font-medium">{subtopic.questoesVinculadas}</span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <Button 
                                          size="sm" 
                                          className="h-8 w-8 p-0 rounded-full bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 flex items-center justify-center"
                                          onClick={() => {
                                            console.log('🔍 Button clicked - subtopic data:', subtopic);
                                            console.log('🔍 subtopic.id specifically:', subtopic.id, typeof subtopic.id);
                                            console.log('🔍 subtopic.title specifically:', subtopic.title, typeof subtopic.title);
                                            handlePlaySubtopic(subtopic.id, subtopic.title);
                                          }}
                                        >
                                          <Play className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </ContextMenu>
                            ) : (
                              <div className="border-b border-gray-100 hover:bg-gray-50 last:border-b-0 flex">
                                <div className="w-[10%] bg-gray-50 px-4 py-3 flex items-center justify-center border-r border-gray-200 rounded-l-lg">
                                  <div className="flex items-center gap-1.5 text-xs text-gray-700">
                                    <Clock className="w-3 h-3 text-gray-500" />
                                    <span className="font-medium">
                                      {subtopic.tempo}
                                    </span>
                                  </div>
                                </div>
                                <div className="w-[90%] bg-white px-6 py-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1">
                                      {getStatusIcon(subtopic.status)}
                                      <div className="flex items-center gap-4 flex-1">
                                        <h4 className="text-xs font-medium text-gray-700 min-w-0 flex-shrink-0">
                                          {subtopic.title}
                                        </h4>
                                        <div className="flex items-center gap-3">
                                          <div className="flex items-center gap-3 text-xs text-gray-600 bg-gradient-to-r from-gray-50 to-white px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm">
                                            <div className="flex items-center gap-1.5 hover:text-green-600 transition-colors duration-200">
                                              <FileText className="w-3 h-3 text-green-500" />
                                              <span className="font-medium">{subtopic.resumosVinculados}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 hover:text-purple-600 transition-colors duration-200">
                                              <CreditCard className="w-3 h-3 text-purple-500" />
                                              <span className="font-medium">{subtopic.flashcardsVinculados}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 hover:text-orange-600 transition-colors duration-200">
                                              <HelpCircle className="w-3 h-3 text-orange-500" />
                                              <span className="font-medium">{subtopic.questoesVinculadas}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <Button 
                                        size="sm" 
                                        className="h-8 w-8 p-0 rounded-full bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 flex items-center justify-center"
                                        onClick={() => handlePlaySubtopic(subtopic.id, subtopic.title)}
                                      >
                                        <Play className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                         )
                         })}
                         
                         {/* Botão para adicionar novo subtópico - apenas no modo de edição */}
                           {isEditMode && (
                             <div className="px-4 py-3 bg-white">
                               <AddSubtopicButton 
                                 onClick={async () => {
                        const title = prompt('Nome do novo subtópico:');
                        if (title?.trim()) {
                          const subtopicId = await addSubtopic(unit.id, topic.id, title.trim());
                          if (!subtopicId) {
                            alert('Erro ao criar subtópico. Tente novamente.');
                          }
                        }
                      }}
                               />
                             </div>
                           )}
                           </div>
                         </CollapsibleContent>
                       )}
                     </div>
                   </Collapsible>
                ))}
                
                {/* Botão para adicionar novo tópico - apenas no modo de edição */}
                {isEditMode && (
                  <div className="px-4 py-3 bg-white">
                    <AddTopicButton 
                      onClick={async () => {
                        const title = prompt('Nome do novo tópico:');
                        if (title?.trim()) {
                          const topicId = await addTopic(unit.id, title.trim());
                          if (!topicId) {
                            alert('Erro ao criar tópico. Tente novamente.');
                          }
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Botão para adicionar nova unidade - apenas no modo de edição */}
        {isEditMode && (
          <div className="flex justify-center mt-6">
            <AddUnitButton 
              onClick={async () => {
                const title = prompt('Nome da nova unidade:');
                if (title?.trim()) {
                  const unitId = await addUnit(title.trim(), 'Novo Assunto');
                  if (!unitId) {
                    alert('Erro ao criar unidade. Tente novamente.');
                  }
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentsOrganizationPage;