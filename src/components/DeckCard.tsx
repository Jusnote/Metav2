import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Deck } from '@/types/flashcard';
import { BookOpen, Calendar, MoreVertical, Play, Edit3, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DeckCardProps {
  deck: Deck;
  dueCount: number;
  totalCards: number;
  onStudy: () => void;
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
}

export function DeckCard({ deck, dueCount, totalCards, onStudy, onEdit, onDelete, className }: DeckCardProps) {
  const progressPercentage = totalCards > 0 ? ((totalCards - dueCount) / totalCards) * 100 : 0;

  return (
    <Card className={cn(
      "group hover:shadow-study transition-all duration-200 cursor-pointer",
      "bg-gradient-card border border-border/50",
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
              {deck.name}
            </CardTitle>
            {deck.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {deck.description}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="gap-2"
              >
                <Edit3 className="h-4 w-4" />
                Editar Deck
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Excluir Deck
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BookOpen className="h-4 w-4" />
            <span>{totalCards} cards</span>
          </div>
          
          {dueCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <Calendar className="h-3 w-3" />
              {dueCount} para revisar
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        <Button
          onClick={(e) => {
            e.stopPropagation();
            onStudy();
          }}
          variant={dueCount > 0 ? "study" : "outline"}
          size="study"
          className="w-full gap-2"
          disabled={totalCards === 0}
        >
          <Play className="h-4 w-4" />
          {dueCount > 0 ? `Estudar (${dueCount})` : 'Estudar'}
        </Button>
      </CardContent>
    </Card>
  );
}