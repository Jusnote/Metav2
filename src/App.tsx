import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./components/AppSidebar";
import { AppHeaderCompact } from "./components/AppHeaderCompact";
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
import LeiSecaPage from "./views/LeiSecaPage";
import LeiSecaTestPage from "./views/LeiSecaTestPage";
import LeiSecaTestV3Page from "./views/LeiSecaTestV3Page";
import ImportLeiPage from "./views/ImportLeiPage";
import ImportLeiV2Page from "./views/ImportLeiV2Page";
import { LeiSecaProvider } from "./contexts/LeiSecaContext";
import { DocumentsOrganizationProvider } from "./contexts/DocumentsOrganizationContext";
import { QuestoesProvider } from "./contexts/QuestoesContext";
import { CadernosProvider } from "./contexts/CadernosContext";

import DocumentsOrganizationPage from "./views/DocumentsOrganizationPage";
import CadernosPage from "./views/CadernosPage";
import NotesPage from "./views/NotesPage";
import GoalsPage from "./views/GoalsPage";
import { useAuth } from "./hooks/useAuth";
import { useVisualViewport } from '@/hooks/useVisualViewport';
import GlobalTimer from "./components/GlobalTimer";
import React, { useState } from "react";
// import { TestScheduleHooks } from "./components/TestScheduleHooks";
import { TimeEstimateInputTest } from "./components/goals/TimeEstimateInputTest";
import { ModerationShell } from './components/moderation/layout/ModerationShell';
import { ModerationRoute } from './components/moderation/layout/ModerationRoute';
import { OverviewPage } from './components/moderation/overview/OverviewPage';
import { ReportsPage } from './components/moderation/reports/ReportsPage';
import { UsersPage } from './components/moderation/users/UsersPage';
import { QuestionsReportsPage } from './components/moderation/questions/QuestionsReportsPage';
import { LeiReportsPage } from './components/moderation/lei-seca/LeiReportsPage';

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

  // Detectar páginas full-width (sem padding no main)
  const isFullWidth = (location?.pathname?.startsWith('/lei-seca') || location?.pathname?.startsWith('/documents-organization') || location?.pathname?.startsWith('/cadernos')) ?? false;
  
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
  
  // Modo normal - sidebar envolve o conteúdo (3 containers aninhados)
  return (
    <CadernosProvider>
    <QuestoesProvider>
    <LeiSecaProvider>
    <DocumentsOrganizationProvider>
    <AppSidebar>
      <AppHeaderCompact />
      <main className={`flex-1 overflow-auto ${isFullWidth ? 'p-0' : 'p-6'}`} style={{
        paddingBottom: isTimerVisible ? '80px' : isFullWidth ? '0' : '24px'
      }}>
        <Outlet />
      </main>
      <GlobalTimer
        isVisible={isTimerVisible}
        onActivityComplete={(_activity, _duration) => {
          (window as any).timerContext?.completeCurrentActivity?.();
        }}
      />
    </AppSidebar>
    </DocumentsOrganizationProvider>
    </LeiSecaProvider>
    </QuestoesProvider>
    </CadernosProvider>
  );
};

const App = () => {
  useVisualViewport();

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
                    {/* Lei Seca - rotas dinâmicas */}
                    <Route path="lei-seca" element={<PrivateRoute><LeiSecaPage /></PrivateRoute>} />
                    <Route path="lei-seca/:leiId" element={<PrivateRoute><LeiSecaPage /></PrivateRoute>} />
                    <Route path="lei-seca/:leiId/:slug" element={<PrivateRoute><LeiSecaPage /></PrivateRoute>} />
                    <Route path="lei-seca-test" element={<PrivateRoute><LeiSecaTestPage /></PrivateRoute>} />
                    <Route path="lei-seca-test-v3" element={<PrivateRoute><LeiSecaTestV3Page /></PrivateRoute>} />
                    <Route path="admin/importar-lei" element={<PrivateRoute><ImportLeiPage /></PrivateRoute>} />
                    <Route path="admin/importar-lei-v2" element={<PrivateRoute><ImportLeiV2Page /></PrivateRoute>} />

                    {/* Caderno Temático */}
                    <Route path="cadernos" element={<PrivateRoute><CadernosPage /></PrivateRoute>} />

                    <Route path="documents-organization" element={<PrivateRoute><DocumentsOrganizationPage /></PrivateRoute>} />
                    <Route path="notes" element={<PrivateRoute><NotesPage /></PrivateRoute>} />
                    {/* <Route path="test-schedule" element={<PrivateRoute><TestScheduleHooks /></PrivateRoute>} /> */}
                    <Route path="test-time-input" element={<PrivateRoute><TimeEstimateInputTest /></PrivateRoute>} />
                    <Route path="goals" element={<PrivateRoute><GoalsPage /></PrivateRoute>} />
                  </Route>
                  {/* Moderation Panel — separate layout */}
                  <Route
                    path="/moderacao"
                    element={
                      <PrivateRoute>
                        <ModerationRoute>
                          <ModerationShell />
                        </ModerationRoute>
                      </PrivateRoute>
                    }
                  >
                    <Route index element={<OverviewPage />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="usuarios" element={<UsersPage />} />
                    <Route path="questoes" element={<QuestionsReportsPage />} />
                    <Route path="lei-seca" element={<LeiReportsPage />} />
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

