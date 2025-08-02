import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImprovedWordHidingDisplayProps {
  text: string;
  hiddenWords: string[];
  isStudyMode?: boolean;
  onAllWordsRevealed?: () => void; // Nova prop
}

export function ImprovedWordHidingDisplay({ 
  text, 
  hiddenWords, 
  isStudyMode = true,
  onAllWordsRevealed // Nova prop
}: ImprovedWordHidingDisplayProps) {
  const [revealedWords, setRevealedWords] = useState<Set<string>>(new Set());
  const [showAnswer, setShowAnswer] = useState(false);

  // Dividir texto em palavras mantendo espaços e pontuação
  const words = text.split(/(\s+)/);
  
  const revealWord = (word: string) => {
    if (isStudyMode) {
      const wordWithoutPunctuation = word.toLowerCase().replace(/[.,!?;:()]/g, '');
      const shouldReveal = hiddenWords.some(hw => hw.toLowerCase() === wordWithoutPunctuation);
      if (shouldReveal) {
        const newRevealedWords = new Set([...revealedWords, wordWithoutPunctuation]);
        setRevealedWords(newRevealedWords);
        
        // Verificar se todas as palavras foram reveladas
        const allWordsWithoutPunctuation = hiddenWords.map(w => w.toLowerCase().replace(/[.,!?;:()]/g, ''));
        if (newRevealedWords.size === allWordsWithoutPunctuation.length && onAllWordsRevealed) {
          onAllWordsRevealed();
        }
      }
    }
  };

  const toggleAnswer = () => {
    if (showAnswer) {
      setRevealedWords(new Set());
      setShowAnswer(false);
    } else {
      const wordsWithoutPunctuation = hiddenWords.map(w => w.toLowerCase().replace(/[.,!?;:()]/g, ''));
      setRevealedWords(new Set(wordsWithoutPunctuation));
      setShowAnswer(true);
      // Chamar callback quando revelar todas via botão
      if (onAllWordsRevealed) {
        onAllWordsRevealed();
      }
    }
  };

  const revealAllWords = () => {
    const wordsWithoutPunctuation = hiddenWords.map(w => w.toLowerCase().replace(/[.,!?;:()]/g, ''));
    setRevealedWords(new Set(wordsWithoutPunctuation));
    setShowAnswer(true);
    // Chamar callback quando revelar todas
    if (onAllWordsRevealed) {
      onAllWordsRevealed();
    }
  };

  const hideAllWords = () => {
    setRevealedWords(new Set());
    setShowAnswer(false);
  };

  const getWordDisplay = (word: string, index: number) => {
    const cleanWord = word.trim().toLowerCase();
    // Remove pontuação para comparação
    const wordWithoutPunctuation = cleanWord.replace(/[.,!?;:()]/g, '');
    const shouldBeHidden = hiddenWords.some(hw => hw.toLowerCase() === wordWithoutPunctuation);
    const isCurrentlyHidden = shouldBeHidden && !revealedWords.has(wordWithoutPunctuation) && !showAnswer;
    
    if (!word.trim()) {
      return <span key={index}>{word}</span>;
    }

    if (!shouldBeHidden) {
      return <span key={index}>{word}</span>;
    }

    return (
      <span
        key={index}
        onClick={() => revealWord(wordWithoutPunctuation)}
        className={cn(
          "relative inline-block transition-all duration-300",
          shouldBeHidden && "font-medium",
          isCurrentlyHidden && [
            "bg-muted/80 border border-dashed border-primary/30 rounded-md px-2 py-1",
            "text-transparent select-none cursor-pointer",
            "hover:bg-muted hover:border-primary/50 hover:scale-105",
            "animate-pulse transition-all duration-300"
          ],
          shouldBeHidden && (revealedWords.has(wordWithoutPunctuation) || showAnswer) && [
            "bg-success/20 text-success border border-success/30 rounded-md px-1",
            "animate-[scale-in_0.4s_ease-out]",
            "shadow-sm"
          ]
        )}
        title={isCurrentlyHidden ? "Clique para revelar a palavra" : undefined}
      >
        {isCurrentlyHidden ? "____" : word}
      </span>
    );
  };

  const remainingHiddenCount = hiddenWords.filter(word => {
    const wordWithoutPunctuation = word.toLowerCase().replace(/[.,!?;:()]/g, '');
    return !revealedWords.has(wordWithoutPunctuation);
  }).length;

  return (
    <div className="space-y-6">
      {/* Texto principal */}
      <div className="text-lg leading-relaxed p-4 bg-background border border-border/30 rounded-lg">
        {words.map((word, index) => getWordDisplay(word, index))}
      </div>

      {/* Controles */}
      {isStudyMode && hiddenWords.length > 0 && (
        <div className="space-y-4">
          {/* Botão principal Ver Resposta */}
          <div className="flex justify-center">
            <Button
              onClick={toggleAnswer}
              variant={showAnswer ? "outline" : "study"}
              size="lg"
              className="gap-2 min-w-[150px]"
            >
              {showAnswer ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  Ocultar Resposta
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Ver Resposta
                </>
              )}
            </Button>
          </div>

          {/* Estatísticas e controles adicionais */}
          <div className="pt-4 border-t border-border/30">
            <div className="flex justify-between items-center mb-3">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">
                  {showAnswer ? 'Todas as palavras reveladas' : 
                   `${remainingHiddenCount} de ${hiddenWords.length} palavra${hiddenWords.length !== 1 ? 's' : ''} oculta${hiddenWords.length !== 1 ? 's' : ''}`
                  }
                </span>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={hideAllWords} 
                  variant="ghost" 
                  size="sm"
                  disabled={remainingHiddenCount === hiddenWords.length}
                >
                  Ocultar Todas
                </Button>
                <Button 
                  onClick={revealAllWords} 
                  variant="ghost" 
                  size="sm"
                  disabled={remainingHiddenCount === 0}
                >
                  Revelar Todas
                </Button>
              </div>
            </div>

            {!showAnswer && remainingHiddenCount > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                💡 Clique nas palavras ocultas (____) para revelá-las individualmente
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}