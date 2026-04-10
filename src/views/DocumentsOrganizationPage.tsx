import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { editaisQuery } from '@/lib/editais-client';

const TOPICOS_QUERY = `
  query Topicos($disciplinaId: Int!) {
    topicos(disciplinaId: $disciplinaId) { id nome ordem }
  }
`;

const DocumentsOrganizationPage = () => {
  const navigate = typeof window !== 'undefined' ? useNavigate() : null;
  const [aiDrawerOpen, setAiDrawerOpen] = React.useState(false);
  const pageContainerRef = useRef<HTMLDivElement>(null);

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
      const converted: Disciplina[] = [];
      for (const disc of apiDisciplinas) {
        const { data } = await editaisQuery<{ topicos: ApiTopico[] }>(
          TOPICOS_QUERY,
          { disciplinaId: disc.id },
        );

        if (cancelled) return;

        const topicos: Topico[] = (data?.topicos || []).map(t => ({
          id: `api-${t.id}`,
          nome: t.nome,
          date: '',
          totalAulas: 0,
          estimated_duration_minutes: 120,
          _apiId: t.id,
          _apiDisciplinaId: disc.id,
        } as any));

        converted.push({
          id: `api-${disc.id}`,
          nome: disc.nome,
          totalChapters: disc.totalTopicos,
          subject: '',
          topicos,
          _apiId: disc.id,
        } as any);
      }

      if (!cancelled) {
        setApiConvertedDisciplinas(converted);
        setLoadingApiTopicos(false);
      }
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
    <div ref={pageContainerRef} className="h-full relative overflow-hidden">
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
          <div className="mb-8 pb-6 border-b">
            <div className="text-[11px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
              {cargoData.edital.sigla || cargoData.edital.nome} · {cargoData.edital.esfera}
            </div>
            <h1 className="text-[24px] font-bold text-foreground tracking-tight mt-1">
              {cargoData.nome}
            </h1>
            <div className="text-[13px] text-muted-foreground mt-1">
              {cargoData.qtdDisciplinas} disciplinas · {cargoData.qtdTopicos} topicos
            </div>
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
                            return (
                              <div
                                key={subtopico.id}
                                onClick={() => handleSubtopicoClick(disciplina.id, topico.id, subtopico)}
                                className={`flex items-center py-[9px] px-3.5 cursor-pointer transition-colors gap-3 group
                                  ${isSelected ? 'bg-[#f0edff]' : 'hover:bg-[#f8f7fd]'}`}
                              >
                                {/* Status dot */}
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                                  subtopico.status === 'completed'
                                    ? 'bg-emerald-500'
                                    : subtopico.status === 'in-progress'
                                      ? 'bg-[#6c63ff]'
                                      : 'bg-[#d4d0de] group-hover:bg-[#6c63ff]'
                                }`} />

                                {/* Name */}
                                <div className="text-[13px] font-[550] text-[#1a1a1a] dark:text-foreground flex-1 truncate">
                                  {subtopico.nome}
                                </div>

                                {/* Meta */}
                                <div className="text-[11px] text-[#b0adb8] shrink-0">
                                  {subtopico.resumosVinculados > 0 && `${subtopico.resumosVinculados} res`}
                                  {subtopico.resumosVinculados > 0 && subtopico.questoesVinculadas > 0 && ' · '}
                                  {subtopico.questoesVinculadas > 0 && `${subtopico.questoesVinculadas} quest`}
                                </div>

                                {/* Hover action */}
                                <div className="text-[11px] font-semibold text-[#6c63ff] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
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
                    return (
                      <div
                        key={topico.id}
                        onClick={() => handleTopicoClick(disciplina.id, topico)}
                        className={`flex items-center py-[9px] px-3.5 cursor-pointer transition-colors gap-3 group
                          ${isSelected ? 'bg-[#f0edff]' : 'hover:bg-[#f8f7fd]'}`}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-[#d4d0de] shrink-0 group-hover:bg-[#6c63ff]" />
                        <div className="text-[13px] font-[550] text-[#1a1a1a] dark:text-foreground flex-1 truncate">
                          {topico.nome}
                        </div>
                        {topico.estimated_duration_minutes ? (
                          <div className="text-[11px] text-[#b0adb8] shrink-0">
                            {topico.estimated_duration_minutes >= 60
                              ? `${Math.floor(topico.estimated_duration_minutes / 60)}h ${topico.estimated_duration_minutes % 60 > 0 ? `${topico.estimated_duration_minutes % 60}m` : ''}`
                              : `${topico.estimated_duration_minutes}m`
                            }
                          </div>
                        ) : null}
                        <div className="text-[11px] font-semibold text-[#6c63ff] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
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
        container={pageContainerRef.current}
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
