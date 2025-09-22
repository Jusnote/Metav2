import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, BookOpen, ChevronDown, ChevronRight, Play, CheckCircle, Pause, Square } from 'lucide-react';
import { DayWithProgress } from '../components/DayWithProgress';


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

export default function CronogramaPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(21);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(new Set(['1-2', '28-2'])); // Alguns tópicos já completos para demo
  const [completedSubtopics, setCompletedSubtopics] = useState<Set<string>>(new Set(['21-2-0', '21-2-1', '28-1-0', '28-1-2'])); // Formato: topicId-subtopicIndex
  
  // Estados para timers
  const [activeTimers, setActiveTimers] = useState<Set<string>>(new Set()); // IDs dos timers ativos
  const [timeSpent, setTimeSpent] = useState<Record<string, number>>({}); // Tempo gasto em segundos
  const intervalRefs = useRef<Record<string, NodeJS.Timeout>>({});
  
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
      return total + (timeSpent[subtopicKey] || 0);
    }, 0);
  };
  
  // Calcular progresso real de cada dia
  const calculateDayProgress = (day: number) => {
    const dayTopics = mockTopicsByDay[day] || [];
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
  
  // Cleanup dos intervals quando componente desmonta
  useEffect(() => {
    return () => {
      Object.values(intervalRefs.current).forEach(interval => {
        if (interval) clearInterval(interval);
      });
    };
  }, []);
  
  // Obter tópicos do dia selecionado
  const currentTopics = mockTopicsByDay[selectedDay] || [];
  
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
      <div className="bg-white shadow-sm border-b">
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
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="grid grid-cols-12">
            
            {/* Calendar Sidebar */}
            <div className="col-span-12 lg:col-span-3 border-r border-gray-200 p-6">
              {/* Date Info */}
              <div className="mb-6">
                <div className="text-2xl font-bold text-gray-900">Sep {selectedDay}</div>
                <div className="text-sm text-gray-500">Sunday</div>
              </div>
              
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Novembro de 2024
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
                  {/* Week 1 */}
                  <DayWithProgress day={0} progress={0} isEmpty />
                  <DayWithProgress day={0} progress={0} isEmpty />
                  <DayWithProgress day={0} progress={0} isEmpty />
                  <DayWithProgress day={0} progress={0} isEmpty />
                  <DayWithProgress day={0} progress={0} isEmpty />
                  <DayWithProgress 
                    day={1} 
                    progress={calculateDayProgress(1)}
                    isSelected={selectedDay === 1}
                    onClick={() => handleDayClick(1)}
                  />
                  <DayWithProgress 
                    day={2} 
                    progress={calculateDayProgress(2)}
                    isSelected={selectedDay === 2}
                    onClick={() => handleDayClick(2)}
                  />
                  
                  {/* Week 2 */}
                  <DayWithProgress 
                    day={3} 
                    progress={calculateDayProgress(3)}
                    isSelected={selectedDay === 3}
                    onClick={() => handleDayClick(3)}
                  />
                  <DayWithProgress 
                    day={4} 
                    progress={calculateDayProgress(4)}
                    isSelected={selectedDay === 4}
                    onClick={() => handleDayClick(4)}
                  />
                  <DayWithProgress 
                    day={5} 
                    progress={calculateDayProgress(5)}
                    isSelected={selectedDay === 5}
                    onClick={() => handleDayClick(5)}
                  />
                  <DayWithProgress 
                    day={6} 
                    progress={calculateDayProgress(6)}
                    isSelected={selectedDay === 6}
                    onClick={() => handleDayClick(6)}
                  />
                  <DayWithProgress 
                    day={7} 
                    progress={calculateDayProgress(7)}
                    isSelected={selectedDay === 7}
                    onClick={() => handleDayClick(7)}
                  />
                  <DayWithProgress 
                    day={8} 
                    progress={calculateDayProgress(8)}
                    isSelected={selectedDay === 8}
                    onClick={() => handleDayClick(8)}
                  />
                  <DayWithProgress 
                    day={9} 
                    progress={calculateDayProgress(9)}
                    isSelected={selectedDay === 9}
                    onClick={() => handleDayClick(9)}
                  />
                  
                  {/* Week 3 */}
                  <DayWithProgress 
                    day={10} 
                    progress={calculateDayProgress(10)}
                    isSelected={selectedDay === 10}
                    onClick={() => handleDayClick(10)}
                  />
                  <DayWithProgress 
                    day={11} 
                    progress={calculateDayProgress(11)}
                    isSelected={selectedDay === 11}
                    onClick={() => handleDayClick(11)}
                  />
                  <DayWithProgress 
                    day={12} 
                    progress={calculateDayProgress(12)}
                    isSelected={selectedDay === 12}
                    onClick={() => handleDayClick(12)}
                  />
                  <DayWithProgress 
                    day={13} 
                    progress={calculateDayProgress(13)}
                    isSelected={selectedDay === 13}
                    onClick={() => handleDayClick(13)}
                  />
                  <DayWithProgress 
                    day={14} 
                    progress={calculateDayProgress(14)}
                    isSelected={selectedDay === 14}
                    onClick={() => handleDayClick(14)}
                  />
                  <DayWithProgress 
                    day={15} 
                    progress={calculateDayProgress(15)}
                    isSelected={selectedDay === 15}
                    onClick={() => handleDayClick(15)}
                  />
                  <DayWithProgress 
                    day={16} 
                    progress={calculateDayProgress(16)}
                    isSelected={selectedDay === 16}
                    onClick={() => handleDayClick(16)}
                  />
                  
                  {/* Week 4 */}
                  <DayWithProgress 
                    day={17} 
                    progress={calculateDayProgress(17)}
                    isSelected={selectedDay === 17}
                    onClick={() => handleDayClick(17)}
                  />
                  <DayWithProgress 
                    day={18} 
                    progress={calculateDayProgress(18)}
                    isSelected={selectedDay === 18}
                    onClick={() => handleDayClick(18)}
                  />
                  <DayWithProgress 
                    day={19} 
                    progress={calculateDayProgress(19)}
                    isSelected={selectedDay === 19}
                    onClick={() => handleDayClick(19)}
                  />
                  <DayWithProgress 
                    day={20} 
                    progress={calculateDayProgress(20)}
                    isSelected={selectedDay === 20}
                    onClick={() => handleDayClick(20)}
                  />
                  <DayWithProgress 
                    day={21} 
                    progress={calculateDayProgress(21)}
                    isSelected={selectedDay === 21}
                    isToday={true}
                    onClick={() => handleDayClick(21)}
                  />
                  <DayWithProgress 
                    day={22} 
                    progress={calculateDayProgress(22)}
                    isSelected={selectedDay === 22}
                    onClick={() => handleDayClick(22)}
                  />
                  <DayWithProgress 
                    day={23} 
                    progress={calculateDayProgress(23)}
                    isSelected={selectedDay === 23}
                    onClick={() => handleDayClick(23)}
                  />
                  
                  {/* Week 5 */}
                  <DayWithProgress 
                    day={24} 
                    progress={calculateDayProgress(24)}
                    isSelected={selectedDay === 24}
                    onClick={() => handleDayClick(24)}
                  />
                  <DayWithProgress 
                    day={25} 
                    progress={calculateDayProgress(25)}
                    isSelected={selectedDay === 25}
                    onClick={() => handleDayClick(25)}
                  />
                  <DayWithProgress 
                    day={26} 
                    progress={calculateDayProgress(26)}
                    isSelected={selectedDay === 26}
                    onClick={() => handleDayClick(26)}
                  />
                  <DayWithProgress 
                    day={27} 
                    progress={calculateDayProgress(27)}
                    isSelected={selectedDay === 27}
                    onClick={() => handleDayClick(27)}
                  />
                  <DayWithProgress 
                    day={28} 
                    progress={calculateDayProgress(28)}
                    isSelected={selectedDay === 28}
                    onClick={() => handleDayClick(28)}
                  />
                  <DayWithProgress 
                    day={29} 
                    progress={calculateDayProgress(29)}
                    isSelected={selectedDay === 29}
                    onClick={() => handleDayClick(29)}
                  />
                  <DayWithProgress 
                    day={30} 
                    progress={calculateDayProgress(30)}
                    isSelected={selectedDay === 30}
                    onClick={() => handleDayClick(30)}
                  />
                </div>
              </div>
              
            </div>

            {/* Topics List */}
            <div className="col-span-12 lg:col-span-9 p-6">
              
              {/* Topics Header */}
              <div className="mb-6 border-b pb-4">
                <h2 className="text-lg font-semibold text-gray-800">
                  Tópicos do Dia - {selectedDay} de Setembro
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
                      <div className={`${isExpanded ? 'border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden' : ''}`}>
                        {/* Topic Header */}
                        <div className={`flex items-center justify-between py-2 transition-colors px-2 ${
                          isExpanded 
                            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100' 
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
                                      className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                                        isSubtopicCompleted ? 'bg-green-50 border border-green-200' : 'bg-gray-50 hover:bg-gray-100'
                                      }`}
                                    >
                                      {/* Checkbox do subtópico */}
                                      <button
                                        onClick={() => toggleSubtopicCompletion(topic.id, index)}
                                        className={`flex-shrink-0 w-5 h-5 border-2 rounded-full flex items-center justify-center transition-all ${
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
                                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
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
                                      
                                      {/* Timer do Subtópico */}
                                      <div className="flex items-center gap-2">
                                        <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono ${
                                          activeTimers.has(subtopicKey) 
                                            ? 'bg-green-100 text-green-700' 
                                            : timeSpent[subtopicKey] > 0 
                                              ? 'bg-blue-100 text-blue-700'
                                              : 'bg-gray-100 text-gray-500'
                                        }`}>
                                          <span>{formatTime(timeSpent[subtopicKey] || 0)}</span>
                                        </div>
                                        
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
                              <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors shadow-sm">
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
    </div>
  );
}
