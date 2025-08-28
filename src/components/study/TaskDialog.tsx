import { useState, useEffect } from 'react';
import { StudyTask } from '@/types/study';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, FlaskConical, MessageCircle, Scroll } from 'lucide-react';

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (task: Partial<StudyTask>) => void;
  editingTask?: StudyTask | null;
  dayId?: string;
}

const subjectOptions = [
  { value: 'math', label: 'Matemática', icon: BookOpen },
  { value: 'science', label: 'Ciências', icon: FlaskConical },
  { value: 'language', label: 'Línguas', icon: MessageCircle },
  { value: 'history', label: 'História', icon: Scroll },
];

const priorityOptions = [
  { value: 'low', label: 'Baixa', color: 'text-success' },
  { value: 'medium', label: 'Média', color: 'text-warning-foreground' },
  { value: 'high', label: 'Alta', color: 'text-destructive' },
];

export function TaskDialog({ open, onOpenChange, onSave, editingTask, dayId }: TaskDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    subject: 'math' as StudyTask['subject'],
    duration: 30,
    priority: 'medium' as StudyTask['priority'],
    description: '',
  });

  useEffect(() => {
    if (editingTask) {
      setFormData({
        title: editingTask.title,
        subject: editingTask.subject,
        duration: editingTask.duration,
        priority: editingTask.priority,
        description: editingTask.description || '',
      });
    } else {
      setFormData({
        title: '',
        subject: 'math',
        duration: 30,
        priority: 'medium',
        description: '',
      });
    }
  }, [editingTask, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const taskData: Partial<StudyTask> = {
      ...formData,
      id: editingTask?.id || crypto.randomUUID(),
      completed: editingTask?.completed || false,
    };

    onSave(taskData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingTask ? 'Editar Tarefa' : 'Nova Tarefa de Estudo'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">Título da Tarefa</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Estudar equações de segundo grau"
              required
            />
          </div>

          {/* Grid para matéria e duração */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Matéria</Label>
              <Select
                value={formData.subject}
                onValueChange={(value: StudyTask['subject']) => 
                  setFormData({ ...formData, subject: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {subjectOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {option.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duração (min)</Label>
              <Input
                id="duration"
                type="number"
                min="5"
                max="300"
                step="5"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                required
              />
            </div>
          </div>

          {/* Prioridade */}
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select
              value={formData.priority}
              onValueChange={(value: StudyTask['priority']) => 
                setFormData({ ...formData, priority: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className={option.color}>{option.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Adicione detalhes sobre o que será estudado..."
              rows={3}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="gradient-primary">
              {editingTask ? 'Salvar Alterações' : 'Criar Tarefa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}