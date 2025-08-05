import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { WordHidingDisplay } from '@/components/WordHidingDisplay';
import { ImprovedWordHidingDisplay } from '@/components/ImprovedWordHidingDisplay';
import { TrueFalseDisplay } from '@/components/TrueFalseDisplay';
import { Flashcard, StudyDifficulty } from '@/types/flashcard';
import { RotateCcw, Eye, EyeOff, Plus, Link2, ArrowDown, GitBranch, Zap, Brain, Clock, MoreHorizontal } from 'lucide-react';
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

  // States for true-false cards
  const [trueFalseAnswer, setTrueFalseAnswer] = useState<'true' | 'false' | null>(null);
  const [trueFalseIsCorrect, setTrueFalseIsCorrect] = useState<boolean | null>(null);

  // State for word-hiding cards
  const [wordHidingAllRevealed, setWordHidingAllRevealed] = useState(false);

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

        <div className="flex justify-center">
          <Card className={cn(
            "w-full max-w-4xl mx-auto bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 min-h-[25rem]",
            !hasParents && "max-w-5xl",
            hasParents && "max-w-xl ml-8 border-l-4 border-l-primary/50"
          )}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 pb-3">
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src="/brain-icon.png" alt="Flashcard" />
                  <AvatarFallback>
                    <Brain className="h-5 w-5 text-purple-600" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-semibold text-gray-900 text-sm">
                    {!hasParents ? 'Pergunta Principal' : `Sub-flashcard • Nível ${card.level + 1}`}
                  </span>
                  <span className="text-gray-500 text-xs flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {card.type === 'traditional' ? 'Tradicional' : 
                     card.type === 'word-hiding' ? 'Palavras Ocultas' : 'Verdadeiro/Falso'}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <MoreHorizontal className="h-4 w-4 text-gray-500" />
              </Button>
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
                  <div className="bg-gray-50 rounded-lg p-4">
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
                    <div className="relative bg-gradient-to-r from-slate-50 to-slate-100 p-6 rounded-xl border-l-4 border-l-slate-400 shadow-sm hover:shadow-md transition-all duration-300 min-h-[100px] flex items-center">
                       <div className="absolute top-2 right-3">
             <span className="bg-slate-100/80 backdrop-blur-sm px-2 py-1 rounded-full font-mono text-[10px] tracking-[0.1em] uppercase text-slate-500">
               PERGUNTA
             </span>
           </div>
                       <p className="text-slate-800 leading-relaxed w-full text-center">{card.front}</p>
                     </div>

                    {showAnswer && (
                      <div className="animate-fade-in">
                        <div className="relative bg-gradient-to-r from-orange-50 to-yellow-50 p-6 rounded-xl border-l-4 border-l-orange-400 shadow-md hover:shadow-lg transition-all duration-300 min-h-[100px] flex items-center">
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

            {/* Action Buttons */}
            {card.type !== 'true-false' && card.type !== 'word-hiding' && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <div className="flex items-center space-x-3">
                  <Button
                    onClick={toggleAnswer}
                    variant="ghost"
                    size="sm"
                    className="flex items-center space-x-2 h-8 px-3 hover:bg-blue-50 transition-colors"
                  >
                    {showAnswer ? (
                      <>
                        <EyeOff className="h-4 w-4" />
                        <span className="text-xs font-medium">Ocultar</span>
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        <span className="text-xs font-medium">Ver Resposta</span>
                      </>
                    )}
                  </Button>

                  {showAnswer && hasChildren && (
                    <Button
                      onClick={() => setShowSubFlashcardSection(!showSubFlashcardSection)}
                      variant="ghost"
                      size="sm"
                      className="flex items-center space-x-2 h-8 px-3 hover:bg-purple-50 transition-colors text-purple-600"
                    >
                      <GitBranch className="h-4 w-4" />
                      <span className="text-xs font-medium">
                        {showSubFlashcardSection ? "Esconder" : "Sub-Cards"}
                      </span>
                    </Button>
                  )}
                </div>
              </div>
            )}

              {showSubFlashcardSection && hasChildren && (
                <div className="mt-4 space-y-3 mx-4 mb-6">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-primary mb-4">Sub-Flashcards</h3>
                  </div>
                  {childCards.map((childCard, index) => (
                    <div key={childCard.id}>
                      <div className="p-5 bg-background rounded-lg border-2 border-purple-500/20 shadow-lg shadow-purple-500/10 bg-gradient-to-br from-background via-background to-purple-500/5">
                        <div className="text-center">
                          <div className="space-y-3">
                            <div className="text-muted-foreground/80 bg-muted/30 p-3 rounded-lg border-l-4 border-l-muted-foreground/20 text-sm">
                              <strong>Pergunta:</strong> {childCard.front}
                            </div>

                            {subCardAnswers[childCard.id] && (
                              <div className="animate-fade-in">
                                <div className="bg-primary/5 p-4 rounded-lg border-l-4 border-l-primary/40 shadow-sm">
                                  <strong className="text-primary">Resposta:</strong> {childCard.back}
                                </div>
                              </div>
                            )}
                          </div>

                          {!subCardAnswers[childCard.id] ? (
                            <div className="flex justify-center gap-3 mt-4">
                              <Button
                                onClick={() => toggleSubCardAnswer(childCard.id, index)}
                                variant="outline"
                                size="default"
                                className="gap-2 font-medium transition-all duration-300"
                              >
                                <Eye className="h-4 w-4" />
                                Ver Resposta
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Botão único de resposta para sub-flashcards */}
                  {Object.values(subCardAnswers).some(answer => answer) && (
                    <div className="flex justify-center gap-2 mt-4 pt-4 border-t border-border/50">
                      <Button
                        onClick={() => {
                          // Encontrar o primeiro sub-flashcard com resposta mostrada
                          const firstAnsweredCard = childCards.find(card => subCardAnswers[card.id]);
                          if (firstAnsweredCard) {
                            const cardIndex = childCards.findIndex(card => card.id === firstAnsweredCard.id);
                            handleSubCardResponse(firstAnsweredCard.id, cardIndex, true);
                          }
                        }}
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs bg-green-500 border-green-200 text-green-700 hover:bg-green-100"
                      >
                        ✓ Acertei
                      </Button>
                      <Button
                        onClick={() => {
                          // Encontrar o primeiro sub-flashcard com resposta mostrada
                          const firstAnsweredCard = childCards.find(card => subCardAnswers[card.id]);
                          if (firstAnsweredCard) {
                            const cardIndex = childCards.findIndex(card => card.id === firstAnsweredCard.id);
                            handleSubCardResponse(firstAnsweredCard.id, cardIndex, false);
                          }
                        }}
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                      >
                        ✗ Errei
                      </Button>
                    </div>
                  )}
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
