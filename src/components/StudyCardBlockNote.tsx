/**
 * 🎯 STUDY CARD BLOCKNOTE
 * 
 * Componente específico para modo estudo que separa
 * automaticamente frente e verso usando quote blocks.
 */

import React, { useState } from 'react';
import SavedCardBlockNote from '@/components/SavedCardBlockNote';
import { parseFlashcardContent } from '@/lib/flashcard-parser';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudyCardBlockNoteProps {
  content: any[];
  title?: string;
  showAnswer?: boolean;
  onToggleAnswer?: () => void;
  className?: string;
}

export default function StudyCardBlockNote({ 
  content,
  title,
  showAnswer = false,
  onToggleAnswer,
  className
}: StudyCardBlockNoteProps) {
  const [internalShowAnswer, setInternalShowAnswer] = useState(false);
  
  // Usar estado interno se não for controlado externamente
  const isShowingAnswer = showAnswer || internalShowAnswer;
  const toggleAnswer = onToggleAnswer || (() => setInternalShowAnswer(!internalShowAnswer));

  // 🎯 PARSING DO CONTEÚDO
  const parsedContent = React.useMemo(() => {
    if (!content || !Array.isArray(content)) {
      return {
        front: [],
        back: [],
        hasQuote: false,
        strategy: 'empty' as const
      };
    }
    
    return parseFlashcardContent(content);
  }, [content]);

  // Debug logs (apenas em desenvolvimento)
  if (process.env.NODE_ENV === 'development') {
    console.log("🎯 [StudyCardBlockNote] Parsed content:", parsedContent);
  }

  if (parsedContent.strategy === 'empty') {
    return (
      <div className={cn("text-center text-gray-500 italic p-8", className)}>
        Conteúdo vazio
      </div>
    );
  }

  // Se não tem quote, usar conteúdo completo como frente e verso
  if (!parsedContent.hasQuote) {
    return (
      <div className={cn("space-y-4", className)}>
        {title && (
          <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
            {title}
          </h3>
        )}

        {!isShowingAnswer ? (
          // 📄 MODO PERGUNTA - Conteúdo completo
          <>
            <SavedCardBlockNote 
              content={content} 
              isEditing={false}
              onSave={() => {}}
            />
            
            <div className="text-center mt-4">
              <Button 
                onClick={toggleAnswer}
                variant="default"
                size="lg"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Eye className="h-4 w-4 mr-2" />
                Mostrar Resposta
              </Button>
            </div>
          </>
        ) : (
          // 📄 MODO RESPOSTA - Mesmo conteúdo
          <>
            <SavedCardBlockNote 
              content={content} 
              isEditing={false}
              onSave={() => {}}
            />
            
            <div className="text-center mt-4">
              <Button 
                onClick={toggleAnswer}
                variant="outline"
                size="lg"
              >
                <EyeOff className="h-4 w-4 mr-2" />
                Ocultar Resposta
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {title && (
        <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
          {title}
        </h3>
      )}

      {!isShowingAnswer ? (
        // 📄 MODO PERGUNTA - Apenas a frente (estilo /notes)
        <>
          <SavedCardBlockNote 
            content={parsedContent.front} 
            isEditing={false}
            onSave={() => {}}
          />
          
          <div className="text-center mt-4">
            <Button 
              onClick={toggleAnswer}
              variant="default"
              size="lg"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Eye className="h-4 w-4 mr-2" />
              Mostrar Resposta
            </Button>
          </div>
        </>
      ) : (
        // 📄 MODO RESPOSTA - Pergunta + Resposta (estilo /notes)
        <>
          {/* Pergunta (desfocada) */}
          <div className="opacity-60 mb-4">
            <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">
              PERGUNTA:
            </div>
            <SavedCardBlockNote 
              content={parsedContent.front} 
              isEditing={false}
              onSave={() => {}}
            />
          </div>
          
          {/* Divisor visual */}
          <div className="border-t border-gray-200 my-4"></div>
          
          {/* Resposta */}
          <div>
            <div className="text-xs text-green-600 mb-2 font-medium uppercase tracking-wide">
              RESPOSTA:
            </div>
            <SavedCardBlockNote 
              content={parsedContent.back} 
              isEditing={false}
              onSave={() => {}}
            />
          </div>
          
          <div className="text-center mt-4">
            <Button 
              onClick={toggleAnswer}
              variant="outline"
              size="lg"
            >
              <EyeOff className="h-4 w-4 mr-2" />
              Ocultar Resposta
            </Button>
          </div>
        </>
      )}
      
      {/* Debug info (remover em produção) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-400 mt-4 p-2 bg-gray-100 rounded">
          <strong>Debug:</strong> Estratégia: {parsedContent.strategy} | 
          Frente: {parsedContent.front.length} blocos | 
          Verso: {parsedContent.back.length} blocos
        </div>
      )}
    </div>
  );
}
