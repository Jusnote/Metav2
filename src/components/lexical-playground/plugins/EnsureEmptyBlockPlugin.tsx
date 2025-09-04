/**
 * Plugin para garantir que sempre haja um bloco vazio no final do editor Lexical
 */

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {
  $createParagraphNode,
  $getRoot,
  $isParagraphNode,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
} from 'lexical';
import {useEffect} from 'react';

export default function EnsureEmptyBlockPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const ensureEmptyBlock = () => {
      editor.update(() => {
        const root = $getRoot();
        const children = root.getChildren();
        
        if (children.length === 0) {
          // Se não há nenhum nó, adiciona um parágrafo vazio
          const paragraph = $createParagraphNode();
          root.append(paragraph);
          return;
        }
        
        const lastChild = children[children.length - 1];
        
        // Verifica se o último nó é um parágrafo vazio
        if ($isParagraphNode(lastChild)) {
          const textContent = lastChild.getTextContent().trim();
          if (textContent === '') {
            // Já existe um parágrafo vazio no final
            return;
          }
        }
        
        // Adiciona um novo parágrafo vazio no final
        const emptyParagraph = $createParagraphNode();
        root.append(emptyParagraph);
      });
    };

    // Executa a verificação após mudanças no editor
    const removeUpdateListener = editor.registerUpdateListener(() => {
      ensureEmptyBlock();
    });

    // Executa a verificação quando o usuário pressiona Enter ou seta para baixo
    const removeEnterListener = editor.registerCommand(
      KEY_ENTER_COMMAND,
      () => {
        setTimeout(ensureEmptyBlock, 0);
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    const removeArrowDownListener = editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      () => {
        setTimeout(ensureEmptyBlock, 0);
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    // Executa a verificação inicial
    ensureEmptyBlock();

    return () => {
      removeUpdateListener();
      removeEnterListener();
      removeArrowDownListener();
    };
  }, [editor]);

  return null;
}