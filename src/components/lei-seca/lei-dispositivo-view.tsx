'use client';

import { useState, useCallback } from 'react';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { MoreVertical, Copy, MessageSquare, Bookmark } from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';

export function LeiDispositivoView({ node }: NodeViewProps) {
  const [showAnnotation, setShowAnnotation] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const role = node.attrs.role;
  const slug = node.attrs.slug;
  const indent = node.attrs.indent || 0;

  const handleCopy = useCallback(() => {
    const text = node.textContent;
    if (text) navigator.clipboard.writeText(text).catch(() => {});
    setPopoverOpen(false);
  }, [node]);

  const handleAnnotate = useCallback(() => {
    setShowAnnotation((prev) => !prev);
    setPopoverOpen(false);
  }, []);

  return (
    <NodeViewWrapper
      className={`lei-dispositivo${popoverOpen ? ' lei-dispositivo-active' : ''}`}
      data-role={role || undefined}
      data-slug={slug || undefined}
      style={indent ? { paddingLeft: `${indent * 2}rem` } : undefined}
    >
      {/* Paragraph content — ProseMirror manages inline content here */}
      <NodeViewContent />

      {/* Gutter action trigger — absolutely positioned left, appears on hover */}
      {role && (
        <div className="lei-gutter" contentEditable={false}>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="lei-gutter-btn"
                aria-label="Ações do dispositivo"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="left"
              align="start"
              sideOffset={4}
              className="w-auto p-1"
            >
              <div className="flex flex-col gap-0.5 min-w-[120px]">
                <button
                  className="lei-action-item"
                  onClick={handleCopy}
                >
                  <Copy className="h-3 w-3" />
                  Copiar
                </button>
                <button
                  className="lei-action-item"
                  onClick={handleAnnotate}
                >
                  <MessageSquare className="h-3 w-3" />
                  {showAnnotation ? 'Fechar anotação' : 'Anotar'}
                </button>
                <button
                  className="lei-action-item"
                  onClick={() => setPopoverOpen(false)}
                >
                  <Bookmark className="h-3 w-3" />
                  Salvar
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Inline annotation area — expands below the paragraph */}
      {showAnnotation && (
        <div className="lei-annotation" contentEditable={false}>
          <textarea
            placeholder="Escreva sua anotação..."
            className="w-full min-h-[60px] p-2 text-sm border rounded-md bg-muted/30 resize-y outline-none focus:ring-1 focus:ring-ring"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </NodeViewWrapper>
  );
}
