"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUnitsManager, type Unit, type Topic, type Subtopic } from "@/hooks/useUnitsManager";
import { usePlateDocuments } from "@/hooks/usePlateDocuments";
import { useMaterialCounts } from "@/hooks/useMaterialCounts";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

// ============ TIPOS ============

interface NotesModalState {
  isOpen: boolean;
  subtopicId?: string | null;
  topicId?: string | null;
  title: string | null;
}

interface DocumentsModalState {
  isOpen: boolean;
  subtopicId: string | null;
  subtopicTitle: string | null;
}

interface QuickCreateModalState {
  isOpen: boolean;
  type: 'unit' | 'topic' | 'subtopic' | null;
  unitId?: string | null;
  topicId?: string | null;
}

interface EditModalState {
  isOpen: boolean;
  type: 'topic' | 'subtopic' | null;
  unitId?: string | null;
  topicId?: string | null;
  itemId?: string | null;
  itemTitle?: string;
  itemDuration?: number;
  hasSubtopics?: boolean;
}

interface DocumentsOrganizationContextType {
  // Units data & CRUD
  units: Unit[];
  addUnit: ReturnType<typeof useUnitsManager>['addUnit'];
  updateUnit: ReturnType<typeof useUnitsManager>['updateUnit'];
  deleteUnit: ReturnType<typeof useUnitsManager>['deleteUnit'];
  addTopic: ReturnType<typeof useUnitsManager>['addTopic'];
  updateTopic: ReturnType<typeof useUnitsManager>['updateTopic'];
  deleteTopic: ReturnType<typeof useUnitsManager>['deleteTopic'];
  addSubtopic: ReturnType<typeof useUnitsManager>['addSubtopic'];
  updateSubtopic: ReturnType<typeof useUnitsManager>['updateSubtopic'];
  deleteSubtopic: ReturnType<typeof useUnitsManager>['deleteSubtopic'];
  calculateTopicDuration: ReturnType<typeof useUnitsManager>['calculateTopicDuration'];

  // UI state
  isEditMode: boolean;
  setIsEditMode: (v: boolean) => void;
  expandedUnits: Set<string>;
  expandedTopics: Set<string>;
  selectedSubtopic: { unitId: string; topicId: string; subtopic: any } | null;
  setSelectedSubtopic: React.Dispatch<React.SetStateAction<{ unitId: string; topicId: string; subtopic: any } | null>>;
  selectedTopic: { unitId: string; topic: any } | null;
  setSelectedTopic: React.Dispatch<React.SetStateAction<{ unitId: string; topic: any } | null>>;
  editingUnit: string | null;
  subtopicWithScheduleButton: string | null;

  // Actions
  toggleUnitExpansion: (unitId: string) => void;
  toggleTopicExpansion: (topicId: string) => void;
  handleSubtopicSelect: (unitId: string, topicId: string, subtopic: any) => void;
  handleTopicSelect: (unitId: string, topic: any) => void;
  handleSearchSelect: (result: { type: 'unit' | 'topic' | 'subtopic'; id: string; unitId?: string; topicId?: string; item: Unit | Topic | Subtopic }) => void;
  setEditingUnit: (unitId: string | null) => void;
  setSubtopicWithScheduleButton: (id: string | null) => void;
  setExpandedUnits: React.Dispatch<React.SetStateAction<Set<string>>>;
  setExpandedTopics: React.Dispatch<React.SetStateAction<Set<string>>>;

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
  handlePlaySubtopic: (subtopicId: string, subtopicTitle: string) => void;
  handleQuickCreate: (name: string) => Promise<void>;
  handleTopicSubtopicCreate: (data: { title: string; estimated_duration_minutes: number }) => Promise<void>;
  handleTopicSubtopicEdit: (data: { title: string; estimated_duration_minutes: number }) => Promise<void>;
  handleToggleSubtopicComplete: (unitId: string, topicId: string, subtopicId: string, completed: boolean) => Promise<void>;

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
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [selectedSubtopic, setSelectedSubtopic] = useState<{ unitId: string; topicId: string; subtopic: any } | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<{ unitId: string; topic: any } | null>(null);
  const [editingUnit, setEditingUnit] = useState<string | null>(null);
  const [subtopicWithScheduleButton, setSubtopicWithScheduleButton] = useState<string | null>(null);

  // Modals
  const [notesModal, setNotesModal] = useState<NotesModalState>({ isOpen: false, subtopicId: null, topicId: null, title: null });
  const [documentsModal, setDocumentsModal] = useState<DocumentsModalState>({ isOpen: false, subtopicId: null, subtopicTitle: null });
  const [quickCreateModal, setQuickCreateModal] = useState<QuickCreateModalState>({ isOpen: false, type: null, unitId: null, topicId: null });
  const [editModal, setEditModal] = useState<EditModalState>({ isOpen: false, type: null, unitId: null, topicId: null, itemId: null, itemTitle: '', itemDuration: 0, hasSubtopics: false });
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);

  const { createDocument } = usePlateDocuments();

  const { counts: materialCounts } = useMaterialCounts(
    selectedSubtopic?.subtopic.id,
    selectedSubtopic ? undefined : selectedTopic?.topic.id
  );

  const {
    units, addUnit, updateUnit, deleteUnit,
    addTopic, updateTopic, deleteTopic,
    addSubtopic, updateSubtopic, deleteSubtopic,
    calculateTopicDuration,
  } = useUnitsManager();

  // Auto-expand first unit
  useEffect(() => {
    if (units.length > 0 && expandedUnits.size === 0) {
      setExpandedUnits(new Set([units[0].id]));
    }
  }, [units, expandedUnits]);

  const toggleUnitExpansion = useCallback((unitId: string) => {
    setExpandedUnits(prev => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  }, []);

  const toggleTopicExpansion = useCallback((topicId: string) => {
    setExpandedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
  }, []);

  const handleSubtopicSelect = useCallback((unitId: string, topicId: string, subtopic: any) => {
    setSelectedSubtopic({ unitId, topicId, subtopic });
    setSelectedTopic(null);
  }, []);

  const handleTopicSelect = useCallback((unitId: string, topic: any) => {
    setSelectedTopic({ unitId, topic });
    setSelectedSubtopic(null);
  }, []);

  const handleSearchSelect = useCallback((result: { type: 'unit' | 'topic' | 'subtopic'; id: string; unitId?: string; topicId?: string; item: Unit | Topic | Subtopic }) => {
    if (result.unitId) {
      setExpandedUnits(prev => new Set(prev).add(result.unitId!));
    }
    if (result.type === 'subtopic' && result.topicId) {
      setExpandedTopics(prev => new Set(prev).add(result.topicId!));
    }
    if (result.type === 'subtopic' && result.unitId && result.topicId) {
      handleSubtopicSelect(result.unitId, result.topicId, result.item);
    } else if (result.type === 'topic' && result.unitId) {
      handleTopicSelect(result.unitId, result.item);
    } else if (result.type === 'unit') {
      setExpandedUnits(prev => new Set(prev).add(result.id));
    }
  }, [handleSubtopicSelect, handleTopicSelect]);

  const handlePlaySubtopic = useCallback((subtopicId: string, subtopicTitle: string) => {
    setDocumentsModal({ isOpen: true, subtopicId, subtopicTitle });
  }, []);

  const handleQuickCreate = useCallback(async (name: string) => {
    const { type } = quickCreateModal;
    if (type === 'unit') {
      const newUnit = await addUnit(name, 'Novo Assunto');
      if (newUnit) {
        setExpandedUnits(prev => new Set(prev).add(newUnit));
      }
    }
    setQuickCreateModal({ isOpen: false, type: null, unitId: null, topicId: null });
  }, [quickCreateModal, addUnit]);

  const handleTopicSubtopicCreate = useCallback(async (data: { title: string; estimated_duration_minutes: number }) => {
    const { type, unitId, topicId } = quickCreateModal;
    if (type === 'topic' && unitId) {
      const newTopic = await addTopic(unitId, data.title, data.estimated_duration_minutes);
      setExpandedUnits(prev => new Set(prev).add(unitId));
      if (newTopic) {
        setExpandedTopics(prev => new Set(prev).add(newTopic));
      }
    } else if (type === 'subtopic' && unitId && topicId) {
      await addSubtopic(unitId, topicId, data.title, data.estimated_duration_minutes);
      setExpandedUnits(prev => new Set(prev).add(unitId));
      setExpandedTopics(prev => new Set(prev).add(topicId));
    }
    setQuickCreateModal({ isOpen: false, type: null, unitId: null, topicId: null });
  }, [quickCreateModal, addTopic, addSubtopic]);

  const handleTopicSubtopicEdit = useCallback(async (data: { title: string; estimated_duration_minutes: number }) => {
    const { type, unitId, topicId, itemId } = editModal;
    if (type === 'topic' && unitId && itemId) {
      const updates: any = { title: data.title };
      if (data.estimated_duration_minutes !== undefined) updates.estimated_duration_minutes = data.estimated_duration_minutes;
      await updateTopic(unitId, itemId, updates);
    } else if (type === 'subtopic' && unitId && topicId && itemId) {
      const updates: any = { title: data.title };
      if (data.estimated_duration_minutes !== undefined) updates.estimated_duration_minutes = data.estimated_duration_minutes;
      await updateSubtopic(unitId, topicId, itemId, updates);
    }
    setEditModal({ isOpen: false, type: null, unitId: null, topicId: null, itemId: null, itemTitle: '', itemDuration: 0, hasSubtopics: false });
  }, [editModal, updateTopic, updateSubtopic]);

  const handleToggleSubtopicComplete = useCallback(async (unitId: string, topicId: string, subtopicId: string, completed: boolean) => {
    await updateSubtopic(unitId, topicId, subtopicId, { status: completed ? 'completed' : 'not-started' });
  }, [updateSubtopic]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      { key: 'n', ctrl: true, handler: () => { if (isEditMode) setQuickCreateModal({ isOpen: true, type: 'unit', unitId: null, topicId: null }); } },
      { key: 't', ctrl: true, handler: () => { if (isEditMode && expandedUnits.size > 0) { const firstUnit = Array.from(expandedUnits)[0]; setQuickCreateModal({ isOpen: true, type: 'topic', unitId: firstUnit, topicId: null }); } } },
      { key: 's', ctrl: true, shift: true, handler: () => { if (isEditMode && expandedTopics.size > 0 && expandedUnits.size > 0) { setQuickCreateModal({ isOpen: true, type: 'subtopic', unitId: Array.from(expandedUnits)[0], topicId: Array.from(expandedTopics)[0] }); } } },
      { key: 'e', ctrl: true, handler: () => { setIsEditMode(prev => !prev); } },
    ],
    enabled: true,
  });

  return (
    <DocumentsOrganizationContext.Provider value={{
      units, addUnit, updateUnit, deleteUnit,
      addTopic, updateTopic, deleteTopic,
      addSubtopic, updateSubtopic, deleteSubtopic,
      calculateTopicDuration,
      isEditMode, setIsEditMode,
      expandedUnits, expandedTopics,
      selectedSubtopic, setSelectedSubtopic, selectedTopic, setSelectedTopic,
      editingUnit, subtopicWithScheduleButton,
      toggleUnitExpansion, toggleTopicExpansion,
      handleSubtopicSelect, handleTopicSelect,
      handleSearchSelect,
      setEditingUnit, setSubtopicWithScheduleButton,
      setExpandedUnits, setExpandedTopics,
      notesModal, setNotesModal,
      documentsModal, setDocumentsModal,
      quickCreateModal, setQuickCreateModal,
      editModal, setEditModal,
      goalDialogOpen, setGoalDialogOpen,
      handlePlaySubtopic, handleQuickCreate,
      handleTopicSubtopicCreate, handleTopicSubtopicEdit,
      handleToggleSubtopicComplete,
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
