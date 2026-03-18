'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCompletion } from '@ai-sdk/react';
import type { Editor } from '@tiptap/core';
import {
  Sparkles,
  X,
  BookOpen,
  FileText,
  List,
  Lightbulb,
  Scale,
  Send,
  Square,
  Loader2,
  RotateCcw,
} from 'lucide-react';

// ============ Types ============

interface LeiSecaAiPanelProps {
  isOpen: boolean;
  editor: Editor;
  selectionRange: { from: number; to: number };
  selectedText: string;
  scrollContainer: HTMLDivElement | null;
  onClose: () => void;
}

// ============ Actions ============

const AI_ACTIONS = [
  { id: 'explain', label: 'Explicar', icon: BookOpen },
  { id: 'simplify', label: 'Simplificar', icon: FileText },
  { id: 'summarize', label: 'Resumir', icon: List },
  { id: 'key-points', label: 'Pontos-chave', icon: Lightbulb },
  { id: 'practical-example', label: 'Exemplo prático', icon: Scale },
];

// ============ Component ============

export function LeiSecaAiPanel({
  isOpen,
  editor,
  selectionRange,
  selectedText,
  scrollContainer,
  onClose,
}: LeiSecaAiPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  const { completion, complete, isLoading, stop, error, setCompletion } =
    useCompletion({ api: '/api/ai/tiptap', streamProtocol: 'text' });

  // ---- Calculate position relative to scroll container (once on open) ----

  useEffect(() => {
    if (!isOpen || !editor?.view || editor.isDestroyed || !scrollContainer)
      return;

    try {
      const startCoords = editor.view.coordsAtPos(selectionRange.from);
      const endCoords = editor.view.coordsAtPos(selectionRange.to);
      const containerRect = scrollContainer.getBoundingClientRect();

      // Convert viewport coords → scroll-container-relative coords
      let top =
        endCoords.bottom -
        containerRect.top +
        scrollContainer.scrollTop +
        8; // 8px gap below selection
      let left =
        startCoords.left -
        containerRect.left +
        scrollContainer.scrollLeft;

      // Shift: keep panel within container width
      const panelWidth = 380;
      const maxLeft = scrollContainer.clientWidth - panelWidth - 8;
      if (left > maxLeft) left = Math.max(0, maxLeft);
      if (left < 8) left = 8;

      setPosition({ top, left });
    } catch {
      // coords can be invalid if doc changed
    }
  }, [isOpen, editor, selectionRange, scrollContainer]);

  // ---- Scroll panel into view after positioning ----

  useEffect(() => {
    if (isOpen && panelRef.current) {
      const timer = setTimeout(() => {
        panelRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, position]);

  // ---- Focus input on open ----

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 200);
  }, [isOpen]);

  // ---- Escape to close ----

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // ---- Click outside to close ----

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 150);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [isOpen, onClose]);

  // ---- Reset on close ----

  useEffect(() => {
    if (!isOpen) {
      setInputValue('');
      setCompletion('');
    }
  }, [isOpen, setCompletion]);

  // ---- Auto-scroll response ----

  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [completion]);

  // ---- Handlers ----

  const handleAction = useCallback(
    (commandId: string) => {
      complete('', { body: { text: selectedText, command: commandId } });
    },
    [complete, selectedText]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim() || isLoading) return;
      complete(inputValue.trim(), { body: { text: selectedText } });
    },
    [complete, inputValue, isLoading, selectedText]
  );

  const handleReset = useCallback(() => {
    setCompletion('');
    setInputValue('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [setCompletion]);

  // ---- Render ----

  if (!isOpen) return null;

  const truncatedText =
    selectedText.length > 120
      ? selectedText.slice(0, 120) + '...'
      : selectedText;

  const hasResponse = !!completion;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        zIndex: 50,
      }}
      className="w-[380px] max-h-[460px] bg-background border rounded-xl shadow-xl overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkles className="h-3.5 w-3.5 text-purple-500" />
          <span>Ask AI</span>
        </div>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Selected text preview */}
      <div className="px-3 py-2 border-b bg-muted/30">
        <p className="text-xs text-muted-foreground line-clamp-2 italic">
          &ldquo;{truncatedText}&rdquo;
        </p>
      </div>

      {/* Action buttons (hidden after response starts) */}
      {!hasResponse && !isLoading && (
        <div className="px-3 py-2 border-b">
          <div className="flex flex-wrap gap-1.5">
            {AI_ACTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleAction(id)}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border bg-background hover:bg-accent transition-colors"
              >
                <Icon className="h-3 w-3" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Free-text input (hidden after response starts) */}
      {!hasResponse && !isLoading && (
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-1.5 px-3 py-2 border-b"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Pergunte à IA..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/60"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      )}

      {/* Loading indicator (before any text arrives) */}
      {isLoading && !hasResponse && (
        <div className="flex items-center gap-2 px-3 py-3">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500" />
          <span className="text-xs text-muted-foreground">Pensando...</span>
        </div>
      )}

      {/* Streaming / completed response */}
      {hasResponse && (
        <div className="flex flex-col min-h-0">
          <div
            ref={responseRef}
            className="px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap overflow-auto max-h-[280px]"
          >
            {completion}
          </div>

          <div className="flex items-center justify-end gap-1 px-3 py-1.5 border-t">
            {isLoading ? (
              <button
                onClick={stop}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-accent text-muted-foreground transition-colors"
              >
                <Square className="h-3 w-3" />
                Parar
              </button>
            ) : (
              <button
                onClick={handleReset}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-accent text-muted-foreground transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Nova pergunta
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-3 py-2 text-xs text-red-500">
          Erro: {error.message}
        </div>
      )}
    </div>
  );
}
