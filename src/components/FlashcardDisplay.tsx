import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WordHidingDisplay } from '@/components/WordHidingDisplay';
import { ImprovedWordHidingDisplay } from '@/components/ImprovedWordHidingDisplay';
import { TrueFalseDisplay } from '@/components/TrueFalseDisplay';
import { Flashcard, StudyDifficulty } from '@/types/flashcard';
import { RotateCcw, Eye, EyeOff, Plus, Link2, ArrowDown, GitBranch, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FlashcardDisplayProps {
  card: Flashcard;
  parentCards?: Flashcard[]; // Hierarchy context from root to current card
  onAnswer: (difficulty: StudyDifficulty) => void;
  onCreateSubCard?: (parentCard: Flashcard) => void;
  showAnswer?: boolean;
  getChildCards?: (parentId: string) => Flashcard[];
}

export function FlashcardDisplay({ 
  card, 
  parentCards = [], 
  onAnswer, 
  onCreateSubCard, 
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
  
  // States for true-false cards
  const [trueFalseAnswer, setTrueFalseAnswer] = useState<'true' | 'false' | null>(null);
  const [trueFalseIsCorrect, setTrueFalseIsCorrect] = useState<boolean | null>(null);

  const handleTrueFalseAnswer = (userAnswer: 'true' | 'false', isCorrect: boolean) => {
    setTrueFalseAnswer(userAnswer);
    setTrueFalseIsCorrect(isCorrect);
    setMainCardAnswered(true);
    setUserGotItRight(isCorrect);
    
    if (isCorrect && hasChildren && !hasParents) {
      // Se acertou e tem subperguntas, destacar a primeira
      setTimeout(() => {
        setCurrentHighlightedSub(0);
        setTimeout(() => setCurrentHighlightedSub(null), 8000);
      }, 800);
    } else if (!isCorrect) {
      // Se errou, vai para o próximo card automaticamente
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
  };

  const handleMainCardResponse = (gotItRight: boolean) => {
    setMainCardAnswered(true);
    setUserGotItRight(gotItRight);
    
    if (gotItRight && hasChildren && !hasParents) {
      // Se acertou e tem subperguntas, destacar a primeira
      setTimeout(() => {
        setCurrentHighlightedSub(0);
        setTimeout(() => setCurrentHighlightedSub(null), 8000);
      }, 800);
    } else if (!gotItRight) {
      // Se errou, vai para o próximo card (será implementado na StudyPage)
      handleAnswer('again');
    }
  };

  const handleSubCardResponse = (cardId: string, cardIndex: number, gotItRight: boolean) => {
    setSubCardResults(prev => ({ ...prev, [cardId]: gotItRight }));
    
    if (gotItRight && cardIndex + 1 < childCards.length) {
      // Se acertou e há próxima sub-pergunta, destacá-la
      setTimeout(() => {
        setCurrentHighlightedSub(cardIndex + 1);
        setTimeout(() => setCurrentHighlightedSub(null), 8000);
      }, 600);
    }
  };

  const toggleAnswer = () => {
    setShowAnswer(!showAnswer);
    if (!showAnswer) {
      // Quando "Ver Resposta" é clicado, parar a animação
      setIsLoadingAnimationActive(false);
    }
  };

  const hasParents = parentCards.length > 0;
  const childCards = getChildCards ? getChildCards(card.id) : [];
  const hasChildren = childCards.length > 0;

  const toggleSubCardAnswer = (cardId: string, cardIndex: number) => {
    setSubCardAnswers(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
    
    // Lógica de destaque sequencial
    if (!subCardAnswers[cardId]) { // Se está respondendo a pergunta
      setCurrentHighlightedSub(null); // Remove destaque atual
      
      // Se há próxima sub-pergunta e ela ainda não foi respondida
      if (cardIndex + 1 < childCards.length) {
        const nextCardId = childCards[cardIndex + 1].id;
        if (!subCardAnswers[nextCardId]) {
          setTimeout(() => {
            setCurrentHighlightedSub(cardIndex + 1);
            // Remover destaque após 8 segundos
            setTimeout(() => setCurrentHighlightedSub(null), 8000);
          }, 600);
        }
      }
    }
  };

  return (
    <div className="relative">
      {/* Indicador de foco para sub-pergunta atual */}
      {currentHighlightedSub !== null && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-primary/90 text-primary-foreground px-4 py-2 rounded-full shadow-lg animate-fade-in flex items-center gap-2">
            <div className="w-2 h-2 bg-primary-foreground rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">
              ↓ Responda a {currentHighlightedSub === 0 ? 'primeira' : `${currentHighlightedSub + 1}ª`} sub-pergunta
            </span>
          </div>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto space-y-8">
      {/* Hierarchy Context */}
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

      {/* Main Flashcard - Tamanho Reduzido e Proporcional */}
      <div className="flex justify-center">
        <Card className={cn(
          "relative transition-all duration-500 transform",
          "p-6 shadow-lg hover:shadow-xl",
          // Efeito especial para pergunta principal - com cor roxa equivalente ao azul original e melhorias visuais
          !hasParents && [
            "bg-gradient-to-br from-background via-background to-purple-500/5",
            "border-2 border-purple-500/20 shadow-lg shadow-purple-500/10",
            "before:absolute before:inset-0 before:bg-gradient-to-r before:from-purple-500/5 before:via-transparent before:to-purple-500/5 before:animate-pulse before:duration-3000",
            "after:absolute after:top-0 after:left-0 after:right-0 after:h-1 after:bg-gradient-to-r after:from-purple-400/40 after:via-purple-600 after:to-purple-400/40",
            "max-w-3xl w-full" // Largura fixa
          ],
          // Estilo para sub-perguntas
          hasParents && [
            "bg-gradient-card border-l-4 border-l-primary/50 ml-8",
            "max-w-xl"
          ],
        )}>
          {/* Círculo sobresalente com ícone de cérebro - para todos os cards */}
          <>
            {/* Animação de carregamento - 1 bolinha subindo */}
            {isLoadingAnimationActive && !showAnswer && !hasParents && (
              <>
                {/* Ícone de carregamento - agora com coloração gradual */}
                <div 
                  className="absolute -top-[93px] -left-[19px] w-[80px] h-[80px] flex items-center justify-center z-40 animate-iconColorFade"
                  style={{
                    animationDelay: '0.6s'
                  }}
                >
                  <div className="bg-purple-500 rounded-full w-6 h-6 flex items-center justify-center">
                    <Zap className="w-3 h-3 text-white" />
                  </div>
                </div>               
                {/* Container da 1 bolinha - posicionada entre o círculo e o ícone */}
                <div className="absolute -top-[105px] -left-[19px] w-[80px] h-[80px] flex flex-col items-center justify-end space-y-1 z-30">
                  {/* Bolinha única - Mais próxima do ícone */}
                  <div 
                    className="bg-purple-500 rounded-full animate-colorFade"
                    style={{
                      width: '0.64rem',
                      height: '0.64rem'
                    }}
                  ></div>
                </div>
              </>
            )}

            {/* Círculo de fundo que sobresai do card com efeito hover */}
            <div className="absolute -top-[20px] -left-[20px] w-[80px] h-[80px] bg-background border-4 border-purple-500/40 rounded-full shadow-lg z-10 brain-circle transition-all duration-300 hover:shadow-purple-500/30 hover:shadow-xl hover:scale-105 cursor-pointer group"></div>
            
            {/* Ícone de cérebro centralizado no círculo com efeito hover */}
            <div className="absolute -top-[20px] -left-[20px] w-[80px] h-[80px] flex items-center justify-center z-20 transition-all duration-300 group-hover:scale-110">
            <img 
              src="/brain-icon.png" 
              alt="Brain icon" 
              className="w-[48px] h-[48px] object-contain transition-all duration-300 hover:drop-shadow-lg hover:brightness-110" 
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)'
              }}
            />
            </div>
          </>
          <div className="relative z-10 space-y-4">
            <div className="text-center">
              {/* Badge identificador */}
              {!hasParents && (
                <div className="mb-4">
                  <div className="inline-flex items-center gap-2 bg-purple-500/10 text-purple-500 font-medium px-4 py-2 rounded-full border border-purple-500/20">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm">Pergunta Principal</span>
                  </div>
                </div>
              )}
              
              {hasParents && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
                  <Link2 className="h-4 w-4" />
                  <span className="font-medium">Sub-pergunta • Nível {card.level + 1}</span>
                </div>
              )}
              
              <div className="space-y-4">
                {/* Renderização específica para tipo de flashcard */}
                {card.type === 'word-hiding' ? (
                  /* Flashcard de ocultação de palavras */
                  <div>
                    <ImprovedWordHidingDisplay
                      text={card.back}
                      hiddenWords={card.hiddenWords || []}
                      isStudyMode={true}
                    />
                  </div>
                ) : card.type === 'true-false' ? (
                  /* Flashcard de Certo/Errado */
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
                  /* Flashcard tradicional */
                  showAnswer ? (
                    <div className="space-y-3">
                      {/* Pergunta em fonte menor quando resposta está visível */}
                      <div className={cn(
                        "text-muted-foreground/80 bg-muted/30 p-3 rounded-lg border-l-4 border-l-muted-foreground/20",
                        !hasParents ? "text-sm" : "text-xs"
                      )}>
                        <strong>Pergunta:</strong> {card.front}
                      </div>
                      
                      {/* Resposta em destaque */}
                      <div className={cn(
                        "animate-fade-in",
                        !hasParents ? "text-lg" : "text-base"
                      )}>
                        <div className="bg-primary/5 p-4 rounded-lg border-l-4 border-l-primary/40 shadow-sm">
                          <strong className="text-primary">Resposta:</strong> {card.back}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Pergunta normal quando resposta não está visível */
                    <div className={cn(
                      "leading-relaxed font-medium text-foreground",
                      !hasParents ? "text-lg" : "text-base"
                    )}>
                      {card.front}
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Botões de controle - não mostrar para true-false */}
            {card.type !== 'true-false' && (
              <div className="flex justify-center gap-3">
                <Button
                  onClick={toggleAnswer}
                  variant="outline"
                  size="default"
                  className={cn(
                    "gap-2 font-medium transition-all duration-300"
                  )}
                >
                  {showAnswer ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      Ver Pergunta
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      Ver Resposta
                    </>
                  )}
                </Button>

                {showAnswer && onCreateSubCard && (
                  <Button
                    onClick={() => onCreateSubCard(card)}
                    variant="outline"
                    size="default"
                    className="gap-2 border-primary/30 text-primary hover:bg-primary/10 font-medium transition-all duration-300"
                  >
                    <Plus className="h-4 w-4" />
                    Sub-Pergunta
                  </Button>
                )}
              </div>
            )}

            {/* Botão Sub-Pergunta para true-false (quando respondido) */}
            {card.type === 'true-false' && trueFalseAnswer !== null && onCreateSubCard && (
              <div className="flex justify-center">
                <Button
                  onClick={() => onCreateSubCard(card)}
                  variant="outline"
                  size="default"
                  className="gap-2 border-primary/30 text-primary hover:bg-primary/10 font-medium transition-all duration-300"
                >
                  <Plus className="h-4 w-4" />
                  Sub-Pergunta
                </Button>
              </div>
            )}

            {/* Botões Acertei/Errei para card principal */}
            {showAnswer && !hasParents && !mainCardAnswered && (
              <div className="flex justify-center gap-2 mt-4 pt-4 border-t border-border/50">
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
            )}
          </div>
        </Card>
      </div>

      {/* Connection indicator and Sub-flashcards - always visible */}
      {(showAnswer || (card.type === 'true-false' && trueFalseAnswer !== null)) && hasChildren && (
        <div className="space-y-0 animate-fade-in">
          {/* Visual connection from answer to sub-questions */}
          <div className="flex justify-center relative">
            <div className="w-px h-8 bg-gradient-to-b from-primary/30 to-primary/60 relative">
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                <GitBranch className="h-4 w-4 text-primary/70" />
              </div>
            </div>
          </div>
          
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border">
              <ArrowDown className="h-3 w-3" />
              <span>Sub-perguntas derivadas desta resposta</span>
            </div>
          </div>
          
          <div className="space-y-3 relative">
            {/* Connecting lines on the left */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent"></div>
            
            {childCards.map((childCard, index) => {
              const showSubAnswer = subCardAnswers[childCard.id] || false;
              const isEnabled = hasParents || userGotItRight; // Habilitado se é subcard ou se acertou o principal
              const subResult = subCardResults[childCard.id];
              const canAnswerThisSub = isEnabled && (index === 0 || subCardResults[childCards[index - 1].id] === true);
              
              return (
                <div 
                  key={childCard.id} 
                  className="relative animate-fade-in"
                  style={{ 
                    animationDelay: `${index * 150}ms`,
                    animationFillMode: 'both'
                  }}
                >
                  {/* Connection dot */}
                  <div className="absolute left-4 top-6 w-2 h-2 bg-primary/60 rounded-full transform -translate-x-1/2 z-10"></div>
                  
                   <Card 
                     key={childCard.id}
                     className={cn(
                       "p-4 bg-accent/10 border-l-4 border-l-primary/30 ml-8 relative",
                       "transition-all duration-300 hover:shadow-md hover:border-l-primary/50",
                       showSubAnswer && "border-l-primary/60 bg-accent/15 shadow-sm",
                       "before:absolute before:left-0 before:top-6 before:w-4 before:h-px before:bg-primary/30 before:-translate-x-4",
                        // Destaque para sub-pergunta atual
                        index === currentHighlightedSub && [
                          "border-2 border-primary/60 bg-primary/5 shadow-lg shadow-primary/20",
                          "ring-2 ring-primary/30 ring-offset-2 ring-offset-background",
                          "scale-[1.02] transform-gpu",
                          "animate-pulse"
                         ],
                         // Desabilitado se não pode responder esta sub-pergunta
                         !canAnswerThisSub && "opacity-50"
                      )}
                   >
                     <div className="space-y-3 relative">
                       <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Link2 className="h-3 w-3" />
                        <span>Sub-pergunta {index + 1}</span>
                      </div>
                      
                      <div className="space-y-3">
                        {showSubAnswer ? (
                          <div className="space-y-2">
                            {/* Pergunta em fonte menor quando resposta está visível */}
                            <div className="text-xs text-muted-foreground/80 bg-muted/30 p-2 rounded border-l-2 border-l-muted-foreground/20">
                              <strong>Pergunta:</strong> {childCard.front}
                            </div>
                            
                            {/* Resposta em destaque */}
                            <div className="text-sm animate-fade-in">
                              <div className="bg-primary/5 p-3 rounded border-l-2 border-l-primary/30">
                                <strong className="text-primary">Resposta:</strong> {childCard.back}
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Pergunta normal quando resposta não está visível */
                          <div className="text-sm">
                            <strong>Pergunta:</strong> {childCard.front}
                          </div>
                        )}
                      </div>
                      
                        <div className="flex justify-center">
                          <Button
                            onClick={() => toggleSubCardAnswer(childCard.id, index)}
                            variant="outline"
                            size="sm"
                            disabled={!canAnswerThisSub}
                            className="gap-2 text-xs hover:border-primary/40"
                          >
                           {showSubAnswer ? (
                             <>
                               <EyeOff className="h-3 w-3" />
                               Ocultar Resposta
                             </>
                           ) : (
                             <>
                               <Eye className="h-3 w-3" />
                               Ver Resposta
                             </>
                           )}
                         </Button>
                       </div>

                       {/* Botões Acertei/Errei para subperguntas */}
                       {showSubAnswer && subResult === null && (
                         <div className="flex justify-center gap-2 pt-2 border-t border-border/30">
                           <Button
                             onClick={() => handleSubCardResponse(childCard.id, index, true)}
                             variant="outline"
                             size="sm"
                             className="gap-1 text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                           >
                             ✓ Acertei
                           </Button>
                           
                           <Button
                             onClick={() => handleSubCardResponse(childCard.id, index, false)}
                             variant="outline"
                             size="sm"
                             className="gap-1 text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                           >
                             ✗ Errei
                           </Button>
                         </div>
                       )}

                       {/* Overlay quando não habilitado */}
                       {!canAnswerThisSub && (
                         <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded">
                           <p className="text-xs text-muted-foreground bg-background px-2 py-1 rounded border">
                             {!isEnabled ? "Acerte a pergunta principal primeiro" : "Acerte a sub-pergunta anterior primeiro"}
                           </p>
                         </div>
                       )}
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Answer Buttons - only show after responding to main card or for sub-cards */}
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