'use client';

import { type Value } from 'platejs';

import { cn } from '@/lib/utils';
import { EditorStatic } from '@/components/ui/editor-static';

import { CommentStaticKit } from './comment-editor-plugins';

interface CommunityCommentStaticProps {
  value: Value;
  className?: string;
}

export function CommunityCommentStatic({ value, className }: CommunityCommentStaticProps) {
  return (
    <EditorStatic
      plugins={CommentStaticKit}
      value={value}
      variant="none"
      className={cn('text-sm text-zinc-700 dark:text-zinc-300', className)}
    />
  );
}
