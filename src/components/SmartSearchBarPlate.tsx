/**
 * SmartSearchBarPlate — Barra de busca com Plate.js + chips abaixo
 *
 * - Editor Plate.js: texto puro + "/" abre combobox de filtros
 * - Filtros selecionados aparecem como chips ABAIXO da barra
 * - Contexto compartilhado entre SmartSearchBarPlate e slash-node
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Search,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { Plate, usePlateEditor } from 'platejs/react';

import { EditorContainer } from './ui/editor';
import { Editor } from './ui/editor';
import { Badge } from './ui/badge';
import {
  SearchFilterKit,
  SearchFiltersContext,
  FilterChip,
  FilterType,
} from './search-filter-kit';

// ---------------------------------------------------------------------------
// Types exportados para QuestoesPage
// ---------------------------------------------------------------------------
export interface SearchFilters {
  banca?: string;
  ano?: number;
  orgao?: string;
  cargo?: string;
  materia?: string;
  assunto?: string;
}

export interface SmartSearchPayload {
  query: string;
  filters: SearchFilters;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface SmartSearchBarPlateProps {
  onSearch: (payload: SmartSearchPayload) => void;
  loading?: boolean;
  placeholder?: string;
  hasResults?: boolean;
  buscasRecentes?: string[];
  sugestoes?: string[];
}

// ---------------------------------------------------------------------------
// Filter styles
// ---------------------------------------------------------------------------
const FILTER_STYLES: Record<FilterType, { bg: string; text: string; icon: string }> = {
  banca:   { bg: 'bg-green-100 dark:bg-green-900/40',   text: 'text-green-700 dark:text-green-300',   icon: '🏛️' },
  ano:     { bg: 'bg-orange-100 dark:bg-orange-900/40',  text: 'text-orange-700 dark:text-orange-300', icon: '📅' },
  orgao:   { bg: 'bg-blue-100 dark:bg-blue-900/40',     text: 'text-blue-700 dark:text-blue-300',     icon: '🏢' },
  cargo:   { bg: 'bg-purple-100 dark:bg-purple-900/40',  text: 'text-purple-700 dark:text-purple-300', icon: '👤' },
  materia: { bg: 'bg-teal-100 dark:bg-teal-900/40',     text: 'text-teal-700 dark:text-teal-300',     icon: '📚' },
  assunto: { bg: 'bg-indigo-100 dark:bg-indigo-900/40',  text: 'text-indigo-700 dark:text-indigo-300', icon: '📝' },
};

const FILTER_LABELS: Record<FilterType, string> = {
  banca: 'Banca',
  ano: 'Ano',
  orgao: 'Órgão',
  cargo: 'Cargo',
  materia: 'Matéria',
  assunto: 'Assunto',
};

const DEFAULT_SUGESTOES = [
  'concordância verbal',
  'porcentagem',
  'direitos fundamentais',
  'atos administrativos',
  'interpretação de texto',
  'raciocínio lógico',
];

const EMPTY_VALUE = [{ type: 'p' as const, children: [{ text: '' }] }];
const NOOP = () => {};

// ---------------------------------------------------------------------------
// Extrai texto do editor (sem inline nodes — só texto puro)
// ---------------------------------------------------------------------------
function extractText(children: any[]): string {
  const block = children[0];
  if (!block?.children) return '';

  const parts: string[] = [];
  for (const node of block.children as any[]) {
    if ('text' in node && node.text) {
      parts.push(node.text);
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function hasEditorContent(children: any[]): boolean {
  const text = extractText(children);
  return text.length > 0;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const SmartSearchBar = React.memo(function SmartSearchBar({
  onSearch,
  loading = false,
  placeholder = 'Digite sua busca ou use / para filtros...',
  hasResults = false,
  buscasRecentes = [],
  sugestoes = DEFAULT_SUGESTOES,
}: SmartSearchBarPlateProps) {
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter chips state
  const [chipFilters, setChipFilters] = useState<FilterChip[]>([]);

  const addFilter = useCallback((type: FilterType, value: string) => {
    setChipFilters((prev) => {
      if (prev.some((f) => f.type === type && f.value === value)) return prev;
      return [...prev, { type, value }];
    });
  }, []);

  const removeFilter = useCallback((type: FilterType, value: string) => {
    setChipFilters((prev) => prev.filter((f) => !(f.type === type && f.value === value)));
  }, []);

  const filtersContextValue = useMemo(
    () => ({ filters: chipFilters, addFilter, removeFilter }),
    [chipFilters, addFilter, removeFilter]
  );

  const editor = usePlateEditor(
    {
      plugins: SearchFilterKit,
      value: EMPTY_VALUE,
    },
    []
  );

  // Submit
  const handleSubmit = useCallback(() => {
    const query = extractText(editor.children);
    if (!query && chipFilters.length === 0) return;

    const filters: SearchFilters = {};
    for (const chip of chipFilters) {
      if (chip.type === 'ano') {
        filters.ano = parseInt(chip.value, 10);
      } else {
        (filters as any)[chip.type] = chip.value;
      }
    }

    onSearch({ query: query || '*', filters });
  }, [editor, chipFilters, onSearch]);

  // Clear
  const handleClear = useCallback(() => {
    editor.tf.replaceNodes(EMPTY_VALUE, { at: [], children: true });
    setChipFilters([]);
    setTimeout(() => {
      const editorEl = containerRef.current?.querySelector('[data-slate-editor]') as HTMLElement;
      editorEl?.focus();
    }, 0);
  }, [editor]);

  // Suggestion click
  const handleSuggestionClick = useCallback(
    (termo: string) => {
      editor.tf.replaceNodes(
        [{ type: 'p' as const, children: [{ text: termo }] }],
        { at: [], children: true }
      );
      setChipFilters([]);
      onSearch({ query: termo, filters: {} });
    },
    [editor, onSearch]
  );

  // Filter button: insert /
  const handleFilterButton = useCallback(() => {
    const editorEl = containerRef.current?.querySelector('[data-slate-editor]') as HTMLElement;
    editorEl?.focus();
    setTimeout(() => {
      editor.tf.insertText('/');
    }, 50);
  }, [editor]);

  // Enter → submit
  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.defaultPrevented) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const hasText = useMemo(
    () => hasEditorContent(editor.children),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor.children]
  );

  const hasContent = hasText || chipFilters.length > 0;

  const showSuggestions =
    focused && !hasResults && !loading && !hasContent;

  return (
    <SearchFiltersContext.Provider value={filtersContextValue}>
      <div className="w-full max-w-3xl mx-auto">

        {/* Search bar — pill / integrado com dropdown */}
        <div className="relative">
          <div
            ref={containerRef}
            className={`flex items-center gap-3 px-6 py-4 bg-white dark:bg-slate-800 border transition-shadow ${
              showSuggestions
                ? 'rounded-t-3xl border-b-0 border-slate-200 dark:border-slate-500 shadow-[0_2px_8px_rgba(32,33,36,0.2)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.5)]'
                : focused
                  ? 'rounded-full border-slate-200 dark:border-slate-500 shadow-[0_2px_8px_rgba(32,33,36,0.2)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.5)]'
                  : 'rounded-full border-slate-200 dark:border-slate-600 shadow-[0_1px_3px_rgba(32,33,36,0.08)] hover:shadow-[0_2px_8px_rgba(32,33,36,0.2)] dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.5)]'
            }`}
          >
            {/* Search icon */}
            <Search className="h-5 w-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />

            {/* Plate Editor */}
            <div className="flex-1 min-w-0">
              <Plate editor={editor} onValueChange={NOOP}>
                <EditorContainer
                  className="!h-auto border-0 ring-0 focus-within:ring-0 bg-transparent overflow-hidden"
                >
                  <Editor
                    className="!px-0 !py-0.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 min-h-[28px] ring-0 focus-within:ring-0 border-0 bg-transparent"
                    placeholder={placeholder}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setTimeout(() => setFocused(false), 200)}
                    onKeyDown={handleEditorKeyDown}
                    autoFocusOnEditable
                  />
                </EditorContainer>
              </Plate>
            </div>

            {/* Clear */}
            {hasContent && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex-shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            )}

            {/* Divider */}
            {hasContent && (
              <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 flex-shrink-0" />
            )}

            {/* Filter button */}
            <button
              type="button"
              onClick={handleFilterButton}
              className="p-1.5 text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors flex-shrink-0 mr-1"
              title="Adicionar filtro (/)"
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
          </div>

          {/* Suggestions dropdown — conectado à barra (estilo Google) */}
          {showSuggestions && (
            <div className="absolute left-0 right-0 top-full bg-white dark:bg-slate-800 rounded-b-3xl shadow-[0_4px_6px_rgba(32,33,36,0.2)] dark:shadow-[0_4px_6px_rgba(0,0,0,0.4)] border border-t-0 border-slate-200 dark:border-slate-500 z-50 overflow-hidden">
              <div className="mx-6 border-t border-slate-200 dark:border-slate-600" />
              {buscasRecentes.length > 0 && (
                <div className="px-4 pt-4 pb-2">
                  <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Recentes
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {buscasRecentes.map((termo) => (
                      <button
                        key={termo}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSuggestionClick(termo)}
                        className="px-3 py-1 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-full border border-slate-200 dark:border-slate-600 transition-colors"
                      >
                        {termo}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="px-4 pt-2 pb-4">
                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Mais buscados
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sugestoes.map((termo) => (
                    <button
                      key={termo}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSuggestionClick(termo)}
                      className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-full border border-blue-100 dark:border-blue-800 transition-colors"
                    >
                      {termo}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chips de filtro — centralizados abaixo da barra */}
        {chipFilters.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
            {chipFilters.map((chip) => {
              const style = FILTER_STYLES[chip.type];
              return (
                <Badge
                  key={`${chip.type}-${chip.value}`}
                  variant="secondary"
                  className={`gap-1 pr-0.5 py-0.5 text-xs font-medium ${style.bg} ${style.text} cursor-default select-none rounded-full`}
                >
                  <span className="text-[10px]">{style.icon}</span>
                  <span className="opacity-70">{FILTER_LABELS[chip.type]}:</span>
                  {chip.value}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFilter(chip.type, chip.value);
                    }}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}

        {/* Botões abaixo — estilo Google */}
        <div className="flex justify-center gap-3 mt-7">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !hasContent}
            className="px-6 py-2.5 text-sm bg-[#f8f9fa] hover:bg-[#f1f3f4] dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-[#f8f9fa] hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 border-2 border-slate-400/30 border-t-slate-500 rounded-full animate-spin inline-block" />
                Buscando...
              </span>
            ) : (
              'Buscar Questões'
            )}
          </button>
          <button
            type="button"
            onClick={handleFilterButton}
            className="px-6 py-2.5 text-sm bg-[#f8f9fa] hover:bg-[#f1f3f4] dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-[#f8f9fa] hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500 rounded-md transition-colors shadow-sm"
          >
            Adicionar Filtro
          </button>
        </div>

      </div>
    </SearchFiltersContext.Provider>
  );
});
