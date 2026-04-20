import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDocumentsOrganization } from '@/contexts/DocumentsOrganizationContext';
import { NotesModal } from '../components/NotesModal';
import { SubtopicDocumentsModal } from '../components/SubtopicDocumentsModal';
import { QuickCreateModal } from '../components/QuickCreateModal';
import { TopicSubtopicCreateModal } from '../components/TopicSubtopicCreateModal';
import { GoalCreationDialog } from '../components/goals/GoalCreationDialog';
import { TopicAIAssistant } from '../components/TopicAIAssistant';
import { TopicDetailDrawer } from '../components/documents-organization/TopicDetailDrawer';
import { CronogramaWeekView } from '@/components/documents-organization/CronogramaWeekView';
import type { Topico, Subtopico, Disciplina } from '@/hooks/useDisciplinasManager';
import { useDisciplinasApi, useCargoData, type ApiTopico } from '@/hooks/useEditaisData';
import { useLocalProgressBatch } from '@/hooks/useLocalProgress';
import { usePlanosEstudo } from '@/hooks/usePlanosEstudo';
import { useScoreEngine } from '@/hooks/useScoreEngine';
import { BasicScoreDisplay } from '@/components/documents-organization/BasicScoreDisplay';
import { editaisQuery } from '@/lib/editais-client';
import { toast } from 'sonner';

const TOPICOS_QUERY = `
  query Topicos($disciplinaId: Int!) {
    topicos(disciplinaId: $disciplinaId) { id fonteId nome ordem }
  }
`;

const DocumentsOrganizationPage = () => {
  const navigate = typeof window !== 'undefined' ? useNavigate() : null;
  const [aiDrawerOpen, setAiDrawerOpen] = React.useState(false);

  // ---- Edital mode detection ----
  const [searchParams] = useSearchParams();
  const editalIdParam = searchParams.get('editalId');
  const cargoIdParam = searchParams.get('cargoId');

  const editalId = editalIdParam ? Number(editalIdParam) : null;
  const cargoId = cargoIdParam ? Number(cargoIdParam) : null;
  const isEditalMode = !!editalId && !!cargoId;

  // ---- API data (only fetched when in edital mode) ----
  const { data: apiDisciplinas, isLoading: apiLoading } = useDisciplinasApi(isEditalMode ? cargoId : null);
  const { data: cargoData } = useCargoData(editalId, cargoId);
  const { findPlanoByEdital, createPlano } = usePlanosEstudo();
  const existingPlano = editalId && cargoId ? findPlanoByEdital(editalId, cargoId) : null;

  const [apiConvertedDisciplinas, setApiConvertedDisciplinas] = useState<Disciplina[]>([]);
  const [loadingApiTopicos, setLoadingApiTopicos] = useState(false);

  useEffect(() => {
    if (!isEditalMode || !apiDisciplinas || apiDisciplinas.length === 0) {
      setApiConvertedDisciplinas([]);
      return;
    }

    let cancelled = false;
    setLoadingApiTopicos(true);

    (async () => {
      const topicosResults = await Promise.all(
        apiDisciplinas.map(disc =>
          editaisQuery<{ topicos: ApiTopico[] }>(TOPICOS_QUERY, { disciplinaId: disc.id })
        )
      );

      if (cancelled) return;

      const converted: Disciplina[] = apiDisciplinas.map((disc, index) => {
        const result = topicosResults[index];
        const topicos: Topico[] = (result.data?.topicos || []).map(t => ({
          id: `api-${t.id}`,
          nome: t.nome,
          date: '',
          totalAulas: 0,
          estimated_duration_minutes: 120,
          _originRef: t.fonteId || t.id,
          _originDisciplinaRef: disc.fonteId || disc.id,
        } as any));

        return {
          id: `api-${disc.id}`,
          nome: disc.nome,
          totalChapters: disc.totalTopicos,
          subject: '',
          topicos,
          _originRef: disc.fonteId || disc.id,
        } as any;
      });

      setApiConvertedDisciplinas(converted);
      setLoadingApiTopicos(false);
    })();

    return () => { cancelled = true; };
  }, [isEditalMode, apiDisciplinas]);

  // Detail drawer state
  const [drawerDetail, setDrawerDetail] = useState<{
    type: 'topico' | 'subtopico';
    disciplinaId: string;
    topicoId?: string;
    item: Topico | Subtopico;
    disciplinaNome: string;
    topicoNome?: string;
  } | null>(null);

  const {
    disciplinas, selectedSubtopic, selectedTopic,
    notesModal, setNotesModal,
    documentsModal, setDocumentsModal,
    quickCreateModal, setQuickCreateModal,
    editModal, setEditModal,
    goalDialogOpen, setGoalDialogOpen,
    handlePlaySubtopico, handleQuickCreate,
    handleTopicSubtopicCreate, handleTopicSubtopicEdit,
    handleSubtopicoSelect, handleTopicoSelect,
    createDocument, materialCounts,
    calculateTopicDuration,
    setSelectedSubtopic, setSelectedTopic,
    cronogramaMode, setCronogramaMode,
  } = useDocumentsOrganization();

  // ---- Choose data source ----
  const displayDisciplinas = isEditalMode ? apiConvertedDisciplinas : disciplinas;
  const isLoadingContent = isEditalMode ? (apiLoading || loadingApiTopicos) : false;

  // ---- Batch progress for all topics ----
  const allOriginRefs = useMemo(() => {
    return displayDisciplinas.flatMap(d =>
      (d.topicos || []).map((t: any) => t._originRef).filter((ref: any): ref is number => typeof ref === 'number')
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayDisciplinas.map(d => d.id).join(',')]);

  const { progressMap: _progressMap, refetch: refetchListProgress } = useLocalProgressBatch(allOriginRefs);
  const progressMap = _progressMap instanceof Map ? _progressMap : new Map();

  // ---- Score engine ----
  const scoreData = useMemo(() => {
    if (progressMap.size === 0) return [];
    return displayDisciplinas.flatMap(d =>
      d.topicos
        .filter(t => {
          const ref = (t as any)._originRef;
          return ref && progressMap.has(ref);
        })
        .map(t => {
          const ref = (t as any)._originRef;
          const prog = progressMap.get(ref)!;
          return {
            disciplinaNome: d.nome,
            peso_edital: prog.peso_edital || null,
            mastery_score: prog.mastery_score || 0,
          };
        })
    );
  }, [displayDisciplinas, progressMap]);

  const scoreProjection = useScoreEngine(scoreData);

  // Handle topico click -> open drawer
  const handleTopicoClick = useCallback((disciplinaId: string, topico: Topico) => {
    handleTopicoSelect(disciplinaId, topico);
    const disciplina = disciplinas.find(u => u.id === disciplinaId);
    setDrawerDetail({
      type: 'topico',
      disciplinaId,
      item: topico,
      disciplinaNome: disciplina?.nome || '',
    });
  }, [handleTopicoSelect, disciplinas]);

  // Handle subtopico click -> open drawer
  const handleSubtopicoClick = useCallback((disciplinaId: string, topicoId: string, subtopico: Subtopico) => {
    handleSubtopicoSelect(disciplinaId, topicoId, subtopico);
    const disciplina = disciplinas.find(u => u.id === disciplinaId);
    const topico = disciplina?.topicos.find(t => t.id === topicoId);
    setDrawerDetail({
      type: 'subtopico',
      disciplinaId,
      topicoId,
      item: subtopico,
      disciplinaNome: disciplina?.nome || '',
      topicoNome: topico?.nome || '',
    });
  }, [handleSubtopicoSelect, disciplinas]);

  // Close drawer
  const handleCloseDrawer = useCallback(() => {
    setDrawerDetail(null);
    setSelectedSubtopic(null);
    setSelectedTopic(null);
  }, [setSelectedSubtopic, setSelectedTopic]);

  // Notes from drawer
  const handleOpenNotes = useCallback((id: string, title: string, type: 'topico' | 'subtopico') => {
    if (type === 'subtopico') {
      setNotesModal({ isOpen: true, subtopicId: id, topicId: null, title });
    } else {
      setNotesModal({ isOpen: true, subtopicId: null, topicId: id, title });
    }
  }, [setNotesModal]);

  const handleOpenAI = useCallback(() => {
    setAiDrawerOpen(true);
  }, []);

  return (
    <div className="h-full relative bg-white dark:bg-background">
      <div className="h-full overflow-y-auto">
      {/* ===== EDITAL / CRONOGRAMA TOGGLE ===== */}
      <div className="max-w-5xl mx-auto px-8 pt-5 pb-0">
        <div className="flex items-center justify-between">
          <div className="flex bg-[#f5f3ff] rounded-[9px] p-[2.5px]">
            <button
              onClick={() => setCronogramaMode(false)}
              className={`px-4 py-[5px] rounded-[7px] text-xs font-medium transition-all ${
                !cronogramaMode
                  ? 'bg-[#6c63ff] text-white font-semibold shadow-[0_1px_4px_rgba(108,99,255,0.25)]'
                  : 'text-[#9e99ae]'
              }`}
            >
              Edital
            </button>
            <button
              onClick={() => setCronogramaMode(true)}
              className={`px-4 py-[5px] rounded-[7px] text-xs font-medium transition-all ${
                cronogramaMode
                  ? 'bg-[#6c63ff] text-white font-semibold shadow-[0_1px_4px_rgba(108,99,255,0.25)]'
                  : 'text-[#9e99ae]'
              }`}
            >
              Cronograma
            </button>
          </div>
        </div>
      </div>

      {cronogramaMode ? (
        <CronogramaWeekView />
      ) : (
      <div className="max-w-5xl mx-auto flex gap-0 py-6 px-8">

        {/* ===== TOC LEFT ===== */}
        <nav className="w-[180px] shrink-0 pr-6 sticky top-6 self-start">
          <div className="flex items-center gap-2 mb-4 text-muted-foreground">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
            <span className="text-[13px] font-medium text-foreground">Navegacao rapida</span>
          </div>
          <div className="space-y-0.5 border-l border-border/50 ml-[7px]">
            {displayDisciplinas.map((disciplina) => (
              <button
                key={disciplina.id}
                onClick={() => {
                  const el = document.getElementById(`discipline-${disciplina.id}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="w-full text-left pl-4 pr-2 py-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors truncate block -ml-px border-l-2 border-transparent hover:border-foreground"
              >
                {disciplina.nome}
              </button>
            ))}
          </div>
        </nav>

        {/* ===== MAIN CONTENT ===== */}
        <div className="flex-1 min-w-0">

        {isLoadingContent && (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <div className="animate-spin w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full mx-auto mb-3" />
              <p className="text-sm">Carregando edital...</p>
            </div>
          </div>
        )}

        {!isLoadingContent && displayDisciplinas.length === 0 && (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <p className="text-sm">Nenhuma disciplina encontrada</p>
          </div>
        )}

        {isEditalMode && cargoData && (
          <div className="mb-8 pb-6 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-5">
              {/* Cargo icon */}
              {cargoData.edital.logoUrl ? (
                <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 shadow-lg">
                  <img src={cargoData.edital.logoUrl} alt={cargoData.edital.sigla || cargoData.edital.nome} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6c63ff] to-[#4f46e5] flex items-center justify-center shrink-0 shadow-lg shadow-[#6c63ff]/20">
                  <span className="text-white font-bold text-[13px] tracking-wide leading-none">
                    {(cargoData.edital.sigla || cargoData.edital.nome.substring(0, 3)).toUpperCase()}
                  </span>
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold tracking-[0.12em] text-[#6c63ff] uppercase">
                    {cargoData.edital.sigla || cargoData.edital.nome}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">·</span>
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {cargoData.edital.esfera}
                  </span>
                </div>
                <h1 className="text-[22px] font-bold text-foreground tracking-tight mt-0.5 leading-tight">
                  {cargoData.nome}
                </h1>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                    <span>{cargoData.qtdDisciplinas} disciplinas</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    <span>{cargoData.qtdTopicos} topicos</span>
                  </div>
                </div>
              </div>

              {/* Plan CTA or Badge */}
              <div className="shrink-0 mt-1">
                {existingPlano ? (
                  <span className="text-[11px] text-[#6c63ff] font-medium bg-[#f5f3ff] px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {existingPlano.nome}
                  </span>
                ) : (
                  <button
                    onClick={async () => {
                      const nome = `${cargoData.edital.sigla || cargoData.edital.nome} — ${cargoData.nome}`;
                      const plano = await createPlano({
                        nome,
                        edital_id: editalId!,
                        cargo_id: cargoId!,
                        source_type: 'edital',
                        study_mode: 'edital',
                      });
                      if (plano) {
                        toast.success('Plano de estudo criado!');
                      } else {
                        toast.error('Erro ao criar plano.');
                      }
                    }}
                    className="px-4 py-2 bg-[#6c63ff] hover:bg-[#5b54e0] text-white text-[11px] font-semibold rounded-lg transition-colors shadow-sm"
                  >
                    Criar Plano de Estudo
                  </button>
                )}
              </div>
            </div>

            {/* Nota estimada */}
            {scoreProjection.current > 0 && scoreData.length >= 2 && (
              <div className="mt-4 ml-[76px]">
                <BasicScoreDisplay score={scoreProjection.current} targetScore={80} />
              </div>
            )}
          </div>
        )}

        <div className="space-y-10">
          {displayDisciplinas.map((disciplina) => {
            // Stats
            const topicoCount = disciplina.topicos.length;
            const allSubs = disciplina.topicos.flatMap(t => t.subtopicos || []);
            const completedSubs = allSubs.filter(s => s.status === 'completed').length;
            const totalMins = disciplina.topicos.reduce((acc, t) => acc + calculateTopicDuration(t), 0);
            const h = Math.floor(totalMins / 60);
            const m = totalMins % 60;
            const timeStr = totalMins > 0
              ? h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
              : '';

            return (
              <div key={disciplina.id} id={`discipline-${disciplina.id}`}>
                {/* Discipline header */}
                <div className="mb-5">
                  <span className="text-[11px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                    {disciplina.subject || 'Disciplina'}
                  </span>
                  <h2 className="text-[28px] font-bold text-foreground tracking-tight leading-tight mt-0.5">
                    {disciplina.nome}
                  </h2>
                  <div className="flex items-center gap-3 mt-1.5">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
                        <path strokeLinecap="round" strokeWidth="1.5" d="M12 6v6l4 2"/>
                      </svg>
                      <span className="text-[13px]">Total: {timeStr || '0m'}</span>
                    </div>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="text-[13px] text-blue-600 font-medium">
                      Nivel: Intermediario
                    </span>
                  </div>

                  {/* Progress bar inline */}
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wide">Estudante</span>
                    <div className="flex-1 max-w-[280px] h-[5px] bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-700 ease-out"
                        style={{ width: allSubs.length > 0 ? `${Math.round((completedSubs / allSubs.length) * 100)}%` : '0%' }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-foreground uppercase tracking-wide">Especialista</span>
                  </div>
                </div>

                {/* Topicos list - cargo style */}
                <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
                  {disciplina.topicos.map((topico) => {
                    const hasSubtopicos = topico.subtopicos && topico.subtopicos.length > 0;

                    if (hasSubtopicos) {
                      // Render topico header + subtopicos
                      return (
                        <div key={topico.id}>
                          {/* Topico group header */}
                          <div className="px-4 py-2.5 bg-muted/30">
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                              {topico.nome}
                            </span>
                          </div>

                          {/* Subtopicos as cargo-style rows */}
                          {topico.subtopicos!.map((subtopico) => {
                            const isSelected = drawerDetail?.type === 'subtopico' && drawerDetail.item.id === subtopico.id;
                            const subOriginRef = (subtopico as any)._originRef as number | undefined;
                            const subProgress = subOriginRef ? progressMap.get(subOriginRef) : null;
                            const subDotColor = subProgress
                              ? subProgress.learning_stage === 'mastered' ? 'bg-emerald-500'
                                : subProgress.learning_stage === 'maintaining' ? 'bg-emerald-400'
                                : subProgress.mastery_score > 0 ? 'bg-[#6c63ff]'
                                : 'bg-[#d4d0de] group-hover:bg-[#6c63ff]'
                              : subtopico.status === 'completed'
                                ? 'bg-emerald-500'
                                : subtopico.status === 'in-progress'
                                  ? 'bg-[#6c63ff]'
                                  : 'bg-[#d4d0de] group-hover:bg-[#6c63ff]';
                            return (
                              <div
                                key={subtopico.id}
                                onClick={() => handleSubtopicoClick(disciplina.id, topico.id, subtopico)}
                                className={`flex items-start py-[9px] px-3.5 cursor-pointer transition-colors gap-3 group
                                  ${isSelected ? 'bg-[#f0edff]' : 'hover:bg-[#f8f7fd]'}`}
                              >
                                {/* Status dot */}
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors mt-[7px] ${subDotColor}`} />

                                {/* Name + progress bar */}
                                <div className="flex-1">
                                  <div className="text-[14px] font-medium text-[#1a1a1a] dark:text-foreground text-justify">
                                    {subtopico.nome}
                                  </div>
                                  {subProgress && subProgress.mastery_score > 0 && (
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <div className="flex-1 max-w-[120px] h-[3px] bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-[#6c63ff] rounded-full transition-all duration-500" style={{ width: `${Math.round(subProgress.mastery_score)}%` }} />
                                      </div>
                                      <span className="text-[10px] font-medium text-[#6c63ff]">{Math.round(subProgress.mastery_score)}%</span>
                                    </div>
                                  )}
                                </div>

                                {/* Hover action */}
                                <div className="text-[11px] font-semibold text-[#6c63ff] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-[2px]">
                                  Estudar →
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    // Topico without subtopicos - render as single row
                    const isSelected = drawerDetail?.type === 'topico' && drawerDetail.item.id === topico.id;
                    const originRef = (topico as any)._originRef as number | undefined;
                    const topicProgress = originRef ? progressMap.get(originRef) : null;
                    const dotColor = topicProgress
                      ? topicProgress.learning_stage === 'mastered' ? 'bg-emerald-500'
                        : topicProgress.learning_stage === 'maintaining' ? 'bg-emerald-400'
                        : topicProgress.mastery_score > 0 ? 'bg-[#6c63ff]'
                        : 'bg-[#d4d0de] group-hover:bg-[#6c63ff]'
                      : 'bg-[#d4d0de] group-hover:bg-[#6c63ff]';
                    return (
                      <div
                        key={topico.id}
                        onClick={() => handleTopicoClick(disciplina.id, topico)}
                        className={`flex items-start py-[9px] px-3.5 cursor-pointer transition-colors gap-3 group
                          ${isSelected ? 'bg-[#f0edff]' : 'hover:bg-[#f8f7fd]'}`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors mt-[7px] ${dotColor}`} />
                        <div className="flex-1">
                          <div className="text-[14px] font-medium text-[#1a1a1a] dark:text-foreground text-justify">
                            {topico.nome}
                          </div>
                          {topicProgress && topicProgress.mastery_score > 0 && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="flex-1 max-w-[120px] h-[3px] bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-[#6c63ff] rounded-full transition-all duration-500" style={{ width: `${Math.round(topicProgress.mastery_score)}%` }} />
                              </div>
                              <span className="text-[10px] font-medium text-[#6c63ff]">{Math.round(topicProgress.mastery_score)}%</span>
                            </div>
                          )}
                        </div>
                        <div className="text-[11px] font-semibold text-[#6c63ff] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-[2px]">
                          Estudar →
                        </div>
                      </div>
                    );
                  })}

                  {disciplina.topicos.length === 0 && (
                    <div className="px-4 py-6 text-center text-[12px] text-muted-foreground">
                      Nenhum topico nesta disciplina
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
      )}

      </div>{/* end scroll container */}

      {/* ===== RIGHT DRAWER / BOTTOM SHEET (absolute within relative wrapper) ===== */}
      <TopicDetailDrawer
        detail={drawerDetail}
        onClose={handleCloseDrawer}
        materialCounts={materialCounts}
        onOpenNotes={handleOpenNotes}
        onOpenAI={handleOpenAI}
        onPlaySubtopico={handlePlaySubtopico}
      />

      {/* ===== AI Assistant ===== */}
      <TopicAIAssistant
        open={aiDrawerOpen}
        onOpenChange={setAiDrawerOpen}
        context={{
          topicTitle: selectedTopic?.topico.nome || selectedSubtopic?.subtopico.nome,
          subtopicTitle: selectedSubtopic?.subtopico.nome,
          level: 'Proficiente',
          lastAccess: (selectedSubtopic?.subtopico as any)?.lastAccess || (selectedTopic?.topico as any)?.lastAccess || undefined,
          timeInvested: (() => {
            const mins = (selectedSubtopic?.subtopico as any)?.tempoInvestido || (selectedTopic?.topico as any)?.tempoInvestido || 0;
            if (!mins || mins === 0) return 'Nenhum';
            const hh = Math.floor(Number(mins) / 60);
            const mm = Number(mins) % 60;
            return hh > 0 ? `${hh}h ${mm}min` : `${mm}min`;
          })(),
          reviews: '15/01: 85%, 12/01: 78%',
        }}
      />

      {/* ===== MODALS ===== */}
      <NotesModal
        isOpen={notesModal.isOpen}
        onClose={() => setNotesModal({ isOpen: false, subtopicId: null, topicId: null, title: null })}
        subtopicId={notesModal.subtopicId || undefined}
        topicId={notesModal.topicId || undefined}
        title={notesModal.title || ''}
      />

      {documentsModal.isOpen && documentsModal.subtopicId && (
        <SubtopicDocumentsModal
          isOpen={documentsModal.isOpen}
          onClose={() => setDocumentsModal({ isOpen: false, subtopicId: null, subtopicTitle: null })}
          subtopicId={documentsModal.subtopicId}
          subtopicTitle={documentsModal.subtopicTitle || ''}
          onSelectDocument={(docId) => {
            navigate?.(`/plate-editor?doc=${docId}&subtopic=${documentsModal.subtopicId}&title=${encodeURIComponent(documentsModal.subtopicTitle || '')}`);
          }}
          onCreateNew={async () => {
            const newDoc = await createDocument({
              title: `Resumo: ${documentsModal.subtopicTitle}`,
              content: [{ type: 'p', children: [{ text: '' }] }],
              content_text: '',
              subtopico_id: documentsModal.subtopicId!,
            });
            if (newDoc) {
              navigate?.(`/plate-editor?doc=${newDoc.id}&subtopic=${documentsModal.subtopicId}&title=${encodeURIComponent(documentsModal.subtopicTitle || '')}`);
            }
          }}
        />
      )}

      {quickCreateModal.type === 'disciplina' && (
        <QuickCreateModal
          isOpen={quickCreateModal.isOpen}
          onClose={() => setQuickCreateModal({ isOpen: false, type: null, disciplinaId: null, topicoId: null })}
          onSave={handleQuickCreate}
          title="Nova Disciplina"
          placeholder="Digite o nome da disciplina..."
        />
      )}

      {(quickCreateModal.type === 'topico' || quickCreateModal.type === 'subtopico') && (
        <TopicSubtopicCreateModal
          isOpen={quickCreateModal.isOpen}
          onClose={() => setQuickCreateModal({ isOpen: false, type: null, disciplinaId: null, topicoId: null })}
          onSave={handleTopicSubtopicCreate}
          type={quickCreateModal.type}
          hasSubtopicos={false}
          calculatedDuration={0}
        />
      )}

      <GoalCreationDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
      />

      {editModal.isOpen && editModal.type && (
        <TopicSubtopicCreateModal
          isOpen={editModal.isOpen}
          onClose={() => setEditModal({ isOpen: false, type: null, disciplinaId: null, topicoId: null, itemId: null, itemTitle: '', itemDuration: 0, hasSubtopicos: false })}
          onSave={handleTopicSubtopicEdit}
          type={editModal.type}
          hasSubtopicos={editModal.hasSubtopicos || false}
          calculatedDuration={editModal.type === 'topico' && editModal.hasSubtopicos ? calculateTopicDuration(
            disciplinas.find(u => u.id === editModal.disciplinaId)?.topicos.find(t => t.id === editModal.itemId) || {} as any
          ) : 0}
          mode="edit"
          initialTitle={editModal.itemTitle}
          initialDuration={editModal.itemDuration}
        />
      )}
    </div>
  );
};

export default DocumentsOrganizationPage;
