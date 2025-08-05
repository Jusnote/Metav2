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
import { Trash2, AlertTriangle } from "lucide-react";

interface DeleteDeckDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  deckName: string;
  cardCount: number;
}

export function DeleteDeckDialog({
  isOpen,
  onCancel,
  onConfirm,
  deckName,
  cardCount
}: DeleteDeckDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onCancel}>
      <AlertDialogContent className="max-w-md w-full mx-4 p-6 fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] z-50">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Excluir Deck
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            Tem certeza que deseja excluir o deck <strong>"{deckName}"</strong>?
            <br /><br />
            {cardCount > 0 ? (
              <>
                <span className="text-destructive font-medium">
                  ⚠️ Esta ação irá excluir permanentemente {cardCount} flashcard{cardCount > 1 ? 's' : ''} 
                  contido{cardCount > 1 ? 's' : ''} neste deck.
                </span>
                <br /><br />
                <span className="text-sm text-muted-foreground">
                  Esta ação não pode ser desfeita.
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                O deck está vazio e será removido permanentemente.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={onCancel}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir Deck
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}