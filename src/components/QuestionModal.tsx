import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Question, QuestionResponse, SectionQuestions } from '@/types/questions';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Input } from './ui/input';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { CheckCircle, XCircle, ArrowRight, SkipForward, Clock, HelpCircle, Lightbulb } from 'lucide-react';

interface QuestionModalProps {
  sectionQuestions: SectionQuestions | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (responses: QuestionResponse[]) => void;
  onSkip: () => void;
}

export function QuestionModal({ 
  sectionQuestions, 
  isOpen, 
  onClose, 
  onComplete, 
  onSkip 
}: QuestionModalProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<QuestionResponse[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState<string | number | boolean>('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);

  // Timer para controlar tempo gasto na questão
  useEffect(() => {
    if (!isOpen || showFeedback) return;
    
    const timer = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, showFeedback, currentQuestionIndex]);

  // Reset quando modal abre
  useEffect(() => {
    if (isOpen) {
      setCurrentQuestionIndex(0);
      setResponses([]);
      setCurrentAnswer('');
      setShowFeedback(false);
      setTimeSpent(0);
    }
  }, [isOpen]);

  console.log('🎮 QuestionModal render - isOpen:', isOpen, 'sectionQuestions:', sectionQuestions);
  
  if (!isOpen || !sectionQuestions || sectionQuestions.questions.length === 0) {
    console.log('🚫 QuestionModal não renderizado - isOpen:', isOpen, 'sectionQuestions:', !!sectionQuestions, 'questionsLength:', sectionQuestions?.questions.length);
    return null;
  }
  
  console.log('✅ QuestionModal renderizando com', sectionQuestions.questions.length, 'perguntas');

  const currentQuestion = sectionQuestions.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === sectionQuestions.questions.length - 1;
  const progress = ((currentQuestionIndex + 1) / sectionQuestions.questions.length) * 100;

  const handleAnswerSubmit = () => {
    if (currentAnswer === '') return;

    // Verificar se a resposta está correta
    let correct = false;
    
    switch (currentQuestion.type) {
      case 'multiple':
        correct = currentAnswer === currentQuestion.correctAnswer;
        break;
      case 'boolean':
        correct = currentAnswer === currentQuestion.correctAnswer;
        break;
      case 'text':
        const userText = currentAnswer.toString().toLowerCase().trim();
        const correctText = currentQuestion.correctAnswer.toString().toLowerCase().trim();
        correct = userText === correctText;
        break;
    }

    setIsCorrect(correct);
    setShowFeedback(true);

    // Salvar resposta
    const response: QuestionResponse = {
      questionId: currentQuestion.id,
      userAnswer: currentAnswer,
      isCorrect: correct,
      timeSpent: timeSpent,
      attempts: 1,
    };

    setResponses(prev => [...prev, response]);

    // Avançar para próxima pergunta ou finalizar após um delay
    setTimeout(() => {
      if (isLastQuestion) {
        onComplete([...responses, response]);
      } else {
        setCurrentQuestionIndex(prev => prev + 1);
        setCurrentAnswer('');
        setShowFeedback(false);
        setTimeSpent(0);
      }
    }, 2000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderAnswerOptions = () => {
    switch (currentQuestion.type) {
      case 'multiple':
        return (
          <RadioGroup
            value={currentAnswer.toString()}
            onValueChange={(value) => setCurrentAnswer(parseInt(value))}
            className="space-y-3"
          >
            {currentQuestion.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-3">
                <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                  <span className="font-medium">({String.fromCharCode(65 + index)}) </span>
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'boolean':
        return (
          <RadioGroup
            value={currentAnswer.toString()}
            onValueChange={(value) => setCurrentAnswer(value === 'true')}
            className="flex space-x-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="true" id="true" />
              <Label htmlFor="true">Verdadeiro</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="false" id="false" />
              <Label htmlFor="false">Falso</Label>
            </div>
          </RadioGroup>
        );

      case 'text':
        return (
          <Input
            type="text"
            placeholder="Digite sua resposta..."
            value={currentAnswer.toString()}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            className="w-full"
          />
        );

      default:
        return null;
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-blue-600" />
              Perguntas: {sectionQuestions.sectionTitle}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              {formatTime(timeSpent)}
            </div>
          </div>
          
          {/* Barra de progresso */}
          <Progress value={progress} className="h-2" />
          <div className="text-sm text-gray-600 mt-1">
            Pergunta {currentQuestionIndex + 1} de {sectionQuestions.questions.length}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Pergunta */}
          <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
            <h3 className="font-medium text-gray-800 mb-4">
              {currentQuestion.question}
            </h3>

            {/* Opções de resposta */}
            {!showFeedback && (
              <div className="space-y-3">
                {renderAnswerOptions()}
              </div>
            )}

            {/* Feedback */}
            {showFeedback && (
              <div className={`p-4 rounded-lg border ${
                isCorrect 
                  ? 'bg-green-50 border-green-200 text-green-800' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {isCorrect ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className="font-semibold">
                    {isCorrect ? 'Resposta Correta!' : 'Resposta Incorreta'}
                  </span>
                </div>
                
                {!isCorrect && (
                  <div className="text-sm">
                    <span className="font-medium">Resposta correta: </span>
                    {currentQuestion.type === 'multiple' && currentQuestion.options ? (
                      <>
                        ({String.fromCharCode(65 + (currentQuestion.correctAnswer as number))}) {currentQuestion.options[currentQuestion.correctAnswer as number]}
                      </>
                    ) : (
                      currentQuestion.correctAnswer.toString()
                    )}
                  </div>
                )}

                {currentQuestion.explanation && (
                  <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-yellow-800">Explicação: </span>
                        <span className="text-yellow-700">{currentQuestion.explanation}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ações */}
          {!showFeedback && (
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                onClick={onSkip}
                className="flex items-center gap-2"
              >
                <SkipForward className="h-4 w-4" />
                Pular Perguntas
              </Button>
              
              <Button
                onClick={handleAnswerSubmit}
                disabled={currentAnswer === ''}
                className="flex items-center gap-2"
              >
                {isLastQuestion ? 'Finalizar' : 'Próxima'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>,
    document.body
  );
}