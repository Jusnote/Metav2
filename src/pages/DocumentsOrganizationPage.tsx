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
import { NotesModal } from '@/components/NotesModal';

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
  const [selectedTopic, setSelectedTopic] = useState<{unitId: string, topic: any} | null>(null);
  const [editingUnit, setEditingUnit] = useState<string | null>(null);
  const [editingTopic, setEditingTopic] = useState<string | null>(null);
  const [editingSubtopic, setEditingSubtopic] = useState<string | null>(null);
  const [reviewDetailModal, setReviewDetailModal] = useState<{
    isOpen: boolean;
    reviewId: string | null;
    date: string | null;
    data: any;
  }>({
    isOpen: false,
    reviewId: null,
    date: null,
    data: null
  });
  
  // Estados para o modal de anotações
  const [notesModal, setNotesModal] = useState<{
    isOpen: boolean;
    subtopicId?: string | null;
    topicId?: string | null;
    title: string | null;
  }>({
    isOpen: false,
    subtopicId: null,
    topicId: null,
    title: null
  });
  
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
    isEditing,
    updateLastAccess
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
    setSelectedTopic(null); // Limpar seleção de tópico quando subtópico é selecionado
    
    // Atualizar last_access do subtópico
    updateLastAccess('subtopic', subtopic.id);
  };

  const handleTopicSelect = (unitId: string, topic: any) => {
    // Só selecionar tópico se ele não tiver subtópicos
    if (!topic.subtopics || topic.subtopics.length === 0) {
      setSelectedTopic({ unitId, topic });
      setSelectedSubtopic(null); // Limpar seleção de subtópico
      
      // Atualizar last_access do tópico
      updateLastAccess('topic', topic.id);
    }
  };

  // Mock data para detalhes da revisão (em produção viria do backend)
  const getReviewDetails = (reviewId: string) => {
    const mockData = {
      '15/01': {
        date: '15/01/2024',
        questoes: { total: 25, acertos: 21, taxa: 85 },
        flashcards: { total: 40, acertos: 34, taxa: 85 },
        tempoGasto: '45min',
        observacoes: 'Boa performance geral, dificuldade em questões sobre prazos processuais.'
      },
      '12/01': {
        date: '12/01/2024',
        questoes: { total: 20, acertos: 16, taxa: 78 },
        flashcards: { total: 35, acertos: 27, taxa: 77 },
        tempoGasto: '38min',
        observacoes: 'Melhor desempenho em teoria, precisa revisar jurisprudência.'
      }
    };
    return mockData[reviewId] || null;
  };

  const handleReviewClick = (reviewId: string, date: string) => {
    const reviewData = getReviewDetails(reviewId);
    if (reviewData) {
      setReviewDetailModal({
        isOpen: true,
        reviewId,
        date,
        data: reviewData
      });
    }
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
                                    onClick={() => {
                                      if (topic.subtopics && topic.subtopics.length > 0) {
                                        toggleTopicExpansion(topic.id);
                                      } else {
                                        handleTopicSelect(unit.id, topic);
                                      }
                                    }}
                                    className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all duration-150 hover:bg-gray-100/50 ${
                                      selectedTopic?.topic.id === topic.id ? 'bg-blue-50' : ''
                                    }`}
                                  >
                                    {topic.subtopics && topic.subtopics.length > 0 && (
                                      <ChevronRight 
                                        className={`w-3 h-3 text-gray-400 transition-transform duration-150 ${
                                          isTopicExpanded ? 'rotate-90' : ''
                                        }`} 
                                      />
                                    )}
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"></div>
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
                                          <div className="w-1 h-1 rounded-full bg-gray-400 shrink-0"></div>
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
                                          <div className="shrink-0">
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
            {selectedSubtopic || selectedTopic ? (
              <>
                {/* Header do Item Selecionado */}
                <div className="bg-white border-b border-gray-200 px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{['⚖️', '🏛️', '📋', '🏢', '💼', '📊'][units.findIndex(u => u.id === (selectedSubtopic?.unitId || selectedTopic?.unitId)) % 6]}</span>
                      <div>
                        <h1 className="text-xl font-semibold text-gray-900">
                          {selectedSubtopic ? selectedSubtopic.subtopic.title : selectedTopic?.topic.title}
                        </h1>
                        <p className="text-sm text-gray-500">
                          {units.find(u => u.id === (selectedSubtopic?.unitId || selectedTopic?.unitId))?.title}
                          {selectedSubtopic && (
                            <> • {units.find(u => u.id === selectedSubtopic.unitId)?.topics.find(t => t.id === selectedSubtopic.topicId)?.title}</>
                          )}
                        </p>
                               </div>
                                 </div>
                    <div className="ml-auto">
                      {selectedSubtopic ? getStatusIcon(selectedSubtopic.subtopic.status) : getStatusIcon(selectedTopic?.topic.status)}
                               </div>
                             </div>
                           </div>
                
                {/* Conteúdo do Painel de Detalhes */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="space-y-6">
                    {/* Informações Minimalistas */}
                    <div className="bg-gray-50 rounded-xl p-4">
                       <div className="mb-3">
                         <div className="grid grid-cols-2 gap-6">
                          {/* Lado Esquerdo - Progressão */}
                          <div className="flex flex-col justify-between h-full">
                            {/* Escala Jurídica Horizontal Compacta */}
                            <div className="relative">
                              {/* Timeline Jurídica */}
                              <div className="flex items-center justify-between mb-3">
                                {/* Nível 1 - Estudante */}
                                <div className="flex flex-col items-center">
                                  <div className="w-6 h-6 bg-gray-300 bg-opacity-50 rounded-full flex items-center justify-center text-gray-400 text-sm relative z-10 opacity-40">
                                    📚
                                  </div>
                                  <span className="text-xs text-gray-400 mt-1 opacity-40">Estudante</span>
                                </div>
                                
                                {/* Linha 1-2 */}
                                <div className="flex-1 h-px bg-gray-300 mx-2 -mt-6 opacity-30"></div>
                                
                                {/* Nível 2 - Conhecedor */}
                                <div className="flex flex-col items-center">
                                  <div className="w-6 h-6 bg-gray-300 bg-opacity-50 rounded-full flex items-center justify-center text-gray-400 text-sm relative z-10 opacity-40">
                                    ⚖️
                                  </div>
                                  <span className="text-xs text-gray-400 mt-1 opacity-40">Conhecedor</span>
                                </div>
                                
                                {/* Linha 2-3 */}
                                <div className="flex-1 h-px bg-gray-300 mx-2 -mt-6 opacity-30"></div>
                                
                                {/* Nível 3 - Proficiente (Atual) */}
                                <div className="flex flex-col items-center relative">
                                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm shadow-lg relative z-10">
                                    🏛️
                                  </div>
                                  <span className="text-xs text-blue-700 mt-1 font-semibold">Proficiente</span>
                                  {/* Indicador "Você está aqui" */}
                                  <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
                                    <div className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
                                      Você está aqui
                                    </div>
                                    <div className="w-1.5 h-1.5 bg-blue-600 rotate-45 absolute top-[-3px] left-1/2 transform -translate-x-1/2"></div>
                                      </div>
                                    </div>
                                    
                                {/* Linha 3-4 */}
                                <div className="flex-1 h-px bg-gray-300 mx-2 -mt-6 opacity-30"></div>
                                
                                {/* Nível 4 - Especialista */}
                                <div className="flex flex-col items-center">
                                  <div className="w-6 h-6 bg-gray-300 bg-opacity-50 rounded-full flex items-center justify-center text-gray-400 text-sm relative z-10 opacity-40">
                                    👨‍💼
                                              </div>
                                  <span className="text-xs text-gray-400 mt-1 opacity-40">Especialista</span>
                                              </div>
                                            </div>
                                          </div>
                            
                            <div className="space-y-2">
                              {/* Último Acesso e Tempo Investido */}
                              <div className="flex items-center gap-2 p-1.5 rounded-md bg-gray-50/50 border border-gray-200/50">
                                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div>
                                    <div className="text-xs text-gray-500 font-medium">Último acesso</div>
                                    <div className="text-xs font-semibold text-gray-800">
                                      {selectedSubtopic ? selectedSubtopic.subtopic.lastAccess : selectedTopic?.topic.lastAccess}
                                    </div>
                                  </div>
                                  <div className="w-px h-6 bg-gray-300 mx-1"></div>
                                  <div>
                                    <div className="text-xs text-gray-500 font-medium">Tempo investido</div>
                                    <div className="text-xs font-semibold text-gray-800">
                                      {selectedSubtopic ? selectedSubtopic.subtopic.tempoInvestido : selectedTopic?.topic.tempoInvestido}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Minhas Anotações */}
              <div 
                className="flex items-center gap-2 p-1.5 rounded-md bg-gray-50/50 border border-gray-200/50 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors"
                onClick={() => {
                  if (selectedSubtopic) {
                    setNotesModal({
                      isOpen: true,
                      subtopicId: selectedSubtopic.subtopic.id,
                      title: selectedSubtopic.subtopic.title
                    });
                  } else if (selectedTopic) {
                    setNotesModal({
                      isOpen: true,
                      topicId: selectedTopic.topic.id,
                      title: selectedTopic.topic.title
                    });
                  }
                }}
              >
                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                  <FileText className="w-3 h-3 text-gray-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-medium">Minhas anotações</div>
                  <div className="text-xs font-semibold text-gray-800">Ver anotações</div>
                </div>
              </div>
                            </div>
                                </div>
                          
                          {/* Divisor Vertical */}
                          <div className="relative">
                            <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-300"></div>
                            
                            {/* Lado Direito - Revisões Práticas */}
                            <div className="pl-6">
                              <h4 className="font-semibold text-gray-900 mb-3 text-sm">Revisões Práticas</h4>
                              
                              {/* Timeline Vertical */}
                              <div className="space-y-2">
                                {/* Revisão Concluída */}
                                <div 
                                  className="flex items-center gap-2 cursor-pointer hover:bg-green-50 rounded-md px-2 py-1 -mx-2 -my-1 transition-colors"
                                  onClick={() => handleReviewClick('15/01', '15/01/2024')}
                                >
                                  <div className="flex items-center justify-center w-4 h-4 bg-green-100 rounded-md border-2 border-green-500">
                                    <svg className="w-2 h-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                  <div className="flex-1 flex items-center justify-between">
                                    <div className="text-xs font-medium text-gray-900">15/01</div>
                                    <div className="text-xs font-semibold text-green-600">85%</div>
                                      </div>
                                    </div>
                                
                                {/* Linha de Conexão */}
                                <div className="ml-2 w-px h-2 bg-blue-300"></div>
                                
                                {/* Revisão Concluída 2 */}
                                <div 
                                  className="flex items-center gap-2 cursor-pointer hover:bg-green-50 rounded-md px-2 py-1 -mx-2 -my-1 transition-colors"
                                  onClick={() => handleReviewClick('12/01', '12/01/2024')}
                                >
                                  <div className="flex items-center justify-center w-4 h-4 bg-green-100 rounded-md border-2 border-green-500">
                                    <svg className="w-2 h-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                  <div className="flex-1 flex items-center justify-between">
                                    <div className="text-xs font-medium text-gray-900">12/01</div>
                                    <div className="text-xs font-semibold text-green-600">78%</div>
                                  </div>
                                </div>
                                
                                {/* Linha de Conexão */}
                                <div className="ml-2 w-px h-2 bg-blue-300"></div>
                                
                                {/* Revisão Pendente */}
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center justify-center w-4 h-4 bg-orange-100 rounded-md border-2 border-orange-400">
                                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-sm animate-pulse"></div>
                                  </div>
                                  <div className="flex-1 flex items-center justify-between">
                                    <div className="text-xs font-medium text-orange-600">18/01</div>
                                    <button className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full hover:bg-orange-200 transition-colors">
                                      Fazer
                                    </button>
                                  </div>
                                            </div>
                                
                                {/* Linha de Conexão */}
                                <div className="ml-2 w-px h-2 bg-blue-300"></div>
                                
                                {/* Revisão Agendada */}
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center justify-center w-4 h-4 bg-gray-100 rounded-md border-2 border-gray-300">
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-sm"></div>
                                            </div>
                                  <div className="flex-1 flex items-center justify-between">
                                    <div className="text-xs font-medium text-gray-600">22/01</div>
                                    <div className="text-xs text-gray-400">4d</div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    </div>
                                  </div>
                                </div>

                    {/* Ações Rápidas */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-900">Materiais de Estudo</h3>
                      
                      {/* Documento */}
                      <button
                        onClick={() => {
                          const item = selectedSubtopic ? selectedSubtopic.subtopic : selectedTopic?.topic;
                          if (item) {
                            handlePlaySubtopic(item.id, item.title);
                          }
                        }}
                        className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all text-left"
                      >
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">Documento</div>
                          <div className="text-sm text-gray-500">
                            {selectedSubtopic ? selectedSubtopic.subtopic.resumosVinculados : selectedTopic?.topic.resumosVinculados} resumos vinculados
                          </div>
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
                          <div className="text-sm text-gray-500">
                            {selectedSubtopic ? selectedSubtopic.subtopic.flashcardsVinculados : selectedTopic?.topic.flashcardsVinculados} cartões disponíveis
                          </div>
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
                          <div className="text-sm text-gray-500">
                          {selectedSubtopic ? selectedSubtopic.subtopic.questoesVinculadas : selectedTopic?.topic.questoesVinculadas} questões disponíveis
                        </div>
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
                  <h3 className="text-lg font-medium mb-2">Selecione um tópico ou subtópico</h3>
                  <p className="text-sm">Escolha um tópico (sem subtópicos) ou subtópico na sidebar para ver os detalhes e materiais de estudo</p>
                     </div>
                  </div>
                )}
              </div>
            </div>
          </div>
      
      {/* Modal de Detalhes da Revisão */}
      {reviewDetailModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Revisão Detalhada</h2>
                <p className="text-sm text-gray-500">{reviewDetailModal.data?.date}</p>
              </div>
              <button
                onClick={() => setReviewDetailModal({ isOpen: false, reviewId: null, date: null, data: null })}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Conteúdo */}
            <div className="p-6 space-y-6">
              {/* Resumo Geral */}
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-blue-900">Performance Geral</h3>
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round((reviewDetailModal.data?.questoes.taxa + reviewDetailModal.data?.flashcards.taxa) / 2)}%
                  </div>
                </div>
                <p className="text-sm text-blue-700">Tempo gasto: {reviewDetailModal.data?.tempoGasto}</p>
              </div>
              
              {/* Questões */}
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <HelpCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-900">Questões</h3>
                    <p className="text-sm text-green-700">{reviewDetailModal.data?.questoes.acertos} de {reviewDetailModal.data?.questoes.total} questões</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700">Taxa de acerto:</span>
                    <span className="font-semibold text-green-800">{reviewDetailModal.data?.questoes.taxa}%</span>
                  </div>
                  <div className="w-full bg-green-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${reviewDetailModal.data?.questoes.taxa}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              {/* Flashcards */}
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-purple-900">Flashcards</h3>
                    <p className="text-sm text-purple-700">{reviewDetailModal.data?.flashcards.acertos} de {reviewDetailModal.data?.flashcards.total} flashcards</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-700">Taxa de acerto:</span>
                    <span className="font-semibold text-purple-800">{reviewDetailModal.data?.flashcards.taxa}%</span>
                  </div>
                  <div className="w-full bg-purple-200 rounded-full h-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${reviewDetailModal.data?.flashcards.taxa}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              {/* Observações */}
              {reviewDetailModal.data?.observacoes && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Observações</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {reviewDetailModal.data.observacoes}
                  </p>
          </div>
        )}
      </div>
            
            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setReviewDetailModal({ isOpen: false, reviewId: null, date: null, data: null })}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Anotações */}
      <NotesModal
        isOpen={notesModal.isOpen}
        onClose={() => setNotesModal({ isOpen: false, subtopicId: null, topicId: null, title: null })}
        subtopicId={notesModal.subtopicId}
        topicId={notesModal.topicId}
        title={notesModal.title || ''}
      />
    </div>
  );
};

export default DocumentsOrganizationPage;