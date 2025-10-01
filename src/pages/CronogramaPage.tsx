import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, BookOpen, ChevronDown, ChevronRight, Play, CheckCircle, Pause, Square, Settings, X, FileText, HelpCircle } from 'lucide-react';
import { DayWithProgress } from '../components/DayWithProgress';
import { useTimer } from '../contexts/TimerContext';


// Interface para tópicos agendados
interface ScheduledTopic {
  topicId: string;
  originalDay: number;
  currentDay: number;
  scheduledDate?: Date;
  movedAt?: Date;
  topic: TopicData;
}

interface TopicData {
  id: string;
  title: string;
  estimatedTime: string;
  cardsCount: number;
  status: string | null;
  completed: boolean;
  description: string;
  subtopics: string[];
}

// Mock data organizado por dia
const mockTopicsByDay = {
  1: [
    {
      id: '1-1',
      title: 'Introduction to Biochemistry',
      estimatedTime: '25 min',
      cardsCount: 12,
      status: null,
      completed: false,
      description: 'Fundamentos básicos da bioquímica e metabolismo celular',
      subtopics: [
        'Estrutura molecular',
        'Enzimas e catálise',
        'Vias metabólicas',
        'Regulação enzimática'
      ]
    },
    {
      id: '1-2',
      title: 'Organic Chemistry Basics',
      estimatedTime: '18 min',
      cardsCount: 8,
      status: 'Revisão',
      completed: true,
      description: 'Conceitos fundamentais de química orgânica',
      subtopics: [
        'Grupos funcionais',
        'Isomeria',
        'Reações orgânicas'
      ]
    }
  ],
  3: [
    {
      id: '3-1',
      title: 'Physics: Mechanics Overview',
      estimatedTime: '22 min',
      cardsCount: 15,
      status: null,
      completed: false,
      description: 'Princípios fundamentais da mecânica clássica',
      subtopics: [
        'Cinemática',
        'Dinâmica',
        'Energia e trabalho',
        'Momento linear'
      ]
    },
    {
      id: '3-2',
      title: 'Thermodynamics Introduction',
      estimatedTime: '16 min',
      cardsCount: 9,
      status: 'Pré-teste',
      completed: false,
      description: 'Leis da termodinâmica e aplicações',
      subtopics: [
        'Primeira lei',
        'Segunda lei',
        'Entropia',
        'Processos reversíveis'
      ]
    }
  ],
  21: [
    {
      id: '21-1',
      title: 'RemNote MCAT Overview',
      estimatedTime: '0 min',
      cardsCount: 1,
      status: null,
      completed: false,
      description: 'Visão geral do sistema RemNote para preparação do MCAT',
      subtopics: [
        'Introdução ao RemNote',
        'Estrutura do MCAT',
        'Estratégias de estudo'
      ]
    },
    {
      id: '21-2', 
      title: 'Cell membrane overview',
      estimatedTime: '19 min',
      cardsCount: 6,
      status: 'Pré-teste',
      completed: false,
      description: 'Estrutura e função das membranas celulares',
      subtopics: [
        'Composição da membrana',
        'Modelo do mosaico fluido',
        'Transporte através da membrana',
        'Proteínas de membrana'
      ]
    },
    {
      id: '21-3',
      title: 'Biological basis of behavior: The nervous system', 
      estimatedTime: '13 min',
      cardsCount: 15,
      status: null,
      completed: false,
      description: 'Fundamentos neurobiológicos do comportamento',
      subtopics: [
        'Anatomia do sistema nervoso',
        'Neurônios e sinapses',
        'Neurotransmissores',
        'Reflexos e comportamentos'
      ]
    },
    {
      id: '21-4',
      title: 'Vectors and scalars',
      estimatedTime: '3 min', 
      cardsCount: 4,
      status: null,
      completed: false,
      description: 'Conceitos fundamentais de vetores e escalares',
      subtopics: [
        'Definição de vetor',
        'Definição de escalar',
        'Operações com vetores'
      ]
    },
    {
      id: '21-5',
      title: 'Acid/base equilibria',
      estimatedTime: '12 min',
      cardsCount: 14, 
      status: null,
      completed: false,
      description: 'Equilíbrios ácido-base em sistemas químicos',
      subtopics: [
        'Teorias ácido-base',
        'pH e pOH',
        'Titulações',
        'Sistemas tampão'
      ]
    },
    {
      id: '21-6',
      title: 'Self-identity',
      estimatedTime: '8 min',
      cardsCount: 10,
      status: null,
      completed: false,
      description: 'Desenvolvimento e conceitos de identidade pessoal',
      subtopics: [
        'Teoria da identidade',
        'Desenvolvimento da personalidade',
        'Fatores sociais'
      ]
    }
  ],
  24: [
    {
      id: '24-1',
      title: 'Psychology: Learning and Memory',
      estimatedTime: '20 min',
      cardsCount: 11,
      status: null,
      completed: false,
      description: 'Processos de aprendizagem e formação de memória',
      subtopics: [
        'Tipos de memória',
        'Condicionamento',
        'Neuroplasticidade',
        'Esquecimento'
      ]
    }
  ],
  28: [
    {
      id: '28-1',
      title: 'Genetics and Evolution',
      estimatedTime: '30 min',
      cardsCount: 20,
      status: 'Revisão',
      completed: false,
      description: 'Princípios de genética e teoria evolutiva',
      subtopics: [
        'Leis de Mendel',
        'Genética molecular',
        'Seleção natural',
        'Especiação',
        'Genética de populações'
      ]
    },
    {
      id: '28-2',
      title: 'Molecular Biology Techniques',
      estimatedTime: '15 min',
      cardsCount: 7,
      status: null,
      completed: true,
      description: 'Técnicas laboratoriais em biologia molecular',
      subtopics: [
        'PCR',
        'Eletroforese',
        'Sequenciamento',
        'Clonagem'
      ]
    }
  ]
};

// Função para converter mock data para estrutura flexível
const convertMockToScheduledTopics = (): ScheduledTopic[] => {
  const scheduledTopics: ScheduledTopic[] = [];
  
  Object.entries(mockTopicsByDay).forEach(([day, topics]) => {
    topics.forEach(topic => {
      scheduledTopics.push({
        topicId: topic.id,
        originalDay: parseInt(day),
        currentDay: parseInt(day),
        topic: topic
      });
    });
  });
  
  return scheduledTopics;
};

export default function CronogramaPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(new Set(['1-2', '28-2'])); // Alguns tópicos já completos para demo
  const [completedSubtopics, setCompletedSubtopics] = useState<Set<string>>(new Set(['21-2-0', '21-2-1', '28-1-0', '28-1-2'])); // Formato: topicId-subtopicIndex
  
  // Estados para reagendamento
  const [scheduledTopics, setScheduledTopics] = useState<ScheduledTopic[]>(() => convertMockToScheduledTopics());
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [rescheduleModal, setRescheduleModal] = useState<{isOpen: boolean; topic: TopicData | null}>({
    isOpen: false,
    topic: null
  });
  
  // Hook do Timer Context
  const { getTotalTimeForSubtopic, getActivityTime, startActivity, getCurrentSessionTime, timerState, activityTimers } = useTimer();

  // Removido re-render em tempo real - subtópicos mostram apenas tempo salvo
  
  // Estados para timers manuais (mantidos para compatibilidade)
  const [activeTimers, setActiveTimers] = useState<Set<string>>(new Set()); // IDs dos timers ativos
  const [timeSpent, setTimeSpent] = useState<Record<string, number>>({}); // Tempo gasto em segundos
  const intervalRefs = useRef<Record<string, NodeJS.Timeout>>({});
  
  // Estado para modal de detalhamento de tempo
  const [timeBreakdownModal, setTimeBreakdownModal] = useState<{
    isOpen: boolean;
    subtopicKey: string | null;
    subtopicName: string | null;
  }>({
    isOpen: false,
    subtopicKey: null,
    subtopicName: null
  });
  
  // Funções de data
  const currentDate = new Date();
  const currentDay = currentDate.getDate();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  // Obter informações do mês atual
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  
  const handleDayClick = (day: number) => {
    setSelectedDay(day);
    // Limpar expansões quando mudar de dia
    setExpandedTopics(new Set());
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
  
  const toggleTopicCompletion = (topicId: string) => {
    const topic = currentTopics.find(t => t.id === topicId);
    if (!topic) return;
    
    setCompletedTopics(prev => {
      const newSet = new Set(prev);
      const wasCompleted = newSet.has(topicId);
      
      if (wasCompleted) {
        // Se estava completo, desmarcar
        newSet.delete(topicId);
        // Também desmarcar todos os subtópicos
        setCompletedSubtopics(prevSub => {
          const newSubSet = new Set(prevSub);
          topic.subtopics.forEach((_, index) => {
            newSubSet.delete(`${topicId}-${index}`);
          });
          return newSubSet;
        });
      } else {
        // Se não estava completo, marcar
        newSet.add(topicId);
        // Também marcar todos os subtópicos
        setCompletedSubtopics(prevSub => {
          const newSubSet = new Set(prevSub);
          topic.subtopics.forEach((_, index) => {
            newSubSet.add(`${topicId}-${index}`);
          });
          return newSubSet;
        });
      }
      
      return newSet;
    });
  };
  
  const toggleSubtopicCompletion = (topicId: string, subtopicIndex: number) => {
    const subtopicKey = `${topicId}-${subtopicIndex}`;
    setCompletedSubtopics(prev => {
      const newSet = new Set(prev);
      const wasCompleted = newSet.has(subtopicKey);
      
      if (wasCompleted) {
        // Se estava completo, desmarcar subtópico
        newSet.delete(subtopicKey);
        // Também desmarcar o tópico principal (já que não está mais 100% completo)
        setCompletedTopics(prevTopics => {
          const newTopicSet = new Set(prevTopics);
          newTopicSet.delete(topicId);
          return newTopicSet;
        });
      } else {
        // Se não estava completo, marcar subtópico
        newSet.add(subtopicKey);
        // Verificar se todos os subtópicos estão completos agora
        const topic = currentTopics.find(t => t.id === topicId);
        if (topic) {
          const allSubtopicsCompleted = topic.subtopics.every((_, index) => 
            index === subtopicIndex || newSet.has(`${topicId}-${index}`)
          );
          
          // Se todos subtópicos estão completos, marcar tópico principal automaticamente
          if (allSubtopicsCompleted) {
            setCompletedTopics(prevTopics => {
              const newTopicSet = new Set(prevTopics);
              newTopicSet.add(topicId);
              return newTopicSet;
            });
          }
        }
      }
      
      return newSet;
    });
  };
  
  const getSubtopicProgress = (topicId: string, subtopics: string[]) => {
    const completedCount = subtopics.filter((_, index) => 
      completedSubtopics.has(`${topicId}-${index}`)
    ).length;
    return { completed: completedCount, total: subtopics.length };
  };
  
  const isTopicCompleteBySubtopics = (topicId: string, subtopics: string[]) => {
    const { completed, total } = getSubtopicProgress(topicId, subtopics);
    return completed === total && total > 0;
  };
  
  // Calcular tempo total do tópico baseado nos subtópicos
  const getTopicTotalTime = (topicId: string, subtopics: string[]) => {
    return subtopics.reduce((total, _, index) => {
      const subtopicKey = `${topicId}-${index}`;
      const totalActivityTime = getTotalTimeForSubtopic(subtopicKey);
      return total + totalActivityTime + (timeSpent[subtopicKey] || 0);
    }, 0);
  };
  
  // Funções do modal de breakdown
  const openTimeBreakdown = (subtopicKey: string, subtopicName: string) => {
    setTimeBreakdownModal({
      isOpen: true,
      subtopicKey,
      subtopicName
    });
  };

  const closeTimeBreakdown = () => {
    setTimeBreakdownModal({
      isOpen: false,
      subtopicKey: null,
      subtopicName: null
    });
  };
  
  // Calcular progresso real de cada dia usando nova estrutura
  const calculateDayProgress = (day: number) => {
    const dayTopics = getTopicsForDay(day);
    if (dayTopics.length === 0) return 0;
    
    const completedCount = dayTopics.filter(topic => {
      const isManuallyCompleted = completedTopics.has(topic.id);
      const isAutoCompleted = isTopicCompleteBySubtopics(topic.id, topic.subtopics);
      return isManuallyCompleted || isAutoCompleted;
    }).length;
    
    return Math.round((completedCount / dayTopics.length) * 100);
  };
  
  // Funções do timer
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const startTimer = (id: string) => {
    if (activeTimers.has(id)) return; // Já está rodando
    
    setActiveTimers(prev => new Set([...prev, id]));
    
    intervalRefs.current[id] = setInterval(() => {
      setTimeSpent(prev => ({
        ...prev,
        [id]: (prev[id] || 0) + 1
      }));
    }, 1000);
  };
  
  const pauseTimer = (id: string) => {
    if (!activeTimers.has(id)) return; // Não está rodando
    
    setActiveTimers(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    
    if (intervalRefs.current[id]) {
      clearInterval(intervalRefs.current[id]);
      delete intervalRefs.current[id];
    }
  };
  
  const resetTimer = (id: string) => {
    pauseTimer(id);
    setTimeSpent(prev => ({
      ...prev,
      [id]: 0
    }));
  };
  
  const toggleTimer = (id: string) => {
    if (activeTimers.has(id)) {
      pauseTimer(id);
    } else {
      startTimer(id);
    }
  };

  // Funções de reagendamento
  const openRescheduleModal = (topic: TopicData) => {
    setRescheduleModal({
      isOpen: true,
      topic: topic
    });
  };

  const closeRescheduleModal = () => {
    setRescheduleModal({
      isOpen: false,
      topic: null
    });
  };

  const rescheduleTopicToDay = (topicId: string, newDay: number) => {
    setScheduledTopics(prev => 
      prev.map(scheduledTopic => 
        scheduledTopic.topicId === topicId
          ? {
              ...scheduledTopic,
              currentDay: newDay,
              movedAt: new Date()
            }
          : scheduledTopic
      )
    );
    closeRescheduleModal();
  };
  
  // Cleanup dos intervals quando componente desmonta
  useEffect(() => {
    return () => {
      Object.values(intervalRefs.current).forEach(interval => {
        if (interval) clearInterval(interval);
      });
    };
  }, []);
  
  // Função para obter tópicos do dia selecionado usando a nova estrutura
  const getTopicsForDay = (day: number): TopicData[] => {
    return scheduledTopics
      .filter(scheduledTopic => scheduledTopic.currentDay === day)
      .map(scheduledTopic => scheduledTopic.topic);
  };
  
  // Obter tópicos do dia selecionado
  const currentTopics = getTopicsForDay(selectedDay);
  
  // Calcular estatísticas do dia atual
  const totalTopics = currentTopics.length;
  const completedCount = currentTopics.filter(topic => {
    const isManuallyCompleted = completedTopics.has(topic.id);
    const isAutoCompleted = isTopicCompleteBySubtopics(topic.id, topic.subtopics);
    return isManuallyCompleted || isAutoCompleted;
  }).length;
  const totalTime = currentTopics.reduce((sum, topic) => {
    const time = parseInt(topic.estimatedTime) || 0;
    return sum + time;
  }, 0);
  const totalCards = currentTopics.reduce((sum, topic) => sum + topic.cardsCount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-xs border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Cronograma de Estudos</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4">
        {/* Single unified container */}
        <div className="bg-white rounded-lg shadow-xs border">
          <div className="grid grid-cols-12">
            
            {/* Calendar Sidebar */}
            <div className="col-span-12 lg:col-span-3 border-r border-gray-200 p-6">
              {/* Date Info */}
              <div className="mb-6">
                <div className="text-2xl font-bold text-gray-900">
                  {monthNames[currentMonth].substring(0, 3)} {selectedDay}
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(currentYear, currentMonth, selectedDay).toLocaleDateString('pt-BR', { weekday: 'long' })}
                </div>
              </div>
              
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                {monthNames[currentMonth]} de {currentYear}
              </h2>
              
              {/* Simple Calendar Grid */}
              <div className="space-y-2">
                {/* Calendar Header */}
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500 mb-2">
                  <div>Dom</div>
                  <div>Seg</div>
                  <div>Ter</div>
                  <div>Qua</div>
                  <div>Qui</div>
                  <div>Sex</div>
                  <div>Sáb</div>
                </div>
                
                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Dias vazios no início do mês */}
                  {Array.from({ length: firstDayOfMonth }, (_, i) => (
                    <DayWithProgress key={`empty-${i}`} day={0} progress={0} isEmpty />
                  ))}
                  
                  {/* Dias do mês atual */}
                  {Array.from({ length: daysInCurrentMonth }, (_, i) => {
                    const day = i + 1;
                    return (
                  <DayWithProgress 
                        key={day}
                        day={day} 
                        progress={calculateDayProgress(day)}
                        isSelected={selectedDay === day}
                        isToday={day === currentDay}
                        onClick={() => handleDayClick(day)}
                      />
                    );
                  })}
                </div>
              </div>
              
              {/* Botão de Reagendamento */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setRescheduleMode(!rescheduleMode)}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    rescheduleMode
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  {rescheduleMode ? 'Sair do Modo Reagendamento' : 'Reagendamento Manual'}
                </button>
                
                {rescheduleMode && (
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Clique no ícone de calendário nos tópicos para reagendar
                  </p>
                )}
              </div>
              
            </div>

            {/* Topics List */}
            <div className="col-span-12 lg:col-span-9 p-6">
              
              {/* Topics Header */}
              <div className="mb-6 border-b pb-4">
                <h2 className="text-lg font-semibold text-gray-800">
                  Tópicos do Dia - {selectedDay} de {monthNames[currentMonth]}
                </h2>
                
                <div className="mt-2 space-y-2">
                  {totalTopics === 0 ? (
                    <p className="text-sm text-gray-500 italic">
                      Nenhum tópico programado para este dia
                    </p>
                  ) : (
                    <>
                      {/* Estatísticas do dia */}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {totalTopics} tópicos
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          {completedCount}/{totalTopics} completos
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {totalTime} min
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {totalCards} cards
                        </span>
                      </div>
                      
                      {/* Barra de progresso */}
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div 
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" 
                          style={{ width: `${(completedCount / totalTopics) * 100}%` }}
                        ></div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Topics List */}
              <div className="space-y-1">
                {currentTopics.map((topic) => {
                  const isExpanded = expandedTopics.has(topic.id);
                  const isManuallyCompleted = completedTopics.has(topic.id);
                  const isAutoCompleted = isTopicCompleteBySubtopics(topic.id, topic.subtopics);
                  const isCompleted = isManuallyCompleted || isAutoCompleted;
                  const subtopicProgress = getSubtopicProgress(topic.id, topic.subtopics);
                  
                  return (
                    <div key={topic.id}>
                      {/* Container com borda quando expandido */}
                      <div className={`${isExpanded ? 'border border-gray-200 rounded-lg bg-white shadow-xs overflow-hidden' : ''}`}>
                        {/* Topic Header */}
                        <div className={`flex items-center justify-between py-2 transition-colors px-2 ${
                          isExpanded 
                            ? 'bg-linear-to-r from-blue-50 to-indigo-50 border-b border-gray-100' 
                            : 'hover:bg-gray-50 rounded-lg'
                        }`}>
                          {/* Topic Info */}
                          <div className="flex items-center gap-3 flex-1">
                            {/* Checkbox */}
                            <button 
                              onClick={() => toggleTopicCompletion(topic.id)}
                              className={`w-5 h-5 border-2 rounded-full flex items-center justify-center transition-all ${
                                isCompleted 
                                  ? 'border-green-500 bg-green-500' 
                                  : 'border-gray-300 hover:border-green-400'
                              }`}
                            >
                              {isCompleted && (
                                <CheckCircle className="h-4 w-4 text-white" />
                              )}
                            </button>
                            
                            {/* Topic Title */}
                            <div className="flex-1">
                              <h3 className={`font-medium transition-all ${
                                isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'
                              }`}>
                                {topic.title}
                              </h3>
                              {topic.status && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 mt-1">
                                  🧠 {topic.status}
                                </span>
                              )}
                            </div>
                            
                            {/* Ícone de Reagendamento */}
                            {rescheduleMode && (
                              <button
                                onClick={() => openRescheduleModal(topic)}
                                className="flex items-center justify-center w-8 h-8 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Reagendar tópico"
                              >
                                <Calendar className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                        {/* Topic Stats */}
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          {/* Time Info */}
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span className="text-xs text-gray-500">Estimado:</span>
                            <span>{topic.estimatedTime}</span>
                            <span className="text-gray-400">|</span>
                            <span className="text-xs text-gray-500">Total:</span>
                            <div className={`px-2 py-1 rounded-md text-xs font-mono ${
                              getTopicTotalTime(topic.id, topic.subtopics) > 0 
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              <span>{formatTime(getTopicTotalTime(topic.id, topic.subtopics))}</span>
                            </div>
                          </div>
                          
                          {/* Cards Count */}
                          <div className="flex items-center gap-1">
                            <BookOpen className="h-4 w-4" />
                            <span>{topic.cardsCount}</span>
                          </div>
                          
                          {/* Expand Button */}
                          <button 
                            onClick={() => toggleTopicExpansion(topic.id)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="p-4 space-y-4">
                            {/* Description */}
                            <div>
                              <p className="text-sm text-gray-700 leading-relaxed">{topic.description}</p>
                            </div>
                            
                            {/* Subtopics */}
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Subtópicos</h5>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span>{subtopicProgress.completed}/{subtopicProgress.total} concluídos</span>
                                  <div className="w-16 bg-gray-200 rounded-full h-1">
                                    <div 
                                      className="bg-blue-500 h-1 rounded-full transition-all duration-300" 
                                      style={{ width: `${subtopicProgress.total > 0 ? (subtopicProgress.completed / subtopicProgress.total) * 100 : 0}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="grid gap-2">
                                {topic.subtopics.map((subtopic, index) => {
                                  const subtopicKey = `${topic.id}-${index}`;
                                  const isSubtopicCompleted = completedSubtopics.has(subtopicKey);
                                  
                                  return (
                                    <div 
                                      key={index} 
                                      className={`group flex items-center gap-3 p-2 rounded-md transition-colors ${
                                        isSubtopicCompleted ? 'bg-green-50 border border-green-200' : 'bg-gray-50 hover:bg-gray-100'
                                      }`}
                                    >
                                      {/* Checkbox do subtópico */}
                                      <button
                                        onClick={() => toggleSubtopicCompletion(topic.id, index)}
                                        className={`shrink-0 w-5 h-5 border-2 rounded-full flex items-center justify-center transition-all ${
                                          isSubtopicCompleted
                                            ? 'border-green-500 bg-green-500'
                                            : 'border-gray-300 hover:border-green-400'
                                        }`}
                                      >
                                        {isSubtopicCompleted && (
                                          <CheckCircle className="h-3 w-3 text-white" />
                                        )}
                                      </button>
                                      
                                      {/* Número do subtópico */}
                                      <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                                        isSubtopicCompleted ? 'bg-green-100' : 'bg-blue-100'
                                      }`}>
                                        <span className={`text-xs font-medium ${
                                          isSubtopicCompleted ? 'text-green-600' : 'text-blue-600'
                                        }`}>
                                          {index + 1}
                                        </span>
                                      </div>
                                      
                                      {/* Nome do subtópico */}
                                      <span className={`flex-1 text-sm transition-all ${
                                        isSubtopicCompleted ? 'text-gray-600 line-through' : 'text-gray-700'
                                      }`}>
                                        {subtopic}
                                      </span>
                                      
                                      {/* Botões de Acesso - Aparecem no Hover */}
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                        <button
                                          onClick={() => {
                                            startActivity(subtopicKey, 'documento', `📄 ${subtopic} - Documento`);
                                            // TODO: Navegar para página do documento
                                            console.log(`Abrindo documento do subtópico: ${subtopicKey}`);
                                          }}
                                          className="p-1 hover:bg-white hover:shadow-xs rounded transition-colors"
                                          title="Abrir documento"
                                        >
                                          <FileText className="h-4 w-4 text-blue-600" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            startActivity(subtopicKey, 'flashcards', `🃏 ${subtopic} - Flashcards`);
                                            // TODO: Navegar para página de flashcards
                                            console.log(`Abrindo flashcards do subtópico: ${subtopicKey}`);
                                          }}
                                          className="p-1 hover:bg-white hover:shadow-xs rounded transition-colors"
                                          title="Estudar flashcards"
                                        >
                                          <BookOpen className="h-4 w-4 text-green-600" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            startActivity(subtopicKey, 'questoes', `❓ ${subtopic} - Questões`);
                                            // TODO: Navegar para página de questões
                                            console.log(`Abrindo questões do subtópico: ${subtopicKey}`);
                                          }}
                                          className="p-1 hover:bg-white hover:shadow-xs rounded transition-colors"
                                          title="Resolver questões"
                                        >
                                          <HelpCircle className="h-4 w-4 text-purple-600" />
                                        </button>
                                      </div>
                                      
                                      {/* Timer do Subtópico */}
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => openTimeBreakdown(subtopicKey, subtopic)}
                                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono hover:ring-2 hover:ring-blue-200 transition-all ${
                                            timerState.isActive && timerState.currentSubtopicKey === subtopicKey
                                            ? 'bg-green-100 text-green-700' 
                                              : (timeSpent[subtopicKey] > 0 || getTotalTimeForSubtopic(subtopicKey) > 0)
                                              ? 'bg-blue-100 text-blue-700'
                                              : 'bg-gray-100 text-gray-500'
                                          }`}
                                          title="Ver detalhamento do tempo"
                                        >
                                     <span>{formatTime(
                                       (timeSpent[subtopicKey] || 0) + getTotalTimeForSubtopic(subtopicKey)
                                     )}</span>
                                        </button>
                                        
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => toggleTimer(subtopicKey)}
                                            className={`p-1 rounded transition-colors ${
                                              activeTimers.has(subtopicKey)
                                                ? 'text-orange-600 hover:bg-orange-50'
                                                : 'text-green-600 hover:bg-green-50'
                                            }`}
                                            title={activeTimers.has(subtopicKey) ? 'Pausar timer' : 'Iniciar timer'}
                                          >
                                            {activeTimers.has(subtopicKey) ? (
                                              <Pause className="h-3 w-3" />
                                            ) : (
                                              <Play className="h-3 w-3" />
                                            )}
                                          </button>
                                          
                                          {timeSpent[subtopicKey] > 0 && (
                                            <button
                                              onClick={() => resetTimer(subtopicKey)}
                                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                              title="Resetar timer"
                                            >
                                              <Square className="h-3 w-3" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex gap-2 pt-2 border-t border-gray-100">
                              <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors shadow-xs">
                                <Play className="h-4 w-4" />
                                Iniciar Estudo
                              </button>
                              <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors">
                                <BookOpen className="h-4 w-4" />
                                Ver Flashcards
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Reagendamento */}
      {rescheduleModal.isOpen && rescheduleModal.topic && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            {/* Header do Modal */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Reagendar Tópico
              </h3>
              <button
                onClick={closeRescheduleModal}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {/* Informações do Tópico */}
            <div className="mb-6 p-3 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900">{rescheduleModal.topic.title}</h4>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {rescheduleModal.topic.estimatedTime}
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  {rescheduleModal.topic.cardsCount} cards
                </span>
              </div>
            </div>

            {/* Seletor de Dia */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Selecione o novo dia:
              </label>
              
              <div className="grid grid-cols-7 gap-2">
                {/* Cabeçalho dos dias da semana */}
                <div className="text-xs font-medium text-gray-500 text-center py-1">Dom</div>
                <div className="text-xs font-medium text-gray-500 text-center py-1">Seg</div>
                <div className="text-xs font-medium text-gray-500 text-center py-1">Ter</div>
                <div className="text-xs font-medium text-gray-500 text-center py-1">Qua</div>
                <div className="text-xs font-medium text-gray-500 text-center py-1">Qui</div>
                <div className="text-xs font-medium text-gray-500 text-center py-1">Sex</div>
                <div className="text-xs font-medium text-gray-500 text-center py-1">Sáb</div>
                
                {/* Dias vazios no início do mês no modal */}
                {Array.from({ length: firstDayOfMonth }, (_, i) => (
                  <div key={`modal-empty-${i}`} className="h-8"></div>
                ))}
                
                {/* Dias do mês atual no modal */}
                {Array.from({ length: daysInCurrentMonth }, (_, i) => {
                  const day = i + 1;
                  const hasTopics = getTopicsForDay(day).length > 0;
                  const currentTopicDay = scheduledTopics.find(st => st.topicId === rescheduleModal.topic?.id)?.currentDay;
                  const isCurrentDay = day === currentTopicDay;
                  
                  return (
                    <button
                      key={day}
                      onClick={() => rescheduleModal.topic && rescheduleTopicToDay(rescheduleModal.topic.id, day)}
                      disabled={isCurrentDay}
                      className={`
                        h-8 text-xs font-medium rounded transition-colors
                        ${isCurrentDay 
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                          : hasTopics
                            ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }
                      `}
                      title={
                        isCurrentDay 
                          ? 'Dia atual do tópico' 
                          : hasTopics 
                            ? `${getTopicsForDay(day).length} tópicos neste dia`
                            : 'Dia disponível'
                      }
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={closeRescheduleModal}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhamento de Tempo */}
      {timeBreakdownModal.isOpen && timeBreakdownModal.subtopicKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            {/* Header do Modal */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Tempo por Atividade
              </h3>
              <button
                onClick={closeTimeBreakdown}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {/* Nome do Subtópico */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900">{timeBreakdownModal.subtopicName}</h4>
            </div>

            {/* Breakdown do Tempo */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-blue-50">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Documento</span>
                </div>
                <span className="text-sm font-mono text-blue-700">
                  {formatTime(getActivityTime(timeBreakdownModal.subtopicKey, 'documento'))}
                </span>
              </div>
              
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-green-50">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Flashcards</span>
                </div>
                <span className="text-sm font-mono text-green-700">
                  {formatTime(getActivityTime(timeBreakdownModal.subtopicKey, 'flashcards'))}
                </span>
              </div>
              
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-purple-50">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">Questões</span>
                </div>
                <span className="text-sm font-mono text-purple-700">
                  {formatTime(getActivityTime(timeBreakdownModal.subtopicKey, 'questoes'))}
                </span>
              </div>
              
              {/* Timer Manual */}
              {timeSpent[timeBreakdownModal.subtopicKey] > 0 && (
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-900">Timer Manual</span>
                  </div>
                  <span className="text-sm font-mono text-gray-700">
                    {formatTime(timeSpent[timeBreakdownModal.subtopicKey])}
                  </span>
                </div>
              )}
            </div>

            {/* Tempo Total */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-indigo-50">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-indigo-600" />
                  <span className="font-semibold text-indigo-900">Total</span>
                </div>
                <span className="text-lg font-mono font-bold text-indigo-700">
                  {formatTime((timeSpent[timeBreakdownModal.subtopicKey] || 0) + getTotalTimeForSubtopic(timeBreakdownModal.subtopicKey))}
                </span>
              </div>
            </div>

            {/* Botão de Fechar */}
            <div className="flex justify-end mt-4">
              <button
                onClick={closeTimeBreakdown}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
