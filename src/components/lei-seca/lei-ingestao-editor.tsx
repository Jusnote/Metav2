'use client';

import React, { useMemo, useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { StarterKit } from '@tiptap/starter-kit';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
// TextStyle e Color removidos intencionalmente:
// sem essas extensões, o TipTap descarta font/cor/tamanho no paste
// mas preserva bold, centralizado, indent.
import Underline from '@tiptap/extension-underline';
import Paragraph from '@tiptap/extension-paragraph';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Undo2,
  Redo2,
  Wand2,
  Indent,
  Outdent,
  Tags,
  Eye,
  Pencil,
  Loader2,
  X,
  Highlighter,
} from 'lucide-react';

// ============ Role options for dropdown ============

const ROLE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'hierarchy', label: 'Hierarquia' },
  { value: 'artigo', label: 'Artigo' },
  { value: 'paragrafo', label: '§' },
  { value: 'paragrafo_unico', label: '§ único' },
  { value: 'inciso', label: 'Inciso' },
  { value: 'alinea', label: 'Alínea' },
  { value: 'item', label: 'Item' },
  { value: 'pena', label: 'Pena' },
  { value: 'epigrafe', label: 'Epígrafe' },
] as const;

// ============ Badge types ============

interface BadgeData {
  type: 'revogado' | 'vetado' | 'sem_vigencia' | 'informacoes';
  resumo: string;
}

const BADGE_LABELS: Record<BadgeData['type'], string> = {
  revogado: 'Dispositivo revogado',
  vetado: 'Dispositivo vetado',
  sem_vigencia: 'Dispositivo sem vigência',
  informacoes: 'Informações adicionais',
};

// ============ Custom Paragraph (indent + slug + role) ============

const LeiParagraph = Paragraph.extend({
  addAttributes() {
    return {
      indent: {
        default: 0,
        parseHTML: (el: HTMLElement) =>
          parseInt(el.getAttribute('data-indent') || '0'),
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.indent) return {};
          return {
            'data-indent': attrs.indent,
            style: `padding-left: ${attrs.indent * 2}rem`,
          };
        },
      },
      slug: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-slug'),
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.slug) return {};
          return { 'data-slug': attrs.slug };
        },
      },
      role: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-role'),
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.role) return {};
          return { 'data-role': attrs.role };
        },
      },
    };
  },
});

// ============ Regex for auto-detection ============

const RE_ARTIGO = /^Art\.?\s+(\d+(?:\.\d+)*[ºo°]?(?:-[A-Za-z]+)?)\s*[.\-–—]?\s+(.*)/i;
const RE_PARAGRAFO = /^§\s*(\d+[ºo°]?(?:-[A-Za-z]+)?)\s*[.\-–—]?\s*(.*)/i;
const RE_PARAGRAFO_UNICO = /^Par[áa]grafo\s+[úu]nico\s*[.\-–—]?\s*(.*)/i;
const RE_INCISO = /^([IVXLCDM]+)\s*[–—-]\s*(.*)/;
const RE_ALINEA = /^([a-z])\)\s*(.*)/;
const RE_ITEM = /^(\d+)\.\s+(.*)/;
const RE_PENA = /^Pena\s*[–—-]\s*(.*)/i;
// Hierarchy patterns
const RE_PARTE = /^PARTE\s+(GERAL|ESPECIAL|PRELIMINAR|COMPLEMENTAR|[IVXLCDM]+)\s*(.*)/i;
const RE_LIVRO = /^LIVRO\s+([IVXLCDM]+(?:\s+COMPLEMENTAR)?|COMPLEMENTAR|[ÚU]NICO)\s*(.*)/i;
const RE_TITULO = /^T[ÍI]TULO\s+([IVXLCDM]+|[ÚU]NICO)\s*(.*)/i;
const RE_CAPITULO = /^CAP[ÍI]TULO\s+([IVXLCDM]+(?:-[A-Z]+)?|[ÚU]NICO)\s*(.*)/i;
const RE_SECAO = /^Se[çc][ãa]o\s+([IVXLCDM]+|[ÚU]NICA)\s*(.*)/i;
const RE_SUBSECAO = /^Subse[çc][ãa]o\s+([IVXLCDM]+|[ÚU]NICA)\s*(.*)/i;
// Filter: paragraphs ending with (any annotation) or standalone Vigência
const RE_ANOTACAO_FILTER = /\([^)]{2,}\)\s*[.;,]?\s*$|\bVig[êe]ncia\s*$/i;

interface LineClassification {
  type: 'hierarchy' | 'artigo' | 'paragrafo' | 'paragrafo_unico' | 'inciso' | 'alinea' | 'item' | 'pena' | 'text';
  label: string;     // bold part
  content: string;   // rest
  indent: number;
}

function classifyLine(line: string): LineClassification {
  // Normalize non-breaking spaces (U+00A0) from Planalto HTML before matching
  const trimmed = line.replace(/\u00A0/g, ' ').trim();
  if (!trimmed) return { type: 'text', label: '', content: '', indent: 0 };

  // Hierarchy
  const hierPatterns: [RegExp, string][] = [
    [RE_PARTE, 'PARTE'], [RE_LIVRO, 'LIVRO'], [RE_TITULO, 'TÍTULO'],
    [RE_CAPITULO, 'CAPÍTULO'], [RE_SECAO, 'Seção'], [RE_SUBSECAO, 'Subseção'],
  ];
  for (const [re, prefix] of hierPatterns) {
    const m = trimmed.match(re);
    if (m) {
      const header = `${prefix} ${m[1]}`;
      const desc = m[2]?.trim() || '';
      return { type: 'hierarchy', label: header, content: desc, indent: 0 };
    }
  }

  // Article elements
  let m = trimmed.match(RE_ARTIGO);
  if (m) return { type: 'artigo', label: `Art. ${m[1]}`, content: m[2], indent: 0 };

  m = trimmed.match(RE_PARAGRAFO_UNICO);
  if (m) return { type: 'paragrafo_unico', label: 'Parágrafo único.', content: m[1], indent: 1 };

  m = trimmed.match(RE_PARAGRAFO);
  if (m) return { type: 'paragrafo', label: `§ ${m[1]}`, content: m[2], indent: 1 };

  m = trimmed.match(RE_INCISO);
  if (m) return { type: 'inciso', label: `${m[1]} -`, content: m[2], indent: 1 };

  m = trimmed.match(RE_ALINEA);
  if (m) return { type: 'alinea', label: `${m[1]})`, content: m[2], indent: 2 };

  m = trimmed.match(RE_ITEM);
  if (m) return { type: 'item', label: `${m[1]}.`, content: m[2], indent: 3 };

  m = trimmed.match(RE_PENA);
  if (m) return { type: 'pena', label: 'Pena -', content: m[1], indent: 1 };

  return { type: 'text', label: '', content: trimmed, indent: 0 };
}

// ============ Toolbar ============

function IngestaoToolbar({
  editor,
  previewMode,
  onTogglePreview,
  onHighlightAnnotations,
}: {
  editor: ReturnType<typeof useEditor>;
  previewMode: boolean;
  onTogglePreview: () => void;
  onHighlightAnnotations: () => void;
}) {
  if (!editor) return null;

  return (
    <div className="sticky top-0 z-10 flex items-center gap-1 border-b bg-background/95 backdrop-blur px-4 py-1.5 flex-wrap">
      {/* Text formatting */}
      <button
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
        className={`p-1.5 rounded-sm transition-colors ${
          editor.isActive('bold') ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        }`}
        title="Negrito (Ctrl+B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
        className={`p-1.5 rounded-sm transition-colors ${
          editor.isActive('italic') ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        }`}
        title="Itálico (Ctrl+I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}
        className={`p-1.5 rounded-sm transition-colors ${
          editor.isActive('underline') ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        }`}
        title="Sublinhado (Ctrl+U)"
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Alignment */}
      <button
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign('left').run(); }}
        className={`p-1.5 rounded-sm transition-colors ${
          editor.isActive({ textAlign: 'left' }) ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        }`}
        title="Alinhar à esquerda"
      >
        <AlignLeft className="h-3.5 w-3.5" />
      </button>
      <button
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign('center').run(); }}
        className={`p-1.5 rounded-sm transition-colors ${
          editor.isActive({ textAlign: 'center' }) ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        }`}
        title="Centralizar"
      >
        <AlignCenter className="h-3.5 w-3.5" />
      </button>
      <button
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign('right').run(); }}
        className={`p-1.5 rounded-sm transition-colors ${
          editor.isActive({ textAlign: 'right' }) ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        }`}
        title="Alinhar à direita"
      >
        <AlignRight className="h-3.5 w-3.5" />
      </button>
      <button
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign('justify').run(); }}
        className={`p-1.5 rounded-sm transition-colors ${
          editor.isActive({ textAlign: 'justify' }) ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        }`}
        title="Justificar"
      >
        <AlignJustify className="h-3.5 w-3.5" />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Indent manual */}
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          changeIndent(editor, 1);
        }}
        className="p-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title="Aumentar recuo (Indent+)"
      >
        <Indent className="h-3.5 w-3.5" />
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          changeIndent(editor, -1);
        }}
        className="p-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title="Diminuir recuo (Indent-)"
      >
        <Outdent className="h-3.5 w-3.5" />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Undo / Redo */}
      <button
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().undo().run(); }}
        disabled={!editor.can().undo()}
        className="p-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30"
        title="Desfazer (Ctrl+Z)"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </button>
      <button
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().redo().run(); }}
        disabled={!editor.can().redo()}
        className="p-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30"
        title="Refazer (Ctrl+Y)"
      >
        <Redo2 className="h-3.5 w-3.5" />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Auto-format buttons */}
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          autoFormatBoldLabels(editor);
        }}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs font-medium text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950 transition-colors"
        title="Bold em labels: Art., §, Parágrafo único, incisos (I -), alíneas (a)), itens (1.)"
      >
        <Bold className="h-3 w-3" />
        Labels
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          autoFormatIndent(editor);
        }}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950 transition-colors"
        title="Indent: §/incisos/pena = 1, alíneas = 2, itens = 3"
      >
        <AlignLeft className="h-3 w-3" />
        Indent
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          autoFormatCenterHierarchy(editor);
        }}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs font-medium text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950 transition-colors"
        title="Centralizar hierarquia: PARTE, LIVRO, TÍTULO, CAPÍTULO, Seção, Subseção"
      >
        <AlignCenter className="h-3 w-3" />
        Hierarquia
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          autoFormatBoldHierarchy(editor);
        }}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs font-medium text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950 transition-colors"
        title="Bold na hierarquia inteira: CAPÍTULO I, TÍTULO II, etc."
      >
        <Wand2 className="h-3 w-3" />
        Bold Hier.
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          autoFormatRoles(editor);
        }}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs font-medium text-teal-600 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-950 transition-colors"
        title="Detectar e aplicar roles (data-role) em todos os parágrafos"
      >
        <Tags className="h-3 w-3" />
        Roles
      </button>
      {!previewMode && (
        <>
          <button
            onMouseDown={(e) => { e.preventDefault(); onHighlightAnnotations(); }}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950 transition-colors"
            title="Destacar em amarelo os dispositivos com anotações legislativas (clique novamente para remover)"
          >
            <Highlighter className="h-3 w-3" />
            Anotações
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); autoFormatCenterAll(editor); }}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950 transition-colors"
            title="Centralizar todo o documento exceto hierarquias e suas descrições"
          >
            <AlignCenter className="h-3 w-3" />
            Centralizar
          </button>
        </>
      )}

      <div className="w-px h-5 bg-border mx-1" />

      {/* Role dropdown manual */}
      <select
        value={getCurrentRole(editor)}
        onChange={(e) => {
          setCurrentRole(editor, e.target.value);
          editor.commands.focus();
        }}
        className="h-7 px-1.5 text-[11px] rounded-sm border bg-background text-foreground cursor-pointer hover:bg-accent transition-colors"
        title="Role do parágrafo atual (correção manual)"
      >
        {ROLE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Modo Leitura toggle */}
      <button
        onMouseDown={(e) => { e.preventDefault(); onTogglePreview(); }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-semibold transition-colors ${
          previewMode
            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
            : 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950'
        }`}
        title={previewMode ? 'Voltar ao modo edição' : 'Visualizar como o aluno verá'}
      >
        {previewMode ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        {previewMode ? 'Editar' : 'Preview'}
      </button>
    </div>
  );
}

// ============ Manual indent: +1 / -1 on selected paragraph ============

function changeIndent(editor: ReturnType<typeof useEditor>, delta: number) {
  if (!editor) return;
  const { state } = editor;
  const { tr } = state;
  const { from, to } = state.selection;
  let changed = false;

  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name !== 'paragraph') return;
    const current = node.attrs.indent || 0;
    const next = Math.max(0, Math.min(current + delta, 5)); // 0-5 range
    if (next !== current) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
      changed = true;
    }
  });

  if (changed) {
    editor.view.dispatch(tr);
    editor.commands.focus();
  }
}

// ============ Role helpers (get/set on current paragraph) ============

function getCurrentRole(editor: ReturnType<typeof useEditor>): string {
  if (!editor) return '';
  const { state } = editor;
  const { from } = state.selection;
  const resolved = state.doc.resolve(from);
  const node = resolved.parent;
  if (node.type.name === 'paragraph') {
    return node.attrs.role || '';
  }
  return '';
}

function setCurrentRole(editor: ReturnType<typeof useEditor>, role: string) {
  if (!editor) return;
  const { state } = editor;
  const { tr } = state;
  const { from, to } = state.selection;
  let changed = false;

  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name !== 'paragraph') return;
    const newRole = role || null;
    if (node.attrs.role !== newRole) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, role: newRole });
      changed = true;
    }
  });

  if (changed) editor.view.dispatch(tr);
}

// 5) Auto-detect roles: set data-role on all paragraphs
function autoFormatRoles(editor: ReturnType<typeof useEditor>) {
  if (!editor) return;
  const { doc } = editor.state;
  const { tr } = editor.state;
  let changed = false;

  doc.forEach((node, offset) => {
    if (node.type.name !== 'paragraph') return;
    const text = node.textContent;
    if (!text.trim()) return;

    const cls = classifyLine(text);
    const role = cls.type === 'text' ? null : cls.type;

    if (node.attrs.role !== role) {
      tr.setNodeMarkup(offset, undefined, { ...node.attrs, role });
      changed = true;
    }
  });

  if (changed) editor.view.dispatch(tr);
}

// ============ Auto-format functions (one per button) ============

// 1) Bold em labels: Art., §, Parágrafo único, incisos, alíneas, itens, pena
function autoFormatBoldLabels(editor: ReturnType<typeof useEditor>) {
  if (!editor) return;
  const { doc } = editor.state;
  const { tr } = editor.state;
  let changed = false;
  const boldMark = editor.schema.marks.bold;
  if (!boldMark) return;

  doc.forEach((node, offset) => {
    if (node.type.name !== 'paragraph') return;
    const text = node.textContent;
    if (!text.trim()) return;

    const cls = classifyLine(text);
    // Only article-level labels (not hierarchy — that's a separate button)
    if (cls.label && cls.type !== 'text' && cls.type !== 'hierarchy') {
      const labelLen = cls.label.length;
      const from = offset + 1;
      const to = from + labelLen;
      if (to <= offset + node.nodeSize - 1) {
        tr.addMark(from, to, boldMark.create());
        changed = true;
      }
    }
  });

  if (changed) editor.view.dispatch(tr);
}

// 2) Indent: §/incisos/pena = 1, alíneas = 2, itens = 3
function autoFormatIndent(editor: ReturnType<typeof useEditor>) {
  if (!editor) return;
  const { doc } = editor.state;
  const { tr } = editor.state;
  let changed = false;

  doc.forEach((node, offset) => {
    if (node.type.name !== 'paragraph') return;
    const text = node.textContent;
    if (!text.trim()) return;

    const cls = classifyLine(text);
    if (cls.indent > 0 && node.attrs.indent !== cls.indent) {
      tr.setNodeMarkup(offset, undefined, { ...node.attrs, indent: cls.indent });
      changed = true;
    }
  });

  if (changed) editor.view.dispatch(tr);
}

// 3) Centralizar hierarquia: PARTE, LIVRO, TÍTULO, CAPÍTULO, Seção, Subseção
function autoFormatCenterHierarchy(editor: ReturnType<typeof useEditor>) {
  if (!editor) return;
  const { doc } = editor.state;
  const { tr } = editor.state;
  let changed = false;

  // Collect all top-level paragraph nodes with their offsets
  const nodes: { node: typeof doc.firstChild; offset: number }[] = [];
  doc.forEach((node, offset) => {
    nodes.push({ node, offset });
  });

  for (let i = 0; i < nodes.length; i++) {
    const { node, offset } = nodes[i];
    if (!node || node.type.name !== 'paragraph') continue;
    const text = node.textContent;
    if (!text.trim()) continue;

    const cls = classifyLine(text);

    // Center hierarchy headers
    if (cls.type === 'hierarchy') {
      if (node.attrs.textAlign !== 'center') {
        tr.setNodeMarkup(offset, undefined, { ...node.attrs, textAlign: 'center' });
        changed = true;
      }

      // Also center the next paragraph if it is NOT an article (hierarchy description)
      const next = nodes[i + 1];
      if (next && next.node && next.node.type.name === 'paragraph') {
        const nextText = next.node.textContent.trim();
        if (nextText && !RE_ARTIGO.test(nextText) && next.node.attrs.textAlign !== 'center') {
          const nextCls = classifyLine(nextText);
          // Only center if it's not itself another hierarchy header
          if (nextCls.type !== 'hierarchy') {
            tr.setNodeMarkup(next.offset, undefined, { ...next.node.attrs, textAlign: 'center' });
            changed = true;
          }
        }
      }
    }
  }

  if (changed) editor.view.dispatch(tr);
}

// 4a) Centralizar tudo exceto hierarquias e descrições de hierarquia
function autoFormatCenterAll(editor: ReturnType<typeof useEditor>) {
  if (!editor) return;
  const { doc } = editor.state;
  const { tr } = editor.state;
  let changed = false;

  const nodes: { node: typeof doc.firstChild; offset: number }[] = [];
  doc.forEach((node, offset) => nodes.push({ node, offset }));

  // Build set of indexes that are hierarchy or hierarchy descriptions
  const skipIndexes = new Set<number>();
  for (let i = 0; i < nodes.length; i++) {
    const { node } = nodes[i];
    if (!node || node.type.name !== 'paragraph') continue;
    const text = node.textContent.trim();
    if (!text) continue;
    const cls = classifyLine(text);
    if (cls.type === 'hierarchy') {
      skipIndexes.add(i);
      // Next paragraph = hierarchy description if not an article/hierarchy
      const next = nodes[i + 1];
      if (next?.node?.type.name === 'paragraph') {
        const nextText = next.node.textContent.trim();
        const nextCls = classifyLine(nextText);
        if (nextCls.type !== 'hierarchy' && !RE_ARTIGO.test(nextText)) {
          skipIndexes.add(i + 1);
        }
      }
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    if (skipIndexes.has(i)) continue;
    const { node, offset } = nodes[i];
    if (!node || node.type.name !== 'paragraph') continue;
    if (!node.textContent.trim()) continue;
    if (node.attrs.textAlign !== 'center') {
      tr.setNodeMarkup(offset, undefined, { ...node.attrs, textAlign: 'center' });
      changed = true;
    }
  }

  if (changed) editor.view.dispatch(tr);
}

// 4b) Bold na hierarquia: bold só no header ("CAPÍTULO I"), remove bold da descrição
function autoFormatBoldHierarchy(editor: ReturnType<typeof useEditor>) {
  if (!editor) return;
  const { doc } = editor.state;
  const { tr } = editor.state;
  let changed = false;
  const boldMark = editor.schema.marks.bold;
  if (!boldMark) return;

  doc.forEach((node, offset) => {
    if (node.type.name !== 'paragraph') return;
    const text = node.textContent;
    if (!text.trim()) return;

    const cls = classifyLine(text);
    const isCentered = node.attrs.textAlign === 'center';

    if (cls.type === 'hierarchy' && cls.label) {
      const from = offset + 1;
      // Bold only the header part (e.g. "CAPÍTULO I")
      const headerEnd = from + cls.label.length;
      if (headerEnd <= offset + node.nodeSize - 1) {
        tr.addMark(from, headerEnd, boldMark.create());
        changed = true;
      }
      // Remove bold from the description part if present
      if (cls.content) {
        const descStart = from + text.indexOf(cls.content);
        const descEnd = from + text.length;
        if (descStart < descEnd && descEnd <= offset + node.nodeSize - 1) {
          tr.removeMark(descStart, descEnd, boldMark);
          changed = true;
        }
      }
    } else if (isCentered && cls.type === 'text') {
      // Centered non-hierarchy text = hierarchy description in separate paragraph
      // Remove bold (likely came from Planalto paste)
      const from = offset + 1;
      const to = from + text.length;
      if (to <= offset + node.nodeSize - 1) {
        tr.removeMark(from, to, boldMark);
        changed = true;
      }
    }
  });

  if (changed) editor.view.dispatch(tr);
}

// ============ Highlight annotations in editor ============

const ANNOTATION_HIGHLIGHT_COLOR = '#fef08a';

function highlightAnnotations(editor: NonNullable<ReturnType<typeof useEditor>>) {
  const { state } = editor;
  const highlightType = state.schema.marks['highlight'];
  if (!highlightType) return;

  const ranges: { from: number; to: number }[] = [];
  state.doc.descendants((node, offset) => {
    if (node.type.name !== 'paragraph') return true;
    const text = (node.textContent ?? '').replace(/\u00A0/g, ' ').trim();

    let totalChars = 0, strikeChars = 0;
    node.forEach((child: any) => {
      if (!child.isText) return;
      const len = child.text?.length ?? 0;
      totalChars += len;
      if (child.marks?.some((m: any) => m.type.name === 'strike')) strikeChars += len;
    });
    const isMostlyStrike = totalChars > 5 && strikeChars / totalChars > 0.6;

    if (text && (RE_ANOTACAO_FILTER.test(text) || isMostlyStrike)) {
      ranges.push({ from: offset + 1, to: offset + node.nodeSize - 1 });
    }
    return false;
  });

  if (ranges.length === 0) return;

  // Toggle: if already highlighted → remove, else → apply
  let hasHighlights = false;
  outer: for (const { from, to } of ranges) {
    state.doc.nodesBetween(from, to, (node) => {
      if (node.isText && node.marks.some((m: any) => m.type.name === 'highlight' && m.attrs.color === ANNOTATION_HIGHLIGHT_COLOR)) {
        hasHighlights = true;
      }
      return !hasHighlights;
    });
    if (hasHighlights) break outer;
  }

  const tr = state.tr;
  if (hasHighlights) {
    ranges.forEach(({ from, to }) => tr.removeMark(from, to, highlightType));
  } else {
    ranges.forEach(({ from, to }) => tr.addMark(from, to, highlightType.create({ color: ANNOTATION_HIGHLIGHT_COLOR })));
  }
  editor.view.dispatch(tr);
}

// ============ Badges ProseMirror plugin ============

function createBadgesPlugin(
  mapRef: React.MutableRefObject<Map<string, BadgeData[]>>,
  pluginKey: PluginKey,
  onBadgeClick: (badge: BadgeData, rect: DOMRect) => void
): Plugin {
  return new Plugin({
    key: pluginKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, old, _oldState, newState) {
        if (!tr.getMeta(pluginKey) && !tr.docChanged) return old;

        const decos: Decoration[] = [];
        newState.doc.descendants((node, offset) => {
          if (node.type.name !== 'paragraph') return true;
          const text = (node.textContent ?? '').replace(/\u00A0/g, ' ').trim();
          if (!text) return false;
          const badges = mapRef.current.get(text);
          if (!badges?.length) return false;

          const endPos = offset + node.nodeSize - 1;
          badges.forEach((badge, i) => {
            const dom = document.createElement('button');
            dom.className = `lei-badge lei-badge--${badge.type}`;
            dom.textContent = BADGE_LABELS[badge.type] ?? 'Informações adicionais';
            dom.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              onBadgeClick(badge, dom.getBoundingClientRect());
            });
            decos.push(Decoration.widget(endPos, dom, { side: 1, key: `badge-${offset}-${i}` }));
          });
          return false;
        });

        return DecorationSet.create(newState.doc, decos);
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
}

// ============ Public API ============

export interface LeiIngestaoEditorRef {
  getJSON: () => any;
  getEditor: () => ReturnType<typeof useEditor> | null;
}

interface LeiIngestaoEditorProps {
  initialContent?: string;
}

export const LeiIngestaoEditor = forwardRef<LeiIngestaoEditorRef, LeiIngestaoEditorProps>(
  function LeiIngestaoEditor({ initialContent }, ref) {
    const [previewMode, setPreviewMode] = useState(false);
    const [badgesLoading, setBadgesLoading] = useState(false);
    const [activeBadge, setActiveBadge] = useState<{ badge: BadgeData; x: number; y: number } | null>(null);

    const badgesMapRef = useRef<Map<string, BadgeData[]>>(new Map());
    const badgesPluginKeyRef = useRef(new PluginKey<DecorationSet>('lei-badges'));

    const extensions = useMemo(() => {
      const badgesPlugin = createBadgesPlugin(
        badgesMapRef,
        badgesPluginKeyRef.current,
        (badge, rect) => setActiveBadge({ badge, x: rect.left, y: rect.bottom + 8 })
      );
      return [
        StarterKit.configure({ paragraph: false }),
        LeiParagraph,
        TextAlign.configure({
          types: ['paragraph'],
          alignments: ['left', 'center', 'right', 'justify'],
          defaultAlignment: 'left',
        }),
        Highlight.configure({ multicolor: true }),
        Underline,
        Extension.create({ name: 'leiBadges', addProseMirrorPlugins: () => [badgesPlugin] }),
      ];
    }, []);

    const editor = useEditor({
      extensions,
      immediatelyRender: false,
      content: initialContent || '<p></p>',
      editorProps: {
        attributes: {
          class: 'lei-ingestao-content prose prose-sm max-w-none focus:outline-none min-h-[400px] px-8 py-6',
          spellcheck: 'false',
        },
        handleClick(view, pos) {
          const { state } = view;
          const highlightType = state.schema.marks['highlight'];
          if (!highlightType) return false;

          const $pos = state.doc.resolve(pos);
          const depth = $pos.depth >= 1 ? 1 : $pos.depth;
          const paraNode = $pos.node(depth);
          if (!paraNode || paraNode.type.name !== 'paragraph') return false;

          let hasYellow = false;
          paraNode.forEach((child: any) => {
            if (child.isText && child.marks?.some((m: any) => m.type.name === 'highlight' && m.attrs.color === ANNOTATION_HIGHLIGHT_COLOR)) {
              hasYellow = true;
            }
          });
          if (!hasYellow) return false;

          const paraStart = $pos.before(depth);
          view.dispatch(state.tr.removeMark(paraStart + 1, paraStart + paraNode.nodeSize - 1, highlightType));
          return false; // allow cursor placement
        },
      },
    });

    useImperativeHandle(ref, () => ({
      getJSON: () => editor?.getJSON() ?? null,
      getEditor: () => editor,
    }), [editor]);

    // Toggle editability with preview mode
    useEffect(() => {
      if (!editor) return;
      editor.setEditable(!previewMode);
    }, [editor, previewMode]);

    // Close badge popover on outside click
    useEffect(() => {
      if (!activeBadge) return;
      const close = () => setActiveBadge(null);
      document.addEventListener('click', close);
      return () => document.removeEventListener('click', close);
    }, [activeBadge]);

    const processHighlightedBadges = useCallback(async () => {
      if (!editor) return;

      const { state } = editor;
      const highlightType = state.schema.marks['highlight'];
      const aiTexts: string[] = [];
      const strikeTexts: string[] = [];

      // Find paragraphs with yellow highlight
      state.doc.descendants((node) => {
        if (node.type.name !== 'paragraph') return true;
        let hasYellow = false;
        node.forEach((child: any) => {
          if (child.isText && child.marks?.some((m: any) => m.type.name === 'highlight' && m.attrs.color === ANNOTATION_HIGHLIGHT_COLOR)) {
            hasYellow = true;
          }
        });
        if (!hasYellow) return false;

        const text = (node.textContent ?? '').replace(/\u00A0/g, ' ').trim();
        if (!text) return false;

        let totalChars = 0, strikeChars = 0;
        node.forEach((child: any) => {
          if (!child.isText) return;
          const len = child.text?.length ?? 0;
          totalChars += len;
          if (child.marks?.some((m: any) => m.type.name === 'strike')) strikeChars += len;
        });
        const isMostlyStrike = totalChars > 5 && strikeChars / totalChars > 0.6;

        if (isMostlyStrike) { if (!strikeTexts.includes(text)) strikeTexts.push(text); }
        else { if (!aiTexts.includes(text)) aiTexts.push(text); }
        return false;
      });

      // Remove yellow highlights
      if (highlightType) {
        const tr = state.tr;
        state.doc.descendants((node, offset) => {
          if (node.type.name !== 'paragraph') return true;
          tr.removeMark(offset + 1, offset + node.nodeSize - 1, highlightType);
          return false;
        });
        editor.view.dispatch(tr);
      }

      const newMap = new Map<string, BadgeData[]>();
      strikeTexts.forEach(text => newMap.set(text, [{ type: 'sem_vigencia', resumo: 'Dispositivo sem vigência — texto suprimido ou sem efeito.' }]));

      if (aiTexts.length > 0) {
        setBadgesLoading(true);
        try {
          const res = await fetch('/api/ai/lei-badges', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ textos: aiTexts }),
          });
          if (res.ok) {
            const data = await res.json();
            aiTexts.forEach((text, i) => {
              const badges: BadgeData[] = data.results[i]?.badges ?? [];
              if (badges.length > 0) newMap.set(text, badges);
            });
          }
        } catch (e) {
          console.error('[lei-badges] erro:', e);
        } finally {
          setBadgesLoading(false);
        }
      }

      badgesMapRef.current = newMap;
      editor.view.dispatch(editor.state.tr.setMeta(badgesPluginKeyRef.current, true));
    }, [editor]);

    if (!editor) return null;

    return (
      <>
        <div className="relative h-full flex flex-col border rounded-lg overflow-hidden bg-background">
          <IngestaoToolbar
            editor={editor}
            previewMode={previewMode}
            onHighlightAnnotations={() => highlightAnnotations(editor)}
            onTogglePreview={() => {
              if (!previewMode) {
                autoFormatRoles(editor);
                processHighlightedBadges();
              } else {
                badgesMapRef.current = new Map();
                editor.view.dispatch(editor.state.tr.setMeta(badgesPluginKeyRef.current, true));
                setActiveBadge(null);
              }
              setPreviewMode(p => !p);
            }}
          />
          {previewMode && (
            <div className="flex items-center justify-center gap-2 py-1 text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-b border-indigo-200 dark:border-indigo-800">
              <Eye className="h-3 w-3" />
              Modo Leitura — visualização aproximada do estilo final
              {badgesLoading && (
                <span className="ml-2 flex items-center gap-1 opacity-70">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Processando anotações...
                </span>
              )}
            </div>
          )}
          <div className={`flex-1 overflow-auto${previewMode ? ' lei-reader-preview' : ''}`}>
            <EditorContent editor={editor} />
          </div>
        </div>

        {activeBadge && (
          <div
            className="fixed z-[100] bg-white dark:bg-gray-950 border border-border rounded-lg shadow-xl p-3 w-72 text-sm"
            style={{
              left: Math.min(activeBadge.x, (typeof window !== 'undefined' ? window.innerWidth : 800) - 296),
              top: activeBadge.y,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`lei-badge lei-badge--${activeBadge.badge.type} pointer-events-none`}>
                {BADGE_LABELS[activeBadge.badge.type]}
              </span>
              <button
                onClick={() => setActiveBadge(null)}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{activeBadge.badge.resumo}</p>
          </div>
        )}

      </>
    );
  }
);
