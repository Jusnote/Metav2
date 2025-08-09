import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Blocks } from "lucide-react";
import { FlashcardEditor } from "./FlashcardEditor";
import BlockNoteEditor from "@/components/BlockNoteEditor";
import { Deck } from "@/types/flashcard";

interface EditorSelectorProps {
  selectedDeck: Deck;
  onUpdateCard?: (cardId: string, front: string, back: string, explanation?: string, hiddenWords?: string[]) => Promise<void>;
  onSave: (front: string, back: string, type?: any, hiddenWordIndices?: number[], hiddenWords?: string[], explanation?: string, parentId?: string, deckId?: string) => Promise<string | null>;
  onDeleteCard?: (cardId: string, deleteOption?: 'cascade' | 'promote') => Promise<void>;
  onClose: () => void;
}

type EditorType = "flashcard" | "blocknote";

export default function EditorSelector({ selectedDeck, onUpdateCard, onSave, onDeleteCard, onClose }: EditorSelectorProps) {
  const [selectedEditor, setSelectedEditor] = useState<EditorType | null>(null);

  if (selectedEditor === "flashcard") {
    return (
      <div className="h-full">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Editor de Flashcards - {selectedDeck.name}</h2>
          <Button variant="outline" onClick={() => setSelectedEditor(null)}>
            Voltar
          </Button>
        </div>
        <FlashcardEditor 
          onSave={onSave}
          onUpdateCard={onUpdateCard}
          onDeleteCard={onDeleteCard}
          placeholder={`Criando cards para "${selectedDeck.name}"

Pergunta == Resposta`}
          deckId={selectedDeck.id}
        />
      </div>
    );
  }

  if (selectedEditor === "blocknote") {
    return (
      <div className="h-full">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Editor de Blocos - {selectedDeck.name}</h2>
          <Button variant="outline" onClick={() => setSelectedEditor(null)}>
            Voltar
          </Button>
        </div>
        <div className="h-[calc(100vh-120px)]">
          <BlockNoteEditor />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Escolha o Editor</h2>
        <p className="text-muted-foreground">Selecione qual editor você deseja usar para o deck "{selectedDeck.name}"</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedEditor("flashcard")}>
          <CardHeader>
            <div className="flex items-center space-x-3">
              <FileText className="h-8 w-8 text-blue-600" />
              <CardTitle>Editor de Flashcards</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">
              Editor especializado para criação e edição de flashcards com funcionalidades específicas como frente/verso, palavras ocultas e explicações.
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedEditor("blocknote")}>
          <CardHeader>
            <div className="flex items-center space-x-3">
              <Blocks className="h-8 w-8 text-green-600" />
              <CardTitle>Editor de Blocos</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">
              Editor de blocos moderno e limpo, similar ao Notion, para criação de conteúdo rico com blocos de texto, listas, tabelas e muito mais.
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}