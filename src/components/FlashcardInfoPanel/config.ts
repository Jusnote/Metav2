import {
  Brain,
  Clock,
  Target,
  Layers,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Zap,
  Calendar,
  TrendingUp,
  Hash,
  GitBranch,
  LucideIcon
} from 'lucide-react';
import { State } from 'ts-fsrs';

// Configuração de cores para diferentes métricas FSRS
export const FSRS_COLOR_CONFIGS = {
  difficulty: {
    thresholds: [3, 6, 8],
    colors: [
      'text-green-600 bg-green-50',
      'text-yellow-600 bg-yellow-50', 
      'text-orange-600 bg-orange-50',
      'text-red-600 bg-red-50'
    ]
  },
  stability: {
    thresholds: [1, 7, 30],
    colors: [
      'text-red-600 bg-red-50',
      'text-orange-600 bg-orange-50',
      'text-yellow-600 bg-yellow-50',
      'text-green-600 bg-green-50'
    ]
  },
  reviewCount: {
    thresholds: [0, 5, 15],
    colors: [
      'text-gray-600 bg-gray-50',
      'text-blue-600 bg-blue-50',
      'text-indigo-600 bg-indigo-50',
      'text-purple-600 bg-purple-50'
    ]
  },
  nextReview: {
    thresholds: [0, 3],
    colors: [
      'text-red-600 bg-red-50',
      'text-orange-600 bg-orange-50',
      'text-green-600 bg-green-50'
    ]
  }
};

// Configuração de estados FSRS
export const STATE_CONFIG = {
  [0]: {
    color: 'text-blue-600 bg-blue-50',
    text: 'Novo',
    icon: Zap
  },
  [1]: {
    color: 'text-yellow-600 bg-yellow-50',
    text: 'Aprendendo',
    icon: Clock
  },
  [2]: {
    color: 'text-green-600 bg-green-50',
    text: 'Revisão',
    icon: Target
  },
  [3]: {
    color: 'text-orange-600 bg-orange-50',
    text: 'Reaprendendo',
    icon: RotateCcw
  }
} as const;

// Configuração de tipos de flashcard
export const TYPE_CONFIG = {
  traditional: {
    color: 'text-blue-600 bg-blue-50',
    text: 'Tradicional',
    icon: Brain
  },
  'word-hiding': {
    color: 'text-purple-600 bg-purple-50',
    text: 'Palavras Ocultas',
    icon: EyeOff
  },
  'true-false': {
    color: 'text-green-600 bg-green-50',
    text: 'V/F',
    icon: CheckCircle
  }
} as const;

// Configuração de tags/ícones do painel
export interface TagConfig {
  id: string;
  icon: LucideIcon;
  getColor: (card: any, ...args: any[]) => string;
  getTooltip: (card: any, ...args: any[]) => string;
  shouldShow?: (card: any, props: any) => boolean;
  priority: number; // Para ordenação
}

export const TAG_CONFIGS: TagConfig[] = [
  {
    id: 'type',
    icon: Brain, // Será sobrescrito dinamicamente
    getColor: (card) => TYPE_CONFIG[card.type as keyof typeof TYPE_CONFIG]?.color || 'text-gray-600 bg-gray-50',
    getTooltip: (card) => `Tipo: ${TYPE_CONFIG[card.type as keyof typeof TYPE_CONFIG]?.text || 'Desconhecido'}`,
    priority: 1
  },
  {
    id: 'state',
    icon: Zap, // Será sobrescrito dinamicamente
    getColor: (card) => STATE_CONFIG[card.state as keyof typeof STATE_CONFIG]?.color || 'text-gray-600 bg-gray-50',
    getTooltip: (card) => `Estado: ${STATE_CONFIG[card.state as keyof typeof STATE_CONFIG]?.text || 'Desconhecido'}`,
    priority: 2
  },
  {
    id: 'difficulty',
    icon: AlertCircle,
    getColor: (card) => {
      const { thresholds, colors } = FSRS_COLOR_CONFIGS.difficulty;
      const difficulty = card.difficulty;
      for (let i = 0; i < thresholds.length; i++) {
        if (difficulty < thresholds[i]) return colors[i];
      }
      return colors[colors.length - 1];
    },
    getTooltip: (card) => `Dificuldade: ${card.difficulty.toFixed(2)}`,
    priority: 3
  },
  {
    id: 'stability',
    icon: TrendingUp,
    getColor: (card) => {
      const { thresholds, colors } = FSRS_COLOR_CONFIGS.stability;
      const stability = card.stability;
      for (let i = 0; i < thresholds.length; i++) {
        if (stability < thresholds[i]) return colors[i];
      }
      return colors[colors.length - 1];
    },
    getTooltip: (card) => `Estabilidade: ${card.stability.toFixed(1)} dias`,
    priority: 4
  },
  {
    id: 'nextReview',
    icon: Calendar,
    getColor: (card) => {
      const daysUntilReview = Math.ceil(
        (new Date(card.nextReview).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      const { thresholds, colors } = FSRS_COLOR_CONFIGS.nextReview;
      if (daysUntilReview <= thresholds[0]) return colors[0];
      if (daysUntilReview <= thresholds[1]) return colors[1];
      return colors[2];
    },
    getTooltip: (card) => {
      const daysUntilReview = Math.ceil(
        (new Date(card.nextReview).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      return `Próxima revisão: ${daysUntilReview <= 0 ? 'Vencida' : `${daysUntilReview} dias`}`;
    },
    priority: 5
  },
  {
    id: 'hierarchy',
    icon: Layers,
    getColor: () => 'text-indigo-600 bg-indigo-50',
    getTooltip: (card) => `Nível hierárquico: ${card.level}`,
    shouldShow: (card, props) => props.hasParents || props.hasChildren,
    priority: 6
  },
  {
    id: 'children',
    icon: GitBranch,
    getColor: () => 'text-purple-600 bg-purple-50',
    getTooltip: (card) => `Sub-flashcards: ${card.childIds.length}`,
    shouldShow: (card, props) => props.hasChildren,
    priority: 7
  },
  {
    id: 'reviewCount',
    icon: Hash,
    getColor: (card) => {
      const { thresholds, colors } = FSRS_COLOR_CONFIGS.reviewCount;
      const count = card.review_count || 0;
      for (let i = 0; i < thresholds.length; i++) {
        if (count <= thresholds[i]) return colors[i];
      }
      return colors[colors.length - 1];
    },
    getTooltip: (card) => `Revisões: ${card.review_count || 0}`,
    priority: 8
  },
  {
    id: 'answerVisible',
    icon: Eye,
    getColor: () => 'text-emerald-600 bg-emerald-50',
    getTooltip: () => 'Resposta visível',
    shouldShow: (card, props) => props.showAnswer,
    priority: 9
  }
];

// Função utilitária para obter ícone dinâmico
export const getDynamicIcon = (tagId: string, card: any): LucideIcon => {
  switch (tagId) {
    case 'type':
      return TYPE_CONFIG[card.type as keyof typeof TYPE_CONFIG]?.icon || Brain;
    case 'state':
      return STATE_CONFIG[card.state as keyof typeof STATE_CONFIG]?.icon || Zap;
    default:
      return TAG_CONFIGS.find(config => config.id === tagId)?.icon || Brain;
  }
};