import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Check, X, Lightbulb } from 'lucide-react';
import { cn } from '../lib/utils';

interface TrueFalseDialogDisplayProps {
  statement: string;
  correctAnswer: string; // "Certo" ou "Errado"
  explanation?: string; // Explicação personalizada opcional
  onAnswer: (userAnswer: 'true' | 'false', isCorrect: boolean) => void;
  hasAnswered?: boolean;
  userAnswer?: 'true' | 'false';
  isCorrect?: boolean;
}

export function TrueFalseDialogDisplay({
  statement,
  correctAnswer,
  explanation,
  onAnswer,
  hasAnswered = false,
  userAnswer,
  isCorrect
}: TrueFalseDialogDisplayProps) {
  const correctIsTrue = correctAnswer === 'Certo';

  const handleAnswerClick = (answer: 'true' | 'false') => {
    if (hasAnswered) return;
    
    const correct = (answer === 'true' && correctIsTrue) || (answer === 'false' && !correctIsTrue);
    onAnswer(answer, correct);
  };

  const getExplanation = () => {
    if (!hasAnswered) return null;
    
    if (isCorrect) {
      return {
        type: 'success' as const,
        title: 'Parabéns! 🎉',
        message: explanation || `Você acertou! A resposta correta é "${correctAnswer}".`
      };
    } else {
      return {
        type: 'error' as const,
        title: 'Não foi desta vez! 😔',
        message: explanation || `A resposta correta é "${correctAnswer}". Continue estudando!`
      };
    }
  };

  const explanationData = getExplanation();

  return (
    <div className="space-y-6">
      {/* Statement with same container as traditional flashcard */}
      <div className="text-slate-800 leading-relaxed font-medium text-lg">
        {statement}
      </div>

      {/* Answer Options - Outside the box */}
      <div className="flex gap-3 w-full">
        <Button
          onClick={() => handleAnswerClick('true')}
          disabled={hasAnswered}
          variant="outline"
          size="lg"
          className={cn(
            "flex-1 flex items-center justify-center gap-3 h-9 text-base font-semibold transition-all duration-300 rounded-full shadow-xs hover:shadow-md",
            hasAnswered && userAnswer === 'true' && isCorrect && "bg-emerald-50 border-emerald-400 text-emerald-700 ring-2 ring-emerald-200 shadow-emerald-100",
            hasAnswered && userAnswer === 'true' && !isCorrect && "bg-red-50 border-red-400 text-red-700 ring-2 ring-red-200 shadow-red-100",
            hasAnswered && userAnswer !== 'true' && correctIsTrue && "bg-emerald-50 border-emerald-400 text-emerald-700 ring-2 ring-emerald-300 shadow-emerald-100",
            !hasAnswered && "hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 hover:scale-[1.02]"
          )}
        >
          <Check className="h-6 w-6" />
          <span>Certo</span>
          {hasAnswered && correctIsTrue && userAnswer !== 'true' && (
             <Badge variant="outline" className="ml-2 text-xs bg-emerald-100 text-emerald-700 border-emerald-300">
              ✓
            </Badge>
          )}
        </Button>

        <Button
          onClick={() => handleAnswerClick('false')}
          disabled={hasAnswered}
          variant="outline"
          size="lg"
          className={cn(
            "flex-1 flex items-center justify-center gap-3 h-9 text-base font-semibold transition-all duration-300 rounded-full shadow-xs hover:shadow-md",
            hasAnswered && userAnswer === 'false' && isCorrect && "bg-emerald-50 border-emerald-400 text-emerald-700 ring-2 ring-emerald-200 shadow-emerald-100",
            hasAnswered && userAnswer === 'false' && !isCorrect && "bg-red-50 border-red-400 text-red-700 ring-2 ring-red-200 shadow-red-100",
            hasAnswered && userAnswer !== 'false' && !correctIsTrue && "bg-emerald-50 border-emerald-400 text-emerald-700 ring-2 ring-emerald-300 shadow-emerald-100",
            !hasAnswered && "hover:bg-red-50 hover:border-red-300 hover:text-red-700 hover:scale-[1.02]"
          )}
        >
          <X className="h-6 w-6" />
          <span>Errado</span>
          {hasAnswered && !correctIsTrue && userAnswer !== 'false' && (
            <Badge variant="outline" className="ml-2 text-xs bg-emerald-100 text-emerald-700 border-emerald-300">
              ✓
            </Badge>
          )}
        </Button>
      </div>

      {/* Feedback */}
      {explanationData && (
        <div className={cn(
          "p-4 rounded-lg border-l-4 animate-fade-in",
          explanationData.type === 'success' && "bg-success/5 border-l-success text-success",
          explanationData.type === 'error' && "bg-destructive/5 border-l-destructive text-destructive-foreground"
        )}>
          <div className="flex items-start gap-3">
            <Lightbulb className={cn(
              "h-5 w-5 mt-0.5 shrink-0",
              explanationData.type === 'success' && "text-success",
              explanationData.type === 'error' && "text-destructive"
            )} />
            <div>
              <div className="font-medium mb-1">{explanationData.title}</div>
              <div className="text-sm opacity-90">{explanationData.message}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}