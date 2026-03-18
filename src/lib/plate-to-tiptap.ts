/**
 * Converts Plate.js JSON content to TipTap/ProseMirror JSON format.
 * Used exclusively by the Lei Seca editor (migrated from Plate to TipTap).
 */

interface PlateTextChild {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  highlight?: boolean | string;
  color?: string;
  backgroundColor?: string;
}

interface PlateNode {
  type: string;
  children: PlateTextChild[];
  indent?: number;
  slug?: string;
  [key: string]: any;
}

interface TipTapMark {
  type: string;
  attrs?: Record<string, any>;
}

interface TipTapTextNode {
  type: 'text';
  text: string;
  marks?: TipTapMark[];
}

interface TipTapBlockNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TipTapTextNode[];
}

function convertMarks(node: PlateTextChild): TipTapMark[] {
  const marks: TipTapMark[] = [];
  if (node.bold) marks.push({ type: 'bold' });
  if (node.italic) marks.push({ type: 'italic' });
  if (node.underline) marks.push({ type: 'underline' });
  if (node.strikethrough) marks.push({ type: 'strike' });
  if (node.code) marks.push({ type: 'code' });
  if (node.highlight) {
    marks.push({
      type: 'highlight',
      attrs: typeof node.highlight === 'string' ? { color: node.highlight } : undefined,
    });
  }
  if (node.backgroundColor) {
    marks.push({ type: 'highlight', attrs: { color: node.backgroundColor } });
  }
  if (node.color) {
    marks.push({ type: 'textStyle', attrs: { color: node.color } });
  }
  return marks;
}

function detectRole(children: PlateTextChild[]): string | null {
  if (!children?.length) return null;
  const first = children[0];
  if (!first?.bold || !first.text) return null;
  const t = first.text.trimStart();
  if (/^Art\.?\s/i.test(t)) return 'artigo';
  if (/^Par[áa]grafo\s+[úu]nico/i.test(t)) return 'paragrafo_unico';
  if (/^§/.test(t)) return 'paragrafo';
  if (/^Pena\s*[-–—]/i.test(t)) return 'pena';
  if (/^[IVXLCDM]+\s*[-–—]/.test(t)) return 'inciso';
  if (/^[a-z]\)\s/.test(t)) return 'alinea';
  if (/^\d+\.\s/.test(t)) return 'item';
  if (children.length === 1) return 'epigrafe';
  return null;
}

function convertNode(plateNode: PlateNode): TipTapBlockNode {
  const { type, children, indent, slug } = plateNode;

  // Map Plate type to TipTap type
  let tiptapType = 'paragraph';
  const attrs: Record<string, any> = {};

  if (type?.startsWith('h') && type.length === 2) {
    const level = parseInt(type[1]);
    if (level >= 1 && level <= 6) {
      tiptapType = 'heading';
      attrs.level = level;
    }
  } else if (type === 'blockquote') {
    tiptapType = 'blockquote';
  } else if (type === 'hr') {
    tiptapType = 'horizontalRule';
  }

  if (indent) attrs.indent = indent;
  if (slug) attrs.slug = slug;

  const role = detectRole(children);
  if (role) attrs.role = role;

  // Convert text children
  const content: TipTapTextNode[] = [];
  for (const child of children || []) {
    if (typeof child.text !== 'string' || child.text === '') continue;
    const marks = convertMarks(child);
    const textNode: TipTapTextNode = { type: 'text', text: child.text };
    if (marks.length > 0) textNode.marks = marks;
    content.push(textNode);
  }

  const result: TipTapBlockNode = { type: tiptapType };
  if (Object.keys(attrs).length > 0) result.attrs = attrs;
  if (content.length > 0) result.content = content;

  return result;
}

export function plateToTipTap(
  plateContent: PlateNode[]
): { type: 'doc'; content: TipTapBlockNode[] } {
  if (!plateContent || plateContent.length === 0) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  return {
    type: 'doc',
    content: plateContent.map(convertNode),
  };
}
