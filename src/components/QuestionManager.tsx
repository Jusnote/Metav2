import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $isElementNode } from 'lexical';
import { $isHeadingNode } from '@lexical/rich-text';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
// import { Badge } from './ui/badge';
// import { ScrollArea } from './ui/scroll-area';
import { QuestionEditor } from './QuestionEditor';
import { useQuestions } from '@/hooks/useQuestions';
import { SectionQuestions } from '@/types/questions';
import { X, Plus, Edit, BookOpen, HelpCircle, Trash2 } from 'lucide-react';

interface H1Section {
  index: number;
  title: string;
  nodeKey: string;
}

interface QuestionManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuestionManager({ isOpen, onClose }: QuestionManagerProps) {
  const [editor] = useLexicalComposerContext();
  const [h1Sections, setH1Sections] = useState<H1Section[]>([]);
  const [showQuestionEditor, setShowQuestionEditor] = useState(false);
  const [currentSection, setCurrentSection] = useState<{ index: number; title: string } | null>(null);
  const { 
    questions, 
    getQuestionsForSection, 
    addQuestionToSection, 
    removeQuestion,
    getStats 
  } = useQuestions();

  // Extrair todas as seções H1 do documento
  const extractH1Sections = () => {
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
            nodeKey: node.getKey(),
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
  };

  // Atualizar seções quando o modal abrir
  useEffect(() => {
    if (isOpen) {
      extractH1Sections();
    }
  }, [isOpen, editor]);

  if (!isOpen) return null;

  const handleOpenQuestionEditor = (sectionIndex: number, sectionTitle: string) => {
    setCurrentSection({ index: sectionIndex, title: sectionTitle });
    setShowQuestionEditor(true);
  };

  const handleSaveQuestions = async (sectionQuestions: SectionQuestions) => {
    try {
      console.log('💾 Salvando perguntas via QuestionManager:', sectionQuestions);
      
      // Limpar perguntas existentes da seção primeiro
      const existingQuestions = getQuestionsForSection(sectionQuestions.sectionIndex);
      if (existingQuestions) {
        for (const question of existingQuestions.questions) {
          await removeQuestion(sectionQuestions.sectionIndex, question.id);
        }
      }
      
      // Adicionar novas perguntas
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
      
      // Atualizar a lista de seções
      extractH1Sections();
    } catch (error) {
      console.error('❌ Erro ao salvar perguntas:', error);
      alert('Erro ao salvar perguntas. Tente novamente.');
    }
  };

  const handleDeleteAllQuestions = async (sectionIndex: number) => {
    const existingQuestions = getQuestionsForSection(sectionIndex);
    if (!existingQuestions) return;
    
    const confirmDelete = confirm(`Tem certeza que deseja deletar todas as ${existingQuestions.questions.length} perguntas desta seção?`);
    if (!confirmDelete) return;
    
    try {
      for (const question of existingQuestions.questions) {
        await removeQuestion(sectionIndex, question.id);
      }
      console.log('🗑️ Todas as perguntas da seção foram deletadas');
      extractH1Sections();
    } catch (error) {
      console.error('❌ Erro ao deletar perguntas:', error);
      alert('Erro ao deletar perguntas. Tente novamente.');
    }
  };

  const stats = getStats();

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
      <Card className="w-full max-w-4xl max-h-[90vh] mx-4 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-3">
            <HelpCircle className="h-6 w-6 text-blue-600" />
            <div>
              <CardTitle className="text-xl text-blue-700">
                Gerenciador de Perguntas
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Gerencie perguntas para cada seção H1 do documento
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <div className="flex h-[calc(90vh-120px)]">
          {/* Estatísticas - Sidebar */}
          <div className="w-80 border-r bg-gray-50 p-4">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Estatísticas
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-white p-2 rounded border">
                    <div className="text-2xl font-bold text-blue-600">{h1Sections.length}</div>
                    <div className="text-gray-600">Seções H1</div>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <div className="text-2xl font-bold text-green-600">{stats.totalQuestions}</div>
                    <div className="text-gray-600">Perguntas</div>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <div className="text-2xl font-bold text-purple-600">{stats.sectionsWithQuestions}</div>
                    <div className="text-gray-600">Com Perguntas</div>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <div className="text-2xl font-bold text-orange-600">{stats.averageQuestionsPerSection.toFixed(1)}</div>
                    <div className="text-gray-600">Média/Seção</div>
                  </div>
                </div>
              </div>
              
              <div className="text-xs text-gray-500 p-2 bg-blue-50 rounded border border-blue-200">
                💡 <strong>Dica:</strong> Adicione perguntas para tornar o estudo dirigido mais interativo e eficaz.
              </div>
            </div>
          </div>
          
          {/* Lista de Seções */}
          <div className="flex-1 p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Seções do Documento</h3>
              <p className="text-sm text-gray-600">
                Clique em "Adicionar" ou "Editar" para gerenciar perguntas de cada seção.
              </p>
            </div>
            
            <div className="h-full overflow-y-auto">
              {h1Sections.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Nenhuma seção H1 encontrada</p>
                  <p className="text-sm">Adicione títulos H1 ao seu documento para criar seções.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {h1Sections.map((section) => {
                    const existingQuestions = getQuestionsForSection(section.index);
                    const hasQuestions = existingQuestions && existingQuestions.questions.length > 0;
                    
                    return (
                      <Card key={section.nodeKey} className="border border-gray-200 hover:border-blue-300 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  Seção {section.index + 1}
                                </span>
                                {hasQuestions && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                    {existingQuestions.questions.length} pergunta{existingQuestions.questions.length !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              <h4 className="font-medium text-gray-900 truncate" title={section.title}>
                                {section.title}
                              </h4>
                              {hasQuestions && (
                                <div className="mt-2 text-xs text-gray-500">
                                  Tipos: {[...new Set(existingQuestions.questions.map(q => {
                                    switch (q.type) {
                                      case 'multiple': return 'Múltipla';
                                      case 'boolean': return 'V/F';
                                      case 'text': return 'Texto';
                                      default: return q.type;
                                    }
                                  }))].join(', ')}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 ml-4">
                              {hasQuestions && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteAllQuestions(section.index)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title="Deletar todas as perguntas"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                              
                              <Button
                                variant={hasQuestions ? "default" : "outline-solid"}
                                size="sm"
                                onClick={() => handleOpenQuestionEditor(section.index, section.title)}
                                className="flex items-center gap-2"
                              >
                                {hasQuestions ? (
                                  <>
                                    <Edit className="h-3 w-3" />
                                    Editar
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-3 w-3" />
                                    Adicionar
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {stats.totalQuestions > 0 ? (
              `Total: ${stats.totalQuestions} perguntas em ${stats.sectionsWithQuestions} seções`
            ) : (
              'Nenhuma pergunta criada ainda'
            )}
          </div>
          <Button onClick={onClose}>
            Fechar
          </Button>
        </div>
      </Card>
      
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
    </div>,
    document.body
  );
}
