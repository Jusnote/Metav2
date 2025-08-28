import { useState, useCallback, useMemo } from 'react';
import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, PointerSensor, useSensor, useSensors, DragOverlay, closestCorners, closestCenter } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Calendar, Plus, TrendingUp, Clock, BookOpen, Target } from 'lucide-react';
import { StudyTask, DaySchedule } from '@/types/study';
import { DayColumn } from './DayColumn';
import { TaskDialog } from './TaskDialog';
import { StudyCard } from './StudyCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { ButtonIcon } from '@/components/ui/button-icon';

// Função para calcular as datas da semana atual
const getCurrentWeekDates = () => {
  const today = new Date();
  const currentDay = today.getDay(); // 0 = domingo, 1 = segunda, etc.
  const monday = new Date(today);
  monday.setDate(today.getDate() - currentDay + 1); // Calcular segunda-feira
  
  return {
    monday: new Date(monday),
    tuesday: new Date(monday.getTime() + 24 * 60 * 60 * 1000),
    wednesday: new Date(monday.getTime() + 2 * 24 * 60 * 60 * 1000),
    thursday: new Date(monday.getTime() + 3 * 24 * 60 * 60 * 1000),
    friday: new Date(monday.getTime() + 4 * 24 * 60 * 60 * 1000),
    saturday: new Date(monday.getTime() + 5 * 24 * 60 * 60 * 1000),
    sunday: new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000)
  };
};

const weekDates = getCurrentWeekDates();

// Dados de exemplo
const initialDays: DaySchedule[] = [
  {
    id: 'monday',
    day: 'monday',
    date: weekDates.monday,
    tasks: [
      {
        id: '1',
        title: 'Resolver exercícios de álgebra',
        subject: 'math',
        duration: 45,
        completed: false,
        priority: 'high',
        description: 'Capítulo 3 - Equações de segundo grau',
      },
      {
        id: '2',
        title: 'Estudar células vegetais',
        subject: 'science',
        duration: 30,
        completed: true,
        priority: 'medium',
        description: 'Fotossíntese e respiração celular',
      },
    ],
  },
  {
    id: 'tuesday',
    day: 'tuesday',
    date: weekDates.tuesday,
    tasks: [
      {
        id: '3',
        title: 'Redação sobre meio ambiente',
        subject: 'language',
        duration: 60,
        completed: false,
        priority: 'high',
        description: 'Texto dissertativo-argumentativo',
      },
    ],
  },
  {
    id: 'wednesday',
    day: 'wednesday',
    date: weekDates.wednesday,
    tasks: [
      {
        id: '4',
        title: 'Revolução Industrial',
        subject: 'history',
        duration: 40,
        completed: false,
        priority: 'medium',
        description: 'Primeira e segunda fases',
      },
    ],
  },
  {
    id: 'thursday',
    day: 'thursday',
    date: weekDates.thursday,
    tasks: [],
  },
  {
    id: 'friday',
    day: 'friday',
    date: weekDates.friday,
    tasks: [],
  },
  {
    id: 'saturday',
    day: 'saturday',
    date: weekDates.saturday,
    tasks: [
      {
        id: '5',
        title: 'Revisão geral de matemática',
        subject: 'math',
        duration: 90,
        completed: false,
        priority: 'high',
        description: 'Revisão dos tópicos da semana',
      },
    ],
  },
  {
    id: 'sunday',
    day: 'sunday',
    date: weekDates.sunday,
    tasks: [
      {
        id: '6',
        title: 'Leitura complementar',
        subject: 'language',
        duration: 60,
        completed: false,
        priority: 'medium',
        description: 'Livro de literatura brasileira',
      },
    ],
  },
];



export function StudySchedule() {
  // Estado único com todos os dias
  const [allDays, setAllDays] = useState<DaySchedule[]>(initialDays);
  const [activeTask, setActiveTask] = useState<StudyTask | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<StudyTask | null>(null);
  const [targetDayId, setTargetDayId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'weekdays' | 'weekend'>('weekdays');

  // Computed value para days baseado no viewMode
  const days = useMemo(() => {
    if (viewMode === 'weekend') {
      return allDays.filter(day => day.day === 'saturday' || day.day === 'sunday');
    } else {
      return allDays.filter(day => 
        day.day !== 'saturday' && day.day !== 'sunday'
      );
    }
  }, [allDays, viewMode]);

  // Função para alternar visualização
  const toggleWeekendView = () => {
    setViewMode(viewMode === 'weekdays' ? 'weekend' : 'weekdays');
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = findTaskById(active.id as string);
    setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Se estamos arrastando sobre uma tarefa, trocar posições
    if (isTask(activeId) && isTask(overId)) {
      const activeTask = findTaskById(activeId);
      const overTask = findTaskById(overId);
      
      if (!activeTask || !overTask) return;

      const activeDayIndex = allDays.findIndex(day => 
        day.tasks.some(task => task.id === activeId)
      );
      const overDayIndex = allDays.findIndex(day => 
        day.tasks.some(task => task.id === overId)
      );

      if (activeDayIndex !== overDayIndex) {
        // Mover entre dias diferentes
        setAllDays(prevAllDays => {
          const newAllDays = [...prevAllDays];
          
          // Remover da lista original
          newAllDays[activeDayIndex].tasks = newAllDays[activeDayIndex].tasks.filter(
            task => task.id !== activeId
          );
          
          // Encontrar posição na nova lista
          const overTaskIndex = newAllDays[overDayIndex].tasks.findIndex(
            task => task.id === overId
          );
          
          // Inserir na nova posição
          newAllDays[overDayIndex].tasks.splice(overTaskIndex, 0, activeTask);
          
          return newAllDays;
        });
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Se arrastamos sobre um dia (coluna)
    if (isDay(overId)) {
      const activeTask = findTaskById(activeId);
      if (!activeTask) return;

      // Atualizar apenas o array completo
      setAllDays(prevAllDays => {
        const newAllDays = [...prevAllDays];
        
        // Remover da lista original
        const sourceDayIndex = newAllDays.findIndex(day => 
          day.tasks.some(task => task.id === activeId)
        );
        
        newAllDays[sourceDayIndex].tasks = newAllDays[sourceDayIndex].tasks.filter(
          task => task.id !== activeId
        );
        
        // Adicionar ao novo dia
        const targetDayIndex = newAllDays.findIndex(day => day.id === overId);
        newAllDays[targetDayIndex].tasks.push(activeTask);
        
        return newAllDays;
      });
      
      toast({
        title: "Tarefa movida com sucesso!",
        description: "A tarefa foi transferida para o novo dia.",
      });
    }

    // Se arrastamos sobre uma tarefa no mesmo dia, reordenar
    if (isTask(activeId) && isTask(overId)) {
      const activeDayIndex = allDays.findIndex(day => 
        day.tasks.some(task => task.id === activeId)
      );
      const overDayIndex = allDays.findIndex(day => 
        day.tasks.some(task => task.id === overId)
      );

      if (activeDayIndex === overDayIndex) {
        // Atualizar apenas o array completo
        setAllDays(prevAllDays => {
          const newAllDays = [...prevAllDays];
          const allDayIndex = newAllDays.findIndex(day => 
            day.tasks.some(task => task.id === activeId)
          );
          const dayTasks = newAllDays[allDayIndex].tasks;
          
          const oldIndex = dayTasks.findIndex(task => task.id === activeId);
          const newIndex = dayTasks.findIndex(task => task.id === overId);
          
          newAllDays[allDayIndex].tasks = arrayMove(dayTasks, oldIndex, newIndex);
          
          return newAllDays;
        });
      }
    }
  };

  const findTaskById = (id: string): StudyTask | null => {
    for (const day of allDays) {
      const task = day.tasks.find(task => task.id === id);
      if (task) return task;
    }
    return null;
  };

  const isTask = (id: string): boolean => {
    return findTaskById(id) !== null;
  };

  const isDay = (id: string): boolean => {
    return allDays.some(day => day.id === id);
  };

  const handleToggleComplete = useCallback((taskId: string) => {
    // Atualizar apenas o array completo
    setAllDays(prevAllDays =>
      prevAllDays.map(day => ({
        ...day,
        tasks: day.tasks.map(task =>
          task.id === taskId
            ? { ...task, completed: !task.completed }
            : task
        ),
      }))
    );
    
    toast({
      title: "Status atualizado!",
      description: "O progresso da tarefa foi salvo.",
    });
  }, []);

  const handleAddTask = (dayId: string) => {
    setTargetDayId(dayId);
    setEditingTask(null);
    setTaskDialogOpen(true);
  };

  const handleEditTask = (task: StudyTask) => {
    setEditingTask(task);
    setTaskDialogOpen(true);
  };

  const handleSaveTask = (taskData: Partial<StudyTask>) => {
    if (editingTask) {
      // Editar tarefa existente
      // Atualizar apenas o array completo
      setAllDays(prevAllDays =>
        prevAllDays.map(day => ({
          ...day,
          tasks: day.tasks.map(task =>
            task.id === editingTask.id
              ? { ...task, ...taskData }
              : task
          ),
        }))
      );
      
      toast({
        title: "Tarefa atualizada!",
        description: "As alterações foram salvas com sucesso.",
      });
    } else {
      // Adicionar nova tarefa
      // Atualizar apenas o array completo
      setAllDays(prevAllDays =>
        prevAllDays.map(day =>
          day.id === targetDayId
            ? { ...day, tasks: [...day.tasks, taskData as StudyTask] }
            : day
        )
      );
      
      toast({
        title: "Tarefa criada!",
        description: "Nova tarefa adicionada ao cronograma.",
      });
    }
  };

  // Calcular estatísticas usando todos os dias
  const totalTasks = allDays.reduce((acc, day) => acc + day.tasks.length, 0);
  const completedTasks = allDays.reduce((acc, day) => 
    acc + day.tasks.filter(task => task.completed).length, 0
  );
  const totalMinutes = allDays.reduce((acc, day) => 
    acc + day.tasks.reduce((dayAcc, task) => dayAcc + task.duration, 0), 0
  );

  // Calcular progresso do dia atual (hoje)
  const today = new Date();
  const currentDay = allDays.find(day => 
    day.date.toDateString() === today.toDateString()
  );
  const todayTasks = currentDay?.tasks.length || 0;
  const todayCompleted = currentDay?.tasks.filter(task => task.completed).length || 0;
  const todayProgress = todayTasks > 0 ? (todayCompleted / todayTasks) * 100 : 0;
  const todayMinutes = currentDay?.tasks.reduce((acc, task) => acc + task.duration, 0) || 0;

  // Calcular progresso semanal
  const weeklyProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Mapear nomes das matérias
  const subjectNames = {
    math: 'Matemática',
    science: 'Ciências',
    language: 'Linguagem',
    history: 'História'
  };

  // Contar matérias por tipo hoje
  const todaySubjectCounts = currentDay ? currentDay.tasks.reduce((acc, task) => {
    acc[task.subject] = (acc[task.subject] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) : {};

  // Contar matérias por tipo na semana
  const weeklySubjectCounts = allDays.flatMap(day => day.tasks).reduce((acc, task) => {
    acc[task.subject] = (acc[task.subject] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Formatar lista de matérias hoje
  const todaySubjectsList = Object.entries(todaySubjectCounts)
    .map(([subject, count]) => `${count.toString().padStart(2, '0')} - ${subjectNames[subject as keyof typeof subjectNames]}`)
    .join('\n');

  // Formatar lista de matérias na semana
  const weeklySubjectsList = Object.entries(weeklySubjectCounts)
    .map(([subject, count]) => `${count.toString().padStart(2, '0')} - ${subjectNames[subject as keyof typeof subjectNames]}`)
    .join('\n');

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="p-3 rounded-xl gradient-primary">
              <Calendar className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                Cronograma de Estudos
              </h1>
              <p className="text-muted-foreground">
                Organize seus estudos de forma inteligente e produtiva
              </p>
            </div>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Progresso
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Hoje ({todayCompleted}/{todayTasks})</span>
                    <span className="font-medium">{Math.round(todayProgress)}%</span>
                  </div>
                  <Progress value={todayProgress} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Semana ({completedTasks}/{totalTasks})</span>
                    <span className="font-medium">{Math.round(weeklyProgress)}%</span>
                  </div>
                  <Progress value={weeklyProgress} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 ml-4">
                  <Clock className="h-4 w-4 text-primary" />
                  Tempo Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {Math.floor(todayMinutes / 60)}h {todayMinutes % 60}m
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Hoje
                    </p>
                  </div>
                  <div className="w-px h-12 bg-border"></div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Semana completa
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-end gap-4">
              <Card className="flex-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-accent-foreground" />
                    Matérias
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-center items-center gap-4">
                    <div className="text-center">
                      <div className="text-xs font-medium text-muted-foreground mb-1">Hoje:</div>
                      {todaySubjectsList ? (
                        <div className="text-xs text-primary whitespace-pre-line leading-tight">
                          {todaySubjectsList}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">Nenhuma tarefa</div>
                      )}
                    </div>
                    <div className="w-px h-8 bg-border"></div>
                    <div className="text-center">
                      <div className="text-xs font-medium text-muted-foreground mb-1">Semana completa:</div>
                      {weeklySubjectsList ? (
                        <div className="text-xs text-primary whitespace-pre-line leading-tight">
                          {weeklySubjectsList}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">Nenhuma tarefa</div>
                      )}  
                    </div>
                  </div>
                </CardContent>
              </Card>
              <ButtonIcon onClick={toggleWeekendView} />
            </div>
          </div>
        </div>

        {/* Grade do cronograma */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {days.map((day) => (
              <Card key={day.id} className="overflow-hidden">
                <DayColumn
                  day={day}
                  onToggleComplete={handleToggleComplete}
                  onAddTask={handleAddTask}
                  onEditTask={handleEditTask}
                />
              </Card>
            ))}
          </div>

          <DragOverlay>
            {activeTask ? (
              <StudyCard
                task={activeTask}
                onToggleComplete={() => {}}
              />
            ) : null}
          </DragOverlay>
        </DndContext>

        <TaskDialog
          open={taskDialogOpen}
          onOpenChange={setTaskDialogOpen}
          onSave={handleSaveTask}
          editingTask={editingTask}
          dayId={targetDayId}
        />
      </div>
    </div>
  );
}