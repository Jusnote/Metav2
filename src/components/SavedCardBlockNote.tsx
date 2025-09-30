import "@blocknote/core/fonts/inter.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";
import { BlockNoteSchema, defaultBlockSpecs, filterSuggestionItems } from "@blocknote/core";
import { SuggestionMenuController, getDefaultReactSlashMenuItems } from "@blocknote/react";
import { FlashcardBlock } from "./blocks/FlashcardBlock";
import { useEffect } from "react";

// Create a schema with custom blocks
const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    flashcard: FlashcardBlock,
  },
});

// Define the editor type with the custom schema
type CustomEditor = typeof schema.BlockNoteEditor;

const getCustomSlashMenuItems = (editor: CustomEditor) => [
  ...getDefaultReactSlashMenuItems(editor),
];

interface SavedCardBlockNoteProps {
  content: any[];
  isEditing: boolean;
  onSave?: (content: any[]) => void;
}

export default function SavedCardBlockNote({ 
  content,
  isEditing,
  onSave
}: SavedCardBlockNoteProps) {
  const editor = useCreateBlockNote({
    schema,
    initialContent: content,
  });

  // Atualizar modo de edição
  useEffect(() => {
    editor.isEditable = isEditing;
  }, [isEditing, editor]);

  // Atualizar conteúdo quando mudar
  useEffect(() => {
    if (content && JSON.stringify(editor.document) !== JSON.stringify(content)) {
      editor.replaceBlocks(editor.document, content);
    }
  }, [content, editor]);

  return (
    <div className="saved-card-block-editor">
      <BlockNoteView 
        editor={editor} 
        slashMenu={isEditing}
        theme="light"
        onChange={() => {
          if (isEditing && onSave) {
            onSave(editor.document);
          }
        }}
      >
        {isEditing && (
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (query) =>
              filterSuggestionItems(getCustomSlashMenuItems(editor), query)
            }
          />
        )}
      </BlockNoteView>
      
      <style jsx global>{`
        .saved-card-block-editor .bn-container {
          border: none !important;
          background: transparent !important;
          max-width: 100% !important;
        }
        
        .saved-card-block-editor .bn-editor {
          padding: 0 !important;
          font-size: 0.875rem !important;
          color: #374151 !important;
          max-width: 100% !important;
        }
        
        .saved-card-block-editor .bn-editor .ProseMirror {
          outline: none !important;
          max-width: 100% !important;
        }
        
        .saved-card-block-editor .bn-inline-content {
          max-width: 100% !important;
          word-break: break-word !important;
          overflow-wrap: break-word !important;
        }
        
        .saved-card-block-editor .bn-editor .ProseMirror p.bn-block-content {
          margin: 0 !important;
          padding: 2px 0 !important;
          max-width: 100% !important;
        }
        
        .saved-card-block-editor .bn-editor .ProseMirror h2.bn-block-content {
          font-size: 1rem !important;
          font-weight: 500 !important;
          color: #111827 !important;
          margin: 0 !important;
          padding: 0 0 4px 0 !important;
          max-width: 100% !important;
        }
      `}</style>
    </div>
  );
}
