import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Bookmark, 
  BookmarkPlus, 
  Clock, 
  Trash2, 
  X, 
  Menu,
  AlertCircle
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useProgressMarkers, ProgressMarker } from "@/hooks/useProgressMarkers";
import { useToast } from "@/hooks/use-toast";

interface ProgressSidebarProps {
  disciplina: string;
  resumo: string;
  onMarkerClick?: (marker: ProgressMarker) => void;
}

export function ProgressSidebar({ disciplina, resumo, onMarkerClick }: ProgressSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { markers, addMarker, removeMarker, clearAllMarkers } = useProgressMarkers(disciplina, resumo);
  const { toast } = useToast();

  const handleAddMarker = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      toast({
        title: "Nenhum texto selecionado",
        description: "Por favor, selecione um texto para marcar como ponto de parada.",
        variant: "destructive"
      });
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      toast({
        title: "Texto vazio",
        description: "Por favor, selecione um texto válido.",
        variant: "destructive"
      });
      return;
    }

    // Encontrar a posição do texto selecionado
    const range = selection.getRangeAt(0);
    const position = range.startOffset;
    
    // Extrair um título curto do contexto
    const container = range.commonAncestorContainer;
    const parentElement = container.nodeType === Node.TEXT_NODE 
      ? container.parentElement 
      : container as Element;
    
    let title = "Marcação";
    if (parentElement) {
      // Procurar por headings próximos
      const heading = parentElement.closest('h1, h2, h3') || 
                     parentElement.querySelector('h1, h2, h3');
      if (heading) {
        title = heading.textContent?.trim() || "Marcação";
      }
    }

    const marker = addMarker(selectedText, position, title);
    
    // Limpar seleção
    selection.removeAllRanges();
    
    toast({
      title: "Marcação adicionada",
      description: `Ponto de parada salvo: "${selectedText.substring(0, 50)}${selectedText.length > 50 ? '...' : ''}"`,
    });

    // Callback opcional para scroll até a marcação
    if (onMarkerClick) {
      onMarkerClick(marker);
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const handleClearAll = () => {
    clearAllMarkers();
    toast({
      title: "Marcações removidas",
      description: "Todas as marcações foram removidas com sucesso.",
    });
  };

  return (
    <div className={`${isExpanded ? 'w-80 absolute right-0 top-0 h-full z-40 bg-muted/95' : 'w-6 bg-muted/50'} ${isExpanded ? 'border-l' : ''} border-border flex flex-col min-h-0 transition-all duration-300 ${!isExpanded ? 'relative' : ''}`}>
      
      {/* Collapsed sidebar - thin line with expand button */}
      {!isExpanded && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsExpanded(true)} 
            className="h-12 w-8 rounded-none rounded-l-md bg-muted/80 hover:bg-muted border border-r-0 border-border text-muted-foreground hover:text-foreground"
          >
            <Bookmark className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {/* Expanded sidebar */}
      {isExpanded && (
        <>
          {/* Header */}
          <div className="p-3 border-b border-border shrink-0 flex items-center justify-between py-[22px]">
            <div className="flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-primary" />
              <div>
                <h2 className="font-semibold text-foreground text-sm">Progresso</h2>
                <p className="text-xs text-muted-foreground">{markers.length} marcações</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsExpanded(false)} 
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Add marker button */}
          <div className="p-3 border-b border-border shrink-0">
            <Button 
              onClick={handleAddMarker}
              className="w-full"
              size="sm"
            >
              <BookmarkPlus className="h-4 w-4 mr-2" />
              Parei aqui
            </Button>
          </div>

          {/* Markers list */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3 pt-2">
              {markers.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  <Bookmark className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma marcação ainda</p>
                  <p className="text-xs mt-1">Selecione texto e clique em "Parei aqui"</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {markers.map((marker, index) => (
                    <div 
                      key={marker.id}
                      className="group border border-border rounded-lg p-3 hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => onMarkerClick?.(marker)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs">
                          #{index + 1}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeMarker(marker.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-foreground line-clamp-2">
                          {marker.title}
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                          "{marker.text}"
                        </p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatTime(marker.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Actions */}
          {markers.length > 0 && (
            <div className="p-3 border-t border-border shrink-0">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Limpar todas
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover todas as marcações?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. Todas as suas marcações de progresso para este resumo serão permanentemente removidas.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleClearAll}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remover todas
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </>
      )}
    </div>
  );
}