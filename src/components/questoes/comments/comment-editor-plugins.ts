'use client';

import { TrailingBlockPlugin } from 'platejs';

import { BasicBlocksKit } from '@/components/basic-blocks-kit';
import { BasicMarksKit } from '@/components/basic-marks-kit';
import { CodeBlockKit } from '@/components/code-block-kit';
import { ExitBreakKit } from '@/components/exit-break-kit';
import { LinkKit } from '@/components/link-kit';
import { ListKit } from '@/components/list-kit';
import { MathKit } from '@/components/math-kit';
import { MentionKit } from '@/components/mention-kit';

/**
 * Minimal Plate plugin subset for question comment/note editors.
 *
 * Includes: paragraph, headings, blockquote, code-block, bold, italic,
 * underline, strikethrough, code, math (inline + block), link, mention,
 * lists, exit-break, trailing-block.
 *
 * Excludes: AI, copilot, DND, table, column, excalidraw, TOC, toggle, date,
 * tag, media, slash commands, font, align, line-height, suggestion,
 * discussion, comment, docx, markdown, block-menu, cursor-overlay,
 * block-placeholder, emoji, toolbar plugins.
 */
export const CommentEditorKit = [
  // Block elements
  ...BasicBlocksKit,
  ...CodeBlockKit,

  // Inline elements + marks
  ...MathKit,
  ...LinkKit,
  ...MentionKit,
  ...BasicMarksKit,

  // Block style
  ...ListKit,

  // Editing behaviour
  ...ExitBreakKit,
  TrailingBlockPlugin,
];

/**
 * Same plugin set used for PlateStatic rendering (JSON → HTML).
 * Toolbars are not included in CommentEditorKit, so this is identical.
 */
export const CommentStaticKit = CommentEditorKit;
