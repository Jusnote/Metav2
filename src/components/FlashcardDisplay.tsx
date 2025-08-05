import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { WordHidingDisplay } from '@/components/WordHidingDisplay';
import { ImprovedWordHidingDisplay } from '@/components/ImprovedWordHidingDisplay';
import { TrueFalseDisplay } from '@/components/TrueFalseDisplay';
import { Flashcard, StudyDifficulty } from '@/types/flashcard';
import { RotateCcw, Eye, EyeOff, Plus, Link2, ArrowDown, GitBranch, Zap, Brain, Clock, MoreHorizontal, Layers } from 'lucide-react';
import { FlashcardInfoPanel } from '@/components/FlashcardInfoPanel';
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
    } else if (!isCorrect) {
      setTimeout(() => {
        handleAnswer('again');
      }, 2000);
    }
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
  };

  const handleMainCardResponse = (gotItRight: boolean) => {
    setMainCardAnswered(true);
    setUserGotItRight(gotItRight);

    if (gotItRight && hasChildren && !hasParents) {
      setTimeout(() => {
        setCurrentHighlightedSub(0);
        setTimeout(() => setCurrentHighlightedSub(null), 8000);
      }, 800);
    } else if (!gotItRight) {
      handleAnswer('again');
    }
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

  const hasParents = parentCards.length > 0;
  const childCards = getChildCards ? getChildCards(card.id) : [];
  const hasChildren = childCards.length > 0;

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

      <div className="max-w-4xl mx-auto">
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

        <div className="flex flex-col items-center gap-4">
          {/* Card principal */}
          <Card className={cn(
            "w-full max-w-4xl mx-auto bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 min-h-[25rem]",
            !hasParents && "max-w-5xl",
            hasParents && "max-w-xl border-l-4 border-l-primary/50"
          )}>
            {/* Header com FlashcardInfoPanel integrado */}
            <div className="flex items-center justify-between p-4 pb-3">
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src="/brain-icon.png" alt="Flashcard" />
                  <AvatarFallback>
                    <Brain className="h-5 w-5 text-purple-600" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    {!hasParents ? (
                      <>
                        <span>Card Status</span>
                        <div className="w-px h-4 bg-gray-300"></div>
                        <FlashcardInfoPanel 
                          card={card}
                          hasParents={hasParents}
                          hasChildren={hasChildren}
                          showAnswer={showAnswer}
                        />
                      </>
                    ) : (
                      <span>Sub-flashcard • Nível {card.level + 1}</span>
                    )}
                  </div>
                  <span className="text-gray-500 text-xs flex items-center gap-1">
                    <Clock className="h-3 w-3" />
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
                    className="h-6 w-6 p-0 hover:bg-blue-50 transition-colors"
                    title={showAnswer ? "Ocultar resposta" : "Ver resposta"}
                  >
                    {showAnswer ? (
                      <EyeOff className="h-3 w-3 text-blue-600" />
                    ) : (
                      <Eye className="h-3 w-3 text-blue-600" />
                    )}
                  </Button>
                )}
                
                {showAnswer && hasChildren && (
                  <Button
                    onClick={() => setShowSubFlashcardSection(!showSubFlashcardSection)}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-purple-50 transition-colors"
                    title={showSubFlashcardSection ? "Esconder sub-cards" : "Mostrar sub-cards"}
                  >
                    <GitBranch className="h-3 w-3 text-purple-600" />
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
            <div className="px-4 pb-3">
              <div className="space-y-4">


                {card.type === 'word-hiding' ? (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <ImprovedWordHidingDisplay
                      text={card.back}
                      hiddenWords={card.hiddenWords || []}
                      isStudyMode={true}
                      onAllWordsRevealed={handleAllWordsRevealed}
                    />
                  </div>
                ) : card.type === 'true-false' ? (
                  <div>
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
                  <div className="space-y-4">
                    <div className={cn(
                      "relative bg-gradient-to-45deg from-slate-50 via-blue-50 to-slate-100 p-6 rounded-xl border-l-4 border-l-slate-400 shadow-sm hover:shadow-lg hover:scale-[1.002] transition-all duration-700 min-h-[100px] flex items-center",
                      questionPulseTriggered && "animate-[single-pulse_0.6s_ease-out_forwards]"
                    )}>
                       <div className="absolute top-2 right-3">
             <span className="bg-slate-100/80 backdrop-blur-sm px-2 py-1 rounded-full font-mono text-[10px] tracking-[0.1em] uppercase text-slate-500">
               PERGUNTA
             </span>
           </div>
                       <p className="text-slate-800 leading-relaxed w-full text-center">{card.front}</p>
                     </div>

                    {showAnswer && (
                      <div className="animate-fade-in">
                        <div className={cn(
                          "relative bg-gradient-to-45deg from-orange-50 via-pink-50 to-yellow-50 p-6 rounded-xl border-l-4 border-l-orange-400 shadow-md hover:shadow-xl hover:scale-[1.002] transition-all duration-700 min-h-[100px] flex items-center",
                          answerPulseTriggered && "animate-[single-pulse_0.6s_ease-out_forwards]"
                        )}>
                           <div className="absolute top-2 right-3">
              <span className="bg-orange-100/80 backdrop-blur-sm px-2 py-1 rounded-full font-mono text-[10px] tracking-[0.1em] uppercase text-orange-600">
                RESPOSTA
              </span>
            </div>
                           <p className="text-orange-800 leading-relaxed w-full text-center">{card.back}</p>
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
                                  className="gap-1 bg-red-50 border-red-200 text-red-700 hover:bg-red-100 rounded-full px-3 py-1 text-xs"
                                >
                                  😕 Não entendi
                                </Button>
                                <Button
                                  onClick={() => {
                                    handleSubCardResponse(childCard.id, index, true);
                                  }}
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 bg-green-50 border-green-200 text-green-700 hover:bg-green-100 rounded-full px-3 py-1 text-xs"
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
            <h3 className="text-center text-sm font-medium text-muted-foreground">
              Como você avalia sua resposta?
            </h3>
            <div className="flex justify-center gap-2">
              <Button
                onClick={() => handleMainCardResponse(true)}
                variant="outline"
                size="sm"
                className="gap-1 text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
              >
                ✓ Acertei
              </Button>

              <Button
                onClick={() => handleMainCardResponse(false)}
                variant="outline"
                size="sm"
                className="gap-1 text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
              >
                ✗ Errei
              </Button>
            </div>
          </div>
        )}

        {(showAnswer || (card.type === 'true-false' && trueFalseAnswer !== null)) && (hasParents || mainCardAnswered) && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-center text-sm font-medium text-muted-foreground">
              Como você avalia sua resposta?
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button
                onClick={() => handleAnswer('again')}
                variant="again"
                size="study"
                className="flex-1"
              >
                <RotateCcw className="h-4 w-4" />
                Novamente
              </Button>

              <Button
                onClick={() => handleAnswer('hard')}
                variant="hard"
                size="study"
                className="flex-1"
              >
                Difícil
              </Button>

              <Button
                onClick={() => handleAnswer('medium')}
                variant="medium"
                size="study"
                className="flex-1"
              >
                Médio
              </Button>

              <Button
                onClick={() => handleAnswer('easy')}
                variant="easy"
                size="study"
                className="flex-1"
              >
                Fácil
              </Button>
            </div>

            <div className="text-xs text-center text-muted-foreground space-y-1">
              <p><strong>Novamente:</strong> Não lembrei • <strong>Difícil:</strong> Lembrei com dificuldade</p>
              <p><strong>Médio:</strong> Lembrei bem • <strong>Fácil:</strong> Muito fácil</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
