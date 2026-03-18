/**
 * @deprecated BlockNote removido — flashcards agora usam Plate Editor.
 * Stub mantido para compatibilidade de imports legados.
 */

interface SavedCardBlockNoteProps {
  content: any[];
  isEditing: boolean;
  onSave?: (content: any[]) => void;
}

export default function SavedCardBlockNote({
  content,
}: SavedCardBlockNoteProps) {
  return (
    <div className="text-sm text-muted-foreground p-4">
      <p>Editor BlockNote removido. Use o Plate Editor.</p>
    </div>
  );
}
