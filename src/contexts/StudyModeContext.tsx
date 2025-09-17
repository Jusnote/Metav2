import React, { createContext, useContext, useState, ReactNode } from 'react';

export type StudyMode = 'dirigido' | 'manual';

interface StudyModeContextType {
  studyMode: StudyMode;
  setStudyMode: (mode: StudyMode) => void;
  isGuidedMode: boolean;
}

const StudyModeContext = createContext<StudyModeContextType | undefined>(undefined);

export function StudyModeProvider({ children }: { children: ReactNode }) {
  const [studyMode, setStudyMode] = useState<StudyMode>('dirigido');

  const isGuidedMode = studyMode === 'dirigido';

  return (
    <StudyModeContext.Provider value={{
      studyMode,
      setStudyMode,
      isGuidedMode
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
