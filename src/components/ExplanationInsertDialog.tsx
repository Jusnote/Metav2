import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { HelpCircle } from 'lucide-react';

interface ExplanationInsertDialogProps {
  children: React.ReactNode;
  onInsert: (explanation: string) => void;
  disabled?: boolean;
}

export function ExplanationInsertDialog({ children, onInsert, disabled }: ExplanationInsertDialogProps) {
  const [open, setOpen] = useState(false);
  const [explanation, setExplanation] = useState('');

  const handleInsert = () => {
    if (explanation.trim()) {
      onInsert(explanation);
      setExplanation('');
      setOpen(false);
    }
  };

  const handleCancel = () => {
    setExplanation('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild disabled={disabled}>
        <div onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Adicionar Explicação Interativa
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="explanation">
              Explicação (aparecerá ao passar o mouse)
            </Label>
            <Textarea
              id="explanation"
              placeholder="Digite a explicação que aparecerá quando o usuário passar o mouse sobre o texto selecionado..."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button 
              onClick={handleInsert}
              disabled={!explanation.trim()}
              className="gap-2"
            >
              <HelpCircle className="h-4 w-4" />
              Adicionar Explicação
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}