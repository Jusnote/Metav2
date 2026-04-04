'use client';

import { useMemo } from 'react';
import { type Value, createSlateEditor } from 'platejs';

import { cn } from '@/lib/utils';
import { EditorStatic } from '@/components/ui/editor-static';

import { CommentStaticKit } from '@/components/questoes/comments/comment-editor-plugins';

const MEDIA_TYPES = new Set(['img', 'video', 'media_embed']);

/** Inject align:'left' on media nodes that have no explicit align (comment default) */
function applyCommentDefaults(value: Value): Value {
  return value.map((node: any) => {
    if (MEDIA_TYPES.has(node.type) && !node.align) {
      return { ...node, align: 'left' };
    }
    return node;
  }) as Value;
}

interface CommentStaticProps {
  value: Value;
  className?: string;
}

export function CommentStatic({ value, className }: CommentStaticProps) {
  const editor = useMemo(
    () => createSlateEditor({ plugins: CommentStaticKit, value: applyCommentDefaults(value) }),
    [value]
  );

  return (
    <EditorStatic
      editor={editor}
      variant="none"
      className={cn('text-sm text-zinc-700 dark:text-zinc-300', className)}
    />
  );
}
