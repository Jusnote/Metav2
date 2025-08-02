import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { Highlight } from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { CodeBlock } from '@tiptap/extension-code-block';
import { Code } from '@tiptap/extension-code';
import { HorizontalRule } from '@tiptap/extension-horizontal-rule';
import { Image } from '@tiptap/extension-image';
import { Superscript } from '@tiptap/extension-superscript';
import { Subscript } from '@tiptap/extension-subscript';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import EmojiPicker from 'emoji-picker-react';
import { CalloutExtension } from '@/components/ui/callout';
import { ColumnsExtension } from '@/components/ui/columns';
import { CarouselExtension } from '@/components/ui/carousel-extension';
import { InteractiveExplanationExtension } from '@/components/ui/interactive-explanation-extension';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Type,
  Palette,
  Smile,
  Hash,
  Minus,
  Table as TableIcon,
  Code2,
  Highlighter,
  IndentIncrease,
  IndentDecrease,
  MoreHorizontal,
  Terminal,
  Upload,
  Lightbulb,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  AlertCircle,
  Columns2,
  Columns3,
  Superscript as SuperscriptIcon,
  Subscript as SubscriptIcon,
  RemoveFormatting,
  Eraser,
  Images,
  HelpCircle
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useState, useRef } from 'react';
import { TableInsertDialog } from './TableInsertDialog';
import { CarouselInsertDialog } from './CarouselInsertDialog';
import { ExplanationInsertDialog } from './ExplanationInsertDialog';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ content, onChange, placeholder, className }: RichTextEditorProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCalloutMenu, setShowCalloutMenu] = useState(false);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Desabilita o code do StarterKit para usar nossa versão customizada
        code: false,
      }),
      Code.configure({
        HTMLAttributes: {
          class: 'inline-code',
        },
      }),
      Underline,
      Superscript,
      Subscript,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color.configure({
        types: ['textStyle'],
      }),
      FontFamily.configure({
        types: ['textStyle'],
      }),
      Highlight.configure({ 
        multicolor: true,
        HTMLAttributes: {
          class: 'highlight',
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'editor-image',
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlock.configure({
        HTMLAttributes: {
          class: 'code-block',
        },
      }),
      HorizontalRule,
      CalloutExtension,
      ColumnsExtension,
      CarouselExtension,
      InteractiveExplanationExtension,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
      
      // Reaplicar cores das tabelas após atualização
      setTimeout(() => {
        const tables = document.querySelectorAll('.ProseMirror table[data-table-color]');
        tables.forEach(table => {
          const color = (table as HTMLElement).getAttribute('data-table-color');
          if (color) {
            applyTableColor(table as HTMLElement, color);
          }
        });
      }, 50);
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[400px] p-4',
        style: 'font-size: 16px; line-height: 1.8; color: hsl(var(--foreground));',
      },
      handleKeyDown: (view, event) => {
        // Detectar Backspace para exclusão de tabela
        if (event.key === 'Backspace') {
          const { state } = view;
          const { $from, $to } = state.selection;
          
          // Caso 1: Cursor está em parágrafo vazio após uma tabela
          if ($from.parent.type.name === 'paragraph' && $from.parent.textContent === '' && $from.pos === $to.pos) {
            const nodeBefore = $from.nodeBefore;
            if (nodeBefore && nodeBefore.type.name === 'table') {
              // Selecionar e deletar a tabela
              const tableStart = $from.pos - nodeBefore.nodeSize;
              const tableEnd = $from.pos;
              const tr = state.tr.delete(tableStart - 1, tableEnd - 1);
              view.dispatch(tr);
              return true;
            }
          }
          
          // Caso 2: Cursor está no início de um parágrafo e há uma tabela antes
          if ($from.parentOffset === 0 && $from.pos === $to.pos) {
            const before = state.doc.resolve($from.pos - 1);
            if (before.nodeBefore && before.nodeBefore.type.name === 'table') {
              const tableStart = before.pos - before.nodeBefore.nodeSize;
              const tableEnd = before.pos;
              const tr = state.tr.delete(tableStart, tableEnd);
              view.dispatch(tr);
              return true;
            }
          }
        }
        return false;
      },
    },
  });

  if (!editor) {
    return null;
  }

  const ToolbarButton = ({ 
    onClick, 
    isActive = false, 
    children, 
    title,
    disabled = false
  }: { 
    onClick: () => void; 
    isActive?: boolean; 
    children: React.ReactNode; 
    title: string;
    disabled?: boolean;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-8 w-8 p-0",
        isActive && "bg-accent text-accent-foreground"
      )}
      title={title}
    >
      {children}
    </Button>
  );

  const colors = [
    '#000000', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#FFFFFF',
    '#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#6366F1',
    '#8B5CF6', '#EC4899', '#F43F5E', '#10B981', '#06B6D4', '#84CC16'
  ];

  const highlightColors = [
    '#FEF3C7', '#FECACA', '#F3E8FF', '#DBEAFE', '#D1FAE5', '#FED7AA',
    '#FCE7F3', '#E0E7FF', '#F0F9FF', '#ECFDF5', '#FEF7CD', '#FDE68A'
  ];

  const fontFamilies = [
    { value: 'Inter', label: 'Inter' },
    { value: 'Times New Roman', label: 'Times' },
    { value: 'Arial', label: 'Arial' },
    { value: 'Helvetica', label: 'Helvetica' },
    { value: 'Courier New', label: 'Courier' },
    { value: 'Georgia', label: 'Georgia' },
    { value: 'Verdana', label: 'Verdana' },
    { value: 'monospace', label: 'Monospace' }
  ];

  const insertTable = (rows: number, cols: number, color: string) => {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    
    // Aplicar cor personalizada à tabela
    setTimeout(() => {
      const tables = document.querySelectorAll('.ProseMirror table');
      const lastTable = tables[tables.length - 1] as HTMLElement;
      if (lastTable) {
        lastTable.setAttribute('data-table-color', color);
        applyTableColor(lastTable, color);
      }
    }, 100);
  };

  const insertHorizontalRule = () => {
    editor.chain().focus().setHorizontalRule().run();
  };

  const insertCodeBlock = () => {
    editor.chain().focus().toggleCodeBlock().run();
  };

  const onEmojiClick = (emojiData: { emoji: string }) => {
    editor.chain().focus().insertContent(emojiData.emoji).run();
    setShowEmojiPicker(false);
  };

  const handleImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const base64 = e.target?.result as string;
        editor.chain().focus().setImage({ src: base64 }).run();
      };
      reader.readAsDataURL(file);
    }
  };

  const insertCallout = (type: 'info' | 'warning' | 'success' | 'error' | 'tip' | 'note') => {
    editor.chain().focus().setCallout(type).run();
    setShowCalloutMenu(false);
  };

  const insertColumns = (count: number) => {
    editor.chain().focus().setColumns(count).run();
    setShowColumnsMenu(false);
  };

  const insertCarousel = (images: string[]) => {
    const slides = images.map(image => ({
      image,
      content: '<p>Escreva aqui o conteúdo para este slide...</p>'
    }));
    
    editor.chain().focus().setCarousel(slides).run();
  };

  const insertExplanation = (explanation: string) => {
    editor.chain().focus().setInteractiveExplanation({ explanation }).run();
  };

  const clearFormatting = () => {
    editor.chain().focus().clearNodes().unsetAllMarks().run();
  };

  const applyTableColor = (table: HTMLElement, color: string) => {
    const lighterColor = (alpha: number) => {
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // Estilizar bordas com !important para sobrescrever CSS padrão
    table.style.setProperty('border-color', color, 'important');
    table.style.setProperty('border', `1px solid ${color}`, 'important');
    
    // Estilizar cabeçalhos
    const headers = table.querySelectorAll('th');
    headers.forEach(th => {
      (th as HTMLElement).style.setProperty('background-color', lighterColor(0.2), 'important');
      (th as HTMLElement).style.setProperty('border-color', color, 'important');
      (th as HTMLElement).style.setProperty('color', color, 'important');
      (th as HTMLElement).style.setProperty('font-weight', '600', 'important');
    });
    
    // Estilizar células
    const cells = table.querySelectorAll('td');
    cells.forEach((td, index) => {
      const row = Math.floor(index / (table.querySelectorAll('tr')[1]?.querySelectorAll('td, th').length || 1));
      (td as HTMLElement).style.setProperty('border-color', color, 'important');
      if (row % 2 === 1) {
        (td as HTMLElement).style.setProperty('background-color', lighterColor(0.1), 'important');
      } else {
        (td as HTMLElement).style.setProperty('background-color', 'transparent', 'important');
      }
    });
  };

  return (
    <div className={cn("border border-border rounded-lg overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="border-b border-border bg-muted/30 p-2">
        <div className="flex items-center gap-1 flex-wrap">
          {/* Desfazer/Refazer */}
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            title="Desfazer (Ctrl+Z)"
            disabled={!editor.can().undo()}
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            title="Refazer (Ctrl+Y)"
            disabled={!editor.can().redo()}
          >
            <Redo className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Títulos */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive('heading', { level: 1 })}
            title="Título 1"
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            title="Título 2"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive('heading', { level: 3 })}
            title="Título 3"
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>
          
          {/* Títulos H4-H6 */}
          <Select
            value={editor.isActive('heading') ? `h${editor.getAttributes('heading').level}` : 'paragraph'}
            onValueChange={(value) => {
              if (value === 'paragraph') {
                editor.chain().focus().setParagraph().run();
              } else {
                const level = parseInt(value.replace('h', '')) as 1 | 2 | 3 | 4 | 5 | 6;
                editor.chain().focus().toggleHeading({ level }).run();
              }
            }}
          >
            <SelectTrigger className="w-20 h-8">
              <div className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paragraph">P</SelectItem>
              <SelectItem value="h1">H1</SelectItem>
              <SelectItem value="h2">H2</SelectItem>
              <SelectItem value="h3">H3</SelectItem>
              <SelectItem value="h4">H4</SelectItem>
              <SelectItem value="h5">H5</SelectItem>
              <SelectItem value="h6">H6</SelectItem>
            </SelectContent>
          </Select>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Formatação de texto */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="Negrito (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="Itálico (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            title="Sublinhado (Ctrl+U)"
          >
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            title="Riscado"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editor.isActive('code')}
            title="Código inline"
          >
            <Terminal className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
            isActive={editor.isActive('superscript')}
            title="Sobrescrito (x²)"
          >
            <SuperscriptIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleSubscript().run()}
            isActive={editor.isActive('subscript')}
            title="Subscrito (H₂O)"
          >
            <SubscriptIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={clearFormatting}
            title="Limpar formatação"
          >
            <Eraser className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Cores e realce */}
          <Popover open={showColorPicker} onOpenChange={setShowColorPicker}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title="Cor do texto"
              >
                <Palette className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Cor do texto</h4>
                  <div className="grid grid-cols-6 gap-1">
                    {colors.map((color: string) => (
                      <button
                        key={color}
                        className="w-8 h-8 rounded border border-border hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          editor.chain().focus().setColor(color).run();
                          setShowColorPicker(false);
                        }}
                        title={`Cor: ${color}`}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Realce</h4>
                  <div className="grid grid-cols-6 gap-1">
                    {highlightColors.map((color: string) => (
                      <button
                        key={color}
                        className="w-8 h-8 rounded border border-border hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          editor.chain().focus().toggleHighlight({ color }).run();
                          setShowColorPicker(false);
                        }}
                        title={`Realce: ${color}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <ToolbarButton
            onClick={() => editor.chain().focus().unsetHighlight().run()}
            title="Remover realce"
          >
            <Highlighter className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Alinhamento */}
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            isActive={editor.isActive({ textAlign: 'left' })}
            title="Alinhar à esquerda"
          >
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            isActive={editor.isActive({ textAlign: 'center' })}
            title="Centralizar"
          >
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            isActive={editor.isActive({ textAlign: 'right' })}
            title="Alinhar à direita"
          >
            <AlignRight className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            isActive={editor.isActive({ textAlign: 'justify' })}
            title="Justificar"
          >
            <AlignJustify className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Recuo */}
          <ToolbarButton
            onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
            title="Diminuir recuo"
            disabled={!editor.can().sinkListItem('listItem')}
          >
            <IndentDecrease className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().liftListItem('listItem').run()}
            title="Aumentar recuo"
            disabled={!editor.can().liftListItem('listItem')}
          >
            <IndentIncrease className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Listas */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title="Lista não ordenada"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title="Lista ordenada"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Elementos estruturais */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            title="Citação"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={insertCodeBlock}
            isActive={editor.isActive('codeBlock')}
            title="Bloco de código"
          >
            <Code2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={insertHorizontalRule}
            title="Linha horizontal"
          >
            <Minus className="h-4 w-4" />
          </ToolbarButton>
          <TableInsertDialog onInsertTable={insertTable} />

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Upload de Imagem */}
          <ToolbarButton
            onClick={handleImageUpload}
            title="Inserir imagem"
          >
            <Upload className="h-4 w-4" />
          </ToolbarButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Carrossel */}
          <CarouselInsertDialog onInsertCarousel={insertCarousel}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="Inserir carrossel"
            >
              <Images className="h-4 w-4" />
            </Button>
          </CarouselInsertDialog>

          {/* Callouts */}
          <Popover open={showCalloutMenu} onOpenChange={setShowCalloutMenu}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title="Inserir bloco de destaque"
              >
                <Lightbulb className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2">
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => insertCallout('tip')}
                >
                  <Lightbulb className="h-4 w-4 text-purple-500" />
                  Dica
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => insertCallout('info')}
                >
                  <Info className="h-4 w-4 text-blue-500" />
                  Informação
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => insertCallout('warning')}
                >
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Aviso
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => insertCallout('success')}
                >
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Sucesso
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => insertCallout('error')}
                >
                  <XCircle className="h-4 w-4 text-red-500" />
                  Erro
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => insertCallout('note')}
                >
                  <AlertCircle className="h-4 w-4 text-gray-500" />
                  Nota
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Layout em Colunas */}
          <Popover open={showColumnsMenu} onOpenChange={setShowColumnsMenu}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title="Layout em colunas"
              >
                <Columns2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-32 p-2">
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => insertColumns(2)}
                >
                  <Columns2 className="h-4 w-4" />
                  2 Colunas
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => insertColumns(3)}
                >
                  <Columns3 className="h-4 w-4" />
                  3 Colunas
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => insertColumns(4)}
                >
                  <div className="grid grid-cols-4 gap-0.5 w-4 h-4">
                    <div className="bg-current rounded-sm"></div>
                    <div className="bg-current rounded-sm"></div>
                    <div className="bg-current rounded-sm"></div>
                    <div className="bg-current rounded-sm"></div>
                  </div>
                  4 Colunas
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Emojis */}
          <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title="Inserir emoji"
              >
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <EmojiPicker onEmojiClick={onEmojiClick} />
            </PopoverContent>
          </Popover>

          {/* Explicação Interativa - Botão independente */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <ExplanationInsertDialog 
                  onInsert={insertExplanation}
                  disabled={editor.state.selection.empty}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 w-8 p-0 transition-all duration-200",
                      !editor.state.selection.empty && [
                        "bg-primary/10 border border-primary/30",
                        "hover:bg-primary/20 hover:border-primary/50",
                        "shadow-sm"
                      ]
                    )}
                    disabled={editor.state.selection.empty}
                  >
                    <HelpCircle className={cn(
                      "h-4 w-4 transition-colors",
                      !editor.state.selection.empty ? "text-primary" : "text-muted-foreground"
                    )} />
                  </Button>
                </ExplanationInsertDialog>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm">
                  {editor.state.selection.empty 
                    ? "Selecione um texto para adicionar explicação interativa"
                    : "Adicionar explicação ao texto selecionado"
                  }
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Fonte */}
          <Select
            value={editor.getAttributes('textStyle').fontFamily || 'Inter'}
            onValueChange={(value) => editor.chain().focus().setFontFamily(value).run()}
          >
            <SelectTrigger className="w-32 h-8">
              <div className="flex items-center gap-1">
                <Type className="h-3 w-3" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {fontFamilies.map((font: { value: string; label: string }) => (
                <SelectItem key={font.value} value={font.value}>
                  {font.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Editor */}
      <div className="min-h-[400px] bg-background relative">
        <style>
          {`
            .ProseMirror {
              font-size: 16px;
              line-height: 1.8;
              color: hsl(var(--foreground));
            }
            
            .ProseMirror h1 {
              font-size: 2rem;
              font-weight: bold;
              color: hsl(var(--foreground));
              margin-bottom: 1rem;
              margin-top: 1.5rem;
              line-height: 1.2;
            }
            
            .ProseMirror h2 {
              font-size: 1.5rem;
              font-weight: 600;
              color: hsl(var(--foreground));
              margin-bottom: 0.75rem;
              margin-top: 1.25rem;
              line-height: 1.3;
            }
            
            .ProseMirror h3 {
              font-size: 1.25rem;
              font-weight: 500;
              color: hsl(var(--foreground));
              margin-bottom: 0.5rem;
              margin-top: 1rem;
              line-height: 1.4;
            }
            
            .ProseMirror h4 {
              font-size: 1.125rem;
              font-weight: 500;
              color: hsl(var(--foreground));
              margin-bottom: 0.5rem;
              margin-top: 1rem;
              line-height: 1.4;
            }
            
            .ProseMirror h5 {
              font-size: 1rem;
              font-weight: 500;
              color: hsl(var(--foreground));
              margin-bottom: 0.5rem;
              margin-top: 0.75rem;
              line-height: 1.5;
            }
            
            .ProseMirror h6 {
              font-size: 0.875rem;
              font-weight: 500;
              color: hsl(var(--muted-foreground));
              margin-bottom: 0.5rem;
              margin-top: 0.75rem;
              line-height: 1.5;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            
            .ProseMirror p {
              margin-bottom: 0.75rem;
              color: hsl(var(--foreground));
              line-height: 1.75;
            }
            
            .ProseMirror strong {
              font-weight: 600;
              /* Remove color para permitir que cores personalizadas sejam aplicadas */
            }
            
            .ProseMirror em {
              font-style: italic;
              /* Remove color para permitir que cores personalizadas sejam aplicadas */
            }
            
            .ProseMirror .inline-code,
            .ProseMirror code {
              background-color: hsl(var(--muted));
              color: hsl(var(--muted-foreground)) !important;
              padding: 0.125rem 0.25rem;
              border-radius: 0.25rem;
              font-family: 'Courier New', monospace;
              font-size: 0.875em;
              font-weight: inherit;
            }
            
            .ProseMirror .code-block {
              background-color: hsl(var(--muted));
              color: hsl(var(--muted-foreground));
              padding: 1rem;
              border-radius: 0.5rem;
              font-family: 'Courier New', monospace;
              font-size: 0.875rem;
              margin: 1rem 0;
              white-space: pre;
              overflow-x: auto;
              border: 1px solid hsl(var(--border));
            }
            
            .ProseMirror ul, .ProseMirror ol {
              margin-bottom: 0.75rem;
              color: hsl(var(--foreground));
              padding-left: 1.5rem;
            }
            
            .ProseMirror li {
              margin-bottom: 0.25rem;
              line-height: 1.75;
            }
            
            .ProseMirror blockquote {
              color: hsl(var(--muted-foreground));
              border-left: 4px solid hsl(var(--primary));
              padding-left: 1rem;
              margin: 1rem 0;
              font-style: italic;
              background-color: hsl(var(--muted)/0.3);
              padding: 1rem;
              border-radius: 0.5rem;
            }
            
            .ProseMirror .highlight {
              padding: 0.125rem 0.25rem;
              border-radius: 0.25rem;
            }
            
            .ProseMirror hr {
              border: none;
              border-top: 2px solid hsl(var(--border));
              margin: 2rem 0;
            }
            
            .ProseMirror table {
              border-collapse: collapse;
              margin: 1rem 0;
              width: 100%;
              border: 1px solid hsl(var(--border));
            }
            
            .ProseMirror table td, .ProseMirror table th {
              border: 1px solid hsl(var(--border));
              padding: 0.5rem;
              text-align: left;
              vertical-align: top;
            }
            
            .ProseMirror table th {
              background-color: hsl(var(--muted));
              font-weight: 600;
            }
            
            .ProseMirror table tr:nth-child(even) {
              background-color: hsl(var(--muted)/0.5);
            }
            
            .ProseMirror .tableWrapper {
              overflow-x: auto;
            }
            
            .ProseMirror .resize-cursor {
              cursor: ew-resize;
              cursor: col-resize;
            }

            .ProseMirror .editor-image {
              max-width: 100%;
              height: auto;
              border-radius: 0.5rem;
              margin: 1rem 0;
              display: block;
            }

            .ProseMirror .editor-image.ProseMirror-selectednode {
              outline: 2px solid hsl(var(--primary));
            }

            .ProseMirror sup {
              font-size: 0.75em;
              vertical-align: super;
              line-height: 0;
            }

            .ProseMirror sub {
              font-size: 0.75em;
              vertical-align: sub;
              line-height: 0;
            }

            .callout-wrapper {
              margin: 1rem 0;
            }

            .columns-wrapper {
              margin: 1rem 0;
            }

            .columns-container {
              position: relative;
            }

            .carousel-wrapper {
              margin: 1rem 0;
              border: 1px solid hsl(var(--border));
              border-radius: 0.5rem;
              overflow: hidden;
            }

            .carousel-wrapper .ProseMirror-selectednode {
              outline: 2px solid hsl(var(--primary));
            }

            /* Explicação Interativa */
            .ProseMirror .interactive-explanation-node {
              display: inline;
            }

            .ProseMirror span[data-explanation] {
              color: hsl(var(--primary)) !important;
              font-weight: 500 !important;
              text-decoration: underline !important;
              text-decoration-color: hsl(var(--primary)/0.5) !important;
              text-decoration-thickness: 2px !important;
              text-underline-offset: 2px !important;
              background-color: hsl(var(--primary)/0.1) !important;
              padding: 0 0.25rem !important;
              border-radius: 0.125rem !important;
              cursor: help !important;
              transition: all 0.2s !important;
            }

            .ProseMirror span[data-explanation]:hover {
              text-decoration-color: hsl(var(--primary)) !important;
              background-color: hsl(var(--primary)/0.2) !important;
            }
          `}
        </style>
        <EditorContent 
          editor={editor} 
          className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[400px] [&_.ProseMirror]:p-4"
        />
        {!editor.getText() && (
          <div className="absolute top-8 left-8 text-muted-foreground pointer-events-none">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}