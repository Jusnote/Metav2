'use client';

import * as React from 'react';

import { BoldIcon, ItalicIcon, UnderlineIcon, StrikethroughIcon, Code2Icon, Heading3Icon, QuoteIcon, SquareCodeIcon, FilmIcon, BaselineIcon, PaintBucketIcon } from 'lucide-react';
import { type Value } from 'platejs';
import { KEYS } from 'platejs';
import { insertMedia } from '@platejs/media';
import { Plate, usePlateEditor, useEditorRef } from 'platejs/react';

import { CommentEditorKit } from '@/components/questoes/comments/comment-editor-plugins';
import { useCommentDraft } from '@/hooks/useCommentDraft';
import { Editor, EditorContainer } from '@/components/ui/editor';
import { FixedToolbar } from '@/components/ui/fixed-toolbar';
import { FontColorToolbarButton } from '@/components/ui/font-color-toolbar-button';
import { UndoToolbarButton, RedoToolbarButton } from '@/components/ui/history-toolbar-button';
import { IndentToolbarButton, OutdentToolbarButton } from '@/components/ui/indent-toolbar-button';
import { MarkToolbarButton } from '@/components/ui/mark-toolbar-button';
import { LinkToolbarButton } from '@/components/ui/link-toolbar-button';
import { MediaToolbarButton } from '@/components/ui/media-toolbar-button';
import { TableToolbarButton } from '@/components/ui/table-toolbar-button';
import { NumberedListToolbarButton, BulletedListToolbarButton } from '@/components/ui/list-toolbar-button';
import { ToolbarButton, ToolbarGroup } from '@/components/ui/toolbar';
import { InlineEquationToolbarButton } from '@/components/ui/equation-toolbar-button';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileCommentEditor } from './MobileCommentEditor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommentEditorProps {
  /** @deprecated Use entityType + entityId instead for new consumers */
  questionId?: number;
  entityType?: string;
  entityId?: string | number;
  mode: 'new' | 'reply' | 'edit' | 'note';
  replyToName?: string;
  initialValue?: Value;
  draftContext?: string;
  onSubmit: (content_json: Record<string, unknown>, content_text: string) => void | Promise<void>;
  onCancel: () => void;
  onChange?: (content_json: Record<string, unknown>, content_text: string) => void;
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
// Block toggle buttons — must live inside <Plate>
// ---------------------------------------------------------------------------

function H3ToolbarButton() {
  const editor = useEditorRef();
  return (
    <ToolbarButton tooltip="Heading 3" onClick={() => editor.tf.toggleBlock(KEYS.h3)}>
      <Heading3Icon className="size-4" />
    </ToolbarButton>
  );
}

function BlockquoteToolbarButton() {
  const editor = useEditorRef();
  return (
    <ToolbarButton tooltip="Citação" onClick={() => editor.tf.toggleBlock(KEYS.blockquote)}>
      <QuoteIcon className="size-4" />
    </ToolbarButton>
  );
}

function CodeBlockToolbarButton() {
  const editor = useEditorRef();
  return (
    <ToolbarButton tooltip="Bloco de código" onClick={() => editor.tf.toggleBlock(KEYS.codeBlock)}>
      <SquareCodeIcon className="size-4" />
    </ToolbarButton>
  );
}

function EmbedVideoToolbarButton() {
  const editor = useEditorRef();
  return (
    <ToolbarButton
      tooltip="Embed vídeo (YouTube, Vimeo)"
      onClick={() => insertMedia(editor, { select: true, type: KEYS.mediaEmbed })}
    >
      <FilmIcon className="size-4" />
    </ToolbarButton>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CommentEditor({
  questionId,
  entityType,
  entityId,
  mode,
  replyToName,
  initialValue,
  draftContext = 'new',
  onSubmit,
  onCancel,
  onChange,
  isSubmitting = false,
  placeholder,
}: CommentEditorProps) {
  // Resolve ID for draft key: prefer entityType/entityId, fall back to questionId
  const resolvedEntityId = entityId ?? questionId ?? 0;
  const draftNamespace = entityType ? `${entityType}_${resolvedEntityId}` : String(resolvedEntityId);

  const { draft, setDraft, clearDraft } = useCommentDraft(
    // useCommentDraft expects a number; pass 0 and use draftNamespace as context prefix
    0,
    `${draftNamespace}_${draftContext}`,
  );

  const startingValue = React.useMemo<Value>(() => {
    if (initialValue && initialValue.length > 0) return initialValue;
    if (draft?.content_json) {
      try {
        const parsed = draft.content_json as unknown as Value;
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch { /* ignore */ }
    }
    return EMPTY_VALUE;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [currentValue, setCurrentValue] = React.useState<Value>(startingValue);

  // Unique ID per editor — crucial for multiple editors on the same page
  const editor = usePlateEditor({
    id: `comment-editor-${draftNamespace}-${draftContext}`,
    plugins: CommentEditorKit,
    value: startingValue,
  });

  const handleChange = React.useCallback(
    (value: Value) => {
      setCurrentValue(value);
      const text = extractPlainText(value);
      setDraft(value as unknown as Record<string, unknown>, text);
      onChange?.(value as unknown as Record<string, unknown>, text);
    },
    [setDraft, onChange]
  );

  const handleSubmit = async () => {
    if (isEditorEmpty(currentValue) || isSubmitting) return;
    const text = extractPlainText(currentValue);
    const content_json = currentValue as unknown as Record<string, unknown>;
    clearDraft();
    await onSubmit(content_json, text);
  };

  const handleCancel = () => {
    clearDraft();
    onCancel();
  };

  const isEmpty = isEditorEmpty(currentValue);
  const isMobile = useIsMobile();
  const [mobileEditorOpen, setMobileEditorOpen] = React.useState(false);

  const getTextLength = React.useCallback(() => {
    return extractPlainText(currentValue).length;
  }, [currentValue]);

  const isEditMode = mode === 'edit' || mode === 'note';
  const submitLabel = isEditMode ? 'Salvar' : 'Publicar';
  const defaultPlaceholder = mode === 'reply'
    ? replyToName
      ? `Respondendo a ${replyToName}...`
      : 'Escreva uma resposta...'
    : mode === 'note'
    ? 'Escreva sua anotação...'
    : 'Escreva um comentário...';

  // Build entity label for mobile editor
  const mobileEntityLabel = entityType
    ? `${entityType} #${resolvedEntityId}`
    : `Questão #${resolvedEntityId}`;

  return (
    <Plate editor={editor} onChange={({ value }) => handleChange(value)}>
      {/* Reply context banner — shown in both mobile and desktop */}
      {mode === 'reply' && replyToName && (
        <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground rounded-t-lg">
          <span>Respondendo a</span>
          <span className="font-medium text-foreground">@{replyToName}</span>
        </div>
      )}

      {isMobile ? (
        <>
          {/* Mobile: trigger button */}
          {!mobileEditorOpen && (
            <button
              onClick={() => setMobileEditorOpen(true)}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-left text-[12px] text-zinc-400 transition-colors hover:bg-zinc-100"
            >
              {placeholder ?? defaultPlaceholder}
            </button>
          )}

          {/* Mobile: fullscreen editor sheet */}
          <MobileCommentEditor
            open={mobileEditorOpen}
            onClose={() => setMobileEditorOpen(false)}
            onPublish={handleSubmit}
            entityLabel={mode === 'note' ? 'Anotação' : mobileEntityLabel}
            getTextLength={getTextLength}
            editorContent={
              <Editor
                variant="comment"
                placeholder={placeholder ?? defaultPlaceholder}
                className="min-h-[120px] px-3 py-2"
              />
            }
            isSubmitting={isSubmitting}
          />
        </>
      ) : (
        <>
          {/* Desktop: existing inline editor — UNCHANGED */}
          <EditorContainer
            variant="comment"
            className="max-h-[400px] rounded-lg border border-border bg-background"
          >
            <FixedToolbar className="sticky top-0 z-50 rounded-t-lg border-b border-border bg-background/95">
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
                <CodeBlockToolbarButton />
              </ToolbarGroup>

              <ToolbarGroup>
                <NumberedListToolbarButton />
                <BulletedListToolbarButton />
                <IndentToolbarButton />
                <OutdentToolbarButton />
              </ToolbarGroup>

              <ToolbarGroup>
                <FontColorToolbarButton nodeType={KEYS.color} tooltip="Cor do texto">
                  <BaselineIcon className="size-4" />
                </FontColorToolbarButton>
                <FontColorToolbarButton nodeType={KEYS.backgroundColor} tooltip="Cor de fundo">
                  <PaintBucketIcon className="size-4" />
                </FontColorToolbarButton>
              </ToolbarGroup>

              <ToolbarGroup>
                <MediaToolbarButton nodeType={KEYS.img} />
                <EmbedVideoToolbarButton />
                <MediaToolbarButton nodeType={KEYS.file} />
                <TableToolbarButton />
              </ToolbarGroup>

              <ToolbarGroup>
                <InlineEquationToolbarButton />
                <LinkToolbarButton />
              </ToolbarGroup>

              <ToolbarGroup>
                <UndoToolbarButton />
                <RedoToolbarButton />
              </ToolbarGroup>
            </FixedToolbar>

            <Editor
              variant="comment"
              placeholder={placeholder ?? defaultPlaceholder}
              className="min-h-[80px] px-3 py-2"
            />
          </EditorContainer>

          {/* Footer: actions */}
          <div className="flex items-center justify-end gap-2 rounded-b-lg border border-t-0 border-border bg-background px-3 py-2">
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
                  {submitLabel}...
                </span>
              ) : (
                submitLabel
              )}
            </button>
          </div>
        </>
      )}
    </Plate>
  );
}
