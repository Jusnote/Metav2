import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2, ArrowUp } from "lucide-react";

interface DeleteCardDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: (strategy: 'cascade' | 'promote') => void;
  cardTitle: string;
  subCardCount: number;
}

export function DeleteCardDialog({
  isOpen,
  onCancel,
  onConfirm,
  cardTitle,
  subCardCount
}: DeleteCardDialogProps) {
  const handleStrategySelect = (strategy: 'cascade' | 'promote') => {
    onConfirm(strategy);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onCancel}>
      <AlertDialogContent className="max-w-md w-full mx-4 p-6 fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] z-50">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Excluir Flashcard
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            O flashcard <strong>"{cardTitle}"</strong> possui{" "}
            <strong>{subCardCount} subflashcard{subCardCount > 1 ? 's' : ''}</strong>.
            <br /><br />
            Como você gostaria de proceder?
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-3 px-4 max-w-sm mx-auto">
          <Button
            variant="destructive"
            className="w-full justify-start gap-3 h-auto px-3 py-2"
            onClick={() => handleStrategySelect('cascade')}
          >
            <Trash2 className="h-4 w-4" />
            <div className="text-left">
              <div className="font-medium">Excluir tudo</div>
              <div className="text-xs opacity-90">
                Remove o flashcard e todos os seus subflashcards
              </div>
            </div>
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto px-3 py-2 border-blue-200 hover:bg-blue-50"
            onClick={() => handleStrategySelect('promote')}
          >
            <ArrowUp className="h-4 w-4 text-blue-600" />
            <div className="text-left">
              <div className="font-medium text-blue-700">Promover subflashcards</div>
              <div className="text-xs text-blue-600">
                Promove subflashcard(s) para o nível superior
              </div>
            </div>
          </Button>
          

        </div>
        
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}