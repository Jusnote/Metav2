import React, { createContext, useContext, useState, ReactNode } from 'react';

export type StudyMode = 'dirigido' | 'manual';

interface StudyModeContextType {
  studyMode: StudyMode;
  setStudyMode: (mode: StudyMode) => void;
  isGuidedMode: boolean;
  // Adicionar estado global do estudo dirigido
  isStudyModeEnabled: boolean;
  setIsStudyModeEnabled: (enabled: boolean) => void;
  currentSectionIndex: number;
  setCurrentSectionIndex: (index: number) => void;
  completedSections: string[];
  setCompletedSections: (sections: string[]) => void;
  showCompletionToast: boolean;
  setShowCompletionToast: (show: boolean) => void;
  // Estados do modal de perguntas
  showQuestionModal: boolean;
  setShowQuestionModal: (show: boolean) => void;
  pendingSectionIndex: number | null;
  setPendingSectionIndex: (index: number | null) => void;
}

const StudyModeContext = createContext<StudyModeContextType | undefined>(undefined);

export function StudyModeProvider({ children }: { children: ReactNode }) {
  const [studyMode, setStudyMode] = useState<StudyMode>('dirigido');
  const [isStudyModeEnabled, setIsStudyModeEnabled] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [completedSections, setCompletedSections] = useState<string[]>([]);
  const [showCompletionToast, setShowCompletionToast] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [pendingSectionIndex, setPendingSectionIndex] = useState<number | null>(null);

  const isGuidedMode = studyMode === 'dirigido';

  return (
    <StudyModeContext.Provider value={{
      studyMode,
      setStudyMode,
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
    }}>
      {children}
    </StudyModeContext.Provider>
  );
}

export function useStudyMode() {
  const context = useContext(StudyModeContext);
  if (context === undefined) {
    throw new Error('useStudyMode must be used within a StudyModeProvider');
  }
  return context;
}
