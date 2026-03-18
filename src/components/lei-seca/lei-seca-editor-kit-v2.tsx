'use client';

import { type Value } from 'platejs';
import { type TPlateEditor, useEditorRef } from 'platejs/react';

import { AIKit } from '@/components/ai-kit';
import { AlignKit } from '@/components/align-kit';
import { BasicBlocksKit } from '@/components/basic-blocks-kit';
import { BlockSelectionKit } from '@/components/block-selection-kit';
import { BasicMarksKit } from '@/components/basic-marks-kit';
import { CommentKit } from '@/components/comment-kit';
import { CursorOverlayKit } from '@/components/cursor-overlay-kit';
import { DateKit } from '@/components/date-kit';
import { DiscussionKit } from '@/components/discussion-kit';
import { FloatingToolbarKit } from '@/components/floating-toolbar-kit';
import { FontKit } from '@/components/font-kit';
import { LineHeightKit } from '@/components/line-height-kit';
import { LinkKit } from '@/components/link-kit';
import { MentionKit } from '@/components/mention-kit';
import { SuggestionKit } from '@/components/suggestion-kit';
import { LeiSecaToolbarKit } from './lei-seca-toolbar-kit';

/**
 * Kit otimizado para modo USER do Lei Seca.
 *
 * Removidos para performance (sem uso em texto jurídico):
 * - CodeBlockKit, TableKit, ToggleKit, TocKit, MediaKit, CalloutKit
 * - ColumnKit, MathKit, ExcalidrawKit, EmojiKit, DocxKit, MarkdownKit, ListKit
 *
 * Removidos (criam UI para ações bloqueadas = UX confusa):
 * - DndKit, BlockMenuKit, CopilotKit, SlashKit, AutoformatKit
 * - TrailingBlockPlugin, ExitBreakKit, BlockPlaceholderKit
 *
 * Mantidos:
 * - AIKit: IA inline (Ctrl+J)
 * - FloatingToolbarKit: toolbar flutuante para highlight/color
 * - BasicMarksKit + FontKit: marks permitidos (highlight, color)
 * - BasicBlocksKit: parágrafos, headings
 * - LinkKit: links em texto de lei
 * - MentionKit: menções de usuários
 * - DateKit, AlignKit, LineHeightKit: formatação de leitura
 * - DiscussionKit, CommentKit, SuggestionKit: colaboração
 * - BlockSelectionKit: necessário para AIKit
 * - CursorOverlayKit: visual de cursor/seleção
 * - LeiSecaToolbarKit: toolbar fixa customizada
 */
export const LeiSecaUserKit = [
  ...AIKit,

  // Elements (renderização)
  ...BasicBlocksKit,
  ...LinkKit,
  ...MentionKit,
  ...DateKit,

  // Marks (highlight, color, backgroundColor permitidos via allowedMarks)
  ...BasicMarksKit,
  ...FontKit,

  // Block Style
  ...AlignKit,
  ...LineHeightKit,

  // Collaboration
  ...DiscussionKit,
  ...CommentKit,
  ...SuggestionKit,

  // Selection (necessário para AIKit funcionar)
  ...BlockSelectionKit,

  // Editing
  ...CursorOverlayKit,

  // UI
  ...LeiSecaToolbarKit,
  ...FloatingToolbarKit,
];

export type LeiSecaUserEditor = TPlateEditor<Value, (typeof LeiSecaUserKit)[number]>;

export const useLeiSecaUserEditor = () => useEditorRef<LeiSecaUserEditor>();
