'use client';

import { TrailingBlockPlugin } from 'platejs';

import { BasicBlocksKit } from '@/components/basic-blocks-kit';
import { BasicMarksKit } from '@/components/basic-marks-kit';
import { CodeBlockKit } from '@/components/code-block-kit';
import { ExitBreakKit } from '@/components/exit-break-kit';
import { FontKit } from '@/components/font-kit';
import { IndentKit } from '@/components/indent-kit';
import { LinkKit } from '@/components/link-kit';
import { ListKit } from '@/components/list-kit';
import { MathKit } from '@/components/math-kit';
import { MediaKit } from '@/components/media-kit';
import { MentionKit } from '@/components/mention-kit';
import { TableKit } from '@/components/table-kit';

// Base (static) kits — no React hooks, safe for PlateStatic
import { BaseBasicBlocksKit } from '@/components/basic-blocks-base-kit';
import { BaseBasicMarksKit } from '@/components/basic-marks-base-kit';
import { BaseCodeBlockKit } from '@/components/code-block-base-kit';
import { BaseFontKit } from '@/components/font-base-kit';
import { BaseIndentKit } from '@/components/indent-base-kit';
import { BaseLinkKit } from '@/components/link-base-kit';
import { BaseListKit } from '@/components/list-base-kit';
import { BaseMathKit } from '@/components/math-base-kit';
import { BaseMediaKit } from '@/components/media-base-kit';
import { BaseMentionKit } from '@/components/mention-base-kit';
import { BaseTableKit } from '@/components/table-base-kit';

/**
 * Full Plate plugin set for question comment/note editors (interactive).
 * Uses the same MediaKit as the main editor — resize handles, captions,
 * upload placeholder, preview dialog all included.
 */
export const CommentEditorKit = [
  ...BasicBlocksKit,
  ...CodeBlockKit,
  ...MathKit,
  ...LinkKit,
  ...MentionKit,
  ...BasicMarksKit,
  ...FontKit,
  ...IndentKit,
  ...ListKit,
  ...MediaKit,
  ...TableKit,
  ...ExitBreakKit,
  TrailingBlockPlugin,
];

/**
 * Static plugin set for PlateStatic rendering (JSON → read-only HTML).
 * Uses Base* plugins with static components — NO React hooks.
 */
export const CommentStaticKit = [
  ...BaseBasicBlocksKit,
  ...BaseCodeBlockKit,
  ...BaseMathKit,
  ...BaseLinkKit,
  ...BaseMentionKit,
  ...BaseBasicMarksKit,
  ...BaseFontKit,
  ...BaseIndentKit,
  ...BaseListKit,
  ...BaseMediaKit,
  ...BaseTableKit,
];
