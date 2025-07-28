import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubFlashcardDisplayProps {
  question: string;
  answer: string;
}

export function SubFlashcardDisplay({
  question,
  answer,
}: SubFlashcardDisplayProps) {
  const [showAnswer, setShowAnswer] = useState(false);

  const toggleAnswer = () => {
    setShowAnswer(!showAnswer);
  };

  return (
    <Card className={cn(
      "p-4 shadow-md transition-all duration-300",
      "bg-gradient-to-br from-background via-background to-purple-500/5",
      "border-2 border-purple-500/20 shadow-lg shadow-purple-500/10",
      "relative"
    )}>
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">
          <strong>Pergunta:</strong> {question}
        </div>
        {showAnswer && (
          <div className="text-base animate-fade-in mt-3">
            <div className="bg-primary/5 p-3 rounded-lg border-l-4 border-l-primary/40 shadow-sm">
              <strong className="text-primary">Resposta:</strong> {answer}
            </div>
          </div>
        )}
        <div className="flex justify-center mt-4">
          <Button
            onClick={toggleAnswer}
            variant="outline"
            size="default"
            className="gap-2 font-medium transition-all duration-300 relative z-[9999]"
          >
            {showAnswer ? (
              <>
                <EyeOff className="h-4 w-4" />
                Esconder Resposta
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                Ver Resposta
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

