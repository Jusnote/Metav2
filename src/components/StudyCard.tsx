import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Flashcard, StudyDifficulty } from '@/types/flashcard';
import { Clock, Eye, EyeOff, CheckCircle, XCircle, RotateCcw, MapPin, Calendar } from 'lucide-react';
import { FlashcardStatistics } from '@/components/FlashcardStatistics';
import { cn } from '@/lib/utils';

interface StudyCardProps {
  card: Flashcard;
  onAnswer: (difficulty: StudyDifficulty) => void;
  showAnswer?: boolean;
}

export function StudyCard({ card, onAnswer, showAnswer: initialShowAnswer = false }: StudyCardProps) {
  const [showAnswer, setShowAnswer] = useState(initialShowAnswer);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(true);
  const [isFlipping, setIsFlipping] = useState(false);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (timerActive) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [timerActive]);

  // Stop timer when answer is shown
  useEffect(() => {
    if (showAnswer && timerActive) {
      setTimerActive(false);
    }
  }, [showAnswer, timerActive]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleAnswer = () => {
    setIsFlipping(true);
    
    // Delay the content change to happen mid-flip
    setTimeout(() => {
      setShowAnswer(!showAnswer);
      setTimeout(() => {
        setIsFlipping(false);
      }, 150); // Half of the flip duration
    }, 150);
  };

  const handleAnswer = (difficulty: StudyDifficulty) => {
    onAnswer(difficulty);
    setShowAnswer(false);
    setTimerSeconds(0);
    setTimerActive(true);
  };

  const getCardTypeLabel = (type: string) => {
    switch (type) {
      case 'true-false':
        return 'V/F';
      case 'word-hiding':
        return 'Ocultação';
      default:
        return 'Tradicional';
    }
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 2) return 'bg-red-100 text-red-700 border-red-200';
    if (difficulty <= 4) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-green-100 text-green-700 border-green-200';
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex gap-6 items-start justify-center">
        {/* Painel de Estatísticas - Lado Esquerdo */}
        {/* <div className="hidden lg:block">
          <FlashcardStatistics card={card} />
        </div> */}
        
        {/* Container Principal */}
        <div className="flex-1 max-w-2xl mt-32">
          {/* Card Principal com design da imagem */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden">
            {/* Card interno com bordas arredondadas */}
            <div className="pt-2 px-2 pb-6">
               <div className={cn(
                 "bg-linear-to-br from-slate-50 to-blue-50/30 rounded-xl p-3 border border-slate-200/30",
                 "transition-transform duration-300 transform-gpu",
                 isFlipping && "rotate-y-180"
               )} style={{
                 transformStyle: 'preserve-3d',
                 backfaceVisibility: 'hidden'
               }}>
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-slate-800">Lead Designer</h2>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <MapPin className="h-4 w-4" />
                      <span>Hopin</span>
                    </div>
                  </div>
                  
                  <Button
                    onClick={toggleAnswer}
                    variant="outline"
                    size="sm"
                    className="gap-2 bg-white/80 hover:bg-white border-slate-200 hover:border-slate-300"
                  >
                    {showAnswer ? (
                      <>
                        <EyeOff className="h-4 w-4" />
                        Ocultar
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        Revelar
                      </>
                    )}
                  </Button>
                </div>

                {/* Content section - Question or Answer */}
                <div className="mb-6">
                  {!showAnswer ? (
                    <div className="bg-white/60 rounded-lg p-4 border border-slate-200/40">
                      <p className="text-slate-700 leading-relaxed font-medium">{card.front}</p>
                    </div>
                  ) : (
                    <div className="bg-green-50/60 rounded-lg p-4 border border-green-200/40">
                      <p className="text-slate-700 leading-relaxed">{card.back}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Informações abaixo do card */}
             <div className="px-2 pb-6">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                      ${card.difficulty || 1}k-${(card.difficulty || 1) + 2}k
                    </Badge>
                    <Badge variant="outline" className="text-slate-600">
                      {getCardTypeLabel(card.type)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-slate-600">Remote</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-slate-600">Full-time</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-slate-500">
                  <Calendar className="h-4 w-4" />
                  <span className="font-mono">{formatTime(timerSeconds)}</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
             {showAnswer && (
               <div className="px-2 pb-6">
                <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="text-center">
                    <p className="text-sm text-slate-600 mb-4">Como foi sua performance?</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Button
                      onClick={() => handleAnswer('again')}
                      variant="outline"
                      className="gap-2 bg-red-50 hover:bg-red-100 border-red-200 hover:border-red-300 text-red-700 hover:text-red-800"
                    >
                      <XCircle className="h-4 w-4" />
                      Difícil
                    </Button>
                    
                    <Button
                      onClick={() => handleAnswer('hard')}
                      variant="outline"
                      className="gap-2 bg-yellow-50 hover:bg-yellow-100 border-yellow-200 hover:border-yellow-300 text-yellow-700 hover:text-yellow-800"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Médio
                    </Button>
                    
                    <Button
                      onClick={() => handleAnswer('easy')}
                      variant="outline"
                      className="gap-2 bg-green-50 hover:bg-green-100 border-green-200 hover:border-green-300 text-green-700 hover:text-green-800"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Fácil
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}