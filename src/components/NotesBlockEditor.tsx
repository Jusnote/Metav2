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

interface NotesBlockEditorProps {
  placeholder?: string;
  onChange?: (content: any) => void;
  reset?: boolean;
  onResetComplete?: () => void;
}

export default function NotesBlockEditor({ 
  placeholder = "Type notes or press / for additional elements...",
  onChange,
  reset,
  onResetComplete
}: NotesBlockEditorProps) {
  const initialContent = [
    {
      type: "heading",
      props: {
        level: 2,
      },
      content: "",
    },
    {
      type: "paragraph",
      content: "",
    },
  ];

  const editor = useCreateBlockNote({
    schema,
    initialContent,
  });

  // Reset do editor quando solicitado
  useEffect(() => {
    if (reset) {
      editor.replaceBlocks(editor.document, initialContent);
      if (onResetComplete) {
        onResetComplete();
      }
    }
  }, [reset, editor, onResetComplete]);

  return (
    <div className="notes-block-editor">
      <BlockNoteView 
        editor={editor} 
        slashMenu={false}
        theme="light"
        onChange={() => {
          if (onChange) {
            onChange(editor.document);
          }
        }}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            filterSuggestionItems(getCustomSlashMenuItems(editor), query)
          }
        />
      </BlockNoteView>
      
      <style jsx="true" global="true">{`
        .notes-block-editor .bn-container {
          border: none !important;
          background: transparent !important;
          max-width: 100% !important;
        }
        
        .notes-block-editor .bn-editor {
          padding: 0 !important;
          font-size: 0.875rem !important;
          color: #374151 !important;
          max-width: 100% !important;
        }
        
         .notes-block-editor .bn-editor .ProseMirror {
           outline: none !important;
           max-width: 100% !important;
         }
         
         .notes-block-editor .bn-inline-content {
           max-width: 100% !important;
           word-break: break-word !important;
           overflow-wrap: break-word !important;
         }
         
         .notes-block-editor .bn-editor .ProseMirror p.bn-block-content {
           margin: 0 !important;
           padding: 4px 0 !important;
           max-width: 100% !important;
         }
        
        .notes-block-editor .bn-editor .ProseMirror p.bn-block-content:first-child::before {
          content: "${placeholder}";
          color: #9CA3AF;
          opacity: 0.7;
          position: absolute;
          pointer-events: none;
        }
        
         .notes-block-editor .bn-editor .ProseMirror p.bn-block-content:first-child:not(:empty)::before {
           display: none;
         }
         
          .notes-block-editor .bn-editor .ProseMirror h2.bn-block-content {
            font-size: 1.125rem !important;
            font-weight: 400 !important;
            color: #9CA3AF !important;
            margin: 0 !important;
            padding: 0 0 8px 0 !important;
            max-width: 100% !important;
          }
          
          .notes-block-editor .bn-editor .ProseMirror h2.bn-block-content:empty::before {
            content: "Untitled";
            color: #9CA3AF;
            opacity: 0.7;
            position: absolute;
            pointer-events: none;
          }
      `}</style>
    </div>
  );
}
