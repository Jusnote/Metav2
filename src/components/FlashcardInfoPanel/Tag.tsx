import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TagConfig, getDynamicIcon } from './config';
import { Flashcard } from '@/types/flashcard';

interface TagProps {
  config: TagConfig;
  card: Flashcard;
  panelProps: {
    hasParents: boolean;
    hasChildren: boolean;
    showAnswer: boolean;
  };
}

export function Tag({ config, card, panelProps }: TagProps) {
  // Verificar se a tag deve ser exibida
  if (config.shouldShow && !config.shouldShow(card, panelProps)) {
    return null;
  }

  const Icon = getDynamicIcon(config.id, card);
  const color = config.getColor(card, panelProps);
  const tooltip = config.getTooltip(card, panelProps);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(
          "p-1 rounded-full transition-colors cursor-help",
          color
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}