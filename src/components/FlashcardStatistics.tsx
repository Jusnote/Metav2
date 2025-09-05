import { Flashcard } from '@/types/flashcard';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Clock, 
  Target, 
  TrendingUp, 
  Calendar, 
  BarChart3, 
  Brain, 
  Timer,
  Award,
  Activity,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FlashcardStatisticsProps {
  card: Flashcard;
  className?: string;
}

export function FlashcardStatistics({ card, className }: FlashcardStatisticsProps) {
  // Calcular estatísticas baseadas nos dados do FSRS
  const getStateLabel = (state: number) => {
    switch (state) {
      case 0: return 'Novo';
      case 1: return 'Aprendendo';
      case 2: return 'Revisão';
      case 3: return 'Reaprendendo';
      default: return 'Desconhecido';
    }
  };

  const getStateColor = (state: number) => {
    switch (state) {
      case 0: return 'bg-blue-500';
      case 1: return 'bg-yellow-500';
      case 2: return 'bg-green-500';
      case 3: return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getDifficultyLevel = (difficulty: number) => {
    if (difficulty < 3) return 'Fácil';
    if (difficulty < 6) return 'Médio';
    if (difficulty < 8) return 'Difícil';
    return 'Muito Difícil';
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty < 3) return 'text-green-600';
    if (difficulty < 6) return 'text-yellow-600';
    if (difficulty < 8) return 'text-orange-600';
    return 'text-red-600';
  };

  const getMaturityDays = () => {
    if (!card.last_review) return 0;
    const now = new Date();
    const lastReview = new Date(card.last_review);
    return Math.floor((now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getNextReviewDays = () => {
    const now = new Date();
    const nextReview = new Date(card.due);
    const diffTime = nextReview.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const stabilityPercentage = Math.min(100, (card.stability / 365) * 100); // Assumindo 1 ano como máximo
  const masteryLevel = Math.min(100, ((10 - card.difficulty) / 10) * 100);

  return (
    <Card className={cn(
      "w-64 h-fit bg-white",
      "border border-slate-200/60 rounded-xl shadow-lg",
      "transition-all duration-300 hover:shadow-xl",
      "sticky top-4",
      className
    )}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200/50">
          <div className="p-2 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-lg">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">Estatísticas do Card</h3>
            <p className="text-xs text-slate-500">Métricas detalhadas</p>
          </div>
        </div>

        {/* Estado Atual */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Estado
            </span>
            <Badge 
              variant="secondary" 
              className={cn(
                "text-white text-xs",
                getStateColor(card.state)
              )}
            >
              {getStateLabel(card.state)}
            </Badge>
          </div>
        </div>

        {/* Nível de Domínio */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Award className="h-4 w-4" />
              Domínio
            </span>
            <span className="text-sm font-semibold text-slate-800">
              {masteryLevel.toFixed(0)}%
            </span>
          </div>
          <Progress value={masteryLevel} className="h-2" />
        </div>

        {/* Dificuldade */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Dificuldade
            </span>
            <span className={cn(
              "text-sm font-semibold",
              getDifficultyColor(card.difficulty)
            )}>
              {getDifficultyLevel(card.difficulty)}
            </span>
          </div>
          <div className="text-xs text-slate-500">
            Índice: {card.difficulty.toFixed(1)}/10
          </div>
        </div>

        {/* Estabilidade */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Estabilidade
            </span>
            <span className="text-sm font-semibold text-slate-800">
              {stabilityPercentage.toFixed(0)}%
            </span>
          </div>
          <Progress value={stabilityPercentage} className="h-2" />
          <div className="text-xs text-slate-500">
            {card.stability.toFixed(1)} dias
          </div>
        </div>

        {/* Histórico de Revisões */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Revisões
            </span>
            <span className="text-sm font-semibold text-slate-800">
              {card.review_count}
            </span>
          </div>
        </div>

        {/* Tempo desde última revisão */}
        {card.last_review && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Última Revisão
              </span>
              <span className="text-sm font-semibold text-slate-800">
                {getMaturityDays()} dias
              </span>
            </div>
          </div>
        )}

        {/* Próxima revisão */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Próxima Revisão
            </span>
            <span className={cn(
              "text-sm font-semibold",
              getNextReviewDays() <= 0 ? "text-red-600" : 
              getNextReviewDays() <= 3 ? "text-orange-600" : "text-green-600"
            )}>
              {getNextReviewDays() <= 0 ? 'Vencido' : 
               getNextReviewDays() === 1 ? 'Amanhã' : 
               `${getNextReviewDays()} dias`}
            </span>
          </div>
        </div>

        {/* Informações do Card */}
        <div className="pt-4 border-t border-slate-200/50 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Brain className="h-4 w-4" />
            Informações do Card
          </div>
          
          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Tipo:</span>
              <span className="font-medium capitalize">
                {card.type === 'traditional' ? 'Tradicional' :
                 card.type === 'word-hiding' ? 'Palavras Ocultas' : 'Verdadeiro/Falso'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span>Nível:</span>
              <span className="font-medium">{card.level}</span>
            </div>
            
            <div className="flex justify-between">
              <span>Criado:</span>
              <span className="font-medium">
                {new Date(card.created).toLocaleDateString('pt-BR')}
              </span>
            </div>
            
            {card.childIds.length > 0 && (
              <div className="flex justify-between">
                <span>Sub-cards:</span>
                <span className="font-medium">{card.childIds.length}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}