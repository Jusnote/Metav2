import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImprovedWordHidingDisplay } from '@/components/ImprovedWordHidingDisplay';
import { TrueFalseDisplay } from '@/components/TrueFalseDisplay';
import { Flashcard, StudyDifficulty } from '@/types/flashcard';
import { RotateCcw, Eye, EyeOff, Plus, Link2, ArrowDown, GitBranch, Zap, Brain, Clock, MoreHorizontal, Layers, Timer } from 'lucide-react';
import { FlashcardInfoPanel } from '@/components/FlashcardInfoPanel';
import { FlashcardStatistics } from '@/components/FlashcardStatistics';
import { cn } from '@/lib/utils';


interface FlashcardDisplayProps {
  card: Flashcard;
  parentCards?: Flashcard[]; // Hierarchy context from root to current card
  onAnswer: (difficulty: StudyDifficulty) => void;
  showAnswer?: boolean;
  getChildCards?: (parentId: string) => Flashcard[];
}

export function FlashcardDisplay({
  card,
  parentCards = [],
  onAnswer,
  showAnswer: initialShowAnswer = false,
  getChildCards
}: FlashcardDisplayProps) {
  const [showAnswer, setShowAnswer] = useState(initialShowAnswer);
  const [subCardAnswers, setSubCardAnswers] = useState<Record<string, boolean>>({});
  const [currentHighlightedSub, setCurrentHighlightedSub] = useState<number | null>(null);
  const [mainCardAnswered, setMainCardAnswered] = useState(false);
  const [userGotItRight, setUserGotItRight] = useState<boolean | null>(null);
  const [subCardResults, setSubCardResults] = useState<Record<string, boolean | null>>({});
  const [isLoadingAnimationActive, setIsLoadingAnimationActive] = useState(true);
  const [showSubFlashcardSection, setShowSubFlashcardSection] = useState(false);
  const [questionPulseTriggered, setQuestionPulseTriggered] = useState(false);
  const [answerPulseTriggered, setAnswerPulseTriggered] = useState(false);

  // States for true-false cards
  const [trueFalseAnswer, setTrueFalseAnswer] = useState<'true' | 'false' | null>(null);
  const [trueFalseIsCorrect, setTrueFalseIsCorrect] = useState<boolean | null>(null);

  // State for word-hiding cards
  const [wordHidingAllRevealed, setWordHidingAllRevealed] = useState(false);

  // Timer states
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(true);

  // Calculate hierarchy context
  const childCards = getChildCards ? getChildCards(card.id) : [];
  const hasParents = parentCards.length > 0;
  const hasChildren = childCards.length > 0;

  // Format timer display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Effect to trigger question pulse on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuestionPulseTriggered(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Effect to trigger answer pulse when answer is shown
  useEffect(() => {
    if (showAnswer && !answerPulseTriggered) {
      const timer = setTimeout(() => {
        setAnswerPulseTriggered(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showAnswer, answerPulseTriggered]);

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

  // Stop timer when evaluation buttons appear
  useEffect(() => {
    const shouldShowEvaluationButtons = 
      (showAnswer && !hasParents && !mainCardAnswered && !showSubFlashcardSection) ||
      (card.type === 'word-hiding' && wordHidingAllRevealed && !hasParents && !mainCardAnswered && !showSubFlashcardSection) ||
      ((showAnswer || (card.type === 'true-false' && trueFalseAnswer !== null)) && (hasParents || mainCardAnswered));
    
    if (shouldShowEvaluationButtons && timerActive) {
      setTimerActive(false);
    }
  }, [showAnswer, hasParents, mainCardAnswered, showSubFlashcardSection, card.type, wordHidingAllRevealed, trueFalseAnswer, timerActive]);

  const handleTrueFalseAnswer = (userAnswer: 'true' | 'false', isCorrect: boolean) => {
    setTrueFalseAnswer(userAnswer);
    setTrueFalseIsCorrect(isCorrect);
    setMainCardAnswered(true);
    setUserGotItRight(isCorrect);

    if (isCorrect && hasChildren && !hasParents) {
      setTimeout(() => {
        setCurrentHighlightedSub(0);
        setTimeout(() => setCurrentHighlightedSub(null), 8000);
      }, 800);
    }
    // Removed automatic 'again' handling - user should choose difficulty manually
  };

  const handleAnswer = (difficulty: StudyDifficulty) => {
    onAnswer(difficulty);
    setShowAnswer(false);
    setMainCardAnswered(false);
    setUserGotItRight(null);
    setShowSubFlashcardSection(false); // Reset sub-flashcard section visibility
    setWordHidingAllRevealed(false); // Reset word-hiding state
    setQuestionPulseTriggered(false); // Reset question pulse for next card
    setAnswerPulseTriggered(false); // Reset answer pulse for next card
    // Reset true-false states to prevent state leakage between cards
    setTrueFalseAnswer(null);
    setTrueFalseIsCorrect(null);
  };

  const handleMainCardResponse = (gotItRight: boolean) => {
    setMainCardAnswered(true);
    setUserGotItRight(gotItRight);

    if (gotItRight && hasChildren && !hasParents) {
      setTimeout(() => {
        setCurrentHighlightedSub(0);
        setTimeout(() => setCurrentHighlightedSub(null), 8000);
      }, 800);
    }
    // Removed automatic 'again' handling - user should choose difficulty manually
  };

  const handleSubCardResponse = (cardId: string, cardIndex: number, gotItRight: boolean) => {
    setSubCardResults(prev => ({ ...prev, [cardId]: gotItRight }));
    setMainCardAnswered(true);
    setUserGotItRight(gotItRight);

    if (gotItRight && cardIndex + 1 < childCards.length) {
      setTimeout(() => {
        setCurrentHighlightedSub(cardIndex + 1);
        setTimeout(() => setCurrentHighlightedSub(null), 8000);
      }, 600);
    }
  };

  const toggleAnswer = () => {
    setShowAnswer(!showAnswer);
    if (!showAnswer) {
      setIsLoadingAnimationActive(false);
      setShowSubFlashcardSection(false); // Hide sub-flashcards when hiding main answer
    }
  };

  // Handler for when all words are revealed in word-hiding flashcards
  const handleAllWordsRevealed = () => {
    setWordHidingAllRevealed(true);
    setShowAnswer(true); // Automatically show answer
  };

  const toggleSubCardAnswer = (cardId: string, cardIndex: number) => {
    setSubCardAnswers(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));

    if (!subCardAnswers[cardId]) {
      setCurrentHighlightedSub(null);

      if (cardIndex + 1 < childCards.length) {
        const nextCardId = childCards[cardIndex + 1].id;
        if (!subCardAnswers[nextCardId]) {
          setTimeout(() => {
            setCurrentHighlightedSub(cardIndex + 1);
            setTimeout(() => setCurrentHighlightedSub(null), 8000);
          }, 600);
        }
      }
    }
  };

  return (
    <div className="relative">
      {currentHighlightedSub !== null && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-primary/90 text-primary-foreground px-4 py-2 rounded-full shadow-lg animate-fade-in flex items-center gap-2">
            <div className="w-2 h-2 bg-primary-foreground rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">
              ↓ Responda a {currentHighlightedSub === 0 ? 'primeira' : `${currentHighlightedSub + 1}ª`} sub-flashcard
            </span>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        {hasParents && (
          <div className="space-y-4 animate-fade-in">
            {parentCards.map((parent, index) => (
              <Card key={parent.id} className={cn(
                "p-5 bg-accent/15 border-l-4 shadow-sm hover:shadow-md transition-all duration-300",
                index === 0 && "border-l-primary",
                index > 0 && "border-l-muted-foreground/30 ml-6"
              )}>
                <div className="text-sm space-y-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Link2 className="h-4 w-4" />
                    <span className="font-medium">Contexto - Nível {index + 1}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="text-foreground"><strong className="text-primary">P:</strong> {parent.front}</div>
                    <div className="text-foreground"><strong className="text-primary">R:</strong> {parent.back}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="flex gap-6 items-start justify-center">
          {/* Painel de Estatísticas - Lado Esquerdo */}
          {!hasParents && (
            <div className="hidden lg:block">
              <FlashcardStatistics card={card} />
            </div>
          )}
          
          {/* Card principal */}
          <div className="flex-1">
            <Card className={cn(
              "w-full max-w-5xl mx-auto relative overflow-hidden",
              "bg-gradient-to-br from-slate-50/80 via-white to-blue-50/60",
              "border border-slate-200/60 rounded-2xl shadow-lg hover:shadow-xl",
              "transition-all duration-500 ease-out min-h-[28rem]",
              "backdrop-blur-sm ring-1 ring-white/20",
              !hasParents && "max-w-6xl shadow-2xl",
              hasParents && "max-w-5xl border-l-4 border-l-gradient-to-b from-blue-400 to-purple-500"
            )}>
            {/* Gradient overlay for depth */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-slate-100/30 pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-400" />
            {/* Header com FlashcardInfoPanel integrado */}
            <div className="relative z-10 flex items-center justify-between p-6 pb-4">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-purple-500/20 rounded-full blur-md" />
                  <Avatar className="h-12 w-12 relative border-2 border-white/50 shadow-lg">
                    <AvatarImage src="/brain-icon.png" alt="Flashcard" className="object-cover" />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      <Brain className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-3 text-sm font-medium">
                    {!hasParents ? (
                      <>
                        <span className="bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent font-semibold">
                          {timerActive ? "Análise temporal" : "Respondido em exatos"}
                        </span>
                        <div className="w-px h-4 bg-gradient-to-b from-slate-300 to-slate-400"></div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-blue-200/50">
                          <Timer className={`h-4 w-4 ${timerActive ? 'text-orange-600 animate-pulse' : 'text-green-600'}`} />
                          <span className={`font-mono text-sm font-medium ${timerActive ? 'text-orange-700' : 'text-green-700'}`}>
                            {formatTime(timerSeconds)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-semibold">
                        Sub-flashcard • Nível {card.level + 1}
                      </span>
                    )}
                  </div>
                  <span className="text-slate-500 text-xs flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3 text-slate-400" />
                    {card.type === 'traditional' ? 'Tradicional' : 
                     card.type === 'word-hiding' ? 'Palavras Ocultas' : 'Verdadeiro/Falso'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Compact Action Buttons */}
                {card.type !== 'true-false' && card.type !== 'word-hiding' && (
                  <Button
                    onClick={toggleAnswer}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-full bg-gradient-to-r from-blue-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20 border border-blue-200/50 backdrop-blur-sm transition-all duration-300 hover:scale-105 shadow-sm hover:shadow-md"
                    title={showAnswer ? "Ocultar resposta" : "Ver resposta"}
                  >
                    {showAnswer ? (
                      <EyeOff className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Eye className="h-4 w-4 text-blue-600" />
                    )}
                  </Button>
                )}
                
                {showAnswer && hasChildren && (
                  <Button
                    onClick={() => setShowSubFlashcardSection(!showSubFlashcardSection)}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 border border-purple-200/50 backdrop-blur-sm transition-all duration-300 hover:scale-105 shadow-sm hover:shadow-md"
                    title={showSubFlashcardSection ? "Esconder sub-cards" : "Mostrar sub-cards"}
                  >
                    <GitBranch className="h-4 w-4 text-purple-600" />
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-gray-100"
                  title="Mais opções"
                >
                  <MoreHorizontal className="h-3 w-3 text-gray-500" />
                </Button>
              </div>
            </div>
            {/* Content */}
            <div className="relative z-10 flex-1 p-8 pt-4">
              <div className="space-y-8">
                {card.type === 'word-hiding' ? (
                  <div className="bg-gradient-to-45deg from-slate-50 via-blue-50 to-slate-100 border-l-4 border-l-emerald-500 rounded-xl p-6 shadow-sm hover:shadow-lg hover:scale-[1.002] transition-all duration-700">
                    <ImprovedWordHidingDisplay
                      text={card.back}
                      hiddenWords={card.hiddenWords || []}
                      isStudyMode={true}
                      onAllWordsRevealed={handleAllWordsRevealed}
                    />
                  </div>
                ) : card.type === 'true-false' ? (
                  <div className="space-y-6">
                    <TrueFalseDisplay
                      statement={card.front}
                      correctAnswer={card.back}
                      explanation={card.explanation}
                      onAnswer={handleTrueFalseAnswer}
                      hasAnswered={trueFalseAnswer !== null}
                      userAnswer={trueFalseAnswer || undefined}
                      isCorrect={trueFalseIsCorrect || undefined}
                    />
                  </div>
                ) : (
                  <div className="space-y-6">
                      {/* Pergunta */}
                      <div className="text-center">
                        <div className="relative">
                          <div className={cn(
                            "relative overflow-hidden",
                            "bg-gradient-to-45deg from-slate-50 via-blue-50 to-slate-100",
                            "border-l-4 border-l-emerald-500 rounded-xl",
                            "shadow-sm hover:shadow-lg hover:scale-[1.002] transition-all duration-700",
                            "min-h-[100px] flex items-center max-w-4xl mx-auto",
                            questionPulseTriggered && "animate-[single-pulse_0.6s_ease-out_forwards]"
                          )}>
                            <div className="absolute top-2 right-3">
                              <span className="bg-slate-100/80 backdrop-blur-sm px-2 py-1 rounded-full font-mono text-[10px] tracking-[0.1em] uppercase text-slate-500">
                                ❓ Pergunta
                              </span>
                            </div>
                            <div className="relative z-10 w-full px-6">
                              <p className="text-slate-800 leading-relaxed text-center font-medium text-lg">{card.front}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                    {showAnswer && (
                        <div className="animate-fade-in">
                          {/* Resposta */}
                          <div className="text-center">
                            <div className="relative">
                              <div className={cn(
                                "relative overflow-hidden",
                                "bg-gradient-to-45deg from-slate-50 via-blue-50 to-slate-100",
                                "border-l-4 border-l-emerald-500 rounded-xl",
                                "shadow-sm hover:shadow-lg hover:scale-[1.002] transition-all duration-700",
                                "min-h-[100px] flex items-center max-w-4xl mx-auto",
                                answerPulseTriggered && "animate-[single-pulse_0.6s_ease-out_forwards]"
                              )}>
                                <div className="absolute top-2 right-3">
                                  <span className="bg-slate-100/80 backdrop-blur-sm px-2 py-1 rounded-full font-mono text-[10px] tracking-[0.1em] uppercase text-slate-500">
                                    💡 Resposta
                                  </span>
                                </div>
                                <div className="relative z-10 w-full px-6">
                                  <p className="text-slate-800 leading-relaxed text-center font-medium text-lg">{card.back}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            </div>

            {/* Removed Action Buttons - now in header */}

              {showSubFlashcardSection && hasChildren && (
                <div className="mt-4 mx-8 mb-6">
                  {/* Elegant Hierarchical Separator */}
                  <div className="relative flex items-center justify-center mb-8">
                    {/* Gradient Line */}
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full h-px bg-gradient-to-r from-transparent via-blue-400/80 to-transparent"></div>
                    </div>
                    {/* Central Indicator */}
                      <div className="relative flex items-center gap-1.5 bg-gradient-to-r from-slate-100/95 via-blue-100/90 to-purple-100/95 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/50 shadow-md ring-1 ring-inset ring-white/40">
                        <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full animate-pulse"></div>
                        <span className="font-mono text-[10px] tracking-widest uppercase text-slate-700 font-medium">Aprofundamento</span>
                        <Layers className="h-3 w-3 text-slate-600" />
                      </div>
                  </div>

                  {/* Chat Container */}
                  <div className="bg-gradient-to-b from-gray-50 to-white rounded-xl border border-gray-200 p-4 max-h-96 overflow-y-auto">
                    <div className="space-y-4">
                      {childCards.map((childCard, index) => (
                        <div key={childCard.id} className="space-y-3">
                          {/* Professor Question */}
                          <div className="flex items-start gap-3 animate-fade-in">
                            <Avatar className="h-8 w-8 border-2 border-blue-200">
                              <AvatarImage src="/brain-icon.png" alt="Professor" />
                              <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                                <Brain className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                                <p className="text-sm text-gray-800">{childCard.front}</p>
                              </div>
                              <div className="flex items-center gap-1 mt-1 ml-2">
                                <span className="text-xs text-gray-500">Professor</span>
                                <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                                <span className="text-xs text-gray-400">agora</span>
                              </div>
                            </div>
                          </div>

                          {/* Show Answer Button or Answer */}
                          {!subCardAnswers[childCard.id] ? (
                            <div className="flex justify-end">
                              <Button
                                onClick={() => toggleSubCardAnswer(childCard.id, index)}
                                variant="outline"
                                size="sm"
                                className="gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 rounded-full px-4 py-2"
                              >
                                <Eye className="h-3 w-3" />
                                Ver Resposta
                              </Button>
                            </div>
                          ) : (
                            <>
                              {/* Professor Answer - Right Side */}
                               <div className="flex items-start gap-3 animate-fade-in justify-end">
                                 <div className="flex-1 flex justify-end">
                                   <div className="max-w-[80%]">
                                     <div className="bg-white text-gray-800 rounded-2xl rounded-tr-sm px-4 py-3 shadow-lg border-2 border-orange-400">
                                       <p className="text-sm">{childCard.back}</p>
                                     </div>
                                     <div className="flex items-center gap-1 mt-1 mr-2 justify-end">
                                       <span className="text-xs text-gray-400">agora</span>
                                       <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                                       <span className="text-xs text-gray-500">Professor</span>
                                     </div>
                                   </div>
                                 </div>
                                 <Avatar className="h-8 w-8 border-2 border-blue-200">
                                   <AvatarImage src="/brain-icon.png" alt="Professor" />
                                   <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                                     <Brain className="h-4 w-4" />
                                   </AvatarFallback>
                                 </Avatar>
                               </div>

                              {/* Student Response Buttons */}
                              <div className="flex justify-end gap-2">
                                <Button
                                  onClick={() => {
                                    handleSubCardResponse(childCard.id, index, false);
                                  }}
                                  variant="outline"
                                  size="sm"
                                  className="gap-2 bg-gradient-to-r from-red-50/80 to-rose-50/80 border-red-200/60 text-red-700 hover:from-red-100/90 hover:to-rose-100/90 hover:border-red-300/70 rounded-full px-4 py-2 text-xs font-medium backdrop-blur-sm transition-all duration-300 hover:scale-105 shadow-sm hover:shadow-md"
                                >
                                  😕 Não entendi
                                </Button>
                                <Button
                                  onClick={() => {
                                    handleSubCardResponse(childCard.id, index, true);
                                  }}
                                  variant="outline"
                                  size="sm"
                                  className="gap-2 bg-gradient-to-r from-green-50/80 to-emerald-50/80 border-green-200/60 text-green-700 hover:from-green-100/90 hover:to-emerald-100/90 hover:border-green-300/70 rounded-full px-4 py-2 text-xs font-medium backdrop-blur-sm transition-all duration-300 hover:scale-105 shadow-sm hover:shadow-md"
                                >
                                  ✅ Entendi!
                                </Button>
                              </div>
                            </>
                          )}

                          {/* Divider between conversations */}
                          {index < childCards.length - 1 && (
                            <div className="flex items-center gap-2 my-4">
                              <div className="flex-1 h-px bg-gray-200"></div>
                              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">próxima pergunta</span>
                              <div className="flex-1 h-px bg-gray-200"></div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Chat Footer */}
                  <div className="text-center mt-4">
                    <p className="text-xs text-gray-500">💬 Interface de chat para melhor aprendizado</p>
                  </div>
                </div>
              )}

          </Card>
        </div>

        {/* Botões Acertei/Errei para flashcards principais */}
        {((showAnswer && !hasParents && !mainCardAnswered && !showSubFlashcardSection) || 
          (card.type === 'word-hiding' && wordHidingAllRevealed && !hasParents && !mainCardAnswered && !showSubFlashcardSection)) && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-center text-sm font-medium bg-gradient-to-r from-slate-600 to-slate-700 bg-clip-text text-transparent">
              ✨ Como você avalia sua resposta?
            </h3>
            <div className="flex justify-center gap-4">
              <Button
                onClick={() => handleMainCardResponse(true)}
                variant="outline"
                size="sm"
                className="gap-2 text-sm bg-gradient-to-r from-green-50/90 to-emerald-50/90 border-green-200/70 text-green-700 hover:from-green-100/95 hover:to-emerald-100/95 hover:border-green-300/80 rounded-full px-6 py-3 font-medium backdrop-blur-sm transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl ring-1 ring-green-200/30"
              >
                ✓ Acertei
              </Button>

              <Button
                onClick={() => handleMainCardResponse(false)}
                variant="outline"
                size="sm"
                className="gap-2 text-sm bg-gradient-to-r from-red-50/90 to-rose-50/90 border-red-200/70 text-red-700 hover:from-red-100/95 hover:to-rose-100/95 hover:border-red-300/80 rounded-full px-6 py-3 font-medium backdrop-blur-sm transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl ring-1 ring-red-200/30"
              >
                ✗ Errei
              </Button>
            </div>
          </div>
        )}
        </div>

        {/* Botões de Avaliação - Abaixo do Card */}
        {(showAnswer || (card.type === 'true-false' && trueFalseAnswer !== null)) && (hasParents || mainCardAnswered) && (
          <div className="space-y-6 animate-fade-in mt-8">
            <h3 className="text-center text-sm font-medium bg-gradient-to-r from-slate-600 to-slate-700 bg-clip-text text-transparent">
              ✨ Como você avalia sua resposta?
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              <Button
                onClick={() => handleAnswer('again')}
                variant="default"
                size="lg"
                className="flex-1 bg-gradient-to-r from-red-50/90 to-rose-50/90 border-red-200/70 text-red-700 hover:from-red-100/95 hover:to-rose-100/95 hover:border-red-300/80 rounded-xl backdrop-blur-sm transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl ring-1 ring-red-200/30 gap-2 py-4"
              >
                <RotateCcw className="h-4 w-4" />
                Novamente
              </Button>

              <Button
                onClick={() => handleAnswer('hard')}
                variant="default"
                size="lg"
                className="flex-1 bg-gradient-to-r from-orange-50/90 to-amber-50/90 border-orange-200/70 text-orange-700 hover:from-orange-100/95 hover:to-amber-100/95 hover:border-orange-300/80 rounded-xl backdrop-blur-sm transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl ring-1 ring-orange-200/30 gap-2 py-4"
              >
                Difícil
              </Button>

              <Button
                onClick={() => handleAnswer('medium')}
                variant="default"
                size="lg"
                className="flex-1 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border-blue-200/70 text-blue-700 hover:from-blue-100/95 hover:to-indigo-100/95 hover:border-blue-300/80 rounded-xl backdrop-blur-sm transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl ring-1 ring-blue-200/30 gap-2 py-4"
              >
                Médio
              </Button>

              <Button
                onClick={() => handleAnswer('easy')}
                variant="default"
                size="lg"
                className="flex-1 bg-gradient-to-r from-green-50/90 to-emerald-50/90 border-green-200/70 text-green-700 hover:from-green-100/95 hover:to-emerald-100/95 hover:border-green-300/80 rounded-xl backdrop-blur-sm transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl ring-1 ring-green-200/30 gap-2 py-4"
              >
                Fácil
              </Button>
            </div>

            <div className="text-xs text-center text-slate-600/80 space-y-1 bg-gradient-to-r from-slate-50/50 to-gray-50/50 rounded-lg p-3 backdrop-blur-sm border border-slate-200/30 max-w-4xl mx-auto">
              <p><strong className="text-red-600">Novamente:</strong> Não lembrei • <strong className="text-orange-600">Difícil:</strong> Lembrei com dificuldade</p>
              <p><strong className="text-blue-600">Médio:</strong> Lembrei bem • <strong className="text-green-600">Fácil:</strong> Muito fácil</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
