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

  // Função melhorada para calcular a retrievability com normalização mais equilibrada
  const calculateRetrievability = () => {
    if (!card.due || !card.stability) return 0.9; // Cards novos têm alta retrievability inicial
    
    const now = new Date();
    const dueDate = new Date(card.due);
    const daysSinceDue = Math.max(0, (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Fórmula FSRS melhorada: R = exp(-t/S) com ajustes
    let baseRetrievability = Math.exp(-daysSinceDue / Math.max(card.stability, 0.1));
    
    // Ajustes baseados no estado do card
    if (card.state === 0) { // Novo
      baseRetrievability = Math.max(0.85, baseRetrievability); // Cards novos mantêm alta retrievability
    } else if (card.state === 1) { // Aprendendo
      baseRetrievability = Math.max(0.7, baseRetrievability); // Cards em aprendizado têm retrievability moderada
    }
    
    // Ajuste baseado na dificuldade (cards mais fáceis têm retrievability ligeiramente maior)
    const difficultyAdjustment = 1 + (5 - card.difficulty) * 0.02; // Máximo +10%, mínimo -10%
    baseRetrievability *= difficultyAdjustment;
    
    // Ajuste baseado no número de revisões (experiência melhora a retenção)
    const reviewBonus = Math.min(0.1, (card.review_count || 0) * 0.01); // Máximo +10%
    baseRetrievability += reviewBonus;
    
    // Garantir que fique entre 0 e 1
    return Math.max(0, Math.min(1, baseRetrievability));
  };

  // Função para determinar o tipo de memória baseado na retrievability (ajustada para nova estratégia)
  const getMemoryType = (retrievability: number) => {
    if (retrievability >= 0.85) {
      return {
        type: 'Longo prazo',
        description: 'Memória muito bem consolidada',
        color: 'text-green-600',
        bgColor: 'bg-white',
        borderColor: 'border-green-200',
        icon: '🏆'
      };
    } else if (retrievability >= 0.7) {
      return {
        type: 'Médio prazo',
        description: 'Memória bem estabelecida',
        color: 'text-blue-600',
        bgColor: 'bg-white',
        borderColor: 'border-blue-200',
        icon: '💡'
      };
    } else if (retrievability >= 0.5) {
      return {
        type: 'Curto-médio prazo',
        description: 'Memória moderadamente estável',
        color: 'text-yellow-600',
        bgColor: 'bg-white',
        borderColor: 'border-yellow-200',
        icon: '⚡'
      };
    } else {
      return {
        type: 'Curto prazo',
        description: 'Necessita revisão urgente',
        color: 'text-red-600',
        bgColor: 'bg-white',
        borderColor: 'border-red-200',
        icon: '🔥'
      };
    }
  };

  // Função melhorada para calcular o domínio baseada em FSRS
  const calculateMasteryLevel = () => {
    const retrievability = calculateRetrievability();
    const stabilityFactor = Math.min(1, card.stability / 30); // Normalizar estabilidade (30 dias = 100%)
    const difficultyFactor = (10 - card.difficulty) / 10; // Inverso da dificuldade
    const reviewCountFactor = Math.min(1, (card.review_count || 0) / 10); // Fator de experiência
    
    // Combinar fatores com pesos diferentes
    const masteryScore = (
      retrievability * 0.4 +        // 40% - Probabilidade atual de lembrar
      stabilityFactor * 0.3 +       // 30% - Quão estável é a memória
      difficultyFactor * 0.2 +      // 20% - Facilidade percebida
      reviewCountFactor * 0.1       // 10% - Experiência com o card
    );
    
    return Math.min(100, masteryScore * 100);
  };

  const stabilityPercentage = Math.min(100, (card.stability / 365) * 100); // Assumindo 1 ano como máximo
  const masteryLevel = calculateMasteryLevel();
  const retrievability = calculateRetrievability();
  const memoryType = getMemoryType(retrievability);

  // Função para gerar descrição dinâmica baseada no percentual de domínio
  const getMasteryDescription = (level: number) => {
    if (level >= 90) return "Conhecimento muito bem consolidado";
    if (level >= 75) return "Conhecimento bem consolidado";
    if (level >= 60) return "Conhecimento moderadamente consolidado";
    if (level >= 40) return "Conhecimento em desenvolvimento";
    if (level >= 20) return "Conhecimento inicial";
    return "Conhecimento em fase de aprendizado";
  };

  return (
    <Card className={cn(
      "w-64 h-fit bg-white",
      "border border-slate-200/60 rounded-xl shadow-lg",
      "transition-all duration-300 hover:shadow-xl",
      "sticky top-4",
      className
    )}>
      <div className="p-6 space-y-5">
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
          <div className="text-xs text-slate-500">
            {getMasteryDescription(masteryLevel)}
          </div>
        </div>

        {/* Memória (Baseado em Retrievability) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Memória
            </span>
            <Badge 
              variant="secondary" 
              className={cn(
                "text-xs font-medium px-2 py-1 flex items-center gap-1",
                memoryType.color,
                memoryType.bgColor,
                memoryType.borderColor,
                "border"
              )}
            >
              <span>{memoryType.icon}</span>
              <span>{memoryType.type}</span>
            </Badge>
          </div>
          <div className={cn(
            "text-xs p-2 rounded-md border",
            memoryType.bgColor,
            memoryType.borderColor
          )}>
            <span className={memoryType.color}>
              {memoryType.description}
            </span>
          </div>
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
        </div>

        {/* Tempo médio */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Tempo médio
            </span>
            <span className="text-sm font-semibold text-slate-800">
              {card.average_response_time ? `${(card.average_response_time / 1000).toFixed(1)}s` : 'N/A'}
            </span>
          </div>
          <div className="text-xs text-slate-500">
            {card.average_response_time ? 
              (card.average_response_time < 3000 ? 'Resposta rápida' :
               card.average_response_time < 10000 ? 'Resposta moderada' : 'Resposta lenta') :
              'Sem dados de tempo'}
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