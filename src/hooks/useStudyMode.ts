import { useState, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $isElementNode } from 'lexical';
import { $isHeadingNode } from '@lexical/rich-text';
import { useStudyMode as useGlobalStudyModeContext } from '@/contexts/StudyModeContext';
import { useQuestions } from '@/contexts/QuestionsContext';
import { QuestionResponse } from '@/types/questions';

export interface StudyModeState {
  isReadOnly: boolean;
  isStudyModeEnabled: boolean;
  canEnableStudyMode: boolean;
  currentSectionIndex: number;
  completedSections: string[];
  isGuidedModeActive: boolean;
}

export function useStudyMode() {
  const [editor] = useLexicalComposerContext();
  const { 
    isGuidedMode, 
    isStudyModeEnabled, 
    setIsStudyModeEnabled,
    currentSectionIndex,
    setCurrentSectionIndex,
    completedSections,
    setCompletedSections,
    showCompletionToast,
    setShowCompletionToast,
    showQuestionModal,
    setShowQuestionModal,
    pendingSectionIndex,
    setPendingSectionIndex
  } = useGlobalStudyModeContext();
  const [isReadOnly, setIsReadOnly] = useState(() => !editor.isEditable());
  const [totalSections, setTotalSections] = useState(0);
  
  // Hook para gerenciar perguntas
  const { getQuestionsForSection, hasQuestions } = useQuestions();

  // Função para contar total de seções H1
  const countH1Sections = () => {
    return editor.getEditorState().read(() => {
      const root = $getRoot();
      let h1Count = 0;
      
      function countH1InNode(node: any) {
        if ($isHeadingNode(node) && node.getTag() === 'h1') {
          h1Count++;
        }
        
        if ($isElementNode(node)) {
          const children = node.getChildren();
          children.forEach(countH1InNode);
        }
      }
      
      const children = root.getChildren();
      children.forEach(countH1InNode);
      
      console.log('📊 Total de seções H1 encontradas:', h1Count);
      return h1Count;
    });
  };

  // Atualizar contagem de seções quando o editor mudar
  useEffect(() => {
    const updateSectionCount = () => {
      const count = countH1Sections();
      setTotalSections(count);
    };

    // Contar inicialmente
    updateSectionCount();

    // Escutar mudanças no editor
    const unregister = editor.registerUpdateListener(() => {
      updateSectionCount();
    });

    return unregister;
  }, [editor]);

  // Escutar mudanças no estado read-only
  useEffect(() => {
    const unregister = editor.registerEditableListener((editable) => {
      const newIsReadOnly = !editable;
      setIsReadOnly(newIsReadOnly);
      
      console.log('📚 Estado read-only mudou:', newIsReadOnly);
      
      // Se saiu do read-only, desativar modo estudo
      if (!newIsReadOnly && isStudyModeEnabled) {
        console.log('🔓 Saindo do read-only, desativando modo estudo');
        setIsStudyModeEnabled(false);
        setCurrentSectionIndex(0);
        setCompletedSections([]);
      }
    });

    return unregister;
  }, [editor, isStudyModeEnabled]);

  // Escutar mudanças no modo de estudo global
  useEffect(() => {
    console.log('🎓 Modo de estudo global mudou:', isGuidedMode ? 'DIRIGIDO' : 'MANUAL');
    
    // Se mudou para manual, desativar modo estudo
    if (!isGuidedMode && isStudyModeEnabled) {
      console.log('📖 Mudou para modo manual, desativando estudo dirigido');
      setIsStudyModeEnabled(false);
      setCurrentSectionIndex(0);
      setCompletedSections([]);
    }
  }, [isGuidedMode, isStudyModeEnabled]);

  // Só pode habilitar se: read-only E modo dirigido
  const canEnableStudyMode = isReadOnly && isGuidedMode;

  const toggleStudyMode = () => {
    if (!canEnableStudyMode) {
      const reason = !isReadOnly ? 'não está em read-only' : 'não está em modo dirigido';
      console.log(`❌ Não pode habilitar modo estudo (${reason})`);
      return;
    }

    const newStudyMode = !isStudyModeEnabled;
    setIsStudyModeEnabled(newStudyMode);
    
    console.log('📚 Modo estudo:', newStudyMode ? 'ATIVADO' : 'DESATIVADO');
    
    if (newStudyMode) {
      // Reset ao ativar
      setCurrentSectionIndex(0);
      setCompletedSections([]);
    }
  };

  const completeSection = (sectionKey: string) => {
    if (!completedSections.includes(sectionKey)) {
      setCompletedSections(prev => [...prev, sectionKey]);
      console.log('✅ Seção completada:', sectionKey);
    }
  };

  const goToNextSection = () => {
    setCurrentSectionIndex(prev => {
      const nextIndex = prev + 1;
      
      // Verificar se não excede o total de seções
      if (nextIndex >= totalSections) {
        console.log('🚫 Não é possível avançar: já na última seção');
        return prev; // Manter índice atual
      }
      
      console.log('➡️ Próxima seção:', nextIndex);
      return nextIndex;
    });
  };

  // Completar seção com verificação de perguntas
  const completeSectionWithQuestions = (sectionIndex: number) => {
    console.log('🎯 Completando seção:', sectionIndex, 'tem perguntas:', hasQuestions(sectionIndex));
    
    // Debug: verificar perguntas disponíveis
    const questionsForSection = getQuestionsForSection(sectionIndex);
    console.log('🔍 Perguntas encontradas para seção', sectionIndex, ':', questionsForSection);
    
    // Marcar seção como completa
    const sectionKey = `section-${sectionIndex}`;
    completeSection(sectionKey);
    
    // Verificar se há perguntas para esta seção
    if (hasQuestions(sectionIndex)) {
      console.log('❓ Seção tem perguntas, abrindo modal');
      console.log('🔧 Definindo pendingSectionIndex:', sectionIndex);
      console.log('🔧 Definindo showQuestionModal:', true);
      setPendingSectionIndex(sectionIndex);
      setShowQuestionModal(true);
      console.log('✅ Estados definidos - pendingSectionIndex:', sectionIndex, 'showQuestionModal:', true);
    } else {
      console.log('📖 Seção sem perguntas, avançando diretamente');
      // Se não há perguntas, avançar diretamente
      if (sectionIndex < totalSections - 1) {
        goToNextSection();
      }
    }
  };

  // Callback quando perguntas são completadas
  const handleQuestionsComplete = (responses: QuestionResponse[]) => {
    console.log('✅ Perguntas completadas:', responses);
    setShowQuestionModal(false);
    setPendingSectionIndex(null);
    
    // Se é a última seção, finalizar o estudo
    if (pendingSectionIndex !== null && pendingSectionIndex >= totalSections - 1) {
      console.log('🎉 Última seção completada com perguntas, finalizando estudo');
      completeStudy();
    } 
    // Senão, avançar para próxima seção
    else if (pendingSectionIndex !== null && pendingSectionIndex < totalSections - 1) {
      goToNextSection();
    }
  };

  // Callback quando perguntas são puladas
  const handleQuestionsSkip = () => {
    console.log('⏭️ Perguntas puladas');
    setShowQuestionModal(false);
    setPendingSectionIndex(null);
    
    // Se é a última seção, finalizar o estudo
    if (pendingSectionIndex !== null && pendingSectionIndex >= totalSections - 1) {
      console.log('🎉 Última seção pulada, finalizando estudo');
      completeStudy();
    } 
    // Senão, avançar para próxima seção
    else if (pendingSectionIndex !== null && pendingSectionIndex < totalSections - 1) {
      goToNextSection();
    }
  };

  // Verificar se pode avançar para próxima seção
  const canGoToNextSection = currentSectionIndex < totalSections - 1;
  
  // Verificar se é a última seção
  const isLastSection = currentSectionIndex >= totalSections - 1;

  const resetStudyProgress = () => {
    setCurrentSectionIndex(0);
    setCompletedSections([]);
    console.log('🔄 Progresso do estudo resetado');
  };

  const completeStudy = () => {
    console.log('🎯 completeStudy chamada, showCompletionToast atual:', showCompletionToast);
    
    // Marcar última seção como completa
    const currentSectionKey = `section-${currentSectionIndex}`;
    completeSection(currentSectionKey);
    
    // Mostrar toast de conclusão PRIMEIRO
    console.log('📢 Definindo showCompletionToast para true (GLOBAL)');
    setShowCompletionToast(true);
    
    console.log('🎉 Estudo concluído! Parabéns!');
    
    // Mostrar todo o conteúdo novamente após um delay maior para dar tempo do toast aparecer
    setTimeout(() => {
      console.log('📖 Desativando modo estudo');
      setIsStudyModeEnabled(false);
    }, 1500);
    
    // Resetar progresso para próximo estudo (após o toast desaparecer)
    setTimeout(() => {
      console.log('🔄 Resetando progresso');
      setCurrentSectionIndex(0);
      setCompletedSections([]);
      setShowCompletionToast(false); // Garantir que o toast seja ocultado
    }, 5000);
  };

  const hideCompletionToast = () => {
    setShowCompletionToast(false);
  };

  return {
    // Estado
    isReadOnly,
    isStudyModeEnabled,
    canEnableStudyMode,
    currentSectionIndex,
    completedSections,
    isGuidedModeActive: isGuidedMode,
    totalSections,
    canGoToNextSection,
    isLastSection,
    showCompletionToast,
    
    // Estados do modal de perguntas
    showQuestionModal,
    pendingSectionIndex,
    
    // Ações
    toggleStudyMode,
    completeSection,
    goToNextSection,
    completeSectionWithQuestions,
    resetStudyProgress,
    completeStudy,
    hideCompletionToast,
    
    // Ações do modal de perguntas
    handleQuestionsComplete,
    handleQuestionsSkip,
    getQuestionsForSection,
    hasQuestions,
  };
}
