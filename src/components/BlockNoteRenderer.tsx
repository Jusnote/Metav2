/**
 * 🎨 BLOCKNOTE RENDERER
 * 
 * Componente para renderizar conteúdo do BlockNote
 * de forma estática (sem editor).
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface BlockNoteRendererProps {
  content: any[];
  className?: string;
}

/**
 * Renderiza um bloco individual do BlockNote
 */
function BlockRenderer({ block }: { block: any }) {
  const extractText = (content: any[]): string => {
    if (!content || !Array.isArray(content)) return '';
    
    return content
      .filter(item => item.type === 'text')
      .map(item => item.text || '')
      .join('');
  };

  const text = extractText(block.content);
  
  // Se não tem texto, não renderizar
  if (!text.trim()) return null;

  switch (block.type) {
    case 'heading':
      const level = block.props?.level || 2;
      const HeadingTag = `h${Math.min(Math.max(level, 1), 6)}` as keyof JSX.IntrinsicElements;
      
      return (
        <HeadingTag className={cn(
          "font-semibold text-slate-800 mb-2",
          level === 1 && "text-2xl",
          level === 2 && "text-xl",
          level === 3 && "text-lg",
          level >= 4 && "text-base"
        )}>
          {text}
        </HeadingTag>
      );

    case 'paragraph':
      return (
        <p className="text-slate-700 leading-relaxed mb-2">
          {text}
        </p>
      );

    case 'quote':
      return (
        <blockquote className="border-l-4 border-blue-400 pl-4 py-2 my-3 bg-blue-50/50 rounded-r-lg">
          <p className="text-slate-700 leading-relaxed italic">
            {text}
          </p>
        </blockquote>
      );

    case 'bulletListItem':
      return (
        <li className="text-slate-700 leading-relaxed mb-1">
          {text}
        </li>
      );

    case 'numberedListItem':
      return (
        <li className="text-slate-700 leading-relaxed mb-1">
          {text}
        </li>
      );

    case 'checkListItem':
      const isChecked = block.props?.checked || false;
      return (
        <div className="flex items-center gap-2 mb-1">
          <input 
            type="checkbox" 
            checked={isChecked} 
            readOnly 
            className="rounded border-gray-300"
          />
          <span className={cn(
            "text-slate-700 leading-relaxed",
            isChecked && "line-through text-slate-500"
          )}>
            {text}
          </span>
        </div>
      );

    default:
      // Fallback para tipos não reconhecidos
      return (
        <div className="text-slate-700 leading-relaxed mb-2">
          {text}
        </div>
      );
  }
}

/**
 * Agrupa blocos de lista para renderização adequada
 */
function groupBlocks(blocks: any[]) {
  const grouped: any[] = [];
  let currentList: any[] = [];
  let currentListType: string | null = null;

  blocks.forEach(block => {
    const isListItem = ['bulletListItem', 'numberedListItem', 'checkListItem'].includes(block.type);
    
    if (isListItem) {
      if (currentListType === block.type) {
        // Continuar lista atual
        currentList.push(block);
      } else {
        // Finalizar lista anterior e iniciar nova
        if (currentList.length > 0) {
          grouped.push({ type: 'list', listType: currentListType, items: currentList });
        }
        currentList = [block];
        currentListType = block.type;
      }
    } else {
      // Finalizar lista se existir
      if (currentList.length > 0) {
        grouped.push({ type: 'list', listType: currentListType, items: currentList });
        currentList = [];
        currentListType = null;
      }
      // Adicionar bloco normal
      grouped.push(block);
    }
  });

  // Finalizar lista pendente
  if (currentList.length > 0) {
    grouped.push({ type: 'list', listType: currentListType, items: currentList });
  }

  return grouped;
}

/**
 * Componente principal para renderizar conteúdo BlockNote
 */
export function BlockNoteRenderer({ content, className }: BlockNoteRendererProps) {
  if (!content || !Array.isArray(content) || content.length === 0) {
    return (
      <div className={cn("text-slate-500 italic", className)}>
        Conteúdo vazio
      </div>
    );
  }

  const groupedBlocks = groupBlocks(content);

  return (
    <div className={cn("space-y-1", className)}>
      {groupedBlocks.map((item, index) => {
        if (item.type === 'list') {
          const ListTag = item.listType === 'numberedListItem' ? 'ol' : 'ul';
          const listClass = item.listType === 'numberedListItem' 
            ? 'list-decimal list-inside space-y-1' 
            : item.listType === 'bulletListItem'
            ? 'list-disc list-inside space-y-1'
            : 'space-y-1';

          return (
            <ListTag key={index} className={listClass}>
              {item.items.map((listItem: any, itemIndex: number) => (
                <BlockRenderer key={itemIndex} block={listItem} />
              ))}
            </ListTag>
          );
        }

        return <BlockRenderer key={index} block={item} />;
      })}
    </div>
  );
}
