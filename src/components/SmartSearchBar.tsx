/**
 * SmartSearchBar — Barra de busca com detecção automática + slash commands
 *
 * Detecção automática (sem ambiguidade):
 *   - Bancas (lookup no dicionário)
 *   - Anos (regex com contexto negativo)
 *
 * Slash Commands (usuário digita / para filtrar):
 *   - Etapa 1: / abre command palette com 6 categorias
 *   - Etapa 2: seleciona categoria → autocomplete contextual (só valores daquela categoria)
 *   - Etapa 3: seleciona valor → chip criado, texto do comando removido
 *   - Gatilho seguro: / só ativa se precedido por espaço ou início do texto
 *   - Backspace reverso: apagar espaço após comando volta ao palette
 *   - Escape: remove o /comando do texto sem criar chip
 *
 * Destino no projeto: components/SmartSearchBar.tsx
 */
import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Search, X, Sparkles, CornerDownLeft, SlidersHorizontal } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useFiltrosDicionario, FiltrosDicionario } from '../hooks/useFiltrosDicionario';

// ---------------------------------------------------------------------------
// Types
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

type FilterType = 'banca' | 'ano' | 'orgao' | 'cargo' | 'materia' | 'assunto';

interface DetectedFilter {
  type: FilterType;
  label: string;
  canonical: string;
  originalText: string;
}

interface SmartSearchBarProps {
  onSearch: (payload: SmartSearchPayload) => void;
  loading?: boolean;
  placeholder?: string;
  hasResults?: boolean;
  buscasRecentes?: string[];
  sugestoes?: string[];
}

// ---------------------------------------------------------------------------
// Slash Commands
// ---------------------------------------------------------------------------
// Ordenado por frequência de uso — resolve colisão: /a → Ano (primeiro), /as → Assunto
const SLASH_COMMANDS = [
  { key: 'banca'   as FilterType, label: 'Banca',   icon: '\u{1F3DB}\uFE0F', desc: 'Filtrar pela banca organizadora' },
  { key: 'materia' as FilterType, label: 'Materia', icon: '\u{1F4DA}',       desc: 'Filtrar pela disciplina' },
  { key: 'ano'     as FilterType, label: 'Ano',     icon: '\u{1F4C5}',       desc: 'Filtrar pelo ano da prova' },
  { key: 'orgao'   as FilterType, label: 'Orgao',   icon: '\u{1F3E2}',       desc: 'Filtrar pelo orgao' },
  { key: 'cargo'   as FilterType, label: 'Cargo',   icon: '\u{1F464}',       desc: 'Filtrar pelo cargo' },
  { key: 'assunto' as FilterType, label: 'Assunto', icon: '\u{1F4DD}',       desc: 'Filtrar pelo tema especifico' },
];

type SlashMode = 'idle' | 'palette' | 'value';

// ---------------------------------------------------------------------------
// Regex: ano com contexto negativo (para auto-detecção)
// ---------------------------------------------------------------------------
const ANO_PREFIXOS_NEGATIVOS = [
  'lei', 'art', 'artigo', 'n\u00BA', 'n\u00B0', 'no', 'decreto',
  'resolu\u00E7\u00E3o', 'resolucao', 's\u00FAmula', 'sumula',
  'emenda', 'ec', 'lc', 'mp', 'portaria', 'in',
];

function isAnoContextoValido(text: string, matchIndex: number): boolean {
  const antes = text.substring(0, matchIndex).trimEnd();
  const palavraAnterior = antes.split(/\s+/).pop()?.toLowerCase() || '';
  return !ANO_PREFIXOS_NEGATIVOS.includes(palavraAnterior);
}

// ---------------------------------------------------------------------------
// Detecção automática: apenas banca e ano (sem /)
// ---------------------------------------------------------------------------
function detectAutoFilters(
  text: string,
  dicionario: FiltrosDicionario | null,
  dismissed: Set<string>,
): DetectedFilter[] {
  if (!dicionario || !text.trim()) return [];

  // Remove trechos de slash commands do texto antes de detectar
  const cleanText = text.replace(/(^|\s)\/\S*/g, '$1').trim();
  if (!cleanText) return [];

  const filters: DetectedFilter[] = [];
  const seen = new Set<string>();
  const words = cleanText.split(/\s+/);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const lower = word.toLowerCase().replace(/[.,;:!?]/g, '');
    if (!lower) continue;

    // 1. Ano
    const anoMatch = lower.match(/^(199[0-9]|20[0-2][0-9])$/);
    if (anoMatch) {
      const anoNum = parseInt(anoMatch[1], 10);
      const { min, max } = dicionario.anos;
      const matchIndex = cleanText.indexOf(word);

      if (
        anoNum >= min &&
        anoNum <= max &&
        isAnoContextoValido(cleanText, matchIndex) &&
        !seen.has('ano') &&
        !dismissed.has(`ano:${anoNum}`)
      ) {
        filters.push({ type: 'ano', label: String(anoNum), canonical: String(anoNum), originalText: word });
        seen.add('ano');
      }
      continue;
    }

    // 2. Banca
    if (dicionario.bancas[lower] && !seen.has('banca') && !dismissed.has(`banca:${dicionario.bancas[lower]}`)) {
      filters.push({ type: 'banca', label: dicionario.bancas[lower], canonical: dicionario.bancas[lower], originalText: word });
      seen.add('banca');
      continue;
    }
  }

  return filters;
}

// ---------------------------------------------------------------------------
// Valores para autocomplete contextual (Etapa 2)
// ---------------------------------------------------------------------------
function getSlashValues(
  category: FilterType,
  dicionario: FiltrosDicionario,
  searchTerm: string,
): string[] {
  let values: string[] = [];

  switch (category) {
    case 'banca':
      values = [...new Set(Object.values(dicionario.bancas))].sort();
      break;
    case 'orgao':
      values = [...new Set(Object.values(dicionario.orgaos))].sort();
      break;
    case 'cargo':
      values = [...new Set(Object.values(dicionario.cargos))].sort();
      break;
    case 'materia':
      values = dicionario.materias;
      break;
    case 'assunto':
      values = dicionario.assuntos;
      break;
    case 'ano': {
      const { min, max } = dicionario.anos;
      values = Array.from({ length: max - min + 1 }, (_, i) => String(max - i));
      break;
    }
  }

  if (!searchTerm) return values.slice(0, 8);

  const term = searchTerm.toLowerCase();
  // includes() com prioridade: startsWith no topo, includes embaixo
  const starts = values.filter(v => v.toLowerCase().startsWith(term));
  const contains = values.filter(v => !v.toLowerCase().startsWith(term) && v.toLowerCase().includes(term));
  return [...starts, ...contains].slice(0, 8);
}

// ---------------------------------------------------------------------------
// Remove palavras dos filtros do texto para gerar query semântica limpa
// ---------------------------------------------------------------------------
function buildCleanQuery(text: string, filters: DetectedFilter[]): string {
  let clean = text;
  for (const f of filters) {
    const escaped = f.originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    clean = clean.replace(new RegExp(`\\b${escaped}\\b`, 'i'), '');
  }
  // Remove qualquer resquício de slash commands
  clean = clean.replace(/(^|\s)\/\S*/g, '$1');
  return clean.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Filter type → visual config
// ---------------------------------------------------------------------------
const FILTER_STYLES: Record<FilterType, { bg: string; text: string; icon: string }> = {
  banca:   { bg: 'bg-green-100 dark:bg-green-900/40',   text: 'text-green-700 dark:text-green-300',   icon: '\u{1F3DB}\uFE0F' },
  ano:     { bg: 'bg-orange-100 dark:bg-orange-900/40',  text: 'text-orange-700 dark:text-orange-300', icon: '\u{1F4C5}' },
  orgao:   { bg: 'bg-blue-100 dark:bg-blue-900/40',     text: 'text-blue-700 dark:text-blue-300',     icon: '\u{1F3E2}' },
  cargo:   { bg: 'bg-purple-100 dark:bg-purple-900/40',  text: 'text-purple-700 dark:text-purple-300', icon: '\u{1F464}' },
  materia: { bg: 'bg-teal-100 dark:bg-teal-900/40',     text: 'text-teal-700 dark:text-teal-300',     icon: '\u{1F4DA}' },
  assunto: { bg: 'bg-indigo-100 dark:bg-indigo-900/40',  text: 'text-indigo-700 dark:text-indigo-300', icon: '\u{1F4DD}' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const DEFAULT_SUGESTOES = [
  'concordancia verbal',
  'porcentagem',
  'direitos fundamentais',
  'atos administrativos',
  'interpretacao de texto',
  'raciocinio logico',
];

export function SmartSearchBar({
  onSearch,
  loading = false,
  placeholder = 'Digite sua busca ou use / para filtros',
  hasResults = false,
  buscasRecentes = [],
  sugestoes = DEFAULT_SUGESTOES,
}: SmartSearchBarProps) {
  const [inputValue, setInputValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [explicitFilters, setExplicitFilters] = useState<DetectedFilter[]>([]);
  const [dropdownIndex, setDropdownIndex] = useState(-1);

  // Slash command state machine
  const [slashMode, setSlashMode] = useState<SlashMode>('idle');
  const [slashCategory, setSlashCategory] = useState<FilterType | null>(null);
  const [slashStartPos, setSlashStartPos] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const { dicionario } = useFiltrosDicionario();

  // Filtros automáticos (banca, ano) — sem /
  const autoFilters = useMemo(
    () => detectAutoFilters(inputValue, dicionario, dismissed),
    [inputValue, dicionario, dismissed],
  );

  // Todos os filtros ativos (automáticos + explícitos via /)
  const allFilters = useMemo(
    () => [...autoFilters, ...explicitFilters],
    [autoFilters, explicitFilters],
  );

  // ---------------------------------------------------------------------------
  // Slash: parse do texto para extrair o trecho do slash command
  // ---------------------------------------------------------------------------
  const slashContext = useMemo(() => {
    if (slashMode === 'idle') return null;

    const slashText = inputValue.substring(slashStartPos);
    // Remove o / inicial
    const afterSlash = slashText.startsWith('/') ? slashText.substring(1) : slashText;

    if (slashMode === 'palette') {
      // Filtra comandos pelo que foi digitado após /
      const term = afterSlash.toLowerCase();
      const filtered = SLASH_COMMANDS.filter(cmd =>
        cmd.key.startsWith(term) || cmd.label.toLowerCase().startsWith(term)
      );
      return { commands: filtered, searchTerm: term, valueTerm: '' };
    }

    if (slashMode === 'value' && slashCategory) {
      // Extrai o termo após "/comando "
      const cmdKey = slashCategory;
      const prefix = cmdKey + ' ';
      const valueTerm = afterSlash.startsWith(prefix)
        ? afterSlash.substring(prefix.length)
        : '';
      return { commands: [], searchTerm: '', valueTerm };
    }

    return null;
  }, [slashMode, slashCategory, slashStartPos, inputValue]);

  // Itens do dropdown (comandos na palette, valores no value)
  const dropdownItems = useMemo(() => {
    if (!focused || !slashContext) return [];

    if (slashMode === 'palette') {
      return slashContext.commands.map(cmd => ({
        id: cmd.key,
        icon: cmd.icon,
        label: cmd.label,
        desc: cmd.desc,
      }));
    }

    if (slashMode === 'value' && slashCategory && dicionario) {
      // Tipos já usados não devem aparecer
      const usedTypes = new Set(allFilters.map(f => f.type));
      if (usedTypes.has(slashCategory)) return [];

      const values = getSlashValues(slashCategory, dicionario, slashContext.valueTerm);
      const cmdDef = SLASH_COMMANDS.find(c => c.key === slashCategory);
      return values.map(v => ({
        id: v,
        icon: cmdDef?.icon || '',
        label: v,
        desc: '',
      }));
    }

    return [];
  }, [focused, slashContext, slashMode, slashCategory, dicionario, allFilters]);

  const showDropdown = dropdownItems.length > 0 && focused;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleBarClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // Dismiss: ignora um filtro detectado
  const dismissFilter = useCallback((filter: DetectedFilter) => {
    setExplicitFilters(prev => prev.filter(f =>
      !(f.type === filter.type && f.canonical === filter.canonical)
    ));
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(`${filter.type}:${filter.canonical}`);
      return next;
    });
  }, []);

  // Resetar slash mode
  const resetSlash = useCallback(() => {
    setSlashMode('idle');
    setSlashCategory(null);
    setSlashStartPos(0);
    setDropdownIndex(-1);
  }, []);

  // Escape: remove o /comando do texto e volta a idle
  const handleSlashEscape = useCallback(() => {
    const before = inputValue.substring(0, slashStartPos);
    setInputValue(before);
    resetSlash();
    inputRef.current?.focus();
  }, [inputValue, slashStartPos, resetSlash]);

  // Selecionar um comando (Etapa 1 → 2)
  const selectCommand = useCallback((cmdKey: FilterType) => {
    const before = inputValue.substring(0, slashStartPos);
    setInputValue(before + '/' + cmdKey + ' ');
    setSlashMode('value');
    setSlashCategory(cmdKey);
    setDropdownIndex(-1);
    // Focus precisa de um tick para o React atualizar o value
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [inputValue, slashStartPos]);

  // Selecionar um valor (Etapa 2 → chip)
  const selectValue = useCallback((value: string) => {
    if (!slashCategory) return;

    const before = inputValue.substring(0, slashStartPos);
    setInputValue(before);

    setExplicitFilters(prev => [
      ...prev,
      {
        type: slashCategory,
        label: value,
        canonical: value,
        originalText: '/' + slashCategory + ' ' + value,
      },
    ]);

    resetSlash();
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [inputValue, slashStartPos, slashCategory, resetSlash]);

  // Botão de filtro: insere / e abre palette
  const handleFilterButton = useCallback(() => {
    const newValue = inputValue + (inputValue && !inputValue.endsWith(' ') ? ' /' : '/');
    setInputValue(newValue);
    setSlashMode('palette');
    setSlashStartPos(newValue.length - 1);
    setDropdownIndex(-1);
    inputRef.current?.focus();
  }, [inputValue]);

  // Input change — detectar /, backspace reverso, etc.
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      setDismissed(new Set());
      setDropdownIndex(-1);

      // --- Slash detection ---
      if (slashMode === 'idle') {
        // Gatilho seguro: / no início ou precedido por espaço
        if (/(^|\s)\/$/.test(newValue)) {
          setSlashMode('palette');
          setSlashStartPos(newValue.length - 1);
          return;
        }
      }

      if (slashMode === 'palette') {
        const slashText = newValue.substring(slashStartPos);
        // Se o usuário apagou o / completamente, volta a idle
        if (!slashText.startsWith('/')) {
          resetSlash();
          return;
        }

        // Auto-Resolve no espaço: /m → materia, /b → banca, /a → ano
        const afterSlash = slashText.substring(1); // remove /
        if (afterSlash.endsWith(' ')) {
          const term = afterSlash.trimEnd().toLowerCase();
          // .find() pega o primeiro match — ordem do array resolve colisões (/a → ano)
          const topMatch = SLASH_COMMANDS.find(cmd =>
            cmd.key.startsWith(term) || cmd.label.toLowerCase().startsWith(term)
          );

          if (topMatch) {
            // Sucesso: expande para /comando e entra em value
            const before = newValue.substring(0, slashStartPos);
            setInputValue(before + '/' + topMatch.key + ' ');
            setSlashMode('value');
            setSlashCategory(topMatch.key);
            return;
          } else {
            // Falha: /macaco → nenhum match. Volta a idle, texto fica como está
            resetSlash();
            return;
          }
        }
      }

      if (slashMode === 'value') {
        const slashText = newValue.substring(slashStartPos);
        // Se apagou o / completamente, volta a idle
        if (!slashText.startsWith('/')) {
          resetSlash();
          return;
        }
        // Backspace reverso: se não tem mais espaço após o comando, volta a palette
        const afterSlash = slashText.substring(1); // remove /
        if (slashCategory && !afterSlash.includes(' ')) {
          setSlashMode('palette');
          setSlashCategory(null);
          return;
        }
      }
    },
    [slashMode, slashStartPos, slashCategory, resetSlash],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Escape
      if (e.key === 'Escape' && slashMode !== 'idle') {
        e.preventDefault();
        handleSlashEscape();
        return;
      }

      if (!showDropdown) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setDropdownIndex(prev => (prev + 1) % dropdownItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setDropdownIndex(prev => (prev <= 0 ? dropdownItems.length - 1 : prev - 1));
      } else if ((e.key === 'Enter' || e.key === 'Tab') && dropdownIndex >= 0) {
        e.preventDefault();
        const item = dropdownItems[dropdownIndex];
        if (slashMode === 'palette') {
          selectCommand(item.id as FilterType);
        } else if (slashMode === 'value') {
          selectValue(item.id);
        }
      }
    },
    [slashMode, showDropdown, dropdownItems, dropdownIndex, handleSlashEscape, selectCommand, selectValue],
  );

  // Submit
  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();

      // Se dropdown está aberto com item selecionado, não submete
      if (showDropdown && dropdownIndex >= 0) return;

      // Se está em modo slash, fecha antes de submeter
      if (slashMode !== 'idle') {
        handleSlashEscape();
      }

      const raw = inputValue.trim();
      if (!raw && allFilters.length === 0) return;

      const filters: SearchFilters = {};
      for (const f of allFilters) {
        if (f.type === 'ano') {
          filters.ano = parseInt(f.canonical, 10);
        } else {
          filters[f.type] = f.canonical;
        }
      }

      const cleanQuery = allFilters.length > 0
        ? buildCleanQuery(raw, allFilters)
        : raw;

      onSearch({ query: cleanQuery || raw || '*', filters });
    },
    [inputValue, allFilters, onSearch, showDropdown, dropdownIndex, slashMode, handleSlashEscape],
  );

  // Limpar tudo
  const handleClear = useCallback(() => {
    setInputValue('');
    setDismissed(new Set());
    setExplicitFilters([]);
    resetSlash();
    inputRef.current?.focus();
  }, [resetSlash]);

  // Clique em sugestão de busca recente
  const handleSuggestionClick = useCallback(
    (termo: string) => {
      setInputValue(termo);
      setDismissed(new Set());
      setExplicitFilters([]);
      resetSlash();
      onSearch({ query: termo, filters: {} });
    },
    [onSearch, resetSlash],
  );

  const hasContent = inputValue.trim().length > 0 || allFilters.length > 0;
  const showSuggestionsPanel = focused && !hasResults && !loading && !showDropdown && slashMode === 'idle';

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="relative">
        {/* Glow */}
        <div
          className={`absolute -inset-2 rounded-2xl blur-2xl transition-all duration-500 ${
            focused ? 'opacity-50' : 'opacity-30'
          } bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500`}
        />

        <form
          onSubmit={handleSubmit}
          className={`relative flex items-center gap-4 px-6 py-5 rounded-2xl transition-all duration-300 bg-white dark:bg-slate-800 border-2 ${
            focused
              ? 'border-orange-500 dark:border-orange-400 shadow-2xl'
              : 'border-slate-200 dark:border-slate-700 shadow-xl'
          }`}
          onClick={handleBarClick}
        >
          {/* Icon */}
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg flex-shrink-0">
            <Search className="h-5 w-5 text-white" />
          </div>

          {/* Input + filtros + dropdown */}
          <div className="flex-1 flex flex-col relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 200)}
              placeholder={placeholder}
              className="flex-1 min-w-[200px] h-auto p-0 bg-transparent border-0 focus:outline-none focus:ring-0 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-base"
            />

            {/* Filtros detectados — abaixo do input */}
            {allFilters.length > 0 ? (
              <>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    Filtros:
                  </span>
                  {allFilters.map(f => {
                    const style = FILTER_STYLES[f.type];
                    return (
                      <Badge
                        key={`${f.type}-${f.canonical}`}
                        variant="secondary"
                        className={`gap-1 pr-0.5 py-0 text-[11px] font-medium ${style.bg} ${style.text} cursor-default select-none`}
                      >
                        <span className="text-[10px]">{style.icon}</span>
                        {f.label}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissFilter(f);
                          }}
                          className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                          title="Remover filtro"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Dica: use <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[10px] font-mono">/</kbd> para adicionar filtros (banca, ano, materia...)
              </p>
            )}

            {/* Slash Command Dropdown */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Header da etapa */}
                {slashMode === 'palette' && (
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Filtros
                    </span>
                  </div>
                )}
                {slashMode === 'value' && slashCategory && (
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      {SLASH_COMMANDS.find(c => c.key === slashCategory)?.label}
                    </span>
                  </div>
                )}

                {/* Items */}
                {dropdownItems.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (slashMode === 'palette') {
                        selectCommand(item.id as FilterType);
                      } else if (slashMode === 'value') {
                        selectValue(item.id);
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                      idx === dropdownIndex
                        ? 'bg-orange-50 dark:bg-orange-900/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    {item.icon && <span className="text-base w-6 text-center">{item.icon}</span>}
                    <span className="flex-1 text-slate-800 dark:text-slate-200">{item.label}</span>
                    {item.desc && (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        {item.desc}
                      </span>
                    )}
                  </button>
                ))}

                {/* Footer */}
                <div className="flex items-center gap-2 px-4 py-2 border-t border-slate-100 dark:border-slate-700 text-[11px] text-slate-400 dark:text-slate-500">
                  <CornerDownLeft className="h-3 w-3" />
                  <span>
                    {slashMode === 'palette' ? 'Selecionar filtro' : 'Selecionar valor'}
                  </span>
                  <span className="ml-auto">Esc para cancelar</span>
                </div>
              </div>
            )}
          </div>

          {/* Botão de filtro (para quem não conhece /) */}
          <button
            type="button"
            onClick={handleFilterButton}
            className="p-2 text-slate-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
            title="Adicionar filtro (/)"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>

          {/* Clear button */}
          {hasContent && (
            <button
              type="button"
              onClick={handleClear}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={loading || !hasContent}
            className="gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Buscar
              </>
            )}
          </Button>
        </form>

        {/* Painel de sugestões (buscas recentes + mais buscados) */}
        {showSuggestionsPanel && (
          <div className="relative z-10 mt-4 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-6">
            {buscasRecentes.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  Buscas Recentes
                </h3>
                <div className="flex flex-wrap gap-2">
                  {buscasRecentes.map((termo) => (
                    <button
                      key={termo}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSuggestionClick(termo)}
                      className="px-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700"
                    >
                      {termo}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Mais Buscados
              </h3>
              <div className="flex flex-wrap gap-2">
                {sugestoes.map((termo) => (
                  <button
                    key={termo}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSuggestionClick(termo)}
                    className="px-4 py-2 text-sm bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors border border-orange-200 dark:border-orange-800"
                  >
                    {termo}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
