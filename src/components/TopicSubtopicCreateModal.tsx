import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { TimeEstimateInput } from './goals/TimeEstimateInput';

interface TopicSubtopicCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { title: string; estimated_duration_minutes: number }) => void;
  type: 'topic' | 'subtopic';
  hasSubtopics?: boolean; // Para tópicos: se já tem subtópicos, mostra tempo calculado
  calculatedDuration?: number; // Tempo calculado dos subtópicos existentes
  mode?: 'create' | 'edit'; // Novo: modo de criação ou edição
  initialTitle?: string; // Novo: título inicial para edição
  initialDuration?: number; // Novo: duração inicial para edição
}

export const TopicSubtopicCreateModal: React.FC<TopicSubtopicCreateModalProps> = ({
  isOpen,
  onClose,
  onSave,
  type,
  hasSubtopics = false,
  calculatedDuration = 0,
  mode = 'create',
  initialTitle = '',
  initialDuration,
}) => {
  const [title, setTitle] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState(type === 'topic' ? 120 : 90);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Se for modo de edição, usa os valores iniciais
      if (mode === 'edit') {
        setTitle(initialTitle);
        setEstimatedDuration(initialDuration || (type === 'topic' ? 120 : 90));
      } else {
        // Modo de criação, reseta os valores
        setTitle('');
        setEstimatedDuration(type === 'topic' ? 120 : 90);
      }
      setError('');
    }
  }, [isOpen, type, mode, initialTitle, initialDuration]);

  const handleSave = () => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError('O nome não pode estar vazio');
      return;
    }

    if (trimmedTitle.length < 3) {
      setError('O nome deve ter pelo menos 3 caracteres');
      return;
    }

    if (estimatedDuration < 5) {
      setError('O tempo estimado deve ser pelo menos 5 minutos');
      return;
    }

    onSave({
      title: trimmedTitle,
      estimated_duration_minutes: estimatedDuration,
    });

    handleClose();
  };

  const handleClose = () => {
    setTitle('');
    setEstimatedDuration(type === 'topic' ? 120 : 90);
    setError('');
    onClose();
  };

  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}min`;
    if (h > 0) return `${h}h`;
    return `${m}min`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit'
              ? (type === 'topic' ? 'Editar Tópico' : 'Editar Subtópico')
              : (type === 'topic' ? 'Novo Tópico' : 'Novo Subtópico')
            }
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">Nome</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError('');
              }}
              placeholder={
                type === 'topic'
                  ? 'Ex: Direito Constitucional'
                  : 'Ex: Princípios Fundamentais'
              }
              maxLength={100}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          {/* Tempo Estimado */}
          {type === 'topic' && hasSubtopics ? (
            // Tópico COM subtópicos → somente leitura (calculado)
            <div className="space-y-2">
              <Label>Tempo Estimado Total (Calculado)</Label>
              <div className="p-4 bg-muted rounded-md border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Calculado automaticamente:
                  </span>
                  <span className="text-2xl font-bold">
                    {formatTime(calculatedDuration)}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                💡 Para alterar o tempo, edite os subtópicos individualmente.
              </p>
            </div>
          ) : (
            // Tópico SEM subtópicos OU Subtópico → editável
            <TimeEstimateInput
              value={estimatedDuration}
              onChange={setEstimatedDuration}
              label={
                type === 'topic'
                  ? 'Tempo estimado de conclusão do tópico'
                  : 'Tempo estimado de conclusão do subtópico'
              }
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            {mode === 'edit' ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
