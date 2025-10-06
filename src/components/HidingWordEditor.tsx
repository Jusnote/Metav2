import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Plus, Eye, EyeOff } from 'lucide-react';

interface HidingWordEditorProps {
  onSave: (front: string, back: string, type: 'word-hiding', hiddenWords: string[]) => void;
  placeholder?: string;
}

export function HidingWordEditor({ onSave, placeholder }: HidingWordEditorProps) {
  const [text, setText] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Extrair palavras marcadas com {{ }}
  const parseHiddenWords = (text: string): { text: string; hiddenWords: string[] } => {
    const hiddenWords: string[] = [];
    const cleanText = text.replace(/\{\{([^}]+)\}\}/g, (_, word) => {
      hiddenWords.push(word.trim());
      return word.trim();
    });
    
    return { text: cleanText, hiddenWords };
  };

  // Renderizar texto com palavras destacadas
  const renderTextWithHighlights = (text: string, isPreview = false) => {
    const parts = text.split(/(\{\{[^}]+\}\})/);
    
    return parts.map((part, index) => {
      if (part.startsWith('{{') && part.endsWith('}}')) {
        const word = part.slice(2, -2).trim();
        if (isPreview) {
          return (
            <span
              key={index}
              className="bg-muted border border-dashed border-muted-foreground/50 rounded px-2 py-0.5 mx-0.5"
            >
              ____
            </span>
          );
        }
        return (
          <span
            key={index}
            className="bg-primary/20 text-primary font-medium rounded px-1 mx-0.5"
          >
            {word}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const canSave = text.trim() && /\{\{[^}]+\}\}/.test(text);

  const handleSave = () => {
    if (!canSave) return;

    const { text: cleanText, hiddenWords } = parseHiddenWords(text);
    
    // Criar pergunta sem as palavras ocultas (com ____)
    const questionText = text.replace(/\{\{([^}]+)\}\}/g, '____');
    
    // A resposta completa fica no back
    onSave(questionText, cleanText, 'word-hiding', hiddenWords);
    
    // Reset form
    setText('');
    setShowPreview(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey && canSave) {
      handleSave();
    }
  };

  return (
    <Card className="p-6 shadow-card bg-gradient-card">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <EyeOff className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">
            Flashcard com Ocultação de Palavras
          </h3>
        </div>

        <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">
          <p><strong>Como usar:</strong> Escreva seu texto e coloque as palavras que quer ocultar entre <code className="bg-background px-1 rounded">{`{{ }}`}</code></p>
          <p className="mt-1 text-xs">Exemplo: "A capital do Brasil é {`{{Brasília}}`}."</p>
        </div>

        {/* Campo único de texto */}
        <div className="space-y-2">
          <Label htmlFor="text">
            Texto com palavras ocultas (use {`{{ }}`} para marcar)
          </Label>
          <Textarea
            id="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "Digite seu texto com {{palavras}} que ficarão ocultas durante o estudo..."}
            className="min-h-[120px] resize-none"
          />
          
          {/* Prévia do texto formatado */}
          {text.trim() && (
            <div className="p-3 border border-border/30 rounded-lg bg-background space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Prévia:</span>
                <Button
                  onClick={() => setShowPreview(!showPreview)}
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 gap-1"
                >
                  {showPreview ? (
                    <>
                      <Eye className="h-3 w-3" />
                      Original
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3 w-3" />
                      Durante estudo
                    </>
                  )}
                </Button>
              </div>
              
              <div className="text-sm leading-relaxed">
                {renderTextWithHighlights(text, showPreview)}
              </div>
              
              {/\{\{[^}]+\}\}/.test(text) && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Palavras que serão ocultadas:</span>{' '}
                  {parseHiddenWords(text).hiddenWords.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mensagem de validação */}
        {text.trim() && !canSave && (
          <div className="text-sm text-warning p-2 bg-warning/10 rounded">
            Adicione pelo menos uma palavra entre {`{{ }}`} no texto para criar um flashcard de ocultação.
          </div>
        )}

        {canSave && (
          <div className="text-sm text-success p-2 bg-success/10 rounded">
            Flashcard pronto! Pressione Ctrl+Enter ou clique em Salvar.
          </div>
        )}

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={!canSave}
            variant="default"
            size="default"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Salvar Flashcard
          </Button>
        </div>
      </div>
    </Card>
  );
}