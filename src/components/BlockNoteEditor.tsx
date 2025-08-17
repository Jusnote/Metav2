import "@blocknote/core/fonts/inter.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";
import { BlockNoteSchema, defaultBlockSpecs, filterSuggestionItems, insertOrUpdateBlock } from "@blocknote/core";
import { DefaultReactSuggestionItem, getDefaultReactSlashMenuItems, SuggestionMenuController } from "@blocknote/react";
import { FlashcardBlock } from "./blocks/FlashcardBlock";
import { HiOutlineSparkles } from "react-icons/hi2";

// Create a schema with custom blocks
const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    flashcard: FlashcardBlock,
  },
});

// Define the editor type with the custom schema
type CustomEditor = typeof schema.BlockNoteEditor;

// Custom Slash Menu item to insert a flashcard block
const insertFlashcardItem = (editor: CustomEditor) => ({
  title: "Flashcard",
  onItemClick: async () => {
    try {
      // Capturar o bloco atual onde está o cursor
      const selection = editor.getSelection();
      const currentBlock = selection?.blocks?.[0] || editor.getTextCursorPosition()?.block;
      
      let currentText = "";
      
      if (currentBlock) {
        // Tentar capturar o texto do bloco atual
        try {
          const blockContent = await editor.blocksToMarkdownLossy([currentBlock]);
          currentText = blockContent ? blockContent.trim() : "";
        } catch (e) {
          console.log("Erro ao capturar texto do bloco:", e);
          currentText = "";
        }
      }
      
      // Se há texto no bloco atual, usar como pergunta; senão usar texto vazio
      const frontText = currentText || "";
      
      if (currentText && currentBlock) {
        // Se há texto, substituir o bloco atual pelo flashcard
        try {
          editor.updateBlock(currentBlock, {
            type: "flashcard",
            props: {
              front: frontText,
              back: "",
              cardType: "traditional",
              showBack: false,
              autoEdit: currentText ? true : false,
            },
          });
        } catch (e) {
          console.log("Erro ao atualizar bloco para flashcard:", e);
          // Fallback: inserir novo bloco
          insertOrUpdateBlock(editor, {
            type: "flashcard",
            props: {
              front: frontText,
              back: "",
              cardType: "traditional",
              showBack: false,
              autoEdit: currentText ? true : false,
            },
          });
        }
      } else {
        // Se não há texto, inserir novo bloco
        insertOrUpdateBlock(editor, {
          type: "flashcard",
          props: {
            front: frontText,
            back: "",
            cardType: "traditional",
            showBack: false,
            autoEdit: currentText ? true : false,
          },
        });
      }
    } catch (error) {
      console.error("Erro ao inserir flashcard:", error);
      // Fallback: inserir flashcard com texto padrão
       insertOrUpdateBlock(editor, {
         type: "flashcard",
         props: {
           front: "",
           back: "",
           cardType: "traditional",
           showBack: false,
           autoEdit: false,
         },
       });
    }
  },
  aliases: ["flashcard", "card", "cartao"],
  group: "Other",
  icon: <HiOutlineSparkles size={18} />,
  subtext: "Criar um novo cartão de estudo",
});

// List containing all default Slash Menu Items, as well as our custom one
const getCustomSlashMenuItems = (
  editor: CustomEditor,
): DefaultReactSuggestionItem[] => [
  ...getDefaultReactSlashMenuItems(editor),
  insertFlashcardItem(editor),
];

export default function BlockNoteEditor() {
  const editor = useCreateBlockNote({
    schema,
  });

  return (
    <div className="h-full">
      <BlockNoteView 
        editor={editor} 
        slashMenu={false}
        shadCNComponents={{
          // Pass modified ShadCN components from your project here.
          // Otherwise, the default ShadCN components will be used.
        }}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            filterSuggestionItems(getCustomSlashMenuItems(editor), query)
          }
        />
      </BlockNoteView>
    </div>
  );
}