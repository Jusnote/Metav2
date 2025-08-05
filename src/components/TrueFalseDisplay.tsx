import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrueFalseDisplayProps {
  statement: string;
  correctAnswer: string; // "Certo" ou "Errado"
  explanation?: string; // Explicação personalizada opcional
  onAnswer: (userAnswer: 'true' | 'false', isCorrect: boolean) => void;
  hasAnswered?: boolean;
  userAnswer?: 'true' | 'false';
  isCorrect?: boolean;
}

export function TrueFalseDisplay({
  statement,
  correctAnswer,
  explanation,
  onAnswer,
  hasAnswered = false,
  userAnswer,
  isCorrect
}: TrueFalseDisplayProps) {
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
      {/* Statement Box - Same style as traditional flashcard */}
      <div className="relative bg-gradient-to-45deg from-slate-50 via-blue-50 to-slate-100 p-6 rounded-xl border-l-4 border-l-emerald-500 shadow-sm hover:shadow-lg hover:scale-[1.002] transition-all duration-700 min-h-[100px] flex items-center">
        <div className="absolute top-2 right-3">
          <span className="bg-slate-100/80 backdrop-blur-sm px-2 py-1 rounded-full font-mono text-[10px] tracking-[0.1em] uppercase text-slate-500">
            C/E?
          </span>
        </div>
        <p className="text-slate-800 leading-relaxed w-full text-center">{statement}</p>
      </div>

      {/* Answer Options - Outside the box */}
      <div className="flex gap-3 w-full">
        <Button
          onClick={() => handleAnswerClick('true')}
          disabled={hasAnswered}
          variant="outline"
          size="lg"
          className={cn(
            "flex-1 flex items-center justify-center gap-3 h-9 text-base font-semibold transition-all duration-300 rounded-full shadow-sm hover:shadow-md",
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
            "flex-1 flex items-center justify-center gap-3 h-9 text-base font-semibold transition-all duration-300 rounded-full shadow-sm hover:shadow-md",
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
              "h-5 w-5 mt-0.5 flex-shrink-0",
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