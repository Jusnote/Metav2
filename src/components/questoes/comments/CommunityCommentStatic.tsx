'use client';

import { useMemo } from 'react';
import { type Value, createSlateEditor } from 'platejs';

import { cn } from '@/lib/utils';
import { EditorStatic } from '@/components/ui/editor-static';

import { CommentStaticKit } from './comment-editor-plugins';

interface CommunityCommentStaticProps {
  value: Value;
  className?: string;
}

export function CommunityCommentStatic({ value, className }: CommunityCommentStaticProps) {
  const editor = useMemo(
    () => createSlateEditor({ plugins: CommentStaticKit, value }),
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
