'use client';

import * as React from 'react';

import { BoldIcon, ItalicIcon, UnderlineIcon, StrikethroughIcon, Code2Icon, Heading3Icon, QuoteIcon } from 'lucide-react';
import { type Value } from 'platejs';
import { KEYS } from 'platejs';
import { Plate, usePlateEditor, useEditorRef } from 'platejs/react';

import { CommentEditorKit } from './comment-editor-plugins';
import { useCommentDraft } from '@/hooks/useCommentDraft';
import { Editor, EditorContainer } from '@/components/ui/editor';
import { FixedToolbar } from '@/components/ui/fixed-toolbar';
import { MarkToolbarButton } from '@/components/ui/mark-toolbar-button';
import { LinkToolbarButton } from '@/components/ui/link-toolbar-button';
import { NumberedListToolbarButton, BulletedListToolbarButton } from '@/components/ui/list-toolbar-button';
import { ToolbarButton, ToolbarGroup } from '@/components/ui/toolbar';
import { InlineEquationToolbarButton } from '@/components/ui/equation-toolbar-button';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommunityCommentEditorProps {
  questionId: number;
  mode: 'new' | 'reply' | 'edit' | 'note';
  /** "@Name" shown above editor in reply mode */
  replyToName?: string;
  /** Existing content_json to populate the editor (edit mode) */
  initialValue?: Value;
  /** Draft context key, e.g. 'new', 'reply_abc123', 'edit_abc123', 'note' */
  draftContext?: string;
  onSubmit: (content_json: Record<string, unknown>, content_text: string) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Plain-text extraction helpers
// ---------------------------------------------------------------------------

function extractNodeText(node: any): string {
  if (node.text !== undefined) return node.text as string;
  if (Array.isArray(node.children)) return node.children.map(extractNodeText).join('');
  return '';
}

function extractPlainText(value: Value): string {
  return value.map(extractNodeText).join('\n').trim();
}

function isEditorEmpty(value: Value): boolean {
  const text = extractPlainText(value);
  return text.length === 0;
}

const EMPTY_VALUE: Value = [{ type: 'p', children: [{ text: '' }] }];

// ---------------------------------------------------------------------------
// Block toggle buttons (H3, Blockquote) — must live inside <Plate>
// ---------------------------------------------------------------------------

function H3ToolbarButton() {
  const editor = useEditorRef();
  return (
    <ToolbarButton
      tooltip="Heading 3"
      onClick={() => {
        editor.tf.toggleBlock(KEYS.h3);
      }}
    >
      <Heading3Icon className="size-4" />
    </ToolbarButton>
  );
}

function BlockquoteToolbarButton() {
  const editor = useEditorRef();
  return (
    <ToolbarButton
      tooltip="Citação"
      onClick={() => {
        editor.tf.toggleBlock(KEYS.blockquote);
      }}
    >
      <QuoteIcon className="size-4" />
    </ToolbarButton>
  );
}

// ---------------------------------------------------------------------------
// Main component (wrapper that sets up the editor instance)
// ---------------------------------------------------------------------------

export function CommunityCommentEditor({
  questionId,
  mode,
  replyToName,
  initialValue,
  draftContext = 'new',
  onSubmit,
  onCancel,
  isSubmitting = false,
  placeholder,
}: CommunityCommentEditorProps) {
  const { draft, setDraft, clearDraft } = useCommentDraft(questionId, draftContext);

  // Resolve starting value: prop > draft > empty
  const startingValue = React.useMemo<Value>(() => {
    if (initialValue && initialValue.length > 0) return initialValue;
    if (draft?.content_json) {
      try {
        const parsed = draft.content_json as unknown as Value;
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // ignore
      }
    }
    return EMPTY_VALUE;
  }, []); // intentionally once at mount — eslint-disable-line react-hooks/exhaustive-deps

  const [currentValue, setCurrentValue] = React.useState<Value>(startingValue);

  const editor = usePlateEditor({
    plugins: CommentEditorKit,
    value: startingValue,
  });

  // Debounced draft save on editor change
  const handleChange = React.useCallback(
    (value: Value) => {
      setCurrentValue(value);
      const text = extractPlainText(value);
      setDraft(value as unknown as Record<string, unknown>, text);
    },
    [setDraft]
  );

  const handleSubmit = async () => {
    if (isEditorEmpty(currentValue) || isSubmitting) return;
    const text = extractPlainText(currentValue);
    const content_json = currentValue as unknown as Record<string, unknown>; // Value[] → opaque JSON
    clearDraft();
    await onSubmit(content_json, text);
  };

  const handleCancel = () => {
    clearDraft();
    onCancel();
  };

  const isEmpty = isEditorEmpty(currentValue);
  const isEditMode = mode === 'edit' || mode === 'note';
  const submitLabel = isEditMode ? 'Salvar' : 'Publicar';
  const defaultPlaceholder = mode === 'reply'
    ? replyToName
      ? `Respondendo a ${replyToName}…`
      : 'Escreva uma resposta…'
    : mode === 'note'
    ? 'Escreva sua anotação…'
    : 'Escreva um comentário…';

  return (
    <div className="flex flex-col rounded-lg border border-border bg-background">
      {/* Reply context banner */}
      {mode === 'reply' && replyToName && (
        <div className="flex items-center gap-1.5 rounded-t-lg border-b border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          <span>Respondendo a</span>
          <span className="font-medium text-foreground">@{replyToName}</span>
        </div>
      )}

      <Plate editor={editor} onChange={({ value }) => handleChange(value)}>
        {/* Compact fixed toolbar */}
        <FixedToolbar
          className={cn(
            'rounded-none border-b border-border bg-background/95',
            mode === 'reply' && replyToName ? '' : 'rounded-t-lg'
          )}
        >
          <ToolbarGroup>
            <MarkToolbarButton nodeType={KEYS.bold} tooltip="Negrito">
              <BoldIcon className="size-4" />
            </MarkToolbarButton>
            <MarkToolbarButton nodeType={KEYS.italic} tooltip="Itálico">
              <ItalicIcon className="size-4" />
            </MarkToolbarButton>
            <MarkToolbarButton nodeType={KEYS.underline} tooltip="Sublinhado">
              <UnderlineIcon className="size-4" />
            </MarkToolbarButton>
            <MarkToolbarButton nodeType={KEYS.strikethrough} tooltip="Tachado">
              <StrikethroughIcon className="size-4" />
            </MarkToolbarButton>
            <MarkToolbarButton nodeType={KEYS.code} tooltip="Código">
              <Code2Icon className="size-4" />
            </MarkToolbarButton>
          </ToolbarGroup>

          <ToolbarGroup>
            <H3ToolbarButton />
            <BlockquoteToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup>
            <NumberedListToolbarButton />
            <BulletedListToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup>
            <InlineEquationToolbarButton />
            <LinkToolbarButton />
          </ToolbarGroup>
        </FixedToolbar>

        {/* Editor area */}
        <EditorContainer
          variant="comment"
          className="min-h-[80px] max-h-[300px] overflow-y-auto px-3 py-2"
        >
          <Editor
            variant="comment"
            placeholder={placeholder ?? defaultPlaceholder}
            className="min-h-[60px]"
          />
        </EditorContainer>

        {/* Footer: actions */}
        <div className="flex items-center justify-end gap-2 rounded-b-lg border-t border-border px-3 py-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-700 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isEmpty || isSubmitting}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium text-white transition-opacity',
              'disabled:cursor-not-allowed disabled:opacity-40',
              isEditMode
                ? 'bg-zinc-700 hover:bg-zinc-800'
                : 'bg-[#2563EB] hover:bg-blue-700'
            )}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-1.5">
                <span className="size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {submitLabel}…
              </span>
            ) : (
              submitLabel
            )}
          </button>
        </div>
      </Plate>
    </div>
  );
}
