import React from 'react';
import { BookOpen, Play, Pause, RotateCcw, ChevronRight, CheckCircle } from 'lucide-react';
import { useStudyMode } from '../hooks/useStudyMode';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

export function StudyModeControls() {
  const {
    isReadOnly,
    isStudyModeEnabled,
    canEnableStudyMode,
    currentSectionIndex,
    completedSections,
    isGuidedModeActive,
    totalSections,
    canGoToNextSection,
    isLastSection,
    toggleStudyMode,
    goToNextSection,
    completeSection,
    completeSectionWithQuestions,
    resetStudyProgress,
    completeStudy,
    hasQuestions,
  } = useStudyMode();
  

  // Só renderizar se estiver em read-only E modo dirigido
  if (!isReadOnly || !isGuidedModeActive) {
    return null;
  }

  return (
    <Card className="fixed top-4 right-4 w-80 shadow-lg border-2 border-blue-200 bg-linear-to-br from-blue-50 to-indigo-50 z-50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-blue-800">Estudo Dirigido</h3>
        </div>

        {/* Status do Modo Estudo */}
        <div className="mb-4 p-3 rounded-lg bg-white/60 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Status:</span>
            <span className={`text-sm font-semibold px-2 py-1 rounded-full ${
              isStudyModeEnabled 
                ? 'bg-green-100 text-green-700' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {isStudyModeEnabled ? '📚 Ativo' : '📖 Inativo'}
            </span>
          </div>
          
          {isStudyModeEnabled && (
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Seção atual:</span>
                <span className="font-medium">{currentSectionIndex + 1} de {totalSections}</span>
              </div>
              <div className="flex justify-between">
                <span>Concluídas:</span>
                <span className="font-medium text-green-600">{completedSections.length}</span>
              </div>
              {isLastSection && (
                <div className="text-xs text-green-600 font-medium">
                  🎉 Última seção!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controles */}
        <div className="flex gap-2">
          <Button
            onClick={toggleStudyMode}
            disabled={!canEnableStudyMode}
            className={`flex-1 flex items-center gap-2 ${
              isStudyModeEnabled
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isStudyModeEnabled ? (
              <>
                <Pause className="h-4 w-4" />
                Pausar Estudo
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Iniciar Estudo
              </>
            )}
          </Button>

          {isStudyModeEnabled && (
            <Button
              onClick={resetStudyProgress}
              variant="outline"
              size="sm"
              className="px-3"
              title="Reiniciar progresso"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Mensagem de ajuda */}
        {!canEnableStudyMode && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            💡 Para usar o estudo dirigido, ative o modo read-only (🔒) na toolbar
          </div>
        )}

        {/* Controles de navegação entre seções */}
        {isStudyModeEnabled && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              {/* Se não é a última seção OU se é a última seção mas tem perguntas */}
              {(!isLastSection || (isLastSection && hasQuestions(currentSectionIndex))) ? (
                <>
                  <Button
                    onClick={() => completeSectionWithQuestions(currentSectionIndex)}
                    disabled={false}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white flex items-center gap-2"
                    size="sm"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {hasQuestions(currentSectionIndex) ? 'Completar e Responder' : 'Completar Seção'}
                  </Button>
                  
                  {/* Só mostrar botão de pular se não for a última seção */}
                  {!isLastSection && (
                    <Button
                      onClick={goToNextSection}
                      disabled={!canGoToNextSection}
                      variant="outline"
                      size="sm"
                      className="px-3 flex items-center gap-1 disabled:opacity-50"
                      title="Pular para próxima seção"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </>
              ) : (
                /* Última seção SEM perguntas - mostrar "Concluir Estudo" */
                <Button
                  onClick={completeStudy}
                  className="flex-1 bg-linear-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white flex items-center gap-2"
                  size="sm"
                >
                  <CheckCircle className="h-4 w-4" />
                  Concluir Estudo
                </Button>
              )}
            </div>
            
            <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
              {isLastSection 
                ? (hasQuestions(currentSectionIndex) 
                    ? '🎯 Última seção! Complete as perguntas para finalizar o estudo.' 
                    : '🎯 Última seção! Clique em "Concluir Estudo" para finalizar.')
                : '📖 Complete cada seção para avançar no estudo dirigido.'
              }
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
