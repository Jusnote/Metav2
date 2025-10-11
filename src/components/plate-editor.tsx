'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Plate, usePlateEditor } from 'platejs/react';

import { EditorKit } from '@/components/editor-kit';
import { SettingsDialog } from '@/components/settings-dialog';
import { Editor, EditorContainer } from '@/components/ui/editor';
import { SaveIndicator } from '@/components/ui/save-indicator';
import { useAutoSavePlateDocument, usePlateDocuments } from '@/hooks/usePlateDocuments';

interface PlateEditorProps {
  documentId?: string | null;
  onDocumentCreate?: (id: string) => void;
  subtopicId?: string | null;
  subtopicTitle?: string;
}

export function PlateEditor({ documentId }: PlateEditorProps) {
  const [currentDocId, setCurrentDocId] = useState<string | null>(documentId || null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isWaitingForDocument, setIsWaitingForDocument] = useState(!!documentId);
  const { saveStatus, currentDocument, saveWithDebounce } = useAutoSavePlateDocument(currentDocId);
  const { isLoading, refresh } = usePlateDocuments();

  // Ref estável para saveWithDebounce (evita re-renders)
  const saveWithDebounceRef = useRef(saveWithDebounce);

  // Atualizar ref quando saveWithDebounce mudar
  useEffect(() => {
    saveWithDebounceRef.current = saveWithDebounce;
  }, [saveWithDebounce]);

  // Forçar refresh do cache quando documentId mudar (para garantir dados atualizados)
  useEffect(() => {
    if (documentId) {
      refresh();
    }
  }, [documentId, refresh]);

  // Aguardar documento carregar se temos documentId mas não currentDocument
  useEffect(() => {
    if (documentId && !currentDocument && !isLoading) {
      setIsWaitingForDocument(true);
    } else if (documentId && currentDocument && currentDocument.id === documentId) {
      setIsWaitingForDocument(false);
    } else if (!documentId) {
      setIsWaitingForDocument(false);
    }
  }, [documentId, currentDocument, isLoading]);

  // Valor inicial: carregar do documento atual ou usar padrão vazio
  const initialValue = React.useMemo(() => {
    // Se está aguardando documento, retornar vazio para mostrar loading
    if (isWaitingForDocument) {
      return [{ type: 'p', children: [{ text: '' }] }];
    }

    const content = currentDocument?.content || [{ type: 'p', children: [{ text: '' }] }];
    return content;
  }, [currentDocument?.content, isWaitingForDocument]);

  const editor = usePlateEditor({
    plugins: EditorKit,
    value: initialValue,
  });

  // Handler para mudanças no editor (usando ref estável)
  const handleChange = useCallback((newValue: any) => {
    // Auto-save quando conteúdo mudar
    if (!currentDocId || !hasLoaded || isWaitingForDocument) {
      return;
    }

    saveWithDebounceRef.current(newValue);
  }, [currentDocId, hasLoaded, isWaitingForDocument]);

  // Atualizar documentId se mudar externamente
  useEffect(() => {
    if (documentId !== undefined && documentId !== currentDocId) {
      setCurrentDocId(documentId);
      setHasLoaded(false);
    }
  }, [documentId, currentDocId]);

  // Marcar como carregado após inicializar
  useEffect(() => {
    if (editor && !hasLoaded) {
      setHasLoaded(true);
    }
  }, [editor, hasLoaded, currentDocId]);

  // Atualizar conteúdo do editor quando currentDocument mudar
  useEffect(() => {
    if (!editor || !currentDocument?.content) return;

    // Substituir todo o conteúdo do editor
    editor.children = currentDocument.content;
    if (typeof editor.onChange === 'function') {
      editor.onChange();
    }
  }, [editor, currentDocument?.id, currentDocument?.content]);

  // Handler para blur do editor (ANTES de qualquer return condicional)
  const handleBlur = useCallback(() => {
    if (!editor || !currentDocId) return;

    const content = editor.children as any[];
    if (content && content.length > 0) {
      saveWithDebounceRef.current(content);
    }
  }, [editor, currentDocId]);

  // Event listeners para salvamento forçado
  useEffect(() => {
    if (!currentDocId || !editor) return;

    const handleBeforeUnload = () => {
      // Salvar imediatamente antes de fechar
      const content = editor.children as any[];
      if (content && content.length > 0) {
        saveWithDebounceRef.current(content);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Salvar quando sair da aba
        const content = editor.children as any[];
        if (content && content.length > 0) {
          saveWithDebounceRef.current(content);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentDocId, editor]);

  // Mostrar loading enquanto aguarda documento
  if (isWaitingForDocument) {
    return (
      <div className="relative h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando documento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      {/* Indicador de salvamento */}
      <div className="absolute top-4 right-4 z-10">
        <SaveIndicator status={saveStatus} />
      </div>

      <Plate editor={editor} onChange={({ value }) => handleChange(value)}>
        <EditorContainer onBlur={handleBlur}>
          <Editor variant="demo" />
        </EditorContainer>

        <SettingsDialog />
      </Plate>
    </div>
  );
}
