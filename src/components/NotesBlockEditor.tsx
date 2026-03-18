/**
 * @deprecated BlockNote removido — notas agora usam Plate Editor.
 * Stub mantido para compatibilidade de imports legados.
 */

interface NotesBlockEditorProps {
  content?: any[];
  onChange?: (content: any[]) => void;
  editable?: boolean;
}

export default function NotesBlockEditor(_props: NotesBlockEditorProps) {
  return (
    <div className="text-sm text-muted-foreground p-4">
      <p>Editor BlockNote removido. Use o Plate Editor.</p>
    </div>
  );
}
