import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Question, QuestionType, SectionQuestions } from '@/types/questions';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { X, Plus, Trash2, Save, Eye, EyeOff } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface QuestionEditorProps {
  sectionIndex: number;
  sectionTitle: string;
  existingQuestions: Question[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (questions: Question[]) => void;
}

export function QuestionEditor({
  sectionIndex,
  sectionTitle,
  existingQuestions,
  isOpen,
  onClose,
  onSave,
}: QuestionEditorProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  // Inicializar com perguntas existentes ou criar nova pergunta
  useEffect(() => {
    if (isOpen) {
      if (existingQuestions && existingQuestions.length > 0) {
        setQuestions(existingQuestions);
        setCurrentQuestionIndex(0);
      } else {
        // Criar uma pergunta inicial vazia
        const newQuestion: Question = {
          id: uuidv4(),
          type: 'multiple',
          question: '',
          options: ['', ''],
          correctAnswer: 0,
          explanation: '',
          points: 10,
        };
        setQuestions([newQuestion]);
        setCurrentQuestionIndex(0);
      }
      setShowPreview(false);
    }
  }, [isOpen, existingQuestions]);

  if (!isOpen) return null;
  
  // Aguardar até que as perguntas sejam carregadas
  if (questions.length === 0) {
    return null;
  }

  const currentQuestion = questions[currentQuestionIndex] || null;
  
  // Verificar se há pergunta atual válida
  if (!currentQuestion) {
    return null;
  }

  const updateCurrentQuestion = (updates: Partial<Question>) => {
    setQuestions(prev => prev.map((q, index) => 
      index === currentQuestionIndex ? { ...q, ...updates } : q
    ));
  };

  const addNewQuestion = () => {
    const newQuestion: Question = {
      id: uuidv4(),
      type: 'multiple',
      question: '',
      options: ['', ''],
      correctAnswer: 0,
      explanation: '',
      points: 10,
    };
    setQuestions(prev => [...prev, newQuestion]);
    setCurrentQuestionIndex(questions.length);
  };

  const deleteQuestion = (index: number) => {
    if (questions.length === 1) return; // Não permitir deletar a última pergunta
    
    setQuestions(prev => prev.filter((_, i) => i !== index));
    
    // Ajustar índice atual se necessário
    if (currentQuestionIndex >= questions.length - 1) {
      setCurrentQuestionIndex(Math.max(0, questions.length - 2));
    }
  };

  const addOption = () => {
    if (!currentQuestion.options || currentQuestion.options.length >= 6) return;
    
    updateCurrentQuestion({
      options: [...(currentQuestion.options || []), ''],
    });
  };

  const updateOption = (optionIndex: number, text: string) => {
    const newOptions = [...(currentQuestion.options || [])];
    newOptions[optionIndex] = text;
    updateCurrentQuestion({ options: newOptions });
  };

  const deleteOption = (optionIndex: number) => {
    if (!currentQuestion.options || currentQuestion.options.length <= 2) return;
    
    const newOptions = currentQuestion.options.filter((_, i) => i !== optionIndex);
    updateCurrentQuestion({
      options: newOptions,
      // Se a resposta correta era essa opção, resetar
      correctAnswer: typeof currentQuestion.correctAnswer === 'number' && 
                    currentQuestion.correctAnswer === optionIndex ? 0 : 
                    typeof currentQuestion.correctAnswer === 'number' && 
                    currentQuestion.correctAnswer > optionIndex ? 
                    (currentQuestion.correctAnswer as number) - 1 : 
                    currentQuestion.correctAnswer,
    });
  };

  const handleTypeChange = (newType: QuestionType) => {
    let updates: Partial<Question> = { type: newType };
    
    // Ajustar estrutura baseada no tipo
    switch (newType) {
      case 'multiple':
        if (!currentQuestion.options || currentQuestion.options.length < 2) {
          updates.options = ['', ''];
        }
        updates.correctAnswer = 0;
        break;
      case 'boolean':
        updates.options = undefined;
        updates.correctAnswer = true;
        break;
      case 'text':
        updates.options = undefined;
        updates.correctAnswer = '';
        break;
    }
    
    updateCurrentQuestion(updates);
  };

  const handleSave = () => {
    // Validar perguntas antes de salvar
    const validQuestions = questions.filter(q => {
      if (!q.question.trim()) return false;
      
      switch (q.type) {
        case 'multiple':
          return q.options && q.options.length >= 2 && 
                 q.options.some(opt => opt.trim()) &&
                 typeof q.correctAnswer === 'number' &&
                 q.correctAnswer >= 0 && q.correctAnswer < q.options.length;
        case 'boolean':
          return typeof q.correctAnswer === 'boolean';
        case 'text':
          return typeof q.correctAnswer === 'string' && q.correctAnswer.trim() !== '';
        default:
          return false;
      }
    });
    
    if (validQuestions.length === 0) {
      alert('Adicione pelo menos uma pergunta válida com resposta correta.');
      return;
    }
    
    onSave(validQuestions);
    onClose();
  };

  const renderQuestionForm = () => {
    switch (currentQuestion.type) {
      case 'multiple':
        return (
          <div className="space-y-4">
            <div>
              <Label>Opções de Resposta:</Label>
              <div className="space-y-2 mt-2">
                {currentQuestion.options?.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <RadioGroup
                      value={currentQuestion.correctAnswer?.toString()}
                      onValueChange={(value) => updateCurrentQuestion({ correctAnswer: parseInt(value) })}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                        <Label htmlFor={`option-${index}`} className="text-sm text-green-600">
                          Correta
                        </Label>
                      </div>
                    </RadioGroup>
                    <Input
                      placeholder={`Opção ${index + 1}`}
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      className="flex-1"
                    />
                    {currentQuestion.options && currentQuestion.options.length > 2 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteOption(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {(!currentQuestion.options || currentQuestion.options.length < 6) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addOption}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar Opção
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      
      case 'boolean':
        return (
          <div>
            <Label>Resposta Correta:</Label>
            <RadioGroup
              value={currentQuestion.correctAnswer?.toString()}
              onValueChange={(value) => updateCurrentQuestion({ correctAnswer: value === 'true' })}
              className="flex space-x-4 mt-2"
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
          </div>
        );
      
      case 'text':
        return (
          <div>
            <Label htmlFor="correct-answer">Resposta Esperada:</Label>
            <Input
              id="correct-answer"
              placeholder="Digite a resposta esperada..."
              value={currentQuestion.correctAnswer?.toString() || ''}
              onChange={(e) => updateCurrentQuestion({ correctAnswer: e.target.value })}
              className="mt-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              A resposta do usuário será comparada com este texto (case-insensitive)
            </p>
          </div>
        );
      
      default:
        return null;
    }
  };

  const renderPreview = () => {
    if (!showPreview) return null;

    return (
      <Card className="mt-4 border-blue-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-blue-700">Preview da Pergunta</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-semibold mb-3">{currentQuestion.question}</p>
          
          {currentQuestion.type === 'multiple' && (
            <div className="space-y-2">
              {currentQuestion.options?.map((option, index) => (
                <div key={index} className={`p-2 rounded border ${
                  currentQuestion.correctAnswer === index 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-200'
                }`}>
                  <span className="font-medium">({String.fromCharCode(65 + index)}) </span>
                  {option}
                  {currentQuestion.correctAnswer === index && (
                    <span className="text-green-600 text-sm ml-2">✓ Correta</span>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {currentQuestion.type === 'boolean' && (
            <div className="space-y-2">
              <div className={`p-2 rounded border ${
                currentQuestion.correctAnswer === true 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-200'
              }`}>
                Verdadeiro
                {currentQuestion.correctAnswer === true && (
                  <span className="text-green-600 text-sm ml-2">✓ Correta</span>
                )}
              </div>
              <div className={`p-2 rounded border ${
                currentQuestion.correctAnswer === false 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-200'
              }`}>
                Falso
                {currentQuestion.correctAnswer === false && (
                  <span className="text-green-600 text-sm ml-2">✓ Correta</span>
                )}
              </div>
            </div>
          )}
          
          {currentQuestion.type === 'text' && (
            <div className="p-2 rounded border border-gray-200 bg-gray-50">
              <span className="text-sm text-gray-600">Resposta esperada: </span>
              <span className="font-medium">{currentQuestion.correctAnswer}</span>
            </div>
          )}
          
          {currentQuestion.explanation && (
            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
              <span className="text-sm font-medium text-yellow-800">Explicação: </span>
              <span className="text-sm text-yellow-700">{currentQuestion.explanation}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-4xl max-h-[90vh] mx-4 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <CardTitle className="text-xl text-blue-700">
            Editor de Perguntas - "{sectionTitle}"
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <div className="flex h-[calc(90vh-120px)]">
          {/* Lista de Perguntas - Sidebar */}
          <div className="w-64 border-r bg-gray-50 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Perguntas ({questions.length})</h3>
              <Button size="sm" onClick={addNewQuestion} className="text-xs">
                <Plus className="h-3 w-3 mr-1" />
                Nova
              </Button>
            </div>
            
            <div className="space-y-2">
              {questions.map((question, index) => (
                <div
                  key={question.id}
                  className={`p-2 rounded cursor-pointer border ${
                    index === currentQuestionIndex
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setCurrentQuestionIndex(index)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Pergunta {index + 1}</span>
                    {questions.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteQuestion(index);
                        }}
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {question.question || 'Nova pergunta...'}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                      {question.type === 'multiple' ? 'Múltipla' : 
                       question.type === 'boolean' ? 'V/F' : 'Texto'}
                    </span>
                    <span className={`text-xs ${
                      (question.type === 'multiple' && typeof question.correctAnswer === 'number') ||
                      (question.type === 'boolean' && typeof question.correctAnswer === 'boolean') ||
                      (question.type === 'text' && question.correctAnswer && question.correctAnswer.toString().trim())
                        ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {((question.type === 'multiple' && typeof question.correctAnswer === 'number') ||
                        (question.type === 'boolean' && typeof question.correctAnswer === 'boolean') ||
                        (question.type === 'text' && question.correctAnswer && question.correctAnswer.toString().trim()))
                        ? '✓' : '⚠'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Editor Principal */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="space-y-6">
              {/* Cabeçalho da Pergunta */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Pergunta {currentQuestionIndex + 1} de {questions.length}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-2"
                >
                  {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showPreview ? 'Ocultar' : 'Preview'}
                </Button>
              </div>
              
              {/* Tipo de Pergunta */}
              <div>
                <Label>Tipo de Pergunta:</Label>
                <Select
                  value={currentQuestion.type}
                  onValueChange={(value: QuestionType) => handleTypeChange(value)}
                >
                  <SelectTrigger className="w-full mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple">Múltipla Escolha</SelectItem>
                    <SelectItem value="boolean">Verdadeiro/Falso</SelectItem>
                    <SelectItem value="text">Resposta Textual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Texto da Pergunta */}
              <div>
                <Label htmlFor="question-text">Pergunta:</Label>
                <Textarea
                  id="question-text"
                  placeholder="Digite sua pergunta aqui..."
                  value={currentQuestion.question}
                  onChange={(e) => updateCurrentQuestion({ question: e.target.value })}
                  className="mt-2 min-h-[80px]"
                />
              </div>
              
              {/* Formulário específico do tipo */}
              {renderQuestionForm()}
              
              {/* Pontuação */}
              <div>
                <Label htmlFor="points">Pontuação:</Label>
                <Input
                  id="points"
                  type="number"
                  min="1"
                  max="100"
                  placeholder="10"
                  value={currentQuestion.points || 10}
                  onChange={(e) => updateCurrentQuestion({ points: parseInt(e.target.value) || 10 })}
                  className="mt-2 w-32"
                />
              </div>
              
              {/* Explicação */}
              <div>
                <Label htmlFor="explanation">Explicação (opcional):</Label>
                <Textarea
                  id="explanation"
                  placeholder="Explicação que aparecerá quando o usuário errar..."
                  value={currentQuestion.explanation || ''}
                  onChange={(e) => updateCurrentQuestion({ explanation: e.target.value })}
                  className="mt-2"
                />
              </div>
              
              {/* Preview */}
              {renderPreview()}
            </div>
          </div>
        </div>
        
        {/* Footer com ações */}
        <div className="border-t p-4 flex items-center justify-between bg-gray-50">
          <div className="text-sm text-gray-600">
            {questions.filter(q => {
              if (!q.question.trim()) return false;
              switch (q.type) {
                case 'multiple': return q.options && q.options.length >= 2 && typeof q.correctAnswer === 'number';
                case 'boolean': return typeof q.correctAnswer === 'boolean';
                case 'text': return typeof q.correctAnswer === 'string' && q.correctAnswer.trim() !== '';
                default: return false;
              }
            }).length} de {questions.length} perguntas válidas
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              Salvar Perguntas
            </Button>
          </div>
        </div>
      </Card>
    </div>,
    document.body
  );
}