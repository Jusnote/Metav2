import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Flashcard, StudyDifficulty } from '@/types/flashcard';
import { Brain, User, Eye, RotateCcw, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

export function DialogFlashcardDisplay({
  cards,
  currentCardIndex,
  onAnswer,
  onComplete
}: DialogFlashcardDisplayProps) {
  const [messages, setMessages] = useState<DialogMessage[]>([]);
  const [showAnswerForCard, setShowAnswerForCard] = useState<string | null>(null);
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false);
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
      return (
        <div key={message.id} className="chat-message left">
          <div className="chat-avatar">
            Q
          </div>
          <div className="bubble left">
            {message.content}
          </div>
        </div>
      );
    }

    if (isAnswer) {
      return (
        <div key={message.id} className="mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: message.content }} />
          </div>
        </div>
      );
    }

    if (isUserResponse) {
      return (
        <div key={message.id} className="flex items-start gap-3 mb-4">
          <Avatar className="h-8 w-8 border-2 border-gray-200">
            <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="max-w-[80%]">
              <div className={cn(
                "text-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg",
                message.difficulty ? getDifficultyColor(message.difficulty) : "bg-gray-500"
              )}>
                <p className="text-sm">{message.content}</p>
              </div>
              <div className="flex items-center gap-1 mt-1 ml-2">
                <span className="text-xs text-gray-500">Você</span>
                <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                <span className="text-xs text-gray-400">agora</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      {/* Área de mensagens */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4 min-h-[400px] max-h-[600px]"
      >
        {messages.map(renderMessage)}
        
        {/* Botão Ver Resposta */}
        {currentCard && showAnswerForCard !== currentCard.id && (
          <div className="flex justify-end">
            <Button
              onClick={() => handleShowAnswer(currentCard.id)}
              variant="outline"
              size="sm"
              className="gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 rounded-full px-4 py-2"
            >
              <Eye className="h-3 w-3" />
              Ver Resposta
            </Button>
          </div>
        )}
        
        {/* Botões de dificuldade */}
        {currentCard && showAnswerForCard === currentCard.id && !isProcessingAnswer && (
          <div className="flex justify-center gap-2 mt-6">
            <Button
              onClick={() => handleDifficultyAnswer('again')}
              variant="outline"
              size="sm"
              className="gap-2 border-red-200 text-red-700 hover:bg-red-50"
            >
              <RotateCcw className="h-3 w-3" />
              Novamente
            </Button>
            <Button
              onClick={() => handleDifficultyAnswer('hard')}
              variant="outline"
              size="sm"
              className="gap-2 border-orange-200 text-orange-700 hover:bg-orange-50"
            >
              Difícil
            </Button>
            <Button
              onClick={() => handleDifficultyAnswer('medium')}
              variant="outline"
              size="sm"
              className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              Médio
            </Button>
            <Button
              onClick={() => handleDifficultyAnswer('easy')}
              variant="outline"
              size="sm"
              className="gap-2 border-green-200 text-green-700 hover:bg-green-50"
            >
              Fácil
            </Button>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}