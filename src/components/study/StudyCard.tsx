import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, CheckCircle2, Circle, BookOpen, FlaskConical, MessageCircle, Scroll } from 'lucide-react';
import { StudyTask } from '@/types/study';
import { cn } from '@/lib/utils';

interface StudyCardProps {
  task: StudyTask;
  onToggleComplete: (taskId: string) => void;
  onEdit?: (task: StudyTask) => void;
}

const subjectIcons = {
  math: BookOpen,
  science: FlaskConical,
  language: MessageCircle,
  history: Scroll,
};

const subjectLabels = {
  math: 'Matemática',
  science: 'Ciências',
  language: 'Línguas',
  history: 'História',
};

export function StudyCard({ task, onToggleComplete, onEdit }: StudyCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const SubjectIcon = subjectIcons[task.subject];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'study-card p-4 cursor-grab active:cursor-grabbing group',
        `study-card-${task.subject}`,
        isDragging && 'study-card-dragging opacity-50',
        task.completed && 'opacity-75'
      )}
      onClick={() => onEdit?.(task)}
      {...attributes}
      {...listeners}
    >
      {/* Header com ícone da matéria e status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <SubjectIcon className={cn("h-4 w-4", `text-study-${task.subject}-foreground`)} />
          <span className={cn("text-xs font-medium", `text-study-${task.subject}-foreground`)}>
            {subjectLabels[task.subject]}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(task.id);
          }}
          className="text-muted-foreground hover:text-success transition-colors cursor-pointer"
        >
          {task.completed ? (
            <CheckCircle2 className="h-5 w-5 text-success" />
          ) : (
            <Circle className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Título da tarefa */}
      <h3 className={cn(
        "font-semibold text-sm mb-2 line-clamp-2",
        task.completed && "line-through text-muted-foreground"
      )}>
        {task.title}
      </h3>

      {/* Descrição opcional */}
      {task.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Footer com duração e prioridade */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{task.duration}min</span>
        </div>
        <div className={cn(
          "px-2 py-1 rounded-full text-xs font-medium",
          task.priority === 'high' && "bg-destructive/10 text-destructive",
          task.priority === 'medium' && "bg-warning/10 text-warning-foreground",
          task.priority === 'low' && "bg-success/10 text-success"
        )}>
          {task.priority === 'high' && 'Alta'}
          {task.priority === 'medium' && 'Média'}
          {task.priority === 'low' && 'Baixa'}
        </div>
      </div>

      {/* Barra de progresso visual */}
      <div className="mt-3 h-1 bg-border rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full transition-all duration-500",
            task.completed ? "w-full bg-success" : "w-0 bg-primary"
          )}
        />
      </div>
    </div>
  );
}