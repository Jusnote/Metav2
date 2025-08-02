import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { cn } from '@/lib/utils';
import { 
  Lightbulb, 
  AlertTriangle, 
  Info, 
  CheckCircle, 
  XCircle,
  AlertCircle
} from 'lucide-react';

export interface CalloutOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (type: 'info' | 'warning' | 'success' | 'error' | 'tip' | 'note') => ReturnType;
      toggleCallout: (type: 'info' | 'warning' | 'success' | 'error' | 'tip' | 'note') => ReturnType;
      unsetCallout: () => ReturnType;
    };
  }
}

interface CalloutComponentProps {
  node: {
    attrs: {
      type?: 'info' | 'warning' | 'success' | 'error' | 'tip' | 'note';
    };
  };
  updateAttributes: (attrs: any) => void;
  deleteNode: () => void;
}

const CalloutComponent = ({ node, updateAttributes, deleteNode }: CalloutComponentProps) => {
  const type = node.attrs.type || 'info';
  
  const icons = {
    info: Info,
    warning: AlertTriangle,
    success: CheckCircle,
    error: XCircle,
    tip: Lightbulb,
    note: AlertCircle
  };
  
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-100',
    success: 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950 dark:border-green-800 dark:text-green-100',
    error: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950 dark:border-red-800 dark:text-red-100',
    tip: 'bg-purple-50 border-purple-200 text-purple-900 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-100',
    note: 'bg-gray-50 border-gray-200 text-gray-900 dark:bg-gray-950 dark:border-gray-800 dark:text-gray-100'
  };
  
  const IconComponent = icons[type as keyof typeof icons];
  
  return (
    <NodeViewWrapper 
      className="callout-wrapper" 
      data-callout="" 
      data-type={type}
    >
      <div className={cn(
        'callout border-l-4 p-4 my-4 rounded-r-lg flex items-start gap-3',
        styles[type as keyof typeof styles]
      )} data-type={type}>
        <IconComponent className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <NodeViewContent 
          className="flex-1 min-w-0 focus:outline-none prose prose-sm max-w-none"
          as="div"
        />
        <button
          onClick={deleteNode}
          className="text-current opacity-50 hover:opacity-100 text-sm ml-2"
          title="Remover callout"
        >
          ×
        </button>
      </div>
    </NodeViewWrapper>
  );
};

export const CalloutExtension = Node.create<CalloutOptions>({
  name: 'callout',
  
  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },
  
  group: 'block',
  
  content: 'inline*',
  
  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: element => element.getAttribute('data-type'),
        renderHTML: attributes => {
          if (!attributes.type) {
            return {};
          }
          return {
            'data-type': attributes.type,
          };
        },
      },
    };
  },
  
  parseHTML() {
    return [
      {
        tag: 'div[data-callout]',
        getAttrs: (element) => {
          const el = element as HTMLElement;
          return {
            type: el.getAttribute('data-type') || 'info',
          };
        },
      },
    ];
  },
  
  renderHTML({ node, HTMLAttributes }) {
    const { type } = node.attrs;
    return [
      'div', 
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-callout': '',
        'data-type': type,
        class: `callout callout-${type}`,
      }),
      0 // This tells ProseMirror to render the content here
    ];
  },
  
  addNodeView() {
    return ReactNodeViewRenderer(CalloutComponent);
  },
  
  addCommands() {
    return {
      setCallout: (type) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: { type },
          content: [
            {
              type: 'text',
              text: 'Digite sua mensagem aqui...'
            }
          ]
        });
      },
      toggleCallout: (type) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: { type },
          content: [
            {
              type: 'text',
              text: 'Digite sua mensagem aqui...'
            }
          ]
        });
      },
      unsetCallout: () => ({ commands }) => {
        return commands.deleteSelection();
      },
    };
  },
});