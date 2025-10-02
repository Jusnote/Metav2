import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import SavedCardBlockNote from '@/components/SavedCardBlockNote';
import AnimatedBackground from '@/components/AnimatedBackground';
import OrbitCircles from '@/components/OrbitCircles';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useBlockNoteFlashcards } from '@/hooks/useBlockNoteFlashcards';
import { Brain, Plus, BookOpen, Target, TrendingUp, ArrowLeft, CheckCircle, RotateCcw, Play, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  // Hook para flashcards BlockNote
  const { 
    flashcards, 
    stats,
    isLoading,
    fetchFlashcards,
    fetchDueFlashcards, 
    updateFlashcardReview
  } = useBlockNoteFlashcards();
  
  // Verificar se está em modo de estudo
  const isStudyMode = searchParams.get('study') === 'true';
  
  // Estados para o modo de estudo
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [studyCards, setStudyCards] = useState<any[]>([]);
  const [completedCards, setCompletedCards] = useState<string[]>([]);
  const [isStudyComplete, setIsStudyComplete] = useState(false);
  const [showBack, setShowBack] = useState(false);


  // Efeito para carregar cards para estudo
  useEffect(() => {
    if (isStudyMode && !isLoading && flashcards.length > 0) {
      loadStudySession();
    }
  }, [isStudyMode, isLoading, flashcards.length]);

  const loadStudySession = async () => {
    // Garantir que temos flashcards antes de continuar
    if (flashcards.length === 0) {
      toast({
        title: "Nenhum flashcard encontrado",
        description: "Crie alguns flashcards primeiro para poder estudar.",
      });
      navigate('/flashcards');
      return;
    }
    
    let cardsToStudy = await fetchDueFlashcards(20);
    
    // Se não há cards vencidos, pegar todos os flashcards
    if (cardsToStudy.length === 0) {
      cardsToStudy = flashcards.slice(0, 20); // Limitar a 20 cards
      toast({
        title: "Revisão geral",
        description: "Não há cards vencidos. Iniciando revisão geral dos flashcards.",
      });
    }
    
    setStudyCards(cardsToStudy);
    setCurrentCardIndex(0);
    setCompletedCards([]);
    setIsStudyComplete(false);
    setShowBack(false);
  };

  const handleStartStudy = () => {
    navigate('/flashcards?study=true');
  };

  const handleCreateFlashcard = () => {
    navigate('/notes');
  };

  // Função para lidar com respostas do estudo
  const handleStudyAnswer = async (difficulty: 'again' | 'hard' | 'medium' | 'easy') => {
    const currentCard = studyCards[currentCardIndex];
    if (!currentCard) return;

    // Atualizar flashcard BlockNote
    await updateFlashcardReview(currentCard.id, difficulty);

    // Marcar card como completo
    setCompletedCards(prev => [...prev, currentCard.id]);

    // Verificar se terminou o estudo
    if (currentCardIndex >= studyCards.length - 1) {
      setIsStudyComplete(true);
      toast({
        title: "Estudo concluído! 🎉",
        description: `Você revisou ${studyCards.length} flashcards.`,
      });
    } else {
      setCurrentCardIndex(prev => prev + 1);
      setShowBack(false);
    }
  };

  const handleRestartStudy = () => {
    setCurrentCardIndex(0);
    setCompletedCards([]);
    setIsStudyComplete(false);
    setShowBack(false);
  };

  const studyProgress = studyCards.length > 0 ? (currentCardIndex / studyCards.length) * 100 : 0;
  const currentCard = studyCards[currentCardIndex];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando flashcards...</p>
        </div>
      </div>
    );
  }

  // Renderizar modo de estudo
  if (isStudyMode) {
    if (isStudyComplete) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <CardTitle className="text-2xl font-bold">Estudo Concluído!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-muted-foreground">
                Você revisou <strong>{studyCards.length} flashcards</strong>
              </p>
              <div className="flex gap-3">
                <Button 
                  onClick={handleRestartStudy}
                  variant="outline"
                  className="flex-1 gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Estudar Novamente
                </Button>
                <Button 
                  onClick={() => navigate('/flashcards')}
                  className="flex-1 gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen p-6 relative" style={{
        backgroundImage: 'url(/bg-mobile.webp)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}>
        <AnimatedBackground />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="flex items-center justify-between mb-6">
            <Button 
              onClick={() => navigate('/flashcards')}
              variant="outline"
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div className="text-center">
              <h2 className="text-xl font-semibold">Flashcards</h2>
              <p className="text-sm text-muted-foreground">
                Card {currentCardIndex + 1} de {studyCards.length}
              </p>
            </div>
            <div className="w-24"> {/* Spacer */}</div>
          </div>
          
          {currentCard && (
            <div className="relative">
              <OrbitCircles />
              <div className="max-w-3xl mx-auto">
                <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-lg">
                  <CardContent className="p-8">
                    {/* Título do Card */}
                    <div className="mb-6 text-center">
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {currentCard.title}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {currentCard.deck_name}
                      </Badge>
                    </div>

                    {/* Conteúdo do Card */}
                    <div className="mb-6">
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-sm font-medium text-muted-foreground">
                            {showBack ? 'Resposta:' : 'Pergunta:'}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowBack(!showBack)}
                            className="flex items-center gap-1 text-xs"
                          >
                            {showBack ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            {showBack ? 'Ocultar' : 'Mostrar'} Resposta
                          </Button>
                        </div>
                        
                        <SavedCardBlockNote
                          content={showBack ? currentCard.back : currentCard.front}
                          isEditing={false}
                          onSave={() => {}}
                        />
                      </div>
                    </div>

                    {/* Botões de Resposta */}
                    {showBack && (
                      <div className="flex flex-col gap-3">
                        <p className="text-sm text-muted-foreground text-center mb-2">
                          Como foi sua resposta?
                        </p>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            variant="destructive"
                            onClick={() => handleStudyAnswer('again')}
                            className="flex flex-col gap-1 h-auto py-3"
                          >
                            <span className="font-medium">Errei</span>
                            <span className="text-xs opacity-90">Revisar novamente</span>
                          </Button>
                          
                          <Button
                            variant="outline"
                            onClick={() => handleStudyAnswer('hard')}
                            className="flex flex-col gap-1 h-auto py-3 border-orange-300 text-orange-700 hover:bg-orange-50"
                          >
                            <span className="font-medium">Difícil</span>
                            <span className="text-xs opacity-70">Revisar em breve</span>
                          </Button>
                          
                          <Button
                            variant="outline"
                            onClick={() => handleStudyAnswer('medium')}
                            className="flex flex-col gap-1 h-auto py-3 border-blue-300 text-blue-700 hover:bg-blue-50"
                          >
                            <span className="font-medium">Médio</span>
                            <span className="text-xs opacity-70">Revisar em alguns dias</span>
                          </Button>
                          
                          <Button
                            variant="default"
                            onClick={() => handleStudyAnswer('easy')}
                            className="flex flex-col gap-1 h-auto py-3 bg-green-600 hover:bg-green-700"
                          >
                            <span className="font-medium">Fácil</span>
                            <span className="text-xs opacity-90">Revisar mais tarde</span>
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Botão para mostrar resposta */}
                    {!showBack && (
                      <div className="text-center">
                        <Button onClick={() => setShowBack(true)} size="lg" className="px-8">
                          Mostrar Resposta
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
           )}
         </div>
         
         {/* Barra de progresso no final da página */}
         <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xs border-t">
           <div className="max-w-5xl mx-auto">
             <Progress value={studyProgress} className="h-2" />
           </div>
         </div>
       </div>
     );
  }

  return (
    <div className="bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">FlashCards</h1>
                <p className="text-sm text-muted-foreground">Aprendizado com repetição espaçada</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Button 
                onClick={handleCreateFlashcard}
                variant="outline" 
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Criar Flashcard
              </Button>
              
              <Button 
                onClick={handleStartStudy}
                className="gap-2"
                disabled={stats.total === 0}
              >
                <Play className="h-4 w-4" />
                {stats.dueForReview > 0 
                  ? `Estudar (${stats.dueForReview})` 
                  : stats.total > 0 
                    ? "Estudar Novamente" 
                    : "Sem Flashcards"
                }
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <BookOpen className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total de Cards</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Target className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.dueForReview}</p>
                  <p className="text-sm text-muted-foreground">Para Revisar</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Plus className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.newCards}</p>
                  <p className="text-sm text-muted-foreground">Novos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.learning}</p>
                  <p className="text-sm text-muted-foreground">Aprendendo</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Flashcards */}
        {flashcards.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="mb-6">
                <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Nenhum flashcard encontrado
                </h3>
                <p className="text-gray-600 mb-6">
                  Comece criando seu primeiro flashcard a partir de uma nota.
                </p>
                <Button onClick={handleCreateFlashcard} className="flex items-center gap-2 mx-auto">
                  <Plus className="h-4 w-4" />
                  Criar Primeiro Flashcard
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {flashcards.slice(0, 10).map((flashcard) => {
              const isOverdue = new Date(flashcard.next_review) <= new Date();
              const nextReview = new Date(flashcard.next_review);
              const isToday = nextReview.toDateString() === new Date().toDateString();
              
              return (
                <Card key={flashcard.id} className="overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2">{flashcard.title}</CardTitle>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{flashcard.deck_name}</Badge>
                          <Badge 
                            variant={isOverdue ? 'destructive' : isToday ? 'default' : 'secondary'}
                          >
                            {isOverdue 
                              ? 'Atrasado' 
                              : isToday 
                                ? 'Hoje' 
                                : `${Math.ceil((nextReview.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} dias`
                            }
                          </Badge>
                          <Badge variant="outline">
                            Repetições: {flashcard.repetitions}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <SavedCardBlockNote
                        content={flashcard.front}
                        isEditing={false}
                        onSave={() => {}}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {flashcards.length > 10 && (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground mb-4">
                    Mostrando 10 de {flashcards.length} flashcards
                  </p>
                  <Button 
                    onClick={() => navigate('/flashcards-new')}
                    variant="outline"
                  >
                    Ver Todos
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;