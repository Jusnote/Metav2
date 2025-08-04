import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrueFalseEditorProps {
  onSave: (front: string, back: string, type: 'true-false', explanation?: string) => void;
  onCancel?: () => void;
  initialStatement?: string;
}

export function TrueFalseEditor({ onSave, onCancel, initialStatement = '' }: TrueFalseEditorProps) {
  const [statement, setStatement] = useState(initialStatement);
  const [answer, setAnswer] = useState<'true' | 'false' | null>(null);
  const [explanation, setExplanation] = useState('');
  const statementRef = useRef<HTMLTextAreaElement>(null);
  const explanationRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (statementRef.current) {
      statementRef.current.focus();
      const length = statement.length;
      statementRef.current.setSelectionRange(length, length);
    }
  }, []);

  const adjustTextareaHeight = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(32, textarea.scrollHeight) + 'px'; // Reduzido de 40px para 32px
  };

  const handleStatementChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setStatement(e.target.value);
    adjustTextareaHeight(e.target);
  };

  const handleExplanationChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setExplanation(e.target.value);
    adjustTextareaHeight(e.target);
  };

  const handleSave = () => {
    if (statement.trim() && answer) {
      const answerText = answer === 'true' ? 'Certo' : 'Errado';
      onSave(statement.trim(), answerText, 'true-false', explanation.trim() || undefined);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && statement.trim() && answer) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel?.();
    }
  };

  const canSave = statement.trim().length > 0 && answer !== null;

  return (
    <div className="space-y-2" onKeyDown={handleKeyDown}> {/* Reduzido de space-y-3 para space-y-2 */}
      {/* Campo do enunciado - mais compacto */}
      <Textarea
        ref={statementRef}
        value={statement}
        onChange={handleStatementChange}
        placeholder="Digite o enunciado do flashcard..."
        className="min-h-[32px] resize-none overflow-hidden border-2 border-blue-200 focus:border-blue-400 py-1 px-2 text-sm" // Reduzido padding e tamanho da fonte
        style={{ height: 'auto' }}
      />

      {/* Botões de resposta - mais compactos */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={answer === 'true' ? 'default' : 'outline'}
          onClick={() => setAnswer('true')}
          className={cn(
            "flex items-center justify-center gap-1 h-8 text-sm", // Reduzido de h-12 para h-8
            answer === 'true' && "bg-green-600 text-white hover:bg-green-700"
          )}
        >
          <Check className="h-4 w-4" />
          Certo
        </Button>
        <Button
          variant={answer === 'false' ? 'default' : 'outline'}
          onClick={() => setAnswer('false')}
          className={cn(
            "flex items-center justify-center gap-1 h-8 text-sm", // Reduzido de h-12 para h-8
            answer === 'false' && "bg-red-600 text-white hover:bg-red-700"
          )}
        >
          <X className="h-4 w-4" />
          Errado
        </Button>
      </div>

      {/* Campo de explicação - mais compacto */}
      <Textarea
        ref={explanationRef}
        value={explanation}
        onChange={handleExplanationChange}
        placeholder="Explicação (opcional)..."
        className="min-h-[32px] resize-none overflow-hidden border border-gray-200 focus:border-gray-400 py-1 px-2 text-sm" // Reduzido padding e tamanho da fonte
        style={{ height: 'auto' }}
      />

      {/* Indicador de ações - mais compacto */}
      <div className="text-xs text-gray-500 text-center py-1"> {/* Adicionado py-1 para espaçamento mínimo */}
        {canSave ? 'Enter para salvar • Esc para cancelar' : 'Preencha o enunciado e selecione uma resposta'}
      </div>
    </div>
  );
}