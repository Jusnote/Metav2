import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Flashcard } from '@/types/flashcard';
import { ChevronDown, ChevronRight, Edit3, Trash2, Calendar, Clock, Eye, EyeOff, Check, X, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
interface DeckCardsListProps {
  deckId: string;
  deckName: string;
  cards: Flashcard[];
  onUpdateCard: (cardId: string, front: string, back: string, explanation?: string, hiddenWords?: string[]) => void;
  onDeleteCard: (cardId: string) => void;
  shouldOpenOnMount?: boolean;
}
export function DeckCardsList({
  deckId,
  deckName,
  cards,
  onUpdateCard,
  onDeleteCard,
  shouldOpenOnMount = false
}: DeckCardsListProps) {
  const [isOpen, setIsOpen] = useState(shouldOpenOnMount);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');
  const [editExplanation, setEditExplanation] = useState('');
  const [editAnswer, setEditAnswer] = useState<'true' | 'false' | null>(null);
  const [editHidingText, setEditHidingText] = useState('');
  const [showBack, setShowBack] = useState<{
    [key: string]: boolean;
  }>({});
  const {
    toast
  } = useToast();
  const handleEditCard = (card: Flashcard) => {
    setEditingCard(card);
    setEditFront(card.front);
    setEditBack(card.back);
    setEditExplanation(card.explanation || '');

    // Para cards true-false, detectar se a resposta é Certo ou Errado
    if (card.type === 'true-false') {
      setEditAnswer(card.back === 'Certo' ? 'true' : 'false');
    }

    // Para cards word-hiding, reconstruir o texto com {{}}
    if (card.type === 'word-hiding' && card.hiddenWords) {
      let reconstructedText = card.back;
      card.hiddenWords.forEach(word => {
        reconstructedText = reconstructedText.replace(new RegExp(`\\b${word}\\b`, 'g'), `{{${word}}}`);
      });
      setEditHidingText(reconstructedText);
    }
  };
  const handleSaveEdit = () => {
    if (!editingCard) return;
    if (editingCard.type === 'true-false') {
      const answerText = editAnswer === 'true' ? 'Certo' : 'Errado';
      onUpdateCard(editingCard.id, editFront, answerText, editExplanation);
    } else if (editingCard.type === 'word-hiding') {
      // Parse hidden words from text with {{}}
      const hiddenWords: string[] = [];
      const cleanText = editHidingText.replace(/\{\{([^}]+)\}\}/g, (match, word) => {
        hiddenWords.push(word.trim());
        return word.trim();
      });
      const questionText = editHidingText.replace(/\{\{([^}]+)\}\}/g, '____');
      onUpdateCard(editingCard.id, questionText, cleanText, undefined, hiddenWords);
    } else {
      onUpdateCard(editingCard.id, editFront, editBack);
    }
    setEditingCard(null);
    toast({
      title: "Card atualizado!",
      description: "As alterações foram salvas com sucesso."
    });
  };
  const handleDeleteCard = (card: Flashcard) => {
    onDeleteCard(card.id);
    toast({
      title: "Card excluído",
      description: "O flashcard foi removido do deck."
    });
  };
  const toggleCardBack = (cardId: string) => {
    setShowBack(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };
  const renderCardContent = (card: Flashcard) => {
    if (card.type === 'true-false') {
      return <div className="space-y-2">
          <p className="text-sm font-medium">{card.front}</p>
          <Badge variant={card.back === 'Certo' ? 'default' : 'destructive'} className="flex items-center gap-1 w-fit">
            {card.back === 'Certo' ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {card.back}
          </Badge>
          {card.explanation && showBack[card.id] && <p className="text-sm text-muted-foreground mt-1 pt-2 border-t border-border/30">
              <HelpCircle className="h-3 w-3 inline mr-1" />
              {card.explanation}
            </p>}
        </div>;
    }
    if (card.type === 'word-hiding') {
      return <div className="space-y-2">
          <p className="text-sm font-medium">{card.front}</p>
          {showBack[card.id] && <p className="text-sm text-muted-foreground mt-1 pt-2 border-t border-border/30">
              <strong>Resposta completa:</strong> {card.back}
            </p>}
        </div>;
    }

    // Traditional card
    return <div className="space-y-2">
        <p className="text-sm font-medium">{card.front}</p>
        {showBack[card.id] && <p className="text-sm text-muted-foreground mt-1 pt-2 border-t border-border/30">
            {card.back}
          </p>}
      </div>;
  };
  const getCardTypeLabel = (type: string) => {
    switch (type) {
      case 'true-false':
        return 'V/F';
      case 'word-hiding':
        return 'Ocultação';
      default:
        return 'Tradicional';
    }
  };
  const getCardStatusColor = (card: Flashcard) => {
    if (!card.lastReviewed) return 'bg-blue-500/10 text-blue-700 border-blue-200';
    const now = new Date();
    const nextReview = new Date(card.nextReview);
    if (nextReview <= now) return 'bg-red-500/10 text-red-700 border-red-200';
    return 'bg-green-500/10 text-green-700 border-green-200';
  };
  const getCardStatusText = (card: Flashcard) => {
    if (!card.lastReviewed) return 'Novo';
    const now = new Date();
    const nextReview = new Date(card.nextReview);
    if (nextReview <= now) return 'Para revisar';
    return 'Revisado';
  };
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit'
    });
  };
  if (cards.length === 0) {
    return <Card className="bg-muted/20 border-border/50">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground text-center">
            Nenhum card neste deck ainda
          </p>
        </CardContent>
      </Card>;
  }
  return <Card className="bg-gradient-card border-border/50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors mx-0 my-0 py-[5px]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Cards do deck "{deckName}"
                <Badge variant="secondary" className="ml-2">
                  {cards.length}
                </Badge>
              </CardTitle>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {cards.map(card => <div key={card.id} className="p-3 rounded-lg border border-border/30 bg-card/50 hover:bg-card transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    {/* Card Front */}
                    <div className="flex items-start gap-2">
                      <Button variant="ghost" size="icon" className="h-6 w-6 mt-0.5 shrink-0" onClick={() => toggleCardBack(card.id)}>
                        {showBack[card.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <div className="flex-1">
                        {renderCardContent(card)}
                      </div>
                    </div>
                    
                    {/* Card Info */}
                    <div className="flex items-center gap-3 text-xs">
                      <Badge variant="outline" className="text-xs">
                        {getCardTypeLabel(card.type)}
                      </Badge>
                      
                      <Badge className={cn("text-xs", getCardStatusColor(card))}>
                        {getCardStatusText(card)}
                      </Badge>
                      
                      {card.lastReviewed && <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          Última: {formatDate(card.lastReviewed)}
                        </div>}
                      
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Próxima: {formatDate(card.nextReview)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditCard(card)}>
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>
                            Editar Card {getCardTypeLabel(card.type)}
                          </DialogTitle>
                        </DialogHeader>
                        
                        {editingCard?.type === 'true-false' ? <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium">Enunciado</label>
                              <Textarea value={editFront} onChange={e => setEditFront(e.target.value)} className="mt-1" rows={3} />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Resposta correta</label>
                              <div className="flex gap-3 mt-2">
                                <Button variant={editAnswer === 'true' ? 'default' : 'outline-solid'} onClick={() => setEditAnswer('true')} className={cn("flex items-center gap-2", editAnswer === 'true' && "bg-success text-success-foreground hover:bg-success/90")}>
                                  <Check className="h-4 w-4" />
                                  Certo
                                </Button>
                                <Button variant={editAnswer === 'false' ? 'default' : 'outline-solid'} onClick={() => setEditAnswer('false')} className={cn("flex items-center gap-2", editAnswer === 'false' && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}>
                                  <X className="h-4 w-4" />
                                  Errado
                                </Button>
                              </div>
                            </div>
                            <div>
                              <label className="text-sm font-medium flex items-center gap-2">
                                <HelpCircle className="h-4 w-4" />
                                Explicação (opcional)
                              </label>
                              <Textarea value={editExplanation} onChange={e => setEditExplanation(e.target.value)} className="mt-1" rows={2} placeholder="Explique por que a resposta está certa ou errada..." />
                            </div>
                          </div> : editingCard?.type === 'word-hiding' ? <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium">
                                Texto com palavras ocultas (use {`{{ }}`} para marcar)
                              </label>
                              <Textarea value={editHidingText} onChange={e => setEditHidingText(e.target.value)} className="mt-1" rows={4} placeholder="Digite seu texto com {{palavras}} que ficarão ocultas..." />
                              <p className="text-xs text-muted-foreground mt-1">
                                Exemplo: "A capital do Brasil é {`{{Brasília}}`}."
                              </p>
                            </div>
                          </div> : <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium">Frente do Card</label>
                              <Textarea value={editFront} onChange={e => setEditFront(e.target.value)} className="mt-1" rows={3} />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Verso do Card</label>
                              <Textarea value={editBack} onChange={e => setEditBack(e.target.value)} className="mt-1" rows={3} />
                            </div>
                          </div>}
                        <div className="flex gap-2">
                          <Button onClick={handleSaveEdit} disabled={editingCard?.type === 'true-false' ? !editFront.trim() || editAnswer === null : editingCard?.type === 'word-hiding' ? !editHidingText.trim() || !/\{\{[^}]+\}\}/.test(editHidingText) : !editFront.trim() || !editBack.trim()} className="flex-1">
                            Salvar
                          </Button>
                          <Button variant="outline" onClick={() => setEditingCard(null)} className="flex-1">
                            Cancelar
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteCard(card)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>)}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>;
}