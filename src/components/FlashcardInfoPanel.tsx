import { Flashcard } from '@/types/flashcard';
import { Card } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TAG_CONFIGS } from './FlashcardInfoPanel/config';
import { Tag } from './FlashcardInfoPanel/Tag';
import { Flame, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FlashcardInfoPanelProps {
  card: Flashcard;
  hasParents?: boolean;
  hasChildren?: boolean;
  showAnswer?: boolean;
}

// Função para calcular a retrievability (probabilidade de lembrar)
function calculateRetrievability(card: Flashcard): number {
  if (!card.due || !card.stability) return 1;
  
  const now = new Date();
  const dueDate = new Date(card.due);
  const daysSinceDue = Math.max(0, (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Fórmula FSRS: R = exp(-t/S)
  return Math.exp(-daysSinceDue / card.stability);
}

// Função para determinar se deve mostrar o ícone de urgência
function shouldShowUrgencyIcon(card: Flashcard): boolean {
  const retrievability = calculateRetrievability(card);
  const isOverdue = card.due && new Date() > new Date(card.due);
  
  // Mostrar se a probabilidade de lembrar é baixa (<70%) ou está atrasado
  return retrievability < 0.7 || !!isOverdue;
}

// Função para obter a cor do ícone de urgência
function getUrgencyColor(card: Flashcard): string {
  const retrievability = calculateRetrievability(card);
  
  if (retrievability < 0.3) return 'text-red-500'; // Crítico
  if (retrievability < 0.5) return 'text-orange-500'; // Alto
  if (retrievability < 0.7) return 'text-yellow-500'; // Médio
  return 'text-gray-400'; // Baixo
}

export function FlashcardInfoPanel({ 
  card, 
  hasParents = false, 
  hasChildren = false, 
  showAnswer = false 
}: FlashcardInfoPanelProps) {
  const panelProps = { hasParents, hasChildren, showAnswer };
  
  // Filtrar tags por categoria
  const urgencyTag = shouldShowUrgencyIcon(card);
  const stateTag = TAG_CONFIGS.find(config => config.id === 'state');
  const footerTags = TAG_CONFIGS
    .filter(config => 
      config.id !== 'state' && 
      (!config.shouldShow || config.shouldShow(card, panelProps))
    )
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 4); // Limitar a 4 ícones no rodapé

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex items-center gap-1">
        {/* Estado FSRS */}
        {stateTag && (
          <Tag
            config={stateTag}
            card={card}
            panelProps={panelProps}
          />
        )}
        
        {/* Ícones adicionais limitados a 3 */}
        {footerTags.slice(0, 3).map((config) => (
          <Tag
            key={config.id}
            config={config}
            card={card}
            panelProps={panelProps}
          />
        ))}
        
        {/* Ícone de urgência */}
        {urgencyTag && (
          <div className={cn(
            "transition-all duration-200",
            getUrgencyColor(card)
          )}>
            <Flame className="h-4 w-4" />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}