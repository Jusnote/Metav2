import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Clock, FileText, Zap, HelpCircle, Play, CreditCard, ArrowLeft, Save, Edit3, Trash2, MoreHorizontal } from 'lucide-react';
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
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [selectedSubtopic, setSelectedSubtopic] = useState<{unitId: string, topicId: string, subtopic: any} | null>(null);
  const [editingUnit, setEditingUnit] = useState<string | null>(null);
  const [editingTopic, setEditingTopic] = useState<string | null>(null);
  const [editingSubtopic, setEditingSubtopic] = useState<string | null>(null);
  
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
    
    setCurrentSubtopic({ id: subtopicId, title: subtopicTitle });
    setShowEditor(true);
    
    // Procurar por um documento existente para este subtópico específico
    const expectedTitle = `Resumo: ${subtopicTitle}`;
    
    const existingDocument = documents.find(doc => 
      (doc as any).subtopic_id === subtopicId || 
      (doc.title === expectedTitle && (!(doc as any).subtopic_id || (doc as any).subtopic_id === ''))
    );

    if (existingDocument) {
      // Se encontrou um documento existente, abrir ele
      if (!(existingDocument as any).subtopic_id || (existingDocument as any).subtopic_id === '') {
        updateDocument(existingDocument.id, { subtopic_id: subtopicId });
      }
      
      setCurrentDocumentId(existingDocument.id);
      setDocumentTitle(existingDocument.title);
    } else {
      // Se não encontrou, criar automaticamente um novo resumo para o subtópico
      const newTitle = `Resumo: ${subtopicTitle}`;
      setDocumentTitle(newTitle);
      
      try {
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
        
        if (newDoc) {
          setCurrentDocumentId(newDoc.id);
          fetchDocuments();
        } else {
          const tempId = `temp-${Date.now()}-${subtopicId}`;
          setCurrentDocumentId(tempId);
        }
    } catch (error) {
      console.error('Erro ao criar documento:', error);
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

  // Inicializar o hook de gerenciamento de unidades
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

  // Expandir primeira unidade automaticamente
  useEffect(() => {
    if (units.length > 0 && expandedUnits.size === 0) {
      setExpandedUnits(new Set([units[0].id]));
    }
  }, [units, expandedUnits]);

  const toggleUnitExpansion = (unitId: string) => {
    setExpandedUnits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(unitId)) {
        newSet.delete(unitId);
      } else {
        newSet.add(unitId);
      }
      return newSet;
    });
  };

  const toggleTopicExpansion = (topicId: string) => {
    setExpandedTopics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(topicId)) {
        newSet.delete(topicId);
      } else {
        newSet.add(topicId);
      }
      return newSet;
    });
  };

  const handleSubtopicSelect = (unitId: string, topicId: string, subtopic: any) => {
    setSelectedSubtopic({ unitId, topicId, subtopic });
  };

  const getStatusIcon = (status: 'not-started' | 'in-progress' | 'completed') => {
    switch (status) {
      case 'completed':
        return <div className="w-3 h-3 rounded-full bg-green-400 flex items-center justify-center">
          <svg className="w-1.5 h-1.5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>;
      case 'in-progress':
        return <div className="w-3 h-3 rounded-full bg-amber-400 flex items-center justify-center">
          <div className="w-1 h-1 bg-white rounded-full"></div>
        </div>;
      case 'not-started':
        return <div className="w-3 h-3 rounded-full border border-gray-300 bg-white"></div>;
      default:
        return <div className="w-3 h-3 rounded-full border border-gray-300 bg-white"></div>;
    }
  };

  // Renderização condicional: Editor ou Lista de Organização
  if (showEditor && currentSubtopic) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header do Editor */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-3">
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
                if (currentDocumentId && loadedDocument && loadedDocument.id === currentDocumentId) {
                  return {
                    id: currentDocumentId,
                    content: loadedDocument.content,
                    title: loadedDocument.title || currentSubtopic?.title || 'Novo Documento'
                  };
                } else {
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
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Container Principal com Margens e Sombra */}
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ height: 'calc(100vh - 4rem)' }}>
        <div className="flex h-full">
          {/* Sidebar Minimalista */}
          <div className="w-96 bg-gray-50 flex flex-col">
            {/* Header da Sidebar */}
            <div className="px-3 py-3 border-b border-gray-200/30">
              <div className="flex items-center justify-between">
                <h1 className="text-base font-normal text-gray-800">Edital</h1>
        <EditModeToggle 
          isEditMode={isEditMode}
          onToggle={() => setIsEditMode(!isEditMode)}
        />
      </div>
            </div>

            {/* Hierarquia Expansível */}
            <div className="flex-1 overflow-y-auto py-1">
              <div className="px-2">
                {units.map((unit, index) => {
                  const unitIcon = ['⚖️', '🏛️', '📋', '🏢', '💼', '📊'][index % 6];
                  const isUnitExpanded = expandedUnits.has(unit.id);
                  
                  return (
                    <div key={unit.id} className="mb-0.5 group">
                      {/* Unit Header */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleUnitExpansion(unit.id)}
                          className="flex-1 flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-all duration-150 hover:bg-gray-100/70"
                        >
                          {unit.topics.length > 0 && (
                            <ChevronRight 
                              className={`w-3 h-3 text-gray-400 transition-transform duration-150 ${
                                isUnitExpanded ? 'rotate-90' : ''
                              }`} 
                            />
                          )}
                          <span className="text-base">{unitIcon}</span>
                          <div className="flex-1 min-w-0">
                            {editingUnit === unit.id ? (
                              <InlineEditor
                                value={unit.title}
                                isEditing={true}
                                onSave={async (newTitle) => {
                                  await updateUnit(unit.id, { title: newTitle });
                                  setEditingUnit(null);
                                }}
                                onCancel={() => setEditingUnit(null)}
                                className="font-normal text-gray-700 text-sm"
                              />
                            ) : (
                              <>
                                <div className="font-normal text-gray-700 truncate text-sm">{unit.title}</div>
                                <div className="text-xs text-gray-400">{unit.topics.length} tópicos</div>
                              </>
                            )}
                          </div>
                        </button>
                        
                        {/* Botões de Ação da Unit */}
                        {isEditMode && editingUnit !== unit.id && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingUnit(unit.id);
                              }}
                              className="p-1 hover:bg-gray-200 rounded transition-colors opacity-0 group-hover:opacity-100"
                              title="Editar unidade"
                            >
                              <Edit3 className="w-3 h-3 text-gray-500" />
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (confirm(`Deletar unidade "${unit.title}"?`)) {
                                  await deleteUnit(unit.id);
                                }
                              }}
                              className="p-1 hover:bg-red-100 rounded transition-colors opacity-0 group-hover:opacity-100"
                              title="Deletar unidade"
                            >
                              <Trash2 className="w-3 h-3 text-red-500" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Topics List */}
                      {isUnitExpanded && (
                        <div className="ml-3 mt-0.5 space-y-0.5 border-l border-gray-200/40 pl-2">
                          {unit.topics.map((topic, topicIndex) => {
                            const isTopicExpanded = expandedTopics.has(topic.id);
                            
                              return (
                              <div key={topic.id} className="group">
                                {/* Topic Header */}
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => toggleTopicExpansion(topic.id)}
                                    className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all duration-150 hover:bg-gray-100/50"
                                  >
                                    {topic.subtopics && topic.subtopics.length > 0 && (
                                      <ChevronRight 
                                        className={`w-3 h-3 text-gray-400 transition-transform duration-150 ${
                                          isTopicExpanded ? 'rotate-90' : ''
                                        }`} 
                                      />
                                    )}
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"></div>
                                    <div className="flex-1 min-w-0">
                                      {editingTopic === topic.id ? (
                                        <InlineEditor
                                          value={topic.title}
                                          isEditing={true}
                                          onSave={async (newTitle) => {
                                            await updateTopic(unit.id, topic.id, { title: newTitle });
                                            setEditingTopic(null);
                                          }}
                                          onCancel={() => setEditingTopic(null)}
                                          className="font-normal text-gray-600 text-xs"
                                        />
                                      ) : (
                                        <>
                                          <div className="font-normal text-gray-600 truncate text-xs">{topic.title}</div>
                                          <div className="text-xs text-gray-400">
                                            {topic.subtopics?.length || 0} itens
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </button>
                                  
                                  {/* Botões de Ação do Topic */}
                                  {isEditMode && editingTopic !== topic.id && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingTopic(topic.id);
                                        }}
                                        className="p-1 hover:bg-gray-200 rounded transition-colors opacity-0 group-hover:opacity-100"
                                        title="Editar tópico"
                                      >
                                        <Edit3 className="w-2.5 h-2.5 text-gray-500" />
                                      </button>
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (confirm(`Deletar tópico "${topic.title}"?`)) {
                                            await deleteTopic(unit.id, topic.id);
                                          }
                                        }}
                                        className="p-1 hover:bg-red-100 rounded transition-colors opacity-0 group-hover:opacity-100"
                                        title="Deletar tópico"
                                      >
                                        <Trash2 className="w-2.5 h-2.5 text-red-500" />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Subtopics List */}
                                {isTopicExpanded && (
                                  <div className="ml-3 mt-0.5 space-y-0.5 border-l border-gray-200/30 pl-2">
                                    {topic.subtopics?.map((subtopic) => (
                                      <div key={subtopic.id} className="group flex items-center gap-1">
                                        <button
                                          onClick={() => handleSubtopicSelect(unit.id, topic.id, subtopic)}
                                          className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all duration-150 hover:bg-gray-100/30 ${
                                            selectedSubtopic?.subtopic.id === subtopic.id ? 'bg-blue-50' : ''
                                          }`}
                                        >
                                          <div className="w-1 h-1 rounded-full bg-gray-400 flex-shrink-0"></div>
                                          <div className="flex-1 min-w-0">
                                            {editingSubtopic === subtopic.id ? (
                                              <InlineEditor
                                                value={subtopic.title}
                                                isEditing={true}
                                                onSave={async (newTitle) => {
                                                  await updateSubtopic(unit.id, topic.id, subtopic.id, { title: newTitle });
                                                  setEditingSubtopic(null);
                                                }}
                                                onCancel={() => setEditingSubtopic(null)}
                                                className="font-normal text-gray-500 text-xs"
                                              />
                                            ) : (
                                              <>
                                                <div className="font-normal text-gray-500 truncate text-xs">{subtopic.title}</div>
                                                <div className="text-xs text-gray-400 flex items-center gap-1">
                                                  <Clock className="w-2.5 h-2.5" />
                                                  {subtopic.tempo}
                                                </div>
                                              </>
                                            )}
                                          </div>
                                          <div className="flex-shrink-0">
                                            {getStatusIcon(subtopic.status)}
                                          </div>
                                        </button>
                                        
                                        {/* Botões de Ação do Subtópico */}
                                        {isEditMode && editingSubtopic !== subtopic.id && (
                                          <div className="flex items-center gap-1">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingSubtopic(subtopic.id);
                                              }}
                                              className="p-1 hover:bg-gray-200 rounded transition-colors opacity-0 group-hover:opacity-100"
                                              title="Editar subtópico"
                                            >
                                              <Edit3 className="w-2 h-2 text-gray-500" />
                                            </button>
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                if (confirm(`Deletar subtópico "${subtopic.title}"?`)) {
                                                  await deleteSubtopic(unit.id, topic.id, subtopic.id);
                                                }
                                              }}
                                              className="p-1 hover:bg-red-100 rounded transition-colors opacity-0 group-hover:opacity-100"
                                              title="Deletar subtópico"
                                            >
                                              <Trash2 className="w-2 h-2 text-red-500" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                    
                                    {/* Botão para Adicionar Subtópico */}
                                    {isEditMode && (
                                      <button
                                        onClick={async () => {
                                          const title = prompt('Nome do novo subtópico:');
                                          if (title?.trim()) {
                                            await addSubtopic(unit.id, topic.id, title.trim());
                                          }
                                        }}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-gray-400 hover:bg-gray-100/50 hover:text-gray-500 transition-all duration-150 border border-dashed border-gray-300/60 mt-1"
                                      >
                                        <span className="text-sm">+</span>
                                        <span className="font-normal text-xs">Novo Subtópico</span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          
                          {/* Botão para Adicionar Tópico */}
                          {isEditMode && (
                            <button
                              onClick={async () => {
                                const title = prompt('Nome do novo tópico:');
                                if (title?.trim()) {
                                  await addTopic(unit.id, title.trim());
                                }
                              }}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-gray-400 hover:bg-gray-100/50 hover:text-gray-500 transition-all duration-150 border border-dashed border-gray-300/60 mt-1"
                            >
                              <span className="text-sm">+</span>
                              <span className="font-normal text-xs">Novo Tópico</span>
                            </button>
                          )}
                             </div>
                           )}
                           </div>
                  );
                })}
                
                {/* Botão Add Unit */}
                {isEditMode && (
                  <div className="mt-3 pt-3 border-t border-gray-200/50">
                    <button
                      onClick={async () => {
                        const title = prompt('Nome da nova unidade:');
                        if (title?.trim()) {
                          await addUnit(title.trim(), 'Novo Assunto');
                        }
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-gray-400 hover:bg-gray-100/50 hover:text-gray-500 transition-all duration-150 border border-dashed border-gray-300/60"
                    >
                      <span className="text-sm">+</span>
                      <span className="font-normal text-xs">Nova Unidade</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Painel de Detalhes */}
          <div className="flex-1 flex flex-col">
            {selectedSubtopic ? (
              <>
                {/* Header do Subtópico Selecionado */}
                <div className="bg-white border-b border-gray-200 px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{['⚖️', '🏛️', '📋', '🏢', '💼', '📊'][units.findIndex(u => u.id === selectedSubtopic.unitId) % 6]}</span>
                      <div>
                        <h1 className="text-xl font-semibold text-gray-900">{selectedSubtopic.subtopic.title}</h1>
                        <p className="text-sm text-gray-500">
                          {units.find(u => u.id === selectedSubtopic.unitId)?.title} • 
                          {units.find(u => u.id === selectedSubtopic.unitId)?.topics.find(t => t.id === selectedSubtopic.topicId)?.title}
                        </p>
                      </div>
                    </div>
                    <div className="ml-auto">
                      {getStatusIcon(selectedSubtopic.subtopic.status)}
                    </div>
                  </div>
                </div>
                
                {/* Conteúdo do Painel de Detalhes */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="space-y-6">
                    {/* Estatísticas */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h3 className="font-semibold text-gray-900 mb-3">Informações</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Tempo estimado:</span>
                          <div className="font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {selectedSubtopic.subtopic.tempo}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Status:</span>
                          <div className="font-medium capitalize">{selectedSubtopic.subtopic.status.replace('-', ' ')}</div>
                        </div>
                      </div>
                    </div>

                    {/* Ações Rápidas */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-900">Materiais de Estudo</h3>
                      
                      {/* Documento */}
                      <button
                        onClick={() => handlePlaySubtopic(selectedSubtopic.subtopic.id, selectedSubtopic.subtopic.title)}
                        className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all text-left"
                      >
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">Documento</div>
                          <div className="text-sm text-gray-500">{selectedSubtopic.subtopic.resumosVinculados} resumos vinculados</div>
                        </div>
                        <Play className="w-4 h-4 text-gray-400" />
                      </button>

                      {/* Flashcards */}
                      <button className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all text-left">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">Flashcards</div>
                          <div className="text-sm text-gray-500">{selectedSubtopic.subtopic.flashcardsVinculados} cartões disponíveis</div>
                        </div>
                        <Play className="w-4 h-4 text-gray-400" />
                      </button>

                      {/* Questões */}
                      <button className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-all text-left">
                        <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                          <HelpCircle className="w-5 h-5 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">Questões</div>
                          <div className="text-sm text-gray-500">{selectedSubtopic.subtopic.questoesVinculadas} questões disponíveis</div>
                        </div>
                        <Play className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <span className="text-4xl mb-4 block">📚</span>
                  <h3 className="text-lg font-medium mb-2">Selecione um subtópico</h3>
                  <p className="text-sm">Escolha um subtópico na sidebar para ver os detalhes e materiais de estudo</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentsOrganizationPage;