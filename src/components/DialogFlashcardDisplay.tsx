import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImprovedWordHidingDisplay } from '@/components/ImprovedWordHidingDisplay';
import { TrueFalseDisplay } from '@/components/TrueFalseDisplay';
import { TrueFalseDialogDisplay } from '@/components/TrueFalseDialogDisplay';
import { Flashcard, StudyDifficulty } from '@/types/flashcard';
import { Brain, User, Eye, RotateCcw, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface DialogMessage {
  id: string;
  type: 'question' | 'answer' | 'user-response';
  content: string;
  cardId: string;
  timestamp: Date;
  showAnswerButton?: boolean;
  difficulty?: StudyDifficulty;
}

interface DialogFlashcardDisplayProps {
  cards: Flashcard[];
  currentCardIndex: number;
  onAnswer: (difficulty: StudyDifficulty) => void;
  onComplete: () => void;
  onBack?: () => void;
}

export function DialogFlashcardDisplay({
  cards,
  currentCardIndex,
  onAnswer,
  onComplete,
  onBack
}: DialogFlashcardDisplayProps) {
  const [messages, setMessages] = useState<DialogMessage[]>([]);
  const [showAnswerForCard, setShowAnswerForCard] = useState<string | null>(null);
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false);
  const [wordHidingAllRevealed, setWordHidingAllRevealed] = useState<Record<string, boolean>>({});
  const [trueFalseAnswers, setTrueFalseAnswers] = useState<Record<string, { userAnswer: 'true' | 'false', isCorrect: boolean }>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentCard = cards[currentCardIndex];

  // Scroll para o final das mensagens
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Adicionar nova pergunta quando o card atual muda
  useEffect(() => {
    if (currentCard && !messages.find(m => m.cardId === currentCard.id && m.type === 'question')) {
      const questionMessage: DialogMessage = {
        id: `question-${currentCard.id}`,
        type: 'question',
        content: currentCard.front,
        cardId: currentCard.id,
        timestamp: new Date(),
        showAnswerButton: true
      };
      
      setMessages(prev => [...prev, questionMessage]);
      scrollToBottom();
    }
  }, [currentCard, messages]);

  // Scroll automático quando novas mensagens são adicionadas
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleShowAnswer = (cardId: string) => {
    if (showAnswerForCard === cardId) return;
    
    setShowAnswerForCard(cardId);
    
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    const answerMessage: DialogMessage = {
      id: `answer-${cardId}`,
      type: 'answer',
      content: card.back,
      cardId: cardId,
      timestamp: new Date()
    };

    setMessages(prev => {
      // Remove o botão "Ver Resposta" da pergunta
      const updatedMessages = prev.map(msg => 
        msg.cardId === cardId && msg.type === 'question' 
          ? { ...msg, showAnswerButton: false }
          : msg
      );
      return [...updatedMessages, answerMessage];
    });
  };

  // Handler para quando todas as palavras são reveladas em flashcards word-hiding
  const handleAllWordsRevealed = (cardId: string) => {
    setWordHidingAllRevealed(prev => ({ ...prev, [cardId]: true }));
    setShowAnswerForCard(cardId);
  };

  // Handler para respostas de flashcards true-false
  const handleTrueFalseAnswer = (cardId: string, userAnswer: 'true' | 'false', isCorrect: boolean) => {
    setTrueFalseAnswers(prev => ({ ...prev, [cardId]: { userAnswer, isCorrect } }));
    setShowAnswerForCard(cardId);
  };

  const handleDifficultyAnswer = (difficulty: StudyDifficulty) => {
    if (isProcessingAnswer) return;
    
    setIsProcessingAnswer(true);
    
    // Adicionar resposta do usuário ao diálogo
    const userResponseMessage: DialogMessage = {
      id: `user-response-${currentCard.id}`,
      type: 'user-response',
      content: getDifficultyText(difficulty),
      cardId: currentCard.id,
      timestamp: new Date(),
      difficulty
    };

    setMessages(prev => [...prev, userResponseMessage]);

    // Processar a resposta após um pequeno delay
    setTimeout(() => {
      onAnswer(difficulty);
      setIsProcessingAnswer(false);
      
      // Reset word hiding state for next card
      setWordHidingAllRevealed({});
      
      // Reset true-false answers for next card
      setTrueFalseAnswers({});
      
      // Se não há mais cards, completar o estudo
      if (currentCardIndex >= cards.length - 1) {
        setTimeout(() => {
          onComplete();
        }, 1000);
      }
    }, 500);
  };

  const getDifficultyText = (difficulty: StudyDifficulty): string => {
    switch (difficulty) {
      case 'again': return 'Preciso revisar novamente 😅';
      case 'hard': return 'Foi difícil, mas consegui 😰';
      case 'medium': return 'Consegui responder bem 😊';
      case 'easy': return 'Foi muito fácil! 😎';
      default: return 'Respondido';
    }
  };

  const getDifficultyColor = (difficulty: StudyDifficulty): string => {
    switch (difficulty) {
      case 'again': return 'bg-red-500';
      case 'hard': return 'bg-orange-500';
      case 'medium': return 'bg-blue-500';
      case 'easy': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const renderMessage = (message: DialogMessage) => {
    const isQuestion = message.type === 'question';
    const isAnswer = message.type === 'answer';
    const isUserResponse = message.type === 'user-response';

    if (isQuestion) {
      const answerMessage = messages.find(m => m.cardId === message.cardId && m.type === 'answer');
      const hasAnswer = !!answerMessage;
      
      return (
        <div key={message.id} className="flex items-start mb-10">
          <div className="-mt-3">
            <DotLottieReact
               src="https://lottie.host/13bf810c-e6d7-4461-807d-518e30a73454/OHla7gSTVg.lottie"
               loop
               autoplay
               style={{
                 width: '170px',
                 height: '170px'
               }}
             />
          </div>
          <div className="flex-1 max-w-[85%] -ml-2">
            <div className="relative bg-linear-to-br from-slate-50/99 via-white/98 to-blue-50/95 backdrop-blur-2xl rounded-4xl shadow-[0_25px_50px_-12px_rgba(59,130,246,0.15),0_0_0_1px_rgba(255,255,255,0.8),inset_0_1px_0_rgba(255,255,255,0.9)] border border-white/80 ring-4 ring-blue-100/30 ring-offset-4 ring-offset-white/70 px-6 py-4 overflow-hidden z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Responda mentalmente...</span>
              </div>
              <div className="text-slate-800 leading-relaxed font-medium text-lg">
                {(() => {
                  const card = cards.find(c => c.id === message.cardId);
                  if (card && card.type === 'word-hiding' && card.hiddenWords && card.hiddenWords.length > 0) {
                    return (
                      <ImprovedWordHidingDisplay
                        text={card.back}
                        hiddenWords={card.hiddenWords}
                        isStudyMode={true}
                        onAllWordsRevealed={() => handleAllWordsRevealed(message.cardId)}
                      />
                    );
                  }
                  if (card && card.type === 'true-false') {
                    const trueFalseAnswer = trueFalseAnswers[message.cardId];
                    return (
                      <TrueFalseDialogDisplay
                        statement={card.front}
                        correctAnswer={card.back}
                        explanation={card.explanation}
                        onAnswer={(userAnswer, isCorrect) => handleTrueFalseAnswer(message.cardId, userAnswer, isCorrect)}
                        hasAnswered={!!trueFalseAnswer}
                        userAnswer={trueFalseAnswer?.userAnswer}
                        isCorrect={trueFalseAnswer?.isCorrect}
                      />
                    );
                  }
                  return <span dangerouslySetInnerHTML={{ __html: message.content }} />;
                })()}
              </div>
              
              {/* Botão Ver Resposta dentro do balão da pergunta */}
              {(() => {
                const card = cards.find(c => c.id === message.cardId);
                const isWordHiding = card && card.type === 'word-hiding' && card.hiddenWords && card.hiddenWords.length > 0;
                const isTrueFalse = card && card.type === 'true-false';
                return !hasAnswer && message.showAnswerButton && !isWordHiding && !isTrueFalse && (
                  <div className="mt-4 pt-4 border-t border-slate-200/50">
                    <Button
                      onClick={() => handleShowAnswer(message.cardId)}
                      size="sm"
                      className="gap-2 bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white border border-blue-300/50 rounded-full px-4 py-2 shadow-md hover:shadow-lg backdrop-blur-xs ring-1 ring-blue-400/30 transition-all duration-300 font-medium text-sm"
                    >
                      <Eye className="h-3 w-3" />
                      Ver Resposta
                    </Button>
                  </div>
                );
              })()}
              
              {/* Resposta expandida dentro do balão da pergunta */}
              {hasAnswer && (
                <div className="mt-4 pt-4 border-t border-orange-200/50 animate-in slide-in-from-top-2 fade-in duration-500">
                  <div className="relative bg-linear-to-br from-orange-50/95 via-pink-50/90 to-yellow-50/95 backdrop-blur-md border border-orange-200/70 rounded-xl px-4 py-4 shadow-lg ring-1 ring-orange-200/50 group hover:shadow-xl transition-all duration-300">
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-linear-to-r from-amber-400 to-orange-400 rounded-full animate-pulse shadow-xs"></div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-linear-to-r from-orange-500 to-pink-500 shadow-xs">
                        <span className="text-white text-xs font-bold">💡</span>
                      </div>
                      <span className="text-xs font-bold bg-linear-to-r from-orange-600 via-pink-600 to-red-600 bg-clip-text text-transparent tracking-wide uppercase">Resposta</span>
                      <div className="flex-1 h-px bg-linear-to-r from-orange-200 to-transparent"></div>
                    </div>
                    {(() => {
                      const card = cards.find(c => c.id === message.cardId);
                      if (card && card.type === 'true-false') {
                        const trueFalseAnswer = trueFalseAnswers[message.cardId];
                        return (
                          <TrueFalseDisplay
                            statement={card.front}
                            correctAnswer={card.back}
                            explanation={card.explanation}
                            onAnswer={(userAnswer, isCorrect) => handleTrueFalseAnswer(message.cardId, userAnswer, isCorrect)}
                            hasAnswered={!!trueFalseAnswer}
                            userAnswer={trueFalseAnswer?.userAnswer}
                            isCorrect={trueFalseAnswer?.isCorrect}
                            showStatement={false}
                          />
                        );
                      }
                      return <div className="text-slate-800 leading-relaxed font-medium prose max-w-none group-hover:text-slate-900 transition-colors duration-200" dangerouslySetInnerHTML={{ __html: answerMessage.content }} />;
                    })()}
                    <div className="absolute inset-0 rounded-xl bg-linear-to-br from-white/20 via-transparent to-orange-100/20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 mt-2 ml-4">
              <span className="text-xs font-medium text-slate-600">Flashcard Inteligente</span>
              <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
              <span className="text-xs text-slate-400">agora</span>
            </div>
          </div>
        </div>
      );
    }

    // Não renderizar mensagens de resposta separadamente, pois agora estão dentro da pergunta
    if (isAnswer) {
      return null;
    }

    if (isUserResponse) {
      return (
        <div key={message.id} className="flex items-start gap-3 mb-6 justify-end">
          <div className="flex-1 flex justify-end">
            <div className="max-w-[80%]">
              <div className={cn(
                "text-white rounded-2xl rounded-tr-md px-6 py-4 shadow-lg backdrop-blur-xs border border-white/20 ring-1 ring-white/10",
                message.difficulty === 'again' && "bg-linear-to-br from-red-500 to-red-600",
                message.difficulty === 'hard' && "bg-linear-to-br from-orange-500 to-orange-600",
                message.difficulty === 'medium' && "bg-linear-to-br from-blue-500 to-blue-600",
                message.difficulty === 'easy' && "bg-linear-to-br from-green-500 to-green-600",
                !message.difficulty && "bg-linear-to-br from-gray-500 to-gray-600"
              )}>
                <p className="text-sm font-medium">{message.content}</p>
              </div>
              <div className="flex items-center gap-1 mt-2 mr-4 justify-end">
                <span className="text-xs text-slate-400">agora</span>
                <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                <span className="text-xs font-medium text-slate-600">Você</span>
              </div>
            </div>
          </div>
          <Avatar className="h-12 w-12 border-2 border-gradient-to-r from-blue-200 to-purple-200 shadow-md">
            <AvatarFallback className="bg-linear-to-br from-blue-100 to-purple-100 text-slate-700 text-sm font-semibold">
              <User className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      {/* Cabeçalho com botão Voltar - apenas quando onBack é fornecido */}
      {onBack && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xs border-b border-border/50">
          <div className="px-6 py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-2 hover:bg-slate-100/80 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </div>
        </div>
      )}
      
      {/* Área de mensagens */}
      <div 
        ref={containerRef}
        className={cn(
          "flex-1 overflow-y-auto px-6 py-8 space-y-6 min-h-[400px] max-h-[600px] bg-linear-to-br from-slate-50/50 via-white to-blue-50/30",
          onBack && "pt-24"
        )}
      >
        {messages.map(renderMessage)}
        

        
        {/* Botões de dificuldade */}
        {currentCard && (() => {
          const card = cards.find(c => c.id === currentCard.id);
          const isWordHiding = card && card.type === 'word-hiding' && card.hiddenWords && card.hiddenWords.length > 0;
          const isTrueFalse = card && card.type === 'true-false';
          const wordHidingAnswered = isWordHiding && wordHidingAllRevealed[currentCard.id];
          const trueFalseAnswered = isTrueFalse && trueFalseAnswers[currentCard.id];
          return (showAnswerForCard === currentCard.id || wordHidingAnswered || trueFalseAnswered);
        })() && !isProcessingAnswer && (
          <div className="space-y-4 mt-8">
            <div className="text-center">
              <h3 className="text-lg font-semibold bg-linear-to-r from-slate-700 to-slate-900 bg-clip-text text-transparent mb-2">
                Como você avalia sua resposta?
              </h3>
              <p className="text-sm text-slate-600">Sua avaliação ajuda a otimizar o cronograma de revisão</p>
            </div>
            <div className="flex justify-center gap-3 flex-wrap">
              <Button
                onClick={() => handleDifficultyAnswer('again')}
                size="lg"
                className="gap-2 bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border border-red-300/50 rounded-full px-6 py-3 shadow-lg hover:shadow-xl backdrop-blur-xs ring-1 ring-red-400/30 transition-all duration-300 font-semibold"
              >
                <RotateCcw className="h-4 w-4" />
                Novamente
              </Button>
              <Button
                onClick={() => handleDifficultyAnswer('hard')}
                size="lg"
                className="gap-2 bg-linear-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border border-orange-300/50 rounded-full px-6 py-3 shadow-lg hover:shadow-xl backdrop-blur-xs ring-1 ring-orange-400/30 transition-all duration-300 font-semibold"
              >
                Difícil
              </Button>
              <Button
                onClick={() => handleDifficultyAnswer('medium')}
                size="lg"
                className="gap-2 bg-linear-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border border-blue-300/50 rounded-full px-6 py-3 shadow-lg hover:shadow-xl backdrop-blur-xs ring-1 ring-blue-400/30 transition-all duration-300 font-semibold"
              >
                Médio
              </Button>
              <Button
                onClick={() => handleDifficultyAnswer('easy')}
                size="lg"
                className="gap-2 bg-linear-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white border border-green-300/50 rounded-full px-6 py-3 shadow-lg hover:shadow-xl backdrop-blur-xs ring-1 ring-green-400/30 transition-all duration-300 font-semibold"
              >
                Fácil
              </Button>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}