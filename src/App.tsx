import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { AppHeader } from "./components/AppHeader";
import { NavigationHeader } from "./components/NavigationHeader";
import { StudyModeProvider } from "./contexts/StudyModeContext";
import { QuestionsProvider } from "./contexts/QuestionsContext";
import { TimerProvider } from "./contexts/TimerContext";
import { StudyConfigProvider } from "./contexts/StudyConfigContext";

import HomePage from "./views/HomePage";
import Index from "./views/Index";
import StudyPage from "./views/StudyPage";
import EditResumoPage from "./views/EditResumoPage";
import ResumosListPage from "./views/ResumosListPage";
import QuestoesPage from "./views/QuestoesPage";
import CriarQuestaoPage from "./views/CriarQuestaoPage";
import CronogramaPage from "./views/CronogramaPage";
import AuthPage from "./views/AuthPage";
import NotFound from "./views/NotFound";
import EditorPage from "./views/EditorPage";
import PlateEditorPage from "./components/pages/PlateEditorPage";

import DocumentsOrganizationPage from "./views/DocumentsOrganizationPage";
import NotesPage from "./views/NotesPage";
import GoalsPage from "./views/GoalsPage";
import { useAuth } from "./hooks/useAuth";
import GlobalTimer from "./components/GlobalTimer";
import React, { useState } from "react";
// import { TestScheduleHooks } from "./components/TestScheduleHooks";
import { TimeEstimateInputTest } from "./components/goals/TimeEstimateInputTest";

const queryClient = new QueryClient();

const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Carregando...</div>; // Ou um spinner de carregamento
  }

  return isAuthenticated ? children : <Navigate to="/auth" replace />;
};

const AppContent = () => {
  const location = typeof window !== 'undefined' ? useLocation() : null;
  const searchParams = new URLSearchParams(location?.search || '');
  const [isTimerVisible, setIsTimerVisible] = useState(false);
  
  // Detectar modo de estudo
  const isStudyMode = location?.pathname === '/flashcards' && searchParams.has('study');
  
  // Expor função para mostrar/esconder timer globalmente
  React.useEffect(() => {
    (window as any).showGlobalTimer = () => setIsTimerVisible(true);
    (window as any).hideGlobalTimer = () => setIsTimerVisible(false);
    
    return () => {
      delete (window as any).showGlobalTimer;
      delete (window as any).hideGlobalTimer;
    };
  }, [setIsTimerVisible]);
  
  if (isStudyMode) {
    // Modo de foco - sem sidebar e header
    return (
      <div className="w-full h-screen bg-background">
        <main className="h-full">
          <Outlet />
        </main>
        <GlobalTimer 
          isVisible={isTimerVisible} 
          onActivityComplete={(_activity, _duration) => {
            // Completar atividade atual via contexto
            (window as any).timerContext?.completeCurrentActivity?.();
          }}
        />
      </div>
    );
  }
  
  // Modo normal - com header horizontal
  return (
    <div className="w-full h-screen bg-background flex flex-col">
      <AppHeader />
      <NavigationHeader />
      <main className="flex-1 overflow-auto" style={{ 
        paddingBottom: isTimerVisible ? '80px' : '0' 
      }}>
        <Outlet />
      </main>
      <GlobalTimer 
        isVisible={isTimerVisible} 
        onActivityComplete={(_activity, _duration) => {
          // Completar atividade atual via contexto
          (window as any).timerContext?.completeCurrentActivity?.();
        }}
      />
    </div>
  );
};

const App = () => {
  // Only render BrowserRouter on the client side
  if (typeof window === 'undefined') {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <TimerProvider>
            <StudyModeProvider>
              <QuestionsProvider>
                <Toaster />
                <Sonner />
                <div>Loading...</div>
              </QuestionsProvider>
            </StudyModeProvider>
          </TimerProvider>
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <StudyConfigProvider>
          <TimerProvider>
            <StudyModeProvider>
              <QuestionsProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                <Routes>
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/" element={<AppContent />}>
                    <Route index element={<PrivateRoute><HomePage /></PrivateRoute>} />
                    <Route path="flashcards" element={<PrivateRoute><Index /></PrivateRoute>} />
                    <Route path="resumos-list" element={<PrivateRoute><ResumosListPage /></PrivateRoute>} />
                    <Route path="resumos" element={<PrivateRoute><EditResumoPage /></PrivateRoute>} />
                    <Route path="study" element={<PrivateRoute><StudyPage /></PrivateRoute>} />
                    <Route path="cronograma" element={<PrivateRoute><CronogramaPage /></PrivateRoute>} />
                    <Route path="questoes" element={<PrivateRoute><QuestoesPage /></PrivateRoute>} />
                    <Route path="criar-questao" element={<PrivateRoute><CriarQuestaoPage /></PrivateRoute>} />
                    <Route path="playground" element={<PrivateRoute><EditorPage /></PrivateRoute>} />
                    <Route path="plate-editor" element={<PrivateRoute><PlateEditorPage /></PrivateRoute>} />

                    <Route path="documents-organization" element={<PrivateRoute><DocumentsOrganizationPage /></PrivateRoute>} />
                    <Route path="notes" element={<PrivateRoute><NotesPage /></PrivateRoute>} />
                    {/* <Route path="test-schedule" element={<PrivateRoute><TestScheduleHooks /></PrivateRoute>} /> */}
                    <Route path="test-time-input" element={<PrivateRoute><TimeEstimateInputTest /></PrivateRoute>} />
                    <Route path="goals" element={<PrivateRoute><GoalsPage /></PrivateRoute>} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
              </QuestionsProvider>
            </StudyModeProvider>
          </TimerProvider>
        </StudyConfigProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

