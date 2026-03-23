import React, { useCallback, useEffect, useRef } from 'react';
import { FileText, HelpCircle, Play, CreditCard, Clock, NotebookPen, TrendingUp, Sparkles, X, Plus, Wrench, Scale } from 'lucide-react';
import { DesempenhoChart } from '../components/DesempenhoChart';
import { useNavigate } from 'react-router-dom';
import { useDocumentsOrganization } from '@/contexts/DocumentsOrganizationContext';
import { HierarchyBreadcrumbs } from '../components/HierarchyBreadcrumbs';
import { NotesModal } from '../components/NotesModal';
import { SubtopicDocumentsModal } from '../components/SubtopicDocumentsModal';
import { QuickCreateModal } from '../components/QuickCreateModal';
import { TopicSubtopicCreateModal } from '../components/TopicSubtopicCreateModal';
import { GoalCreationDialog } from '../components/goals/GoalCreationDialog';
import { TopicAIAssistant } from '../components/TopicAIAssistant';
import { PlateEditor } from '@/components/plate-editor';
import { usePlateDocuments } from '@/hooks/usePlateDocuments';

const DocumentsOrganizationPage = () => {
  const navigate = typeof window !== 'undefined' ? useNavigate() : null;
  const [aiDrawerOpen, setAiDrawerOpen] = React.useState(false);

  // Modo foco - qual card esta expandido
  type FocusCardType = 'document' | 'flashcards' | 'questions' | 'lei-seca' | null;
  const [focusCard, setFocusCard] = React.useState<FocusCardType>(null);
  const [focusDocId, setFocusDocId] = React.useState<string | null>(null);
  const [showDocList, setShowDocList] = React.useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const prevSelectionRef = useRef<string | null>(null);
  const focusMode = focusCard !== null;

  const { getDocumentsBySubtopic } = usePlateDocuments();

  const {
    units, selectedSubtopic, selectedTopic,
    notesModal, setNotesModal,
    documentsModal, setDocumentsModal,
    quickCreateModal, setQuickCreateModal,
    editModal, setEditModal,
    goalDialogOpen, setGoalDialogOpen,
    handlePlaySubtopic, handleQuickCreate,
    handleTopicSubtopicCreate, handleTopicSubtopicEdit,
    createDocument, materialCounts,
    calculateTopicDuration,
    setSelectedSubtopic, setSelectedTopic,
    setExpandedUnits, setExpandedTopics,
  } = useDocumentsOrganization();

  // Sair do foco ao trocar de topico/subtopico
  const currentSelectionId = selectedSubtopic?.subtopic.id || selectedTopic?.topic.id || null;
  useEffect(() => {
    if (prevSelectionRef.current && prevSelectionRef.current !== currentSelectionId && focusCard) {
      setFocusCard(null);
      setFocusDocId(null);
      setShowDocList(false);
    }
    prevSelectionRef.current = currentSelectionId;
  }, [currentSelectionId, focusMode]);

  // Abrir modo foco - documento
  const handleOpenDocumentFocus = useCallback(async () => {
    if (focusCard) return;

    const itemId = selectedSubtopic?.subtopic.id || selectedTopic?.topic.id;
    const itemTitle = selectedSubtopic?.subtopic.title || selectedTopic?.topic.title;
    if (!itemId || !itemTitle) return;

    const docs = getDocumentsBySubtopic(itemId);

    if (docs.length === 0) {
      const newDoc = await createDocument({
        title: `Resumo: ${itemTitle}`,
        content: [{ type: 'p', children: [{ text: '' }] }],
        content_text: '',
        subtopic_id: itemId,
      });
      if (newDoc) {
        setFocusDocId(newDoc.id);
        setShowDocList(false);
        setFocusCard('document');
      }
    } else if (docs.length === 1) {
      setFocusDocId(docs[0].id);
      setShowDocList(false);
      setFocusCard('document');
    } else {
      setFocusDocId(null);
      setShowDocList(true);
      setFocusCard('document');
    }
  }, [focusCard, selectedSubtopic, selectedTopic, getDocumentsBySubtopic, createDocument]);

  // Abrir modo foco - flashcards / questoes (em producao)
  const handleOpenGenericFocus = useCallback((type: 'flashcards' | 'questions' | 'lei-seca') => {
    if (focusCard) return;
    setFocusCard(type);
  }, [focusCard]);

  // Selecionar documento da mini-lista
  const handleSelectDocFromList = useCallback((docId: string) => {
    setFocusDocId(docId);
    setShowDocList(false);
  }, []);

  // Criar novo doc a partir da mini-lista
  const handleCreateNewDocInFocus = useCallback(async () => {
    const itemId = selectedSubtopic?.subtopic.id || selectedTopic?.topic.id;
    const itemTitle = selectedSubtopic?.subtopic.title || selectedTopic?.topic.title;
    if (!itemId || !itemTitle) return;

    const newDoc = await createDocument({
      title: `Resumo: ${itemTitle}`,
      content: [{ type: 'p', children: [{ text: '' }] }],
      content_text: '',
      subtopic_id: itemId,
    });
    if (newDoc) {
      setFocusDocId(newDoc.id);
      setShowDocList(false);
    }
  }, [selectedSubtopic, selectedTopic, createDocument]);

  // Fechar modo foco
  const handleCloseFocusMode = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setFocusCard(null);
    setTimeout(() => {
      setFocusDocId(null);
      setShowDocList(false);
      if (contentRef.current) contentRef.current.scrollTop = 0;
    }, 700);
  }, []);

  // Mini-lista de documentos inline
  const renderDocList = () => {
    const itemId = selectedSubtopic?.subtopic.id || selectedTopic?.topic.id;
    if (!itemId) return null;

    const docs = getDocumentsBySubtopic(itemId)
      .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());

    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }).format(date);
    };

    return (
      <div className="flex-1 overflow-y-auto p-8 doc-focus-scroll">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Escolha um documento
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {docs.length} {docs.length === 1 ? 'documento disponivel' : 'documentos disponiveis'}
          </p>

          <button
            onClick={handleCreateNewDocInFocus}
            className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-border hover:border-green-300 hover:bg-green-50/50 transition-all mb-4"
          >
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Plus className="w-5 h-5 text-green-600" />
            </div>
            <span className="font-medium text-foreground">Criar Novo Documento</span>
          </button>

          <div className="space-y-3">
            {docs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => handleSelectDocFromList(doc.id)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-background hover:border-green-300 hover:shadow-md transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-green-100 group-hover:bg-green-200 flex items-center justify-center transition-colors">
                  <FileText className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">{doc.title}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(doc.updated_at || doc.created_at || '')}
                  </div>
                </div>
                <Play className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Painel de Detalhes */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedSubtopic || selectedTopic ? (
          <>
            {/* COLAPSAVEL: Header + Dashboard */}
            <div className={`doc-focus-collapse collapse-up ${focusMode ? 'collapsed' : ''}`}>
              <div>
                <div className="border-b">
                  <div className="px-6 py-4">
                    <HierarchyBreadcrumbs
                      items={(() => {
                        const breadcrumbs: { label: string; onClick?: () => void }[] = [];
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
                              breadcrumbs.push({ label: selectedSubtopic.subtopic.title });
                            }
                          } else if (selectedTopic) {
                            breadcrumbs.push({ label: selectedTopic.topic.title });
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

                  {/* Painel de Progressao */}
                  <div className="mx-6 mb-4 space-y-3">
                    {/* Stepper horizontal */}
                    <div className="bg-muted rounded-xl px-5 py-3">
                      <div className="flex items-center">
                        {[
                          { emoji: '\u{1F4DA}', label: 'Estudante', completed: true, current: false },
                          { emoji: '\u2696\uFE0F', label: 'Conhecedor', completed: true, current: false },
                          { emoji: '\u{1F3DB}\uFE0F', label: 'Proficiente', completed: false, current: true },
                          { emoji: '\u{1F468}\u200D\u2696\uFE0F', label: 'Especialista', completed: false, current: false },
                        ].map((step, i, arr) => (
                          <React.Fragment key={i}>
                            <div className="flex flex-col items-center shrink-0">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                                step.current
                                  ? 'bg-[#E8930C] shadow-md shadow-amber-200 ring-2 ring-amber-100'
                                  : step.completed
                                    ? 'bg-zinc-800 border border-zinc-700'
                                    : 'bg-gray-100 border border-gray-200'
                              }`}>
                                <span className={step.completed || step.current ? '' : 'opacity-40'}>{step.emoji}</span>
                              </div>
                              <span className={`text-[8px] mt-1 leading-none ${
                                step.current ? 'text-[#E8930C] font-bold' : step.completed ? 'text-zinc-600 font-medium' : 'text-zinc-300'
                              }`}>
                                {step.current ? `\u2191 ${step.label}` : step.label}
                              </span>
                            </div>
                            {i < arr.length - 1 && (
                              <div className="flex-1 h-0.5 rounded-full overflow-hidden bg-gray-200 mx-1.5 -mt-3">
                                <div className={`h-full rounded-full ${
                                  step.completed ? 'w-full bg-zinc-600' : step.current ? 'w-1/2 bg-[#E8930C]' : 'w-0'
                                }`} />
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
                        <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[9px] text-muted-foreground uppercase">Ultimo acesso</div>
                          <div className="text-xs font-semibold text-foreground truncate">
                            {(() => {
                              const raw = selectedSubtopic?.subtopic.lastAccess || selectedTopic?.topic.lastAccess;
                              if (!raw) return 'Nunca';
                              const date = new Date(raw);
                              const now = new Date();
                              const diffMs = now.getTime() - date.getTime();
                              const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                              if (diffDays === 0) {
                                if (diffHours === 0) return 'Agora';
                                return `Ha ${diffHours}h`;
                              }
                              if (diffDays === 1) return 'Ontem';
                              if (diffDays < 7) return `${diffDays}d atras`;
                              return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
                        <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <div className="min-w-0">
                          <div className="text-[9px] text-muted-foreground uppercase">Tempo investido</div>
                          <div className="text-xs font-semibold text-foreground">
                            {(() => {
                              const mins = selectedSubtopic?.subtopic.tempoInvestido || selectedTopic?.topic.tempoInvestido || 0;
                              if (!mins || mins === 0) return 'Nenhum';
                              const h = Math.floor(Number(mins) / 60);
                              const m = Number(mins) % 60;
                              if (h === 0) return `${m}min`;
                              return `${h}h${m > 0 ? ` ${m}m` : ''}`;
                            })()}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (selectedSubtopic) {
                            setNotesModal({ isOpen: true, subtopicId: selectedSubtopic.subtopic.id, topicId: null, title: selectedSubtopic.subtopic.title });
                          } else if (selectedTopic) {
                            setNotesModal({ isOpen: true, subtopicId: null, topicId: selectedTopic.topic.id, title: selectedTopic.topic.title });
                          }
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-amber-50 transition-all text-left"
                      >
                        <NotebookPen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[9px] text-muted-foreground uppercase">Anotacoes</div>
                          <div className="text-xs font-semibold text-amber-700">Ver notas</div>
                        </div>
                      </button>
                    </div>

                    {/* Revisoes + Desempenho + Assistente IA */}
                    <div className="rounded-xl overflow-hidden">
                      <div className="grid grid-cols-[1fr_1fr_1fr]">
                        {/* Revisoes */}
                        <div className="bg-muted p-4">
                          <h4 className="font-semibold text-foreground mb-2 text-xs">Revisoes</h4>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 px-1.5 py-1 rounded-md cursor-pointer hover:bg-green-50 transition-colors">
                              <div className="w-4 h-4 bg-green-100 rounded-full border-2 border-green-500 flex items-center justify-center shrink-0">
                                <svg className="w-2 h-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <span className="text-[11px] font-medium text-foreground">15/01</span>
                              <span className="text-[11px] font-bold text-green-600 ml-auto">85%</span>
                            </div>
                            <div className="flex items-center gap-2 px-1.5 py-1 rounded-md cursor-pointer hover:bg-green-50 transition-colors">
                              <div className="w-4 h-4 bg-green-100 rounded-full border-2 border-green-500 flex items-center justify-center shrink-0">
                                <svg className="w-2 h-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <span className="text-[11px] font-medium text-foreground">12/01</span>
                              <span className="text-[11px] font-bold text-green-600 ml-auto">78%</span>
                            </div>
                            <div className="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-orange-50 transition-colors">
                              <div className="w-4 h-4 bg-orange-100 rounded-full border-2 border-orange-400 flex items-center justify-center shrink-0">
                                <div className="w-1 h-1 bg-orange-500 rounded-full animate-pulse"></div>
                              </div>
                              <span className="text-[11px] font-medium text-orange-600">18/01</span>
                              <button className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-medium rounded-full hover:bg-orange-200 transition-colors ml-auto">Fazer</button>
                            </div>
                            <div className="flex items-center gap-2 px-1.5 py-1 rounded-md">
                              <div className="w-4 h-4 bg-gray-100 rounded-full border-2 border-gray-300 flex items-center justify-center shrink-0">
                                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                              </div>
                              <span className="text-[11px] font-medium text-muted-foreground">22/01</span>
                              <span className="text-[10px] text-muted-foreground ml-auto">4d</span>
                            </div>
                          </div>
                        </div>

                        {/* Grafico Desempenho */}
                        <div className="bg-muted border-l border-border/40 p-4 flex flex-col">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                              Desempenho
                              <svg className="w-3 h-3 text-emerald-500" viewBox="0 0 12 12" fill="none">
                                <path d="M6 9V3M6 3L3 6M6 3L9 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </h4>
                          </div>
                          <div className="flex-1 flex flex-col justify-end">
                            <DesempenhoChart
                              key={selectedSubtopic?.subtopic.id || selectedTopic?.topic.id}
                              altura={160}
                            />
                          </div>
                        </div>

                        {/* Assistente IA */}
                        <div className="bg-zinc-900 dark:bg-zinc-800 border-l border-zinc-700 p-4 flex flex-col rounded-r-lg">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-lg bg-[#E8930C] flex items-center justify-center shrink-0 shadow-sm">
                              <Sparkles className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-zinc-100 text-xs leading-none">Assistente IA</h4>
                              <span className="text-[8px] text-amber-400 font-medium">Beta</span>
                            </div>
                          </div>

                          <p className="text-[11px] text-zinc-400 leading-relaxed flex-1">
                            Seu desempenho em revisoes esta crescendo. Foque nos detalhes de excecoes e qualificadoras para alcancar 90%.
                          </p>

                          <div className="space-y-2 mt-3">
                            <button
                              onClick={() => setAiDrawerOpen(true)}
                              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white text-zinc-900 text-[11px] font-medium hover:bg-zinc-100 transition-all shadow-sm"
                            >
                              <Sparkles className="w-3 h-3 text-[#E8930C]" />
                              Conversar sobre este topico
                            </button>
                            <button className="w-full text-[11px] text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-all px-3 py-1.5 rounded-lg">
                              Gerar questoes
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Materiais de Estudo */}
            <div className="flex-1 flex flex-col overflow-hidden p-6">

              {/* COLAPSAVEL: Titulo */}
              <div className={`doc-focus-collapse collapse-up ${focusMode ? 'collapsed' : ''}`}>
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-4">Materiais de Estudo</h2>
                </div>
              </div>

              <div className={`flex-1 min-h-0 ${focusMode ? 'flex flex-col gap-3' : 'grid grid-cols-2 gap-3 content-start'}`}>

                {/* CARDS DE MATERIAIS - Grid 2x2 / Modo foco */}
                {([
                  {
                    type: 'document' as const,
                    title: 'Documento',
                    subtitle: `${materialCounts.documents} ${materialCounts.documents === 1 ? 'resumo' : 'resumos'}`,
                    icon: FileText,
                    colorBg: 'from-green-100 to-green-200',
                    colorBgActive: 'from-green-500 to-green-700',
                    colorIcon: 'text-green-600',
                    colorShadow: 'shadow-[0_0_20px_rgba(34,197,94,0.4)]',
                    hoverBorder: 'hover:border-green-300',
                    onClick: handleOpenDocumentFocus,
                  },
                  {
                    type: 'flashcards' as const,
                    title: 'Flashcards',
                    subtitle: `${materialCounts.flashcards} ${materialCounts.flashcards === 1 ? 'cartao' : 'cartoes'}`,
                    icon: CreditCard,
                    colorBg: 'from-purple-100 to-purple-200',
                    colorBgActive: 'from-purple-500 to-purple-700',
                    colorIcon: 'text-purple-600',
                    colorShadow: 'shadow-[0_0_20px_rgba(147,51,234,0.4)]',
                    hoverBorder: 'hover:border-purple-300',
                    onClick: () => handleOpenGenericFocus('flashcards'),
                  },
                  {
                    type: 'questions' as const,
                    title: 'Questoes',
                    subtitle: `${materialCounts.questions} ${materialCounts.questions === 1 ? 'questao' : 'questoes'}`,
                    icon: HelpCircle,
                    colorBg: 'from-orange-100 to-orange-200',
                    colorBgActive: 'from-orange-500 to-orange-700',
                    colorIcon: 'text-orange-600',
                    colorShadow: 'shadow-[0_0_20px_rgba(249,115,22,0.4)]',
                    hoverBorder: 'hover:border-orange-300',
                    onClick: () => handleOpenGenericFocus('questions'),
                  },
                  {
                    type: 'lei-seca' as const,
                    title: 'Lei Seca',
                    subtitle: 'Leitura da lei',
                    icon: Scale,
                    colorBg: 'from-sky-100 to-sky-200',
                    colorBgActive: 'from-sky-500 to-sky-700',
                    colorIcon: 'text-sky-600',
                    colorShadow: 'shadow-[0_0_20px_rgba(14,165,233,0.4)]',
                    hoverBorder: 'hover:border-sky-300',
                    onClick: () => handleOpenGenericFocus('lei-seca'),
                  },
                ]).map((card) => {
                  const isActive = focusCard === card.type;
                  const isHidden = focusCard !== null && !isActive;
                  const Icon = card.icon;

                  return (
                    <div
                      key={card.type}
                      className={`
                        ${isHidden ? 'doc-focus-collapse collapse-down collapsed' : ''}
                        ${isActive ? 'flex-1 flex flex-col min-h-0 col-span-2' : ''}
                      `}
                    >
                      <div className={isActive ? 'flex-1 flex flex-col min-h-0' : ''}>
                        <div
                          className={`flex flex-col bg-background rounded-xl border overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.25,1,0.2,1)] ${
                            isActive
                              ? 'flex-1 border-transparent shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] cursor-default'
                              : `flex-none cursor-pointer border-border ${card.hoverBorder} hover:shadow-md hover:-translate-y-0.5`
                          }`}
                          onClick={!focusCard ? card.onClick : undefined}
                        >
                          {/* Header */}
                          <div className={`flex items-center justify-between shrink-0 bg-background/90 backdrop-blur-sm z-10 ${
                            isActive
                              ? 'px-6 h-[72px] border-b border-border'
                              : 'px-4 h-[64px]'
                          }`}>
                            <div className={`flex items-center ${isActive ? 'gap-4' : 'gap-3'}`}>
                              <div className={`relative flex items-center justify-center rounded-xl transition-all duration-600 bg-gradient-to-br ${
                                isActive
                                  ? `w-10 h-10 ${card.colorBgActive} rounded-full scale-90 ${card.colorShadow}`
                                  : `w-9 h-9 ${card.colorBg}`
                              }`}>
                                <Icon className={`transition-colors duration-500 ${
                                  isActive ? 'w-5 h-5 text-white' : `w-[18px] h-[18px] ${card.colorIcon}`
                                }`} />
                              </div>

                              <div className="min-w-0">
                                <h3 className={`font-semibold text-foreground leading-tight ${isActive ? 'text-base' : 'text-sm'}`}>{card.title}</h3>
                                <p className={`text-muted-foreground mt-0.5 transition-all duration-300 truncate ${
                                  isActive ? 'opacity-0 absolute text-xs' : 'opacity-100 text-[11px]'
                                }`}>
                                  {card.subtitle}
                                </p>
                              </div>
                            </div>

                            <button
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted border border-border text-foreground font-semibold text-xs hover:bg-accent transition-all duration-400 ${
                                isActive
                                  ? 'opacity-100 pointer-events-auto scale-100'
                                  : 'opacity-0 pointer-events-none scale-90'
                              }`}
                              onClick={handleCloseFocusMode}
                            >
                              <X className="w-3.5 h-3.5" />
                              Sair do Foco
                            </button>
                          </div>

                          {/* Conteudo interno */}
                          {isActive && (
                            <div className="flex-1 flex flex-col overflow-hidden doc-focus-content-enter" ref={contentRef}>
                              {card.type === 'document' ? (
                                showDocList ? (
                                  renderDocList()
                                ) : focusDocId ? (
                                  <div className="flex-1 overflow-hidden">
                                    <PlateEditor documentId={focusDocId} />
                                  </div>
                                ) : null
                              ) : (
                                <div className="flex-1 flex items-center justify-center">
                                  <div className="text-center max-w-md mx-auto px-8">
                                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${card.colorBg} flex items-center justify-center mx-auto mb-5`}>
                                      <Wrench className={`w-7 h-7 ${card.colorIcon}`} />
                                    </div>
                                    <h3 className="text-lg font-semibold text-foreground mb-2">Em desenvolvimento</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                      {card.type === 'flashcards'
                                        ? 'O estudo de flashcards integrado esta sendo construido. Em breve voce podera revisar seus cartoes diretamente aqui, sem sair da pagina.'
                                        : card.type === 'questions'
                                          ? 'A resolucao de questoes integrada esta sendo construida. Em breve voce podera praticar diretamente aqui, sem sair da pagina.'
                                          : 'A leitura da lei seca integrada esta sendo construida. Em breve voce podera estudar os dispositivos legais diretamente aqui, sem sair da pagina.'
                                      }
                                    </p>
                                    <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-xs font-medium text-muted-foreground">
                                      <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                      Em producao
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div className="text-4xl mb-2">{'\u{1F4DA}'}</div>
              <p>Selecione um topico ou subtopico</p>
            </div>
          </div>
        )}
      </div>

      {/* Assistente IA Drawer */}
      <TopicAIAssistant
        open={aiDrawerOpen}
        onOpenChange={setAiDrawerOpen}
        context={{
          topicTitle: selectedTopic?.topic.title || selectedSubtopic?.subtopic.title,
          subtopicTitle: selectedSubtopic?.subtopic.title,
          level: 'Proficiente',
          lastAccess: (selectedSubtopic?.subtopic as any)?.lastAccess || (selectedTopic?.topic as any)?.lastAccess || undefined,
          timeInvested: (() => {
            const mins = (selectedSubtopic?.subtopic as any)?.tempoInvestido || (selectedTopic?.topic as any)?.tempoInvestido || 0;
            if (!mins || mins === 0) return 'Nenhum';
            const h = Math.floor(Number(mins) / 60);
            const m = Number(mins) % 60;
            return h > 0 ? `${h}h ${m}min` : `${m}min`;
          })(),
          reviews: '15/01: 85%, 12/01: 78%',
        }}
      />

      {/* Modais */}
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

      {quickCreateModal.type === 'unit' && (
        <QuickCreateModal
          isOpen={quickCreateModal.isOpen}
          onClose={() => setQuickCreateModal({ isOpen: false, type: null, unitId: null, topicId: null })}
          onSave={handleQuickCreate}
          title="Nova Unidade"
          placeholder="Digite o nome da unidade..."
        />
      )}

      {(quickCreateModal.type === 'topic' || quickCreateModal.type === 'subtopic') && (
        <TopicSubtopicCreateModal
          isOpen={quickCreateModal.isOpen}
          onClose={() => setQuickCreateModal({ isOpen: false, type: null, unitId: null, topicId: null })}
          onSave={handleTopicSubtopicCreate}
          type={quickCreateModal.type}
          hasSubtopics={false}
          calculatedDuration={0}
        />
      )}

      <GoalCreationDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
      />

      {editModal.isOpen && editModal.type && (
        <TopicSubtopicCreateModal
          isOpen={editModal.isOpen}
          onClose={() => setEditModal({ isOpen: false, type: null, unitId: null, topicId: null, itemId: null, itemTitle: '', itemDuration: 0, hasSubtopics: false })}
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
