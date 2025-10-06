import { useState } from 'react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface WordSelectorProps {
  text: string;
  onWordsSelected: (indices: number[]) => void;
}

export function WordSelector({ text, onWordsSelected }: WordSelectorProps) {
  const [selectedWords, setSelectedWords] = useState<Set<number>>(new Set());

  // Divide o texto em palavras, mantendo a pontuação
  const words = text.split(/(\s+)/).filter(word => word.trim());
  
  const toggleWordSelected = (index: number) => {
    const newSelectedWords = new Set(selectedWords);
    if (newSelectedWords.has(index)) {
      newSelectedWords.delete(index);
    } else {
      newSelectedWords.add(index);
    }
    setSelectedWords(newSelectedWords);
    onWordsSelected(Array.from(newSelectedWords));
  };

  const clearSelection = () => {
    setSelectedWords(new Set());
    onWordsSelected([]);
  };

  if (!text.trim()) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>Digite o texto da resposta para selecionar palavras para ocultar</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">
        <p><strong>Selecione as palavras que serão ocultadas:</strong></p>
        <p className="mt-1 text-xs">Clique nas palavras que você quer que fiquem ocultas durante o estudo.</p>
      </div>
      
      <div className="p-4 border border-border/30 rounded-lg bg-background">
        <div className="text-lg leading-relaxed">
          {words.map((word, index) => {
            const isWhitespace = !word.trim();
            
            if (isWhitespace) {
              return <span key={index}>{word}</span>;
            }
            
            return (
              <span
                key={index}
                onClick={() => toggleWordSelected(index)}
                className={cn(
                  "relative inline-block transition-all duration-200 cursor-pointer hover:bg-primary/10 rounded px-1",
                  selectedWords.has(index) && "bg-primary/20 text-primary font-medium"
                )}
                title="Clique para ocultar/mostrar esta palavra"
              >
                {word}
              </span>
            );
          })}
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-border/30 mt-4">
          <span className="text-sm text-muted-foreground">
            {selectedWords.size} palavra{selectedWords.size !== 1 ? 's' : ''} selecionada{selectedWords.size !== 1 ? 's' : ''}
          </span>
          <Button onClick={clearSelection} variant="outline" size="sm" disabled={selectedWords.size === 0}>
            Limpar Seleção
          </Button>
        </div>
      </div>
    </div>
  );
}