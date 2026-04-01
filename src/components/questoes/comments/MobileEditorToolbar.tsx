'use client';

import { useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Paperclip,
  Link,
  MoreHorizontal,
} from 'lucide-react';
import { MobileToolbarSheet } from './MobileToolbarSheet';

interface MobileEditorToolbarProps {
  onTool: (tool: string) => void;
}

export function MobileEditorToolbar({ onTool }: MobileEditorToolbarProps) {
  const [toolsOpen, setToolsOpen] = useState(false);

  const BUTTONS = [
    { key: 'bold', icon: Bold },
    { key: 'italic', icon: Italic },
    { key: 'underline', icon: Underline },
    { key: 'strikethrough', icon: Strikethrough },
    { separator: true },
    { key: 'ordered_list', icon: ListOrdered },
    { key: 'bulleted_list', icon: List },
    { separator: true },
    { key: 'media', icon: Paperclip },
    { key: 'link', icon: Link },
  ] as const;

  return (
    <>
      <div className="flex items-center gap-[3px] overflow-x-auto px-2 py-1.5 scrollbar-hide bg-zinc-50">
        {BUTTONS.map((btn, i) =>
          'separator' in btn ? (
            <span key={`sep-${i}`} className="mx-0.5 h-4 w-px shrink-0 bg-zinc-200" />
          ) : (
            <button
              key={btn.key}
              onClick={() => onTool(btn.key)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition-colors hover:bg-zinc-50 active:bg-zinc-100"
            >
              <btn.icon className="h-4 w-4" />
            </button>
          ),
        )}
        <span className="mx-0.5 h-4 w-px shrink-0 bg-zinc-200" />
        <button
          onClick={() => setToolsOpen(true)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition-colors hover:bg-zinc-50"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      <MobileToolbarSheet
        open={toolsOpen}
        onClose={() => setToolsOpen(false)}
        onTool={onTool}
      />
    </>
  );
}
