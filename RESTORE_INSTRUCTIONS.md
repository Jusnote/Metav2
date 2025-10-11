# Instruções para Restaurar DocumentsOrganizationPage

## ⚠️ O que foi perdido no git checkout:

1. Sistema de documentos Plate.js (navegação pelo subtópico)
2. Modal QuickCreateModal (substituindo prompt())
3. Modal SubtopicDocumentsModal
4. HierarchySearch component
5. HierarchyBreadcrumbs component
6. Atalhos de teclado (useKeyboardShortcuts)
7. Contadores dinâmicos (useMaterialCounts)
8. Integração com UnitItem, TopicItem, SubtopicItem

## ✅ O que NÃO foi perdido (ainda existe):

- src/components/UnitItem.tsx
- src/components/TopicItem.tsx
- src/components/SubtopicItem.tsx
- src/components/MaterialBadge.tsx
- src/components/ProgressBar.tsx
- src/components/QuickCreateModal.tsx
- src/components/HierarchySearch.tsx
- src/components/HierarchyBreadcrumbs.tsx
- src/components/SubtopicDocumentsModal.tsx
- src/hooks/useHierarchyProgress.ts
- src/hooks/useMaterialCounts.ts
- src/hooks/useKeyboardShortcuts.ts
- src/hooks/usePlateDocuments.ts

## 🔧 Mudanças necessárias em DocumentsOrganizationPage.tsx:

### 1. Imports (substituir linhas 1-10):

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FileText, HelpCircle, Play, CreditCard, Edit3, Trash2 } from 'lucide-react';
import { useUnitsManager } from '../hooks/useUnitsManager';
import { InlineEditor } from '../components/InlineEditor';
import { EditModeToggle } from '../components/EditModeToggle';

import { usePlateDocuments } from '../hooks/usePlateDocuments';
import { NotesModal } from '../components/NotesModal';
import { SubtopicDocumentsModal } from '../components/SubtopicDocumentsModal';
import { QuickCreateModal } from '../components/QuickCreateModal';
import { HierarchySearch } from '../components/HierarchySearch';
import { HierarchyBreadcrumbs } from '../components/HierarchyBreadcrumbs';
import { MaterialBadgesGroup } from '../components/MaterialBadge';
import { ProgressBar } from '../components/ProgressBar';
import { UnitItem } from '../components/UnitItem';
import { TopicItem } from '../components/TopicItem';
import { SubtopicItem } from '../components/SubtopicItem';
import { useMaterialCounts } from '../hooks/useMaterialCounts';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
```

### 2. Estados adicionais (adicionar após linha 23):

```typescript
// Estado para modal de documentos
const [documentsModal, setDocumentsModal] = useState<{
  isOpen: boolean;
  subtopicId: string | null;
  subtopicTitle: string | null;
}>({
  isOpen: false,
  subtopicId: null,
  subtopicTitle: null
});

// Estado para modal de criação rápida
const [quickCreateModal, setQuickCreateModal] = useState<{
  isOpen: boolean;
  type: 'unit' | 'topic' | 'subtopic' | null;
  unitId?: string | null;
  topicId?: string | null;
}>({
  isOpen: false,
  type: null,
  unitId: null,
  topicId: null
});
```

### 3. Hooks (substituir useAuth e useDocuments):

```typescript
const { getDocumentsBySubtopic, createDocument } = usePlateDocuments();
const navigate = useNavigate();

// Hook para contagens de materiais
const { counts: materialCounts } = useMaterialCounts(
  selectedSubtopic?.subtopic.id,
  selectedSubtopic ? undefined : selectedTopic?.topic.id
);
```

### 4. Handler handlePlaySubtopic (substituir função completa):

```typescript
const handlePlaySubtopic = async (subtopicId: string, subtopicTitle: string) => {
  console.log('🎯 handlePlaySubtopic:', { subtopicId, subtopicTitle });

  const subtopicDocs = getDocumentsBySubtopic(subtopicId);
  console.log('📄 Documentos encontrados:', subtopicDocs.length, subtopicDocs);

  // SEMPRE mostrar o modal
  console.log('📋 Abrindo modal de documentos');
  setDocumentsModal({
    isOpen: true,
    subtopicId,
    subtopicTitle
  });
};
```

### 5. Adicionar novos handlers (após handlePlaySubtopic):

```typescript
// Handler para criação via QuickCreateModal
const handleQuickCreate = async (name: string) => {
  const { type, unitId, topicId } = quickCreateModal;

  if (type === 'unit') {
    await addUnit(name, 'Novo Assunto');
  } else if (type === 'topic' && unitId) {
    await addTopic(unitId, name);
  } else if (type === 'subtopic' && unitId && topicId) {
    await addSubtopic(unitId, topicId, name);
  }

  setQuickCreateModal({ isOpen: false, type: null, unitId: null, topicId: null });
};

// Handler para marcar/desmarcar subtópico como concluído
const handleToggleSubtopicComplete = async (
  unitId: string,
  topicId: string,
  subtopicId: string,
  completed: boolean
) => {
  await updateSubtopic(unitId, topicId, subtopicId, {
    status: completed ? 'completed' : 'not-started'
  });
};

// Handler para seleção de resultados da busca
const handleSearchSelect = (result: any) => {
  if (result.unitId) {
    setExpandedUnits(prev => new Set(prev).add(result.unitId));
  }

  if (result.type === 'subtopic' && result.topicId) {
    setExpandedTopics(prev => new Set(prev).add(result.topicId));
  }

  if (result.type === 'subtopic') {
    handleSubtopicSelect(result.unitId, result.topicId, result.item);
  } else if (result.type === 'topic') {
    handleTopicSelect(result.unitId, result.item);
  } else if (result.type === 'unit') {
    setExpandedUnits(prev => new Set(prev).add(result.id));
  }
};
```

### 6. Atalhos de teclado (adicionar antes do useEffect):

```typescript
// Atalhos de teclado
useKeyboardShortcuts({
  shortcuts: [
    {
      key: 'n',
      ctrl: true,
      handler: () => {
        if (isEditMode) {
          setQuickCreateModal({ isOpen: true, type: 'unit', unitId: null, topicId: null });
        }
      }
    },
    {
      key: 't',
      ctrl: true,
      handler: () => {
        if (isEditMode && expandedUnits.size > 0) {
          const firstExpandedUnitId = Array.from(expandedUnits)[0];
          setQuickCreateModal({ isOpen: true, type: 'topic', unitId: firstExpandedUnitId, topicId: null });
        }
      }
    },
    {
      key: 's',
      ctrl: true,
      shift: true,
      handler: () => {
        if (isEditMode && expandedTopics.size > 0 && expandedUnits.size > 0) {
          const firstExpandedUnitId = Array.from(expandedUnits)[0];
          const firstExpandedTopicId = Array.from(expandedTopics)[0];
          setQuickCreateModal({
            isOpen: true,
            type: 'subtopic',
            unitId: firstExpandedUnitId,
            topicId: firstExpandedTopicId
          });
        }
      }
    },
    {
      key: 'e',
      ctrl: true,
      handler: () => {
        setIsEditMode(prev => !prev);
      }
    }
  ],
  enabled: true
});
```

### 7. Na sidebar, adicionar HierarchySearch (no header após EditModeToggle):

```typescript
{/* Search Bar */}
<HierarchySearch
  units={units}
  onSelect={handleSearchSelect}
/>
```

### 8. Substituir renderização da hierarquia antiga por novos componentes
### 9. Adicionar modais no final antes do fechamento do div principal:

```typescript
{/* Modal de Documentos */}
{documentsModal.isOpen && documentsModal.subtopicId && (
  <SubtopicDocumentsModal
    isOpen={documentsModal.isOpen}
    onClose={() => setDocumentsModal({ isOpen: false, subtopicId: null, subtopicTitle: null })}
    subtopicId={documentsModal.subtopicId}
    subtopicTitle={documentsModal.subtopicTitle || ''}
    onSelectDocument={(docId) => {
      navigate(`/plate-editor?doc=${docId}&subtopic=${documentsModal.subtopicId}&title=${encodeURIComponent(documentsModal.subtopicTitle || '')}`);
    }}
    onCreateNew={async () => {
      const newDoc = await createDocument({
        title: `Resumo: ${documentsModal.subtopicTitle}`,
        content: [{ type: 'p', children: [{ text: '' }] }],
        content_text: '',
        subtopic_id: documentsModal.subtopicId!,
      });
      if (newDoc) {
        navigate(`/plate-editor?doc=${newDoc.id}&subtopic=${documentsModal.subtopicId}&title=${encodeURIComponent(documentsModal.subtopicTitle || '')}`);
      }
    }}
  />
)}

{/* Modal de Criação Rápida */}
<QuickCreateModal
  isOpen={quickCreateModal.isOpen}
  onClose={() => setQuickCreateModal({ isOpen: false, type: null, unitId: null, topicId: null })}
  onSave={handleQuickCreate}
  title={
    quickCreateModal.type === 'unit'
      ? 'Nova Unidade'
      : quickCreateModal.type === 'topic'
      ? 'Novo Tópico'
      : 'Novo Subtópico'
  }
  placeholder={
    quickCreateModal.type === 'unit'
      ? 'Digite o nome da unidade...'
      : quickCreateModal.type === 'topic'
      ? 'Digite o nome do tópico...'
      : 'Digite o nome do subtópico...'
  }
/>
```

## 📝 Nota Final:

Por limitações de contexto, não pude fazer todas as alterações. Os componentes estão prontos, só falta integrá-los no DocumentsOrganizationPage seguindo estas instruções.

Alternativamente, posso criar o arquivo completo em partes se você preferir.
