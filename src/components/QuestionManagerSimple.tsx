import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $isElementNode } from 'lexical';
import { $isHeadingNode } from '@lexical/rich-text';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { X, HelpCircle, Plus, Edit, BookOpen } from 'lucide-react';
import { useQuestions } from '@/contexts/QuestionsContext';
import { QuestionEditor } from './QuestionEditor';
import { SectionQuestions, Question } from '@/types/questions';

interface QuestionManagerSimpleProps {
  isOpen: boolean;
  onClose: () => void;
}

interface H1Section {
  index: number;
  title: string;
}

export function QuestionManagerSimple({ isOpen, onClose }: QuestionManagerSimpleProps) {
  const [editor] = useLexicalComposerContext();
  const [h1Sections, setH1Sections] = useState<H1Section[]>([]);
  const [showQuestionEditor, setShowQuestionEditor] = useState(false);
  const [currentSection, setCurrentSection] = useState<{ index: number; title: string } | null>(null);
  const { getQuestionsForSection, getStats, replaceQuestionsForSection } = useQuestions();

  // Extrair seções H1 de forma simples
  const extractH1Sections = () => {
    try {
      const sections: H1Section[] = [];
      
      editor.getEditorState().read(() => {
        const root = $getRoot();
        let h1Index = 0;
        
        function traverseNodes(node: any) {
          if ($isHeadingNode(node) && node.getTag() === 'h1') {
            const title = node.getTextContent() || `Seção ${h1Index + 1}`;
            sections.push({
              index: h1Index,
              title: title.trim(),
            });
            h1Index++;
          }
          
          if ($isElementNode(node)) {
            const children = node.getChildren();
            children.forEach(traverseNodes);
          }
        }
        
        const children = root.getChildren();
        children.forEach(traverseNodes);
      });
      
      setH1Sections(sections);
    } catch (error) {
      console.error('Erro ao extrair seções H1:', error);
      setH1Sections([]);
    }
  };

  // Atualizar seções quando o modal abrir
  useEffect(() => {
    if (isOpen) {
      extractH1Sections();
    }
  }, [isOpen, editor]);

  if (!isOpen) return null;

  const stats = getStats();

  const handleOpenQuestionEditor = (sectionIndex: number, sectionTitle: string) => {
    setCurrentSection({ index: sectionIndex, title: sectionTitle });
    setShowQuestionEditor(true);
  };

  const handleSaveQuestions = async (updatedQuestions: Question[]) => {
    if (!currentSection) return;
    
    try {
      console.log('💾 [MANAGER] Salvando perguntas via QuestionManagerSimple:', updatedQuestions);
      
      // Usar o novo método que substitui todas as perguntas de uma vez
      await replaceQuestionsForSection(
        currentSection.index,
        currentSection.title,
        updatedQuestions
      );
      
      console.log('✅ [MANAGER] Perguntas salvas com sucesso');
      
      // Atualizar a lista de seções
      extractH1Sections();
      
      // Fechar o editor
      setShowQuestionEditor(false);
      setCurrentSection(null);
    } catch (error) {
      console.error('❌ [MANAGER] Erro ao salvar perguntas:', error);
      alert('Erro ao salvar perguntas. Tente novamente.');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
      <Card className="w-full max-w-2xl mx-4">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-3">
            <HelpCircle className="h-6 w-6 text-blue-600" />
            <CardTitle className="text-xl text-blue-700">
              Gerenciador de Perguntas (Versão Simples)
            </CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="p-6">
          {/* Estatísticas */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{h1Sections.length}</div>
              <div className="text-sm text-gray-600">Seções H1</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.totalQuestions}</div>
              <div className="text-sm text-gray-600">Perguntas</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{stats.sectionsWithQuestions}</div>
              <div className="text-sm text-gray-600">Com Perguntas</div>
            </div>
          </div>

          {/* Lista de Seções */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Seções do Documento</h3>
            {h1Sections.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Nenhuma seção H1 encontrada</p>
                <p className="text-sm">Adicione títulos H1 ao seu documento.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {h1Sections.map((section) => {
                  const existingQuestions = getQuestionsForSection(section.index);
                  const hasQuestions = existingQuestions && existingQuestions.questions.length > 0;
                  
                  return (
                    <div key={section.index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            Seção {section.index + 1}
                          </span>
                          {hasQuestions && (
                            <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                              {existingQuestions.questions.length} pergunta{existingQuestions.questions.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <h4 className="font-medium text-gray-900 truncate" title={section.title}>
                          {section.title}
                        </h4>
                      </div>
                      
                      <div className="ml-3">
                        <Button
                          variant={hasQuestions ? "default" : "outline-solid"}
                          size="sm"
                          onClick={() => handleOpenQuestionEditor(section.index, section.title)}
                        >
                          {hasQuestions ? (
                            <>
                              <Edit className="h-3 w-3 mr-1" />
                              Editar
                            </>
                          ) : (
                            <>
                              <Plus className="h-3 w-3 mr-1" />
                              Adicionar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
        
        <div className="border-t p-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {stats.totalQuestions > 0 ? (
              `Total: ${stats.totalQuestions} perguntas em ${stats.sectionsWithQuestions} seções`
            ) : (
              'Nenhuma pergunta criada ainda'
            )}
          </div>
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </Card>
      
      {/* Modal do Editor de Perguntas */}
      {showQuestionEditor && currentSection && (
        <QuestionEditor
          sectionIndex={currentSection.index}
          sectionTitle={currentSection.title}
          existingQuestions={getQuestionsForSection(currentSection.index)?.questions || []}
          isOpen={showQuestionEditor}
          onClose={() => {
            setShowQuestionEditor(false);
            setCurrentSection(null);
          }}
          onSave={handleSaveQuestions}
        />
      )}
    </div>,
    document.body
  );
}
