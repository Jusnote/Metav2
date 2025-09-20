/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {JSX} from 'react';

import {AutoFocusPlugin} from '@lexical/react/LexicalAutoFocusPlugin';
import {CharacterLimitPlugin} from '@lexical/react/LexicalCharacterLimitPlugin';
import {CheckListPlugin} from '@lexical/react/LexicalCheckListPlugin';
import {ClearEditorPlugin} from '@lexical/react/LexicalClearEditorPlugin';
import {ClickableLinkPlugin} from '@lexical/react/LexicalClickableLinkPlugin';
import {CollaborationPlugin} from '@lexical/react/LexicalCollaborationPlugin';
import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {LexicalErrorBoundary} from '@lexical/react/LexicalErrorBoundary';
import {HashtagPlugin} from '@lexical/react/LexicalHashtagPlugin';
import {HistoryPlugin} from '@lexical/react/LexicalHistoryPlugin';
import {HorizontalRulePlugin} from '@lexical/react/LexicalHorizontalRulePlugin';
import {ListPlugin} from '@lexical/react/LexicalListPlugin';
import {OnChangePlugin} from '@lexical/react/LexicalOnChangePlugin';
import {PlainTextPlugin} from '@lexical/react/LexicalPlainTextPlugin';
import {RichTextPlugin} from '@lexical/react/LexicalRichTextPlugin';
import {SelectionAlwaysOnDisplay} from '@lexical/react/LexicalSelectionAlwaysOnDisplay';
import {TabIndentationPlugin} from '@lexical/react/LexicalTabIndentationPlugin';
import {TablePlugin} from '@lexical/react/LexicalTablePlugin';
import {useLexicalEditable} from '@lexical/react/useLexicalEditable';
import * as React from 'react';
import {useCallback, useEffect, useState} from 'react';
import {EditorState, LexicalEditor} from 'lexical';
import {CAN_USE_DOM} from './shared/src/canUseDOM';

import {createWebsocketProvider} from './collaboration';
import {useSettings} from './context/SettingsContext';
import {useSharedHistoryContext} from './context/SharedHistoryContext';
import ActionsPlugin from './plugins/ActionsPlugin';
import AutocompletePlugin from './plugins/AutocompletePlugin';
import AutoEmbedPlugin from './plugins/AutoEmbedPlugin';
import AutoLinkPlugin from './plugins/AutoLinkPlugin';
import CodeActionMenuPlugin from './plugins/CodeActionMenuPlugin';
import CodeHighlightPlugin from './plugins/CodeHighlightPlugin';
import CollapsiblePlugin from './plugins/CollapsiblePlugin';
import CommentPlugin from './plugins/CommentPlugin';
import ComponentPickerPlugin from './plugins/ComponentPickerPlugin';
import ContextMenuPlugin from './plugins/ContextMenuPlugin';
import DragDropPaste from './plugins/DragDropPastePlugin';
import DraggableBlockPlugin from './plugins/DraggableBlockPlugin';
import EmojiPickerPlugin from './plugins/EmojiPickerPlugin';
import EnsureEmptyBlockPlugin from './plugins/EnsureEmptyBlockPlugin';
import EmojisPlugin from './plugins/EmojisPlugin';
import EquationsPlugin from './plugins/EquationsPlugin';
import ExcalidrawPlugin from './plugins/ExcalidrawPlugin';
import FigmaPlugin from './plugins/FigmaPlugin';
import FloatingLinkEditorPlugin from './plugins/FloatingLinkEditorPlugin';
import FloatingTextFormatToolbarPlugin from './plugins/FloatingTextFormatToolbarPlugin';
import ImagesPlugin from './plugins/ImagesPlugin';
import InlineImagePlugin from './plugins/InlineImagePlugin';
import KeywordsPlugin from './plugins/KeywordsPlugin';
import {LayoutPlugin} from './plugins/LayoutPlugin/LayoutPlugin';
import LinkPlugin from './plugins/LinkPlugin';
import MarkdownShortcutPlugin from './plugins/MarkdownShortcutPlugin';
import {MaxLengthPlugin} from './plugins/MaxLengthPlugin';
import MentionsPlugin from './plugins/MentionsPlugin';
import PageBreakPlugin from './plugins/PageBreakPlugin';
import PollPlugin from './plugins/PollPlugin';
import ShortcutsPlugin from './plugins/ShortcutsPlugin';
import SpecialTextPlugin from './plugins/SpecialTextPlugin';
import SpeechToTextPlugin from './plugins/SpeechToTextPlugin';
import TabFocusPlugin from './plugins/TabFocusPlugin';
import TableCellActionMenuPlugin from './plugins/TableActionMenuPlugin';
import TableCellResizer from './plugins/TableCellResizer';
import TableHoverActionsPlugin from './plugins/TableHoverActionsPlugin';
import TableOfContentsPlugin from './plugins/TableOfContentsPlugin';
import { useStudyMode as useGlobalStudyMode } from '../../contexts/StudyModeContext';
import ToolbarPlugin from './plugins/ToolbarPlugin';
import TreeViewPlugin from './plugins/TreeViewPlugin';
import TwitterPlugin from './plugins/TwitterPlugin';
import YouTubePlugin from './plugins/YouTubePlugin';
import ContentEditable from './ui/ContentEditable';
import { StudyModeControls } from '../StudyModeControls';
import { StudyCompletionToast } from '../StudyCompletionToast';
import { QuestionModal } from '../QuestionModal';
import StudyModePlugin from './plugins/StudyModePlugin';
import './plugins/StudyModePlugin/index.css';
import QuestionEditorPlugin from './plugins/QuestionEditorPlugin';
import { useStudyMode } from '../../hooks/useStudyMode';

const skipCollaborationInit =
  // @ts-expect-error
  window.parent != null && window.parent.frames.right === window;

// Wrapper para passar dados do study mode para o TableOfContents
function TableOfContentsPluginWithStudyMode() {
  const globalStudyMode = useGlobalStudyMode();
  const [isTableOfContentsVisible, setIsTableOfContentsVisible] = useState(true);
  
  return (
    <div className="flex items-center gap-2">
      {/* Botão para mostrar/esconder */}
      <button
        onClick={() => setIsTableOfContentsVisible(!isTableOfContentsVisible)}
        className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 transition-colors"
        title={isTableOfContentsVisible ? 'Esconder navegação' : 'Mostrar navegação'}
      >
        {isTableOfContentsVisible ? (
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>
      
      {/* TableOfContents colapsável */}
      {isTableOfContentsVisible && (
        <div className="flex-1">
          <TableOfContentsPlugin studyModeData={globalStudyMode} />
        </div>
      )}
    </div>
  );
}

interface EditorProps {
  debouncedSave?: (data: { content: any; content_text: string }) => void;
}

export default function Editor({ debouncedSave }: EditorProps = {}): JSX.Element {
  const {historyState} = useSharedHistoryContext();
  const { 
    showCompletionToast, 
    setShowCompletionToast,
    showQuestionModal,
    pendingSectionIndex
  } = useGlobalStudyMode();
  
  // Hook para modal de perguntas
  const { 
    getQuestionsForSection, 
    handleQuestionsComplete, 
    handleQuestionsSkip 
  } = useStudyMode();
  
  console.log('🎬 Editor render, showCompletionToast (GLOBAL):', showCompletionToast);
  console.log('❓ Editor render, showQuestionModal (GLOBAL):', showQuestionModal, 'pendingSectionIndex (GLOBAL):', pendingSectionIndex);
  
  const hideCompletionToast = () => {
    console.log('🔇 Ocultando toast via Editor');
    setShowCompletionToast(false);
  };
  const {
    settings: {
      isCollab,
      isAutocomplete,
      isMaxLength,
      isCharLimit,
      hasLinkAttributes,
      isCharLimitUtf8,
      isRichText,
      showTreeView,
      showTableOfContents,
      shouldUseLexicalContextMenu,
      shouldPreserveNewLinesInMarkdown,
      tableCellMerge,
      tableCellBackgroundColor,
      tableHorizontalScroll,
      shouldAllowHighlightingWithBrackets,
      selectionAlwaysOnDisplay,
    },
  } = useSettings();
  const isEditable = useLexicalEditable();
  const placeholder = isCollab
    ? 'Enter some collaborative rich text...'
    : isRichText
    ? 'Enter some rich text...'
    : 'Enter some plain text...';
  const [floatingAnchorElem, setFloatingAnchorElem] =
    useState<HTMLDivElement | null>(null);
  const [isSmallWidthViewport, setIsSmallWidthViewport] =
    useState<boolean>(false);
  const [editor] = useLexicalComposerContext();
  const [activeEditor, setActiveEditor] = useState(editor);
  const [isLinkEditMode, setIsLinkEditMode] = useState<boolean>(false);

  const handleEditorChange = useCallback(
    (editorState: EditorState, editor: LexicalEditor) => {
      const serializedState = JSON.stringify(editorState.toJSON());
      
      // Auto-save with debounce to Supabase if debouncedSave is provided
      if (debouncedSave) {
        const textContent = editorState.read(() => {
          const root = editor.getRootElement();
          return root ? root.textContent || '' : '';
        });
        
        debouncedSave({
          content: editorState.toJSON(),
          content_text: textContent
        });
      }
      
      // Keep localStorage as fallback for now
      localStorage.setItem('lexical-playground-state', serializedState);
    },
    [debouncedSave],
  );

  const onRef = (_floatingAnchorElem: HTMLDivElement) => {
    if (_floatingAnchorElem !== null) {
      setFloatingAnchorElem(_floatingAnchorElem);
    }
  };

  useEffect(() => {
    const updateViewPortWidth = () => {
      const isNextSmallWidthViewport =
        CAN_USE_DOM && window.matchMedia('(max-width: 1025px)').matches;

      if (isNextSmallWidthViewport !== isSmallWidthViewport) {
        setIsSmallWidthViewport(isNextSmallWidthViewport);
      }
    };
    updateViewPortWidth();
    window.addEventListener('resize', updateViewPortWidth);

    return () => {
      window.removeEventListener('resize', updateViewPortWidth);
    };
  }, [isSmallWidthViewport]);

  return (
    <>
      {isRichText && (
        <ToolbarPlugin
          editor={editor}
          activeEditor={activeEditor}
          setActiveEditor={setActiveEditor}
          setIsLinkEditMode={setIsLinkEditMode}
        />
      )}
      
      {/* TableOfContents entre Toolbar e Editor - Fixo e Compacto */}
      {showTableOfContents && (
        <div className="table-of-contents-bar sticky top-9 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-3 py-1.5 shadow-sm">
          <TableOfContentsPluginWithStudyMode />
        </div>
      )}
      
      {isRichText && (
        <ShortcutsPlugin
          editor={activeEditor}
          setIsLinkEditMode={setIsLinkEditMode}
        />
      )}
      <div
        className={`editor-container ${showTreeView ? 'tree-view' : ''} ${
          !isRichText ? 'plain-text' : ''
        }`}>
        {isMaxLength && <MaxLengthPlugin maxLength={30} />}
        <DragDropPaste />
        <AutoFocusPlugin />
        {selectionAlwaysOnDisplay && <SelectionAlwaysOnDisplay />}
        <ClearEditorPlugin />
        <ComponentPickerPlugin />
        <EmojiPickerPlugin />
        <AutoEmbedPlugin />
        <MentionsPlugin />
        <EmojisPlugin />
        <HashtagPlugin />
        <KeywordsPlugin />
        <SpeechToTextPlugin />
        <AutoLinkPlugin />
        <CommentPlugin
          providerFactory={isCollab ? createWebsocketProvider : undefined}
        />
        {isRichText ? (
          <>
            {isCollab ? (
              <CollaborationPlugin
                id="main"
                providerFactory={createWebsocketProvider}
                shouldBootstrap={!skipCollaborationInit}
              />
            ) : (
              <HistoryPlugin externalHistoryState={historyState} />
            )}
            <RichTextPlugin
              contentEditable={
                <div className="editor-scroller">
                  <div className="editor" ref={onRef}>
                    <ContentEditable placeholder={placeholder} />
                  </div>
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <OnChangePlugin onChange={handleEditorChange} />
            <MarkdownShortcutPlugin />
            <CodeHighlightPlugin />
            <ListPlugin />
            <CheckListPlugin />
            <TablePlugin
              hasCellMerge={tableCellMerge}
              hasCellBackgroundColor={tableCellBackgroundColor}
              hasHorizontalScroll={tableHorizontalScroll}
            />
            <TableCellResizer />
            <ImagesPlugin />
            <InlineImagePlugin />
            <LinkPlugin hasLinkAttributes={hasLinkAttributes} />
            <PollPlugin />
            <TwitterPlugin />
            <YouTubePlugin />
            <FigmaPlugin />
            <ClickableLinkPlugin disabled={isEditable} />
            <HorizontalRulePlugin />
            <EquationsPlugin />
            <ExcalidrawPlugin />
            <TabFocusPlugin />
            <TabIndentationPlugin maxIndent={7} />
            <CollapsiblePlugin />
            <PageBreakPlugin />
            <LayoutPlugin />
            <EnsureEmptyBlockPlugin />
            {floatingAnchorElem && !isSmallWidthViewport && (
              <>
                <DraggableBlockPlugin anchorElem={floatingAnchorElem} />
                <CodeActionMenuPlugin anchorElem={floatingAnchorElem} />
                <FloatingLinkEditorPlugin
                  anchorElem={floatingAnchorElem}
                  isLinkEditMode={isLinkEditMode}
                  setIsLinkEditMode={setIsLinkEditMode}
                />
                <TableCellActionMenuPlugin
                  anchorElem={floatingAnchorElem}
                  cellMerge={true}
                />
                <TableHoverActionsPlugin anchorElem={floatingAnchorElem} />
                <FloatingTextFormatToolbarPlugin
                  anchorElem={floatingAnchorElem}
                  setIsLinkEditMode={setIsLinkEditMode}
                />
              </>
            )}
          </>
        ) : (
          <>
            <PlainTextPlugin
              contentEditable={<ContentEditable placeholder={placeholder} />}
              ErrorBoundary={LexicalErrorBoundary}
            />
            <OnChangePlugin onChange={handleEditorChange} />
            <HistoryPlugin externalHistoryState={historyState} />
          </>
        )}
        {(isCharLimit || isCharLimitUtf8) && (
          <CharacterLimitPlugin
            charset={isCharLimit ? 'UTF-16' : 'UTF-8'}
            maxLength={5}
          />
        )}
        {isAutocomplete && <AutocompletePlugin />}
        {shouldUseLexicalContextMenu && <ContextMenuPlugin />}
        {shouldAllowHighlightingWithBrackets && <SpecialTextPlugin />}
        <ActionsPlugin
          isRichText={isRichText}
          shouldPreserveNewLinesInMarkdown={shouldPreserveNewLinesInMarkdown}
        />
        
            {/* Study mode controls - only shows when conditions are met */}
            <StudyModeControls />
            
            {/* Study mode plugin - controls content visibility */}
            <StudyModePlugin />
            
            {/* Question editor plugin - adds question buttons to H1s in edit mode */}
            {/* <QuestionEditorPlugin /> */}
      </div>
      {showTreeView && <TreeViewPlugin />}
      
      {/* Toast de conclusão do estudo */}
      <StudyCompletionToast 
        show={showCompletionToast} 
        onHide={hideCompletionToast}
      />
      
      {/* Modal de perguntas */}
      <QuestionModal
        sectionQuestions={pendingSectionIndex !== null ? getQuestionsForSection(pendingSectionIndex) : null}
        isOpen={showQuestionModal}
        onClose={() => handleQuestionsSkip()}
        onComplete={handleQuestionsComplete}
        onSkip={handleQuestionsSkip}
      />
    </>
  );
}
