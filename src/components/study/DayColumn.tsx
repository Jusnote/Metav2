import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Calendar } from 'lucide-react';
import { DaySchedule, StudyTask } from '@/types/study';
import { StudyCard } from './StudyCard';
import { cn } from '@/lib/utils';

interface DayColumnProps {
  day: DaySchedule;
  onToggleComplete: (taskId: string) => void;
  onAddTask: (dayId: string) => void;
  onEditTask?: (task: StudyTask) => void;
}

const dayNames = {
  'monday': 'Segunda',
  'tuesday': 'Terça',
  'wednesday': 'Quarta',
  'thursday': 'Quinta',
  'friday': 'Sexta',
  'saturday': 'Sábado',
  'sunday': 'Domingo',
};

export function DayColumn({ day, onToggleComplete, onAddTask, onEditTask }: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: day.id,
  });

  const completedTasks = day.tasks.filter(task => task.completed).length;
  const totalTasks = day.tasks.length;
  const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header do dia */}
      <div className="p-4 border-b border-border bg-gradient-card rounded-t-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">
              {dayNames[day.day as keyof typeof dayNames] || day.day}
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {day.date.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{completedTasks}/{totalTasks} concluídas</span>
            <span>{Math.round(completionPercentage)}%</span>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-primary transition-all duration-500 ease-out"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Lista de tarefas */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 p-2 space-y-2 min-h-[400px] max-h-[518px] overflow-y-auto transition-colors duration-200",
          "scrollbar-hide",
          isOver && "bg-accent/50"
        )}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <SortableContext items={day.tasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
          {day.tasks.map((task) => (
            <StudyCard
              key={task.id}
              task={task}
              onToggleComplete={onToggleComplete}
              onEdit={onEditTask}
            />
          ))}
        </SortableContext>

        {/* Botão adicionar tarefa */}
        <button
          onClick={() => onAddTask(day.id)}
          className={cn(
            "w-full p-4 border-2 border-dashed border-border rounded-lg",
            "hover:border-primary hover:bg-accent/30 transition-all duration-200",
            "flex items-center justify-center gap-2 text-muted-foreground hover:text-primary",
            "group"
          )}
        >
          <Plus className="h-4 w-4 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-medium">Adicionar tarefa</span>
        </button>
      </div>
    </div>
  );
}