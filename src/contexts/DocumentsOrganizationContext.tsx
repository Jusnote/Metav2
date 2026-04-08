"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDisciplinasManager, type Disciplina, type Topico, type Subtopico } from "@/hooks/useDisciplinasManager";
import { usePlateDocuments } from "@/hooks/usePlateDocuments";
import { useMaterialCounts } from "@/hooks/useMaterialCounts";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

// ============ TIPOS ============

interface NotesModalState {
  isOpen: boolean;
  subtopicoId?: string | null;
  topicoId?: string | null;
  title: string | null;
}

interface DocumentsModalState {
  isOpen: boolean;
  subtopicoId: string | null;
  subtopicoTitle: string | null;
}

interface QuickCreateModalState {
  isOpen: boolean;
  type: 'disciplina' | 'topico' | 'subtopico' | null;
  disciplinaId?: string | null;
  topicoId?: string | null;
}

interface EditModalState {
  isOpen: boolean;
  type: 'topico' | 'subtopico' | null;
  disciplinaId?: string | null;
  topicoId?: string | null;
  itemId?: string | null;
  itemTitle?: string;
  itemDuration?: number;
  hasSubtopicos?: boolean;
}

interface DocumentsOrganizationContextType {
  // Disciplinas data & CRUD
  disciplinas: Disciplina[];
  addDisciplina: ReturnType<typeof useDisciplinasManager>['addDisciplina'];
  updateDisciplina: ReturnType<typeof useDisciplinasManager>['updateDisciplina'];
  deleteDisciplina: ReturnType<typeof useDisciplinasManager>['deleteDisciplina'];
  addTopico: ReturnType<typeof useDisciplinasManager>['addTopico'];
  updateTopico: ReturnType<typeof useDisciplinasManager>['updateTopico'];
  deleteTopico: ReturnType<typeof useDisciplinasManager>['deleteTopico'];
  addSubtopico: ReturnType<typeof useDisciplinasManager>['addSubtopico'];
  updateSubtopico: ReturnType<typeof useDisciplinasManager>['updateSubtopico'];
  deleteSubtopico: ReturnType<typeof useDisciplinasManager>['deleteSubtopico'];
  calculateTopicDuration: ReturnType<typeof useDisciplinasManager>['calculateTopicDuration'];

  // UI state
  isEditMode: boolean;
  setIsEditMode: (v: boolean) => void;
  expandedDisciplinas: Set<string>;
  expandedTopicos: Set<string>;
  selectedSubtopic: { disciplinaId: string; topicoId: string; subtopico: any } | null;
  setSelectedSubtopic: React.Dispatch<React.SetStateAction<{ disciplinaId: string; topicoId: string; subtopico: any } | null>>;
  selectedTopic: { disciplinaId: string; topico: any } | null;
  setSelectedTopic: React.Dispatch<React.SetStateAction<{ disciplinaId: string; topico: any } | null>>;
  editingDisciplina: string | null;
  subtopicoWithScheduleButton: string | null;

  // Actions
  toggleDisciplinaExpansion: (disciplinaId: string) => void;
  toggleTopicoExpansion: (topicoId: string) => void;
  handleSubtopicoSelect: (disciplinaId: string, topicoId: string, subtopico: any) => void;
  handleTopicoSelect: (disciplinaId: string, topico: any) => void;
  handleSearchSelect: (result: { type: 'disciplina' | 'topico' | 'subtopico'; id: string; disciplinaId?: string; topicoId?: string; item: Disciplina | Topico | Subtopico }) => void;
  setEditingDisciplina: (disciplinaId: string | null) => void;
  setSubtopicoWithScheduleButton: (id: string | null) => void;
  setExpandedDisciplinas: React.Dispatch<React.SetStateAction<Set<string>>>;
  setExpandedTopicos: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Modals
  notesModal: NotesModalState;
  setNotesModal: (state: NotesModalState) => void;
  documentsModal: DocumentsModalState;
  setDocumentsModal: (state: DocumentsModalState) => void;
  quickCreateModal: QuickCreateModalState;
  setQuickCreateModal: (state: QuickCreateModalState) => void;
  editModal: EditModalState;
  setEditModal: (state: EditModalState) => void;
  goalDialogOpen: boolean;
  setGoalDialogOpen: (open: boolean) => void;

  // Handlers
  handlePlaySubtopico: (subtopicoId: string, subtopicoTitle: string) => void;
  handleQuickCreate: (name: string) => Promise<void>;
  handleTopicSubtopicCreate: (data: { title: string; estimated_duration_minutes: number }) => Promise<void>;
  handleTopicSubtopicEdit: (data: { title: string; estimated_duration_minutes: number }) => Promise<void>;
  handleToggleSubtopicoComplete: (disciplinaId: string, topicoId: string, subtopicoId: string, completed: boolean) => Promise<void>;

  // Documents
  createDocument: ReturnType<typeof usePlateDocuments>['createDocument'];
  materialCounts: ReturnType<typeof useMaterialCounts>['counts'];
}

const DocumentsOrganizationContext = createContext<DocumentsOrganizationContextType | null>(null);

export function DocumentsOrganizationProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isDocsRoute = location.pathname.startsWith('/documents-organization');

  if (!isDocsRoute) {
    return <>{children}</>;
  }

  return <DocumentsOrganizationProviderInner>{children}</DocumentsOrganizationProviderInner>;
}

function DocumentsOrganizationProviderInner({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  // UI state
  const [isEditMode, setIsEditMode] = useState(false);
  const [expandedDisciplinas, setExpandedDisciplinas] = useState<Set<string>>(new Set());
  const [expandedTopicos, setExpandedTopicos] = useState<Set<string>>(new Set());
  const [selectedSubtopic, setSelectedSubtopic] = useState<{ disciplinaId: string; topicoId: string; subtopico: any } | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<{ disciplinaId: string; topico: any } | null>(null);
  const [editingDisciplina, setEditingDisciplina] = useState<string | null>(null);
  const [subtopicoWithScheduleButton, setSubtopicoWithScheduleButton] = useState<string | null>(null);

  // Modals
  const [notesModal, setNotesModal] = useState<NotesModalState>({ isOpen: false, subtopicoId: null, topicoId: null, title: null });
  const [documentsModal, setDocumentsModal] = useState<DocumentsModalState>({ isOpen: false, subtopicoId: null, subtopicoTitle: null });
  const [quickCreateModal, setQuickCreateModal] = useState<QuickCreateModalState>({ isOpen: false, type: null, disciplinaId: null, topicoId: null });
  const [editModal, setEditModal] = useState<EditModalState>({ isOpen: false, type: null, disciplinaId: null, topicoId: null, itemId: null, itemTitle: '', itemDuration: 0, hasSubtopicos: false });
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);

  const { createDocument } = usePlateDocuments();

  const { counts: materialCounts } = useMaterialCounts(
    selectedSubtopic?.subtopico.id,
    selectedSubtopic ? undefined : selectedTopic?.topico.id
  );

  const {
    disciplinas, addDisciplina, updateDisciplina, deleteDisciplina,
    addTopico, updateTopico, deleteTopico,
    addSubtopico, updateSubtopico, deleteSubtopico,
    calculateTopicDuration,
  } = useDisciplinasManager();

  // Auto-expand first disciplina
  useEffect(() => {
    if (disciplinas.length > 0 && expandedDisciplinas.size === 0) {
      setExpandedDisciplinas(new Set([disciplinas[0].id]));
    }
  }, [disciplinas, expandedDisciplinas]);

  const toggleDisciplinaExpansion = useCallback((disciplinaId: string) => {
    setExpandedDisciplinas(prev => {
      const next = new Set(prev);
      if (next.has(disciplinaId)) next.delete(disciplinaId);
      else next.add(disciplinaId);
      return next;
    });
  }, []);

  const toggleTopicoExpansion = useCallback((topicoId: string) => {
    setExpandedTopicos(prev => {
      const next = new Set(prev);
      if (next.has(topicoId)) next.delete(topicoId);
      else next.add(topicoId);
      return next;
    });
  }, []);

  const handleSubtopicoSelect = useCallback((disciplinaId: string, topicoId: string, subtopico: any) => {
    setSelectedSubtopic({ disciplinaId, topicoId, subtopico });
    setSelectedTopic(null);
  }, []);

  const handleTopicoSelect = useCallback((disciplinaId: string, topico: any) => {
    setSelectedTopic({ disciplinaId, topico });
    setSelectedSubtopic(null);
  }, []);

  const handleSearchSelect = useCallback((result: { type: 'disciplina' | 'topico' | 'subtopico'; id: string; disciplinaId?: string; topicoId?: string; item: Disciplina | Topico | Subtopico }) => {
    if (result.disciplinaId) {
      setExpandedDisciplinas(prev => new Set(prev).add(result.disciplinaId!));
    }
    if (result.type === 'subtopico' && result.topicoId) {
      setExpandedTopicos(prev => new Set(prev).add(result.topicoId!));
    }
    if (result.type === 'subtopico' && result.disciplinaId && result.topicoId) {
      handleSubtopicoSelect(result.disciplinaId, result.topicoId, result.item);
    } else if (result.type === 'topico' && result.disciplinaId) {
      handleTopicoSelect(result.disciplinaId, result.item);
    } else if (result.type === 'disciplina') {
      setExpandedDisciplinas(prev => new Set(prev).add(result.id));
    }
  }, [handleSubtopicoSelect, handleTopicoSelect]);

  const handlePlaySubtopico = useCallback((subtopicoId: string, subtopicoTitle: string) => {
    setDocumentsModal({ isOpen: true, subtopicoId, subtopicoTitle });
  }, []);

  const handleQuickCreate = useCallback(async (name: string) => {
    const { type } = quickCreateModal;
    if (type === 'disciplina') {
      const newDisciplina = await addDisciplina(name, 'Novo Assunto');
      if (newDisciplina) {
        setExpandedDisciplinas(prev => new Set(prev).add(newDisciplina));
      }
    }
    setQuickCreateModal({ isOpen: false, type: null, disciplinaId: null, topicoId: null });
  }, [quickCreateModal, addDisciplina]);

  const handleTopicSubtopicCreate = useCallback(async (data: { title: string; estimated_duration_minutes: number }) => {
    const { type, disciplinaId, topicoId } = quickCreateModal;
    if (type === 'topico' && disciplinaId) {
      const newTopico = await addTopico(disciplinaId, data.title, data.estimated_duration_minutes);
      setExpandedDisciplinas(prev => new Set(prev).add(disciplinaId));
      if (newTopico) {
        setExpandedTopicos(prev => new Set(prev).add(newTopico));
      }
    } else if (type === 'subtopico' && disciplinaId && topicoId) {
      await addSubtopico(disciplinaId, topicoId, data.title, data.estimated_duration_minutes);
      setExpandedDisciplinas(prev => new Set(prev).add(disciplinaId));
      setExpandedTopicos(prev => new Set(prev).add(topicoId));
    }
    setQuickCreateModal({ isOpen: false, type: null, disciplinaId: null, topicoId: null });
  }, [quickCreateModal, addTopico, addSubtopico]);

  const handleTopicSubtopicEdit = useCallback(async (data: { title: string; estimated_duration_minutes: number }) => {
    const { type, disciplinaId, topicoId, itemId } = editModal;
    if (type === 'topico' && disciplinaId && itemId) {
      const updates: any = { title: data.title };
      if (data.estimated_duration_minutes !== undefined) updates.estimated_duration_minutes = data.estimated_duration_minutes;
      await updateTopico(disciplinaId, itemId, updates);
    } else if (type === 'subtopico' && disciplinaId && topicoId && itemId) {
      const updates: any = { title: data.title };
      if (data.estimated_duration_minutes !== undefined) updates.estimated_duration_minutes = data.estimated_duration_minutes;
      await updateSubtopico(disciplinaId, topicoId, itemId, updates);
    }
    setEditModal({ isOpen: false, type: null, disciplinaId: null, topicoId: null, itemId: null, itemTitle: '', itemDuration: 0, hasSubtopicos: false });
  }, [editModal, updateTopico, updateSubtopico]);

  const handleToggleSubtopicoComplete = useCallback(async (disciplinaId: string, topicoId: string, subtopicoId: string, completed: boolean) => {
    await updateSubtopico(disciplinaId, topicoId, subtopicoId, { status: completed ? 'completed' : 'not-started' });
  }, [updateSubtopico]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      { key: 'n', ctrl: true, handler: () => { if (isEditMode) setQuickCreateModal({ isOpen: true, type: 'disciplina', disciplinaId: null, topicoId: null }); } },
      { key: 't', ctrl: true, handler: () => { if (isEditMode && expandedDisciplinas.size > 0) { const firstDisciplina = Array.from(expandedDisciplinas)[0]; setQuickCreateModal({ isOpen: true, type: 'topico', disciplinaId: firstDisciplina, topicoId: null }); } } },
      { key: 's', ctrl: true, shift: true, handler: () => { if (isEditMode && expandedTopicos.size > 0 && expandedDisciplinas.size > 0) { setQuickCreateModal({ isOpen: true, type: 'subtopico', disciplinaId: Array.from(expandedDisciplinas)[0], topicoId: Array.from(expandedTopicos)[0] }); } } },
      { key: 'e', ctrl: true, handler: () => { setIsEditMode(prev => !prev); } },
    ],
    enabled: true,
  });

  return (
    <DocumentsOrganizationContext.Provider value={{
      disciplinas, addDisciplina, updateDisciplina, deleteDisciplina,
      addTopico, updateTopico, deleteTopico,
      addSubtopico, updateSubtopico, deleteSubtopico,
      calculateTopicDuration,
      isEditMode, setIsEditMode,
      expandedDisciplinas, expandedTopicos,
      selectedSubtopic, setSelectedSubtopic, selectedTopic, setSelectedTopic,
      editingDisciplina, subtopicoWithScheduleButton,
      toggleDisciplinaExpansion, toggleTopicoExpansion,
      handleSubtopicoSelect, handleTopicoSelect,
      handleSearchSelect,
      setEditingDisciplina, setSubtopicoWithScheduleButton,
      setExpandedDisciplinas, setExpandedTopicos,
      notesModal, setNotesModal,
      documentsModal, setDocumentsModal,
      quickCreateModal, setQuickCreateModal,
      editModal, setEditModal,
      goalDialogOpen, setGoalDialogOpen,
      handlePlaySubtopico, handleQuickCreate,
      handleTopicSubtopicCreate, handleTopicSubtopicEdit,
      handleToggleSubtopicoComplete,
      createDocument, materialCounts,
    }}>
      {children}
    </DocumentsOrganizationContext.Provider>
  );
}

export function useDocumentsOrganization() {
  const ctx = useContext(DocumentsOrganizationContext);
  if (!ctx) throw new Error("useDocumentsOrganization must be used within DocumentsOrganizationProvider on a /documents-organization route");
  return ctx;
}

export function useDocumentsOrganizationOptional() {
  return useContext(DocumentsOrganizationContext);
}
