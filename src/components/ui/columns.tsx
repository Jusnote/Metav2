import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { cn } from '@/lib/utils';

export interface ColumnsOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columns: {
      setColumns: (count: number) => ReturnType;
      unsetColumns: () => ReturnType;
    };
  }
}

const ColumnEditor = ({ content, onUpdate, index }: { content: string; onUpdate: (content: string) => void; index: number }) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content || '',
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none',
      },
    },
  });

  return (
    <div className="column border border-dashed border-gray-200 rounded p-1 min-h-[60px]">
      <div className="text-xs text-muted-foreground mb-1">Coluna {index + 1}</div>
      <EditorContent 
        editor={editor} 
        className="[&_.ProseMirror]:min-h-[30px] [&_.ProseMirror]:p-1 [&_.ProseMirror]:focus:outline-none" 
      />
    </div>
  );
};

interface ColumnsComponentProps {
  node: {
    attrs: {
      count?: number;
      columns?: string[];
    };
  };
  updateAttributes: (attrs: any) => void;
  deleteNode: () => void;
}

const ColumnsComponent = ({ node, updateAttributes, deleteNode }: ColumnsComponentProps) => {
  const count = node.attrs.count || 2;
  const columns = node.attrs.columns || Array.from({ length: count }, () => '');

  const updateColumn = (index: number, content: string) => {
    const newColumns = [...columns];
    newColumns[index] = content;
    updateAttributes({ columns: newColumns });
  };
  
  return (
    <NodeViewWrapper className="columns-wrapper">
      <div className={cn(
        'columns-container border border-dashed border-gray-300 p-4 my-4 rounded-lg relative',
        'grid gap-4',
        count === 2 && 'grid-cols-2',
        count === 3 && 'grid-cols-3',
        count === 4 && 'grid-cols-4'
      )}>
        <div className="absolute top-2 right-2 flex gap-1 z-10">
          <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
            {count} colunas
          </span>
          <button
            onClick={deleteNode}
            className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200"
            title="Remover layout de colunas"
          >
            ×
          </button>
        </div>
        {Array.from({ length: count }, (_, index) => (
          <ColumnEditor
            key={index}
            content={columns[index] || ''}
            onUpdate={(content) => updateColumn(index, content)}
            index={index}
          />
        ))}
      </div>
    </NodeViewWrapper>
  );
};

export const ColumnsExtension = Node.create<ColumnsOptions>({
  name: 'columns',
  
  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },
  
  group: 'block',
  atom: true,
  
  addAttributes() {
    return {
      count: {
        default: 2,
        parseHTML: element => parseInt(element.getAttribute('data-count') || '2'),
        renderHTML: attributes => ({
          'data-count': attributes.count,
        }),
      },
      columns: {
        default: [],
        parseHTML: element => {
          try {
            return JSON.parse(element.getAttribute('data-columns') || '[]');
          } catch {
            return [];
          }
        },
        renderHTML: attributes => ({
          'data-columns': JSON.stringify(attributes.columns || []),
        }),
      },
    };
  },
  
  parseHTML() {
    return [
      {
        tag: 'div[data-columns]',
      },
    ];
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      'data-columns': '',
      class: 'columns-layout',
    })];
  },
  
  addNodeView() {
    return ReactNodeViewRenderer(ColumnsComponent);
  },

  addCommands() {
    return {
      setColumns: (count) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: { 
            count,
            columns: Array.from({ length: count }, () => '')
          },
        });
      },
      unsetColumns: () => ({ commands }) => {
        return commands.deleteSelection();
      },
    };
  },
});