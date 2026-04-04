'use client';

import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { StarterKit } from '@tiptap/starter-kit';
import { Highlight } from '@tiptap/extension-highlight';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { Extension } from '@tiptap/core';
import Paragraph from '@tiptap/extension-paragraph';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { AddMarkStep, RemoveMarkStep } from '@tiptap/pm/transform';
import {
  Highlighter,
  Eraser,
  Undo2,
  Redo2,
  Type,
  Sparkles,
  Focus,
  Zap,
  Copy,
  MessageSquare,
  Bookmark,
  MoreHorizontal,
  PanelRight,
} from 'lucide-react';

import { computePosition, autoUpdate, offset, flip, shift } from '@floating-ui/dom';
import { plateToTipTap } from '@/lib/plate-to-tiptap';
import { AiSelectionMark } from './ai-selection-mark';
import { AnnotationSlots } from './annotation-slots-extension';
import { LeiSecaAiPanel } from './lei-seca-ai-panel';
import { AnnotationPortals } from './annotation-portals';
import { useAnnotationSlots } from '@/hooks/useAnnotationSlots';
import { annotationStore, useAnnotationState } from '@/stores/annotationStore';
import { useLeiSeca } from '@/contexts/LeiSecaContext';
import { cn } from '@/lib/utils';
import { useCadernosOptional } from '@/contexts/CadernosContext';
import type { ContextChainItem } from '@/types/caderno';
// Legacy comments panel has been removed — inline comments via DispositivoFooter replace it.

// ============ Extract parent context from DOM ============

const ROLE_DEPTH: Record<string, number> = {
  artigo: 0,
  epigrafe: 0,
  paragrafo: 1,
  paragrafo_unico: 1,
  pena: 1,
  inciso: 2,
  alinea: 3,
  item: 4,
};

const ROLE_LABELS: Record<string, string> = {
  artigo: 'Art.',
  paragrafo: '§',
  paragrafo_unico: '§ único',
  inciso: 'Inciso',
  alinea: 'Alínea',
  item: 'Item',
  pena: 'Pena',
};

function extractContextChain(targetSlug: string, container: HTMLElement): ContextChainItem[] {
  if (!targetSlug) return [];

  const allParas = Array.from(container.querySelectorAll<HTMLElement>('p[data-role]'));
  const targetIdx = allParas.findIndex(p => p.dataset.slug === targetSlug);
  if (targetIdx <= 0) return [];

  const targetRole = allParas[targetIdx].dataset.role || '';
  const targetDepth = ROLE_DEPTH[targetRole] ?? 99;
  if (targetDepth === 0) return [];

  const ancestors = new Map<number, ContextChainItem>();
  let minDepthNeeded = targetDepth;

  for (let i = targetIdx - 1; i >= 0; i--) {
    const p = allParas[i];
    const role = p.dataset.role || '';
    const depth = ROLE_DEPTH[role] ?? 99;

    if (depth < minDepthNeeded && !ancestors.has(depth)) {
      ancestors.set(depth, {
        role,
        slug: p.dataset.slug || '',
        text: p.textContent || '',
      });
      minDepthNeeded = depth;
      if (depth === 0) break;
    }
  }

  return Array.from(ancestors.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, item]) => item);
}

// ============ Custom Paragraph (indent + slug) ============

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

// ============ Read-only plugin (allows marks only) ============

const ReadOnlyMarks = Extension.create({
  name: 'readOnlyMarks',

  addStorage() {
    return { allowContentUpdate: false };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin({
        key: new PluginKey('leiSecaReadOnly'),
        filterTransaction(tr) {
          if (storage.allowContentUpdate) return true;
          if (!tr.docChanged) return true;
          for (const step of tr.steps) {
            if (
              !(step instanceof AddMarkStep) &&
              !(step instanceof RemoveMarkStep)
            ) {
              return false;
            }
          }
          return true;
        },
      }),
    ];
  },
});

// ============ Highlight palette ============

const HIGHLIGHTS = [
  { color: '#fef08a', label: 'Amarelo' },
  { color: '#bbf7d0', label: 'Verde' },
  { color: '#bfdbfe', label: 'Azul' },
  { color: '#fbcfe8', label: 'Rosa' },
  { color: '#fed7aa', label: 'Laranja' },
];

// ============ Fixed Toolbar ============

function LeiSecaToolbar({
  editor,
  focusEnabled,
  spotlightEnabled,
  companionOpen,
  onToggleFocus,
  onToggleSpotlight,
  onToggleCompanion,
}: {
  editor: ReturnType<typeof useEditor>;
  focusEnabled: boolean;
  spotlightEnabled: boolean;
  companionOpen: boolean;
  onToggleFocus: () => void;
  onToggleSpotlight: () => void;
  onToggleCompanion: () => void;
}) {
  if (!editor) return null;

  return (
    <div className="sticky top-0 z-10 flex items-center gap-1 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-1.5">
      {/* Highlight colors */}
      <div className="flex items-center gap-0.5 mr-2">
        <Highlighter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
        {HIGHLIGHTS.map(({ color, label }) => (
          <button
            key={color}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleHighlight({ color }).run();
            }}
            className={`w-5 h-5 rounded-sm border transition-all hover:scale-110 ${
              editor.isActive('highlight', { color })
                ? 'border-foreground ring-1 ring-foreground/30 scale-110'
                : 'border-border/50'
            }`}
            style={{ backgroundColor: color }}
            title={label}
          />
        ))}
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().unsetHighlight().run();
          }}
          className="w-5 h-5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center ml-0.5"
          title="Remover destaque"
        >
          <Eraser className="h-3 w-3" />
        </button>
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Undo / Redo */}
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().undo().run();
        }}
        disabled={!editor.can().undo()}
        className="p-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none"
        title="Desfazer (Ctrl+Z)"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().redo().run();
        }}
        disabled={!editor.can().redo()}
        className="p-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none"
        title="Refazer (Ctrl+Y)"
      >
        <Redo2 className="h-3.5 w-3.5" />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Font size indicator */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground px-1">
        <Type className="h-3 w-3" />
        <span>Texto base</span>
      </div>

      <div className="flex-1" />

      {/* View effects */}
      <div className="flex items-center gap-1">
        <button
          onMouseDown={(e) => { e.preventDefault(); onToggleFocus(); }}
          className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs transition-colors ${
            focusEnabled
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
          title="Focus tracking: destaca dispositivo em foco"
        >
          <Focus className="h-3.5 w-3.5" />
          <span>Focus</span>
        </button>
        <button
          onMouseDown={(e) => { e.preventDefault(); onToggleSpotlight(); }}
          className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs transition-colors ${
            spotlightEnabled
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
          title="Spotlight: ilumina dispositivo em foco, apaga os demais"
        >
          <Zap className="h-3.5 w-3.5" />
          <span>Spotlight</span>
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        <button
          onMouseDown={(e) => { e.preventDefault(); onToggleCompanion(); }}
          className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs transition-colors ${
            companionOpen
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
          title="Painel de estudo"
        >
          <PanelRight className="h-3.5 w-3.5" />
          <span>Painel</span>
        </button>

      </div>
    </div>
  );
}

// ============ Editor ============

interface LeiSecaEditorProps {
  content?: any[];
}

export function LeiSecaEditor({ content }: LeiSecaEditorProps) {
  const tiptapDoc = useMemo(() => plateToTipTap(content || []), [content]);

  // ---- Context ----
  const {
    setFocusedProvision, setCompanionOpen, companionOpen,
    currentLeiId, currentLei,
  } = useLeiSeca();

  const cadernosCtx = useCadernosOptional();
  const annotationState = useAnnotationState();

  // ---- View effect toggles (persisted in localStorage) ----
  const [focusEnabled, setFocusEnabled] = useState(() => {
    try { return localStorage.getItem('lei-focus-enabled') === 'true'; } catch { return false; }
  });
  const [spotlightEnabled, setSpotlightEnabled] = useState(() => {
    try { return localStorage.getItem('lei-spotlight-enabled') === 'true'; } catch { return false; }
  });

  const toggleFocus = useCallback(() => {
    setFocusEnabled((v) => {
      const next = !v;
      try { localStorage.setItem('lei-focus-enabled', String(next)); } catch {}
      return next;
    });
  }, []);

  const toggleSpotlight = useCallback(() => {
    setSpotlightEnabled((v) => {
      const next = !v;
      try { localStorage.setItem('lei-spotlight-enabled', String(next)); } catch {}
      return next;
    });
  }, []);

  // ---- AI state ----
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiSelectedText, setAiSelectedText] = useState('');
  const [aiSelectionRange, setAiSelectionRange] = useState({ from: 0, to: 0 });
  const openAiRef = useRef<() => void>(() => {});
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ---- AI Keyboard shortcut extension (Mod-j) ----
  const AiKeyboardExt = useMemo(
    () =>
      Extension.create({
        name: 'aiKeyboard',
        addKeyboardShortcuts() {
          return {
            'Mod-j': () => {
              openAiRef.current();
              return true;
            },
          };
        },
      }),
    []
  );

  // ---- Extensions (cleaned: removed LeiAnnotation, LeiInlineBar) ----
  const extensions = useMemo(
    () =>
      [
        StarterKit.configure({ paragraph: false }),
        LeiParagraph,
        Highlight.configure({ multicolor: true }),
        TextStyle,
        Color,
        Underline,
        ReadOnlyMarks,
        AnnotationSlots,
        AiSelectionMark,
        AiKeyboardExt,
      ] as any[],
    [AiKeyboardExt]
  );

  const editor = useEditor({
    extensions,
    content: tiptapDoc,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'lei-seca-tiptap-content',
        spellcheck: 'false',
      },
      handleKeyDown: (_view: any, event: KeyboardEvent) => {
        const navKeys = [
          'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
          'Home', 'End', 'PageUp', 'PageDown', 'Escape',
        ];
        if (navKeys.includes(event.key)) return false;
        if (event.shiftKey && event.key.startsWith('Arrow')) return false;
        if (
          (event.ctrlKey || event.metaKey) &&
          ['a', 'c', 'z', 'y', 'j'].includes(event.key.toLowerCase())
        )
          return false;
        return true;
      },
      handlePaste: () => true,
      handleDrop: () => true,
    },
  });

  // ---- Annotation Slots (React ↔ ProseMirror bridge) ----
  const { slots, openSlot, closeSlot, toggleSlot } = useAnnotationSlots(editor);

  // Sync annotationStore state → open/close ProseMirror slots
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (annotationState.activeSlug) {
      openSlot(annotationState.activeSlug, annotationState.mode);
    } else {
      closeSlot();
    }
  }, [editor, annotationState.activeSlug, annotationState.mode, openSlot, closeSlot]);

  // Close annotation on content change (navigation)
  useEffect(() => {
    annotationStore.close();
  }, [tiptapDoc]);

  // ---- AI mark helpers ----

  const removeAiMark = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const markType = editor.schema.marks.aiSelection;
    if (!markType) return;
    const { tr } = editor.state;
    tr.removeMark(0, editor.state.doc.content.size, markType);
    editor.view.dispatch(tr);
  }, [editor]);

  const handleOpenAi = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;

    const text = editor.state.doc.textBetween(from, to, ' ');
    if (!text.trim()) return;

    const markType = editor.schema.marks.aiSelection;
    if (markType) {
      const { tr } = editor.state;
      tr.removeMark(0, editor.state.doc.content.size, markType);
      tr.addMark(from, to, markType.create());
      editor.view.dispatch(tr);
    }

    setAiSelectionRange({ from, to });
    setAiSelectedText(text);
    setShowAiPanel(true);
    editor.commands.blur();
  }, [editor]);

  openAiRef.current = handleOpenAi;

  const handleCloseAi = useCallback(() => {
    removeAiMark();
    setShowAiPanel(false);
  }, [removeAiMark]);

  useEffect(() => {
    setShowAiPanel(false);
  }, [tiptapDoc]);

  // ---- Action menu (hover-based, simplified) ----

  const [actionPara, setActionPara] = useState<{
    text: string;
    slug: string;
    nodePos: number;
  } | null>(null);

  const [actionExpanded, setActionExpanded] = useState(false);

  // ---- Floating UI refs ----
  const actionTriggerRef = useRef<HTMLDivElement>(null);
  const floatingCleanupRef = useRef<(() => void) | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, []);

  const getParaEl = useCallback((slug: string) => {
    return scrollContainerRef.current?.querySelector<HTMLElement>(`p[data-slug="${CSS.escape(slug)}"]`) ?? null;
  }, []);

  // ---- Floating UI: position action trigger (right of paragraph) ----
  useEffect(() => {
    if (!actionPara) {
      floatingCleanupRef.current?.();
      floatingCleanupRef.current = null;
      return;
    }
    const anchor = getParaEl(actionPara.slug);
    const floating = actionTriggerRef.current;
    if (!anchor || !floating) return;

    const cleanup = autoUpdate(anchor, floating, () => {
      computePosition(anchor, floating, {
        placement: 'right-start',
        middleware: [offset(4), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        Object.assign(floating.style, { left: `${x}px`, top: `${y}px` });
      });
    });
    floatingCleanupRef.current = cleanup;
    return () => cleanup();
  }, [actionPara, getParaEl]);

  // Hover on paragraph → show ⋯ trigger
  const handleParaHover = useCallback(
    (e: React.MouseEvent) => {
      if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
      if (showAiPanel) return;
      const target = e.target as HTMLElement;
      if (target.closest('.lei-action-overlay')) return;

      const para = target.closest('p[data-role]') as HTMLElement | null;
      if (!para || !editor) {
        if (!actionExpanded) {
          hideTimerRef.current = window.setTimeout(() => { setActionPara(null); hideTimerRef.current = null; }, 150);
        }
        return;
      }

      const slug = para.dataset.slug || '';
      if (slug === actionPara?.slug) return;

      setActionExpanded(false);
      const domPos = editor.view.posAtDOM(para, 0);
      const $pos = editor.state.doc.resolve(domPos);
      const nodePos = $pos.before($pos.depth);
      setActionPara({ text: para.textContent || '', slug, nodePos });
    },
    [showAiPanel, editor, actionPara, actionExpanded]
  );

  const handleEditorMouseLeave = useCallback(() => {
    if (!actionExpanded) {
      hideTimerRef.current = window.setTimeout(() => { setActionPara(null); hideTimerRef.current = null; }, 200);
    }
  }, [actionExpanded]);

  // Click on paragraph → set focus/activeSlug
  const handleParaClick = useCallback(
    (e: React.MouseEvent) => {
      if (showAiPanel) return;
      if (e.shiftKey) return;
      const target = e.target as HTMLElement;
      if (target.closest('.lei-action-overlay')) return;

      const para = target.closest('p[data-role]') as HTMLElement | null;
      if (!para || !scrollContainerRef.current || !editor) {
        setActionPara(null);
        setActionExpanded(false);
        return;
      }

      const slug = para.dataset.slug || '';
      const role = para.dataset.role || '';
      const text = para.textContent || '';
      const domPos = editor.view.posAtDOM(para, 0);
      const $pos = editor.state.doc.resolve(domPos);
      const nodePos = $pos.before($pos.depth);

      setFocusedProvision({ slug, role, text, nodePos });
    },
    [showAiPanel, editor, setFocusedProvision]
  );

  // Dismiss action menu on text selection
  useEffect(() => {
    if (!editor) return;
    const onSel = () => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        setActionPara(null);
        setActionExpanded(false);
      }
    };
    editor.on('selectionUpdate', onSel);
    return () => { editor.off('selectionUpdate', onSel); };
  }, [editor]);

  // Dismiss on content change
  useEffect(() => {
    setActionPara(null);
    setActionExpanded(false);
  }, [tiptapDoc]);

  // ---- Action handlers ----

  const handleCopyAction = useCallback(() => {
    if (actionPara?.text) {
      navigator.clipboard.writeText(actionPara.text).catch(() => {});
    }
    setActionPara(null);
  }, [actionPara]);

  const handleAnnotateAction = useCallback(() => {
    if (!actionPara) return;
    annotationStore.toggle(actionPara.slug, 'expanded');
    setActionPara(null);
    setActionExpanded(false);
  }, [actionPara]);

  const handleSaveAction = useCallback(async () => {
    if (!cadernosCtx || !actionPara) return;
    const slug = actionPara.slug;

    if (cadernosCtx.isSaved(slug)) {
      await cadernosCtx.unsaveProvision(slug);
      setActionPara(null);
      return;
    }

    const para = scrollContainerRef.current?.querySelector(`p[data-slug="${slug}"]`) as HTMLElement | null;
    const role = para?.dataset?.role || 'artigo';
    const contextChain = scrollContainerRef.current && slug
      ? extractContextChain(slug, scrollContainerRef.current)
      : [];

    await cadernosCtx.saveProvision({
      lei_id: currentLeiId,
      artigo_numero: '', // TODO: reconnect after React renderer migration
      provision_slug: slug,
      provision_role: role,
      provision_text: actionPara.text || '',
      lei_sigla: currentLei?.apelido || null,
      lei_nome: currentLei?.titulo || null,
      artigo_contexto: null, // TODO: reconnect after React renderer migration
      context_chain: contextChain,
    });

    setActionPara(null);
  }, [cadernosCtx, actionPara, currentLeiId, currentLei]);

  // ---- Sync content updates ----

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    (editor.storage as any).readOnlyMarks.allowContentUpdate = true;
    editor.commands.setContent(tiptapDoc);
    (editor.storage as any).readOnlyMarks.allowContentUpdate = false;
  }, [editor, tiptapDoc]);

  if (!editor) return null;

  const containerClasses = [
    'relative h-full flex flex-col',
    focusEnabled ? 'lei-focus-enabled' : '',
    spotlightEnabled ? 'lei-spotlight-enabled' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      {/* Fixed Toolbar */}
      <LeiSecaToolbar
        editor={editor}
        focusEnabled={focusEnabled}
        spotlightEnabled={spotlightEnabled}
        companionOpen={companionOpen}
        onToggleFocus={toggleFocus}
        onToggleSpotlight={toggleSpotlight}
        onToggleCompanion={() => setCompanionOpen(!companionOpen)}
      />

      {/* Bubble Menu (appears on text selection) */}
      {!showAiPanel && (
        <BubbleMenu editor={editor}>
          <div className="flex items-center gap-1 rounded-lg border bg-background p-1 shadow-lg">
            {HIGHLIGHTS.map(({ color, label }) => (
              <button
                key={color}
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().toggleHighlight({ color }).run();
                }}
                className={`w-6 h-6 rounded border transition-transform hover:scale-110 ${
                  editor.isActive('highlight', { color })
                    ? 'border-foreground ring-1 ring-foreground/30'
                    : 'border-border/50'
                }`}
                style={{ backgroundColor: color }}
                title={label}
              />
            ))}
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                editor.chain().focus().unsetHighlight().run();
              }}
              className="w-6 h-6 rounded text-xs text-muted-foreground hover:bg-accent flex items-center justify-center"
              title="Remover destaque"
            >
              <Eraser className="h-3.5 w-3.5" />
            </button>

            <div className="w-px h-4 bg-border mx-0.5" />

            <button
              onMouseDown={(e) => {
                e.preventDefault();
                handleOpenAi();
              }}
              className="w-6 h-6 rounded text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950 flex items-center justify-center transition-colors"
              title="Ask AI (Ctrl+J)"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
          </div>
        </BubbleMenu>
      )}

      {/* Editor content + overlays */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto relative"
        onClick={handleParaClick}
        onMouseMove={handleParaHover}
        onMouseLeave={handleEditorMouseLeave}
      >
        <EditorContent editor={editor} />

        {/* Annotation Portals — React components rendered inside ProseMirror Decoration slots */}
        <AnnotationPortals slots={slots} />

        {/* Action trigger — Craft-style: hover shows dots, click expands toolbar */}
        {actionPara && (
          <div
            ref={actionTriggerRef}
            style={{ position: 'fixed', zIndex: 20, top: 0, left: 0 }}
            className="lei-action-overlay"
          >
            {!actionExpanded ? (
              <button
                onClick={() => setActionExpanded(true)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-background/90 backdrop-blur-sm border border-border/30 text-muted-foreground/50 hover:text-muted-foreground hover:bg-background hover:border-border/60 shadow-sm transition-all"
                title="Ações"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex items-center rounded-full border border-border/40 bg-background/95 backdrop-blur-sm shadow-md px-1 py-0.5" style={{ transform: 'translateX(calc(-100% + 1.75rem))' }}>
                <button onClick={handleCopyAction} className="p-1.5 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors" title="Copiar">
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button onClick={handleAnnotateAction} className="p-1.5 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors" title="Anotar">
                  <MessageSquare className="h-3.5 w-3.5" />
                </button>
                {cadernosCtx && (
                  <button onClick={handleSaveAction} className="p-1.5 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors" title={cadernosCtx.isSaved(actionPara.slug) ? 'Remover do caderno' : 'Salvar no caderno'}>
                    <Bookmark className={cn("h-3.5 w-3.5", cadernosCtx.isSaved(actionPara.slug) && "fill-current text-amber-500")} />
                  </button>
                )}
                <button
                  onClick={() => setActionExpanded(false)}
                  className="p-1.5 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
                  title="Fechar"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {showAiPanel && (
          <LeiSecaAiPanel
            isOpen={showAiPanel}
            editor={editor}
            selectionRange={aiSelectionRange}
            selectedText={aiSelectedText}
            scrollContainer={scrollContainerRef.current}
            onClose={handleCloseAi}
          />
        )}
      </div>
    </div>
  );
}
