/**
 * Plugin para adicionar botões de edição de perguntas aos headers H1
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $isElementNode } from 'lexical';
import { $isHeadingNode } from '@lexical/rich-text';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuestionEditor } from '@/components/QuestionEditor';
import { useQuestions } from '@/hooks/useQuestions';
import { SectionQuestions } from '@/types/questions';

export default function QuestionEditorPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [h1Elements, setH1Elements] = useState<Array<{ element: HTMLElement; index: number; title: string }>>([]);
  const [showQuestionEditor, setShowQuestionEditor] = useState(false);
  const [currentSection, setCurrentSection] = useState<{ index: number; title: string } | null>(null);
  const { getQuestionsForSection, addQuestionToSection, updateQuestion, removeQuestion } = useQuestions();

  // Função para encontrar todos os H1 no editor
  const findH1Elements = () => {
    const h1s: Array<{ element: HTMLElement; index: number; title: string }> = [];
    
    editor.getEditorState().read(() => {
      const root = $getRoot();
      let h1Index = 0;
      
      function traverseNodes(node: any) {
        if ($isHeadingNode(node) && node.getTag() === 'h1') {
          const element = editor.getElementByKey(node.getKey());
          if (element) {
            const title = element.textContent || `Seção ${h1Index + 1}`;
            h1s.push({ element, index: h1Index, title });
            h1Index++;
          }
        }
        
        if ($isElementNode(node)) {
          const children = node.getChildren();
          children.forEach(traverseNodes);
        }
      }
      
      const children = root.getChildren();
      children.forEach(traverseNodes);
    });
    
    setH1Elements(h1s);
  };

  // Atualizar a lista de H1s quando o editor mudar
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const unregister = editor.registerUpdateListener(() => {
      // Debounce para evitar muitas atualizações
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        findH1Elements();
      }, 100);
    });

    // Encontrar H1s inicialmente
    findH1Elements();

    return () => {
      clearTimeout(timeoutId);
      unregister();
    };
  }, [editor]);

  // Só renderizar se o editor estiver em modo edição (não read-only)
  const isEditable = editor.isEditable();
  if (!isEditable) {
    return null;
  }

  const handleOpenQuestionEditor = (sectionIndex: number, sectionTitle: string) => {
    setCurrentSection({ index: sectionIndex, title: sectionTitle });
    setShowQuestionEditor(true);
  };

  const handleSaveQuestions = async (sectionQuestions: SectionQuestions) => {
    console.log('💾 Salvando perguntas:', sectionQuestions);
    
    try {
      // Salvar cada pergunta individualmente usando o hook
      for (const question of sectionQuestions.questions) {
        await addQuestionToSection(
          sectionQuestions.sectionIndex,
          sectionQuestions.sectionTitle,
          {
            type: question.type,
            question: question.question,
            options: question.options,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            points: question.points,
          }
        );
      }
      
      console.log('✅ Perguntas salvas com sucesso');
      
      // Atualizar a lista de H1s para refletir as mudanças
      findH1Elements();
    } catch (error) {
      console.error('❌ Erro ao salvar perguntas:', error);
      alert('Erro ao salvar perguntas. Tente novamente.');
    }
  };

  const renderQuestionButton = (h1Data: { element: HTMLElement; index: number; title: string }) => {
    const { element, index, title } = h1Data;
    
    try {
      const existingQuestions = getQuestionsForSection(index);
      const hasQuestions = existingQuestions && existingQuestions.questions.length > 0;

      // Criar um container para o botão se não existir
      let buttonContainer = element.querySelector('.question-editor-button-container') as HTMLElement;
      if (!buttonContainer) {
        buttonContainer = document.createElement('div');
        buttonContainer.className = 'question-editor-button-container';
        buttonContainer.style.cssText = `
          position: absolute;
          right: -60px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 10;
        `;
        
        // Adicionar estilo relativo ao elemento pai se necessário
        if (getComputedStyle(element).position === 'static') {
          element.style.position = 'relative';
        }
        
        element.appendChild(buttonContainer);
      }

      return createPortal(
        <Button
          size="sm"
          variant={hasQuestions ? "default" : "outline-solid"}
          onClick={() => handleOpenQuestionEditor(index, title)}
          className={`flex items-center gap-1 text-xs ${
            hasQuestions 
              ? 'bg-blue-500 hover:bg-blue-600 text-white' 
              : 'border-blue-300 text-blue-600 hover:bg-blue-50'
          }`}
          title={hasQuestions ? `Editar perguntas (${existingQuestions.questions.length})` : 'Adicionar perguntas'}
        >
          {hasQuestions ? (
            <>
              <Edit className="h-3 w-3" />
              {existingQuestions.questions.length}
            </>
          ) : (
            <>
              <Plus className="h-3 w-3" />
              Q
            </>
          )}
        </Button>,
        buttonContainer
      );
    } catch (error) {
      console.error('Erro ao renderizar botão de pergunta:', error);
      return null;
    }
  };

  return (
    <>
      {/* Renderizar botões para cada H1 */}
      {h1Elements.map((h1Data) => (
        <div key={`${h1Data.index}-${h1Data.title}`}>
          {renderQuestionButton(h1Data)}
        </div>
      ))}

      {/* Modal do Editor de Perguntas */}
      {showQuestionEditor && currentSection && (
        <QuestionEditor
          sectionIndex={currentSection.index}
          sectionTitle={currentSection.title}
          existingQuestions={getQuestionsForSection(currentSection.index)}
          isOpen={showQuestionEditor}
          onClose={() => {
            setShowQuestionEditor(false);
            setCurrentSection(null);
          }}
          onSave={handleSaveQuestions}
        />
      )}
    </>
  );
}
