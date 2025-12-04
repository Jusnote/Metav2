import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, HelpCircle, Play, CreditCard, Target } from 'lucide-react';
import { useUnitsManager, type Unit, type Topic, type Subtopic } from '../hooks/useUnitsManager';
import { EditModeToggle } from '../components/EditModeToggle';
import { usePlateDocuments } from '../hooks/usePlateDocuments';
import { NotesModal } from '../components/NotesModal';
import { SubtopicDocumentsModal } from '../components/SubtopicDocumentsModal';
import { QuickCreateModal } from '../components/QuickCreateModal';
import { TopicSubtopicCreateModal } from '../components/TopicSubtopicCreateModal';
import { HierarchySearch } from '../components/HierarchySearch';
import { HierarchyBreadcrumbs } from '../components/HierarchyBreadcrumbs';
import { UnitItem } from '../components/UnitItem';
import { TopicItem } from '../components/TopicItem';
import { SubtopicItem } from '../components/SubtopicItem';
import { useMaterialCounts } from '../hooks/useMaterialCounts';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { GoalCreationDialog } from '../components/goals/GoalCreationDialog';
import { Button } from '../components/ui/button';

const DocumentsOrganizationPage = () => {
  // Proteção SSR - useNavigate só funciona no client
  const navigate = typeof window !== 'undefined' ? useNavigate() : null;
  const [isEditMode, setIsEditMode] = useState(false);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [selectedSubtopic, setSelectedSubtopic] = useState<{unitId: string, topicId: string, subtopic: any} | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<{unitId: string, topic: any} | null>(null);
  const [editingUnit, setEditingUnit] = useState<string | null>(null);
  const [subtopicWithScheduleButton, setSubtopicWithScheduleButton] = useState<string | null>(null);

  // Modal de anotações
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

  // Modal de documentos
  const [documentsModal, setDocumentsModal] = useState<{
    isOpen: boolean;
    subtopicId: string | null;
    subtopicTitle: string | null;
  }>({
    isOpen: false,
    subtopicId: null,
    subtopicTitle: null
  });

  // Modal de criação rápida
  const [quickCreateModal, setQuickCreateModal] = useState<{
    isOpen: boolean;
    type: 'unit' | 'topic' | 'subtopic' | null;
    unitId?: string | null;
    topicId?: string | null;
  }>({
    isOpen: false,
    type: null,
    unitId: null,
    topicId: null
  });

  // Modal de edição de tópico/subtópico
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    type: 'topic' | 'subtopic' | null;
    unitId?: string | null;
    topicId?: string | null;
    itemId?: string | null;
    itemTitle?: string;
    itemDuration?: number;
    hasSubtopics?: boolean;
  }>({
    isOpen: false,
    type: null,
    unitId: null,
    topicId: null,
    itemId: null,
    itemTitle: '',
    itemDuration: 0,
    hasSubtopics: false
  });

  // Modal de criação de meta
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);

  const { createDocument } = usePlateDocuments();

  // Hook para contagens de materiais
  const { counts: materialCounts } = useMaterialCounts(
    selectedSubtopic?.subtopic.id,
    selectedSubtopic ? undefined : selectedTopic?.topic.id
  );

  // Gerenciamento de unidades
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
    calculateTopicDuration,
  } = useUnitsManager();

  // Handler para abrir documentos
  const handlePlaySubtopic = async (subtopicId: string, subtopicTitle: string) => {
    setDocumentsModal({
      isOpen: true,
      subtopicId,
      subtopicTitle
    });
  };

  // Handler para criação via QuickCreateModal (unidades apenas)
  const handleQuickCreate = async (name: string) => {
    const { type, unitId, topicId } = quickCreateModal;

    if (type === 'unit') {
      const newUnit = await addUnit(name, 'Novo Assunto');
      // Expandir automaticamente a nova unidade
      if (newUnit) {
        setExpandedUnits(prev => new Set(prev).add(newUnit));
      }
    }

    setQuickCreateModal({ isOpen: false, type: null, unitId: null, topicId: null });
  };

  // Handler para criação de tópicos e subtópicos com tempo estimado
  const handleTopicSubtopicCreate = async (data: { title: string; estimated_duration_minutes: number }) => {
    const { type, unitId, topicId } = quickCreateModal;

    if (type === 'topic' && unitId) {
      const newTopic = await addTopic(unitId, data.title, data.estimated_duration_minutes);
      // Expandir automaticamente a unidade pai e o novo tópico
      setExpandedUnits(prev => new Set(prev).add(unitId));
      if (newTopic) {
        setExpandedTopics(prev => new Set(prev).add(newTopic));
      }
    } else if (type === 'subtopic' && unitId && topicId) {
      await addSubtopic(unitId, topicId, data.title, data.estimated_duration_minutes);
      // Expandir automaticamente a unidade pai e o tópico pai
      setExpandedUnits(prev => new Set(prev).add(unitId));
      setExpandedTopics(prev => new Set(prev).add(topicId));
    }

    setQuickCreateModal({ isOpen: false, type: null, unitId: null, topicId: null });
  };

  // Handler para edição de tópicos e subtópicos via modal
  const handleTopicSubtopicEdit = async (data: { title: string; estimated_duration_minutes: number }) => {
    const { type, unitId, topicId, itemId } = editModal;

    if (type === 'topic' && unitId && itemId) {
      const updates: any = { title: data.title };
      if (data.estimated_duration_minutes !== undefined) {
        updates.estimated_duration_minutes = data.estimated_duration_minutes;
      }
      await updateTopic(unitId, itemId, updates);
    } else if (type === 'subtopic' && unitId && topicId && itemId) {
      const updates: any = { title: data.title };
      if (data.estimated_duration_minutes !== undefined) {
        updates.estimated_duration_minutes = data.estimated_duration_minutes;
      }
      await updateSubtopic(unitId, topicId, itemId, updates);
    }

    setEditModal({
      isOpen: false,
      type: null,
      unitId: null,
      topicId: null,
      itemId: null,
      itemTitle: '',
      itemDuration: 0,
      hasSubtopics: false
    });
  };

  // Handler para marcar subtópico como concluído
  const handleToggleSubtopicComplete = async (
    unitId: string,
    topicId: string,
    subtopicId: string,
    completed: boolean
  ) => {
    await updateSubtopic(unitId, topicId, subtopicId, {
      status: completed ? 'completed' : 'not-started'
    });
  };

  // Handler para busca
  const handleSearchSelect = (result: {
    type: 'unit' | 'topic' | 'subtopic';
    id: string;
    unitId?: string;
    topicId?: string;
    item: Unit | Topic | Subtopic;
  }) => {
    if (result.unitId) {
      setExpandedUnits(prev => {
        const newSet = new Set(prev);
        newSet.add(result.unitId!);
        return newSet;
      });
    }

    if (result.type === 'subtopic' && result.topicId) {
      setExpandedTopics(prev => {
        const newSet = new Set(prev);
        newSet.add(result.topicId!);
        return newSet;
      });
    }

    if (result.type === 'subtopic' && result.unitId && result.topicId) {
      handleSubtopicSelect(result.unitId, result.topicId, result.item);
    } else if (result.type === 'topic' && result.unitId) {
      handleTopicSelect(result.unitId, result.item);
    } else if (result.type === 'unit') {
      setExpandedUnits(prev => new Set(prev).add(result.id));
    }
  };

  // Atalhos de teclado
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'n',
        ctrl: true,
        handler: () => {
          if (isEditMode) {
            setQuickCreateModal({ isOpen: true, type: 'unit', unitId: null, topicId: null });
          }
        }
      },
      {
        key: 't',
        ctrl: true,
        handler: () => {
          if (isEditMode && expandedUnits.size > 0) {
            const firstExpandedUnitId = Array.from(expandedUnits)[0];
            setQuickCreateModal({ isOpen: true, type: 'topic', unitId: firstExpandedUnitId, topicId: null });
          }
        }
      },
      {
        key: 's',
        ctrl: true,
        shift: true,
        handler: () => {
          if (isEditMode && expandedTopics.size > 0 && expandedUnits.size > 0) {
            const firstExpandedUnitId = Array.from(expandedUnits)[0];
            const firstExpandedTopicId = Array.from(expandedTopics)[0];
            setQuickCreateModal({
              isOpen: true,
              type: 'subtopic',
              unitId: firstExpandedUnitId,
              topicId: firstExpandedTopicId
            });
          }
        }
      },
      {
        key: 'e',
        ctrl: true,
        handler: () => {
          setIsEditMode(prev => !prev);
        }
      }
    ],
    enabled: true
  });

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
    setSelectedTopic(null);
  };

  const handleTopicSelect = (unitId: string, topic: any) => {
    setSelectedTopic({ unitId, topic });
    setSelectedSubtopic(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ height: 'calc(100vh - 4rem)' }}>
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-96 bg-gray-50 flex flex-col">
            <div className="px-3 py-3 border-b border-gray-200/30">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-base font-normal text-gray-800">Edital</h1>
                <EditModeToggle
                  isEditMode={isEditMode}
                  onToggle={() => setIsEditMode(!isEditMode)}
                />
              </div>

              <HierarchySearch
                units={units}
                onSelect={handleSearchSelect}
              />

              <Button
                onClick={() => setGoalDialogOpen(true)}
                className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                <Target className="w-4 h-4 mr-2" />
                Criar Nova Meta
              </Button>
            </div>

            {/* Hierarquia */}
            <div className="flex-1 overflow-y-auto py-2">
              <div className="px-3 space-y-1">
                {units.map((unit) => (
                  <UnitItem
                    key={unit.id}
                    unit={unit}
                    isExpanded={expandedUnits.has(unit.id)}
                    isEditMode={isEditMode}
                    isEditing={editingUnit === unit.id}
                    onToggleExpand={() => toggleUnitExpansion(unit.id)}
                    onEdit={() => setEditingUnit(unit.id)}
                    onCancelEdit={() => setEditingUnit(null)}
                    onSave={async (newTitle) => {
                      await updateUnit(unit.id, { title: newTitle });
                      setEditingUnit(null);
                    }}
                    onDelete={async () => {
                      if (confirm(`Deletar unidade "${unit.title}"?`)) {
                        await deleteUnit(unit.id);
                      }
                    }}
                  >
                    <div className="space-y-1">
                      {unit.topics.map((topic) => (
                        <TopicItem
                          key={topic.id}
                          unitId={unit.id}
                          topic={topic}
                          isExpanded={expandedTopics.has(topic.id)}
                          isSelected={selectedTopic?.topic.id === topic.id}
                          isEditMode={isEditMode}
                          isEditing={false}
                          hasSubtopics={!!(topic.subtopics && topic.subtopics.length > 0)}
                          onToggleExpand={() => toggleTopicExpansion(topic.id)}
                          onSelect={() => handleTopicSelect(unit.id, topic)}
                          onEdit={() => {
                            setEditModal({
                              isOpen: true,
                              type: 'topic',
                              unitId: unit.id,
                              topicId: null,
                              itemId: topic.id,
                              itemTitle: topic.title,
                              itemDuration: topic.estimated_duration_minutes || 120,
                              hasSubtopics: !!(topic.subtopics && topic.subtopics.length > 0)
                            });
                          }}
                          onCancelEdit={() => {}}
                          onSave={async () => {}}
                          onDelete={async () => {
                            if (confirm(`Deletar tópico "${topic.title}"?`)) {
                              await deleteTopic(unit.id, topic.id);
                            }
                          }}
                        >
                          {((topic.subtopics && topic.subtopics.length > 0) || isEditMode) && (
                            <div className="space-y-1">
                              {topic.subtopics && topic.subtopics.map((subtopic) => (
                                <SubtopicItem
                                  key={subtopic.id}
                                  subtopic={subtopic}
                                  unitId={unit.id}
                                  topicId={topic.id}
                                  isSelected={selectedSubtopic?.subtopic.id === subtopic.id}
                                  isEditMode={isEditMode}
                                  isEditing={false}
                                  showScheduleButton={subtopicWithScheduleButton === subtopic.id}
                                  onToggleScheduleButton={() => {
                                    setSubtopicWithScheduleButton(
                                      subtopicWithScheduleButton === subtopic.id ? null : subtopic.id
                                    );
                                  }}
                                  onSelect={() => handleSubtopicSelect(unit.id, topic.id, subtopic)}
                                  onEdit={() => {
                                    setEditModal({
                                      isOpen: true,
                                      type: 'subtopic',
                                      unitId: unit.id,
                                      topicId: topic.id,
                                      itemId: subtopic.id,
                                      itemTitle: subtopic.title,
                                      itemDuration: subtopic.estimated_duration_minutes || 90,
                                      hasSubtopics: false
                                    });
                                  }}
                                  onCancelEdit={() => {}}
                                  onSave={async () => {}}
                                  onDelete={async () => {
                                    if (confirm(`Deletar subtópico "${subtopic.title}"?`)) {
                                      await deleteSubtopic(unit.id, topic.id, subtopic.id);
                                    }
                                  }}
                                  onToggleComplete={(completed) =>
                                    handleToggleSubtopicComplete(unit.id, topic.id, subtopic.id, completed)
                                  }
                                />
                              ))}

                              {isEditMode && (
                                <button
                                  onClick={() => {
                                    setQuickCreateModal({
                                      isOpen: true,
                                      type: 'subtopic',
                                      unitId: unit.id,
                                      topicId: topic.id
                                    });
                                  }}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-blue-500 hover:bg-blue-50 hover:text-blue-600 transition-all border border-dashed border-blue-300"
                                >
                                  <span className="text-base font-semibold">+</span>
                                  <span className="font-medium text-xs">Adicionar Subtópico</span>
                                </button>
                              )}
                            </div>
                          )}
                        </TopicItem>
                      ))}

                      {isEditMode && (
                        <button
                          onClick={() => {
                            setQuickCreateModal({
                              isOpen: true,
                              type: 'topic',
                              unitId: unit.id,
                              topicId: null
                            });
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-blue-500 hover:bg-blue-50 hover:text-blue-600 transition-all border border-dashed border-blue-300"
                        >
                          <span className="text-lg font-semibold">+</span>
                          <span className="font-medium text-sm">Adicionar Tópico</span>
                        </button>
                      )}
                    </div>
                  </UnitItem>
                ))}

                {isEditMode && (
                  <div className="mt-3 pt-3 border-t border-gray-200/50">
                    <button
                      onClick={() => {
                        setQuickCreateModal({
                          isOpen: true,
                          type: 'unit',
                          unitId: null,
                          topicId: null
                        });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-gray-400 hover:bg-gray-100/50 hover:text-gray-600 transition-all"
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
          <div className="flex-1 flex flex-col bg-gray-50">
            {selectedSubtopic || selectedTopic ? (
              <>
                {/* Header com informações do usuário/tópico */}
                <div className="bg-white border-b border-gray-200">
                  <div className="px-6 py-4">
                    <HierarchyBreadcrumbs
                      items={(() => {
                        const breadcrumbs = [];
                        const unit = units.find(u => u.id === (selectedSubtopic?.unitId || selectedTopic?.unitId));

                        if (unit) {
                          breadcrumbs.push({
                            label: unit.title,
                            onClick: () => {
                              setSelectedSubtopic(null);
                              setSelectedTopic(null);
                              setExpandedUnits(prev => new Set(prev).add(unit.id));
                            }
                          });

                          if (selectedSubtopic) {
                            const topic = unit.topics.find(t => t.id === selectedSubtopic.topicId);
                            if (topic) {
                              const hasSubtopics = topic.subtopics && topic.subtopics.length > 0;

                              breadcrumbs.push({
                                label: topic.title,
                                onClick: hasSubtopics
                                  ? () => {
                                      setSelectedSubtopic(null);
                                      setExpandedUnits(prev => new Set(prev).add(unit.id));
                                      setExpandedTopics(prev => new Set(prev).add(topic.id));
                                    }
                                  : () => {
                                      setSelectedSubtopic(null);
                                      setSelectedTopic({ unitId: unit.id, topic });
                                    }
                              });
                              breadcrumbs.push({
                                label: selectedSubtopic.subtopic.title
                              });
                            }
                          } else if (selectedTopic) {
                            breadcrumbs.push({
                              label: selectedTopic.topic.title
                            });
                          }
                        }

                        return breadcrumbs;
                      })()}
                      onHomeClick={() => {
                        setSelectedSubtopic(null);
                        setSelectedTopic(null);
                      }}
                    />
                  </div>

                  {/* Informações Minimalistas */}
                  <div className="bg-gray-50 rounded-xl p-4 mx-6 mb-4">
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
                                    {selectedSubtopic ? (selectedSubtopic.subtopic.lastAccess || new Date().toLocaleDateString('pt-BR')) : (selectedTopic?.topic.lastAccess || new Date().toLocaleDateString('pt-BR'))}
                                  </div>
                                </div>
                                <div className="w-px h-6 bg-gray-300 mx-1"></div>
                                <div>
                                  <div className="text-xs text-gray-500 font-medium">Tempo investido</div>
                                  <div className="text-xs font-semibold text-gray-800">
                                    {selectedSubtopic ? (selectedSubtopic.subtopic.tempoInvestido || '0') : (selectedTopic?.topic.tempoInvestido || '0')}
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
                                    topicId: null,
                                    title: selectedSubtopic.subtopic.title
                                  });
                                } else if (selectedTopic) {
                                  setNotesModal({
                                    isOpen: true,
                                    subtopicId: null,
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
                </div>

                {/* Materiais de Estudo */}
                <div className="flex-1 overflow-y-auto p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Materiais de Estudo</h2>
                  <div className="space-y-3">
                    {/* Documento */}
                    <button
                      onClick={() => {
                        const item = selectedSubtopic ? selectedSubtopic.subtopic : selectedTopic?.topic;
                        if (item) {
                          handlePlaySubtopic(item.id, item.title);
                        }
                      }}
                      className="w-full bg-white rounded-xl border border-gray-200 hover:border-green-300 hover:shadow-md transition-all p-5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-green-600" />
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-gray-900 mb-1">Documento</div>
                            <div className="text-sm text-gray-500">
                              {materialCounts.documents} {materialCounts.documents === 1 ? 'resumo vinculado' : 'resumos vinculados'}
                            </div>
                          </div>
                        </div>
                        <Play className="w-5 h-5 text-gray-400" />
                      </div>
                    </button>

                    {/* Flashcards */}
                    <button className="w-full bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                            <CreditCard className="w-6 h-6 text-purple-600" />
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-gray-900 mb-1">Flashcards</div>
                            <div className="text-sm text-gray-500">
                              {materialCounts.flashcards} {materialCounts.flashcards === 1 ? 'cartão disponível' : 'cartões disponíveis'}
                            </div>
                          </div>
                        </div>
                        <Play className="w-5 h-5 text-gray-400" />
                      </div>
                    </button>

                    {/* Questões */}
                    <button className="w-full bg-white rounded-xl border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                            <HelpCircle className="w-6 h-6 text-orange-600" />
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-gray-900 mb-1">Questões</div>
                            <div className="text-sm text-gray-500">
                              {materialCounts.questions} {materialCounts.questions === 1 ? 'questão disponível' : 'questões disponíveis'}
                            </div>
                          </div>
                        </div>
                        <Play className="w-5 h-5 text-gray-400" />
                      </div>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <div className="text-4xl mb-2">📚</div>
                  <p>Selecione um tópico ou subtópico</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <NotesModal
        isOpen={notesModal.isOpen}
        onClose={() => setNotesModal({ isOpen: false, subtopicId: null, topicId: null, title: null })}
        subtopicId={notesModal.subtopicId || undefined}
        topicId={notesModal.topicId || undefined}
        title={notesModal.title || ''}
      />

      {documentsModal.isOpen && documentsModal.subtopicId && (
        <SubtopicDocumentsModal
          isOpen={documentsModal.isOpen}
          onClose={() => setDocumentsModal({ isOpen: false, subtopicId: null, subtopicTitle: null })}
          subtopicId={documentsModal.subtopicId}
          subtopicTitle={documentsModal.subtopicTitle || ''}
          onSelectDocument={(docId) => {
            navigate?.(`/plate-editor?doc=${docId}&subtopic=${documentsModal.subtopicId}&title=${encodeURIComponent(documentsModal.subtopicTitle || '')}`);
          }}
          onCreateNew={async () => {
            const newDoc = await createDocument({
              title: `Resumo: ${documentsModal.subtopicTitle}`,
              content: [{ type: 'p', children: [{ text: '' }] }],
              content_text: '',
              subtopic_id: documentsModal.subtopicId!,
            });
            if (newDoc) {
              navigate?.(`/plate-editor?doc=${newDoc.id}&subtopic=${documentsModal.subtopicId}&title=${encodeURIComponent(documentsModal.subtopicTitle || '')}`);
            }
          }}
        />
      )}

      {/* Modal para criar unidades (sem tempo estimado) */}
      {quickCreateModal.type === 'unit' && (
        <QuickCreateModal
          isOpen={quickCreateModal.isOpen}
          onClose={() => setQuickCreateModal({ isOpen: false, type: null, unitId: null, topicId: null })}
          onSave={handleQuickCreate}
          title="Nova Unidade"
          placeholder="Digite o nome da unidade..."
        />
      )}

      {/* Modal para criar tópicos e subtópicos (com tempo estimado) */}
      {(quickCreateModal.type === 'topic' || quickCreateModal.type === 'subtopic') && (() => {
        // Find the topic if we're creating a subtopic to show calculated duration
        let hasSubtopics = false;
        let calculatedDuration = 0;

        if (quickCreateModal.type === 'topic' && quickCreateModal.unitId) {
          // For topics, we're creating new, so hasSubtopics is always false initially
          hasSubtopics = false;
        }

        return (
          <TopicSubtopicCreateModal
            isOpen={quickCreateModal.isOpen}
            onClose={() => setQuickCreateModal({ isOpen: false, type: null, unitId: null, topicId: null })}
            onSave={handleTopicSubtopicCreate}
            type={quickCreateModal.type}
            hasSubtopics={hasSubtopics}
            calculatedDuration={calculatedDuration}
          />
        );
      })()}

      <GoalCreationDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
      />

      {/* Modal para editar tópicos e subtópicos */}
      {editModal.isOpen && editModal.type && (
        <TopicSubtopicCreateModal
          isOpen={editModal.isOpen}
          onClose={() => setEditModal({
            isOpen: false,
            type: null,
            unitId: null,
            topicId: null,
            itemId: null,
            itemTitle: '',
            itemDuration: 0,
            hasSubtopics: false
          })}
          onSave={handleTopicSubtopicEdit}
          type={editModal.type}
          hasSubtopics={editModal.hasSubtopics || false}
          calculatedDuration={editModal.type === 'topic' && editModal.hasSubtopics ? calculateTopicDuration(
            units.find(u => u.id === editModal.unitId)?.topics.find(t => t.id === editModal.itemId) || {} as any
          ) : 0}
          mode="edit"
          initialTitle={editModal.itemTitle}
          initialDuration={editModal.itemDuration}
        />
      )}
    </div>
  );
};

export default DocumentsOrganizationPage;
