'use client';

import * as React from 'react';

import type { TComboboxInputElement } from 'platejs';
import type { PlateElementProps } from 'platejs/react';

import {
  ComboboxItem,
} from '@ariakit/react';
import {
  Building2,
  Calendar,
  BookOpen,
  Landmark,
  User,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { PlateElement } from 'platejs/react';

import { cn } from '@/lib/utils';
import {
  SearchFiltersContext,
  FilterType,
} from '@/components/search-filter-kit';
import { useFiltrosDicionario, FiltrosDicionario } from '@/hooks/useFiltrosDicionario';

import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxInput,
  InlineComboboxItem,
} from './inline-combobox';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Step = 'categories' | 'values' | 'assuntos';

interface Category {
  filterType: FilterType;
  label: string;
  icon: React.ReactNode;
  values: string[];
}

interface CategoryMeta {
  filterType: FilterType;
  label: string;
  icon: React.ReactNode;
}

// Ordenado por frequência de uso — resolve colisão (ano antes de assunto)
const CATEGORY_META: CategoryMeta[] = [
  { filterType: 'banca',   label: 'Banca',   icon: <Landmark className="h-4 w-4" /> },
  { filterType: 'materia', label: 'Matéria',  icon: <BookOpen className="h-4 w-4" /> },
  { filterType: 'ano',     label: 'Ano',      icon: <Calendar className="h-4 w-4" /> },
  { filterType: 'orgao',   label: 'Órgão',    icon: <Building2 className="h-4 w-4" /> },
  { filterType: 'cargo',   label: 'Cargo',    icon: <User className="h-4 w-4" /> },
  { filterType: 'assunto', label: 'Assunto',  icon: <BookOpen className="h-4 w-4" /> },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getValuesForCategory(filterType: FilterType, dicionario: FiltrosDicionario): string[] {
  switch (filterType) {
    case 'banca':   return [...new Set(Object.values(dicionario.bancas))].sort();
    case 'orgao':   return [...new Set(Object.values(dicionario.orgaos))].sort();
    case 'cargo':   return [...new Set(Object.values(dicionario.cargos))].sort();
    case 'materia': return dicionario.materias;
    case 'assunto': return dicionario.assuntos;
    case 'ano': {
      const { min, max } = dicionario.anos;
      return Array.from({ length: max - min + 1 }, (_, i) => String(max - i));
    }
    default: return [];
  }
}

// ---------------------------------------------------------------------------
// Styled ComboboxItem for categories (does NOT call removeInput)
// ---------------------------------------------------------------------------
function CategoryItem({
  children,
  className,
  onClick,
  value,
}: {
  children: React.ReactNode;
  className?: string;
  onClick: () => void;
  value: string;
}) {
  return (
    <ComboboxItem
      className={cn(
        'relative mx-1 flex h-9 items-center rounded-sm px-2.5 text-sm text-foreground outline-none select-none',
        'cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground',
        'data-[active-item=true]:bg-accent data-[active-item=true]:text-accent-foreground',
        className
      )}
      value={value}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      hideOnClick={false}
      focusOnHover
    >
      {children}
    </ComboboxItem>
  );
}

// ---------------------------------------------------------------------------
// Header de navegação (Voltar)
// ---------------------------------------------------------------------------
function StepHeader({
  label,
  icon,
  onBack,
}: {
  label: string;
  icon?: React.ReactNode;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-1 px-2 pt-1.5 pb-1 border-b border-border/50 mb-1">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onBack();
        }}
        className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded px-1 py-0.5 hover:bg-accent"
      >
        <ChevronLeft className="h-3 w-3" />
        Voltar
      </button>
      <span className="flex items-center gap-1.5 ml-auto text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component principal
// ---------------------------------------------------------------------------
export function SearchSlashInputElement(
  props: PlateElementProps<TComboboxInputElement>
) {
  const { element } = props;

  // Contexto de filtros (chips abaixo da barra)
  const filtersCtx = React.useContext(SearchFiltersContext);

  // Dados dinâmicos da API
  const { dicionario } = useFiltrosDicionario();
  const materiaAssuntos = dicionario?.materia_assuntos || {};

  // Multi-step state
  const [step, setStep] = React.useState<Step>('categories');
  const [selectedCategory, setSelectedCategory] = React.useState<Category | null>(null);
  const [selectedMateria, setSelectedMateria] = React.useState<string | null>(null);

  const [inputValue, setInputValue] = React.useState('');
  const [consumedPrefix, setConsumedPrefix] = React.useState('');

  // Tipos já usados (lê do contexto, não do editor)
  const usedTypes = React.useMemo(() => {
    if (!filtersCtx) return new Set<string>();
    return new Set(filtersCtx.filters.map((f) => f.type));
  }, [filtersCtx]);

  // Categorias com valores dinâmicos da API
  const categories: Category[] = React.useMemo(() => {
    if (!dicionario) return [];
    return CATEGORY_META.map((meta) => ({
      ...meta,
      values: getValuesForCategory(meta.filterType, dicionario),
    }));
  }, [dicionario]);

  // Categorias disponíveis (excluindo já usadas)
  const availableCategories = React.useMemo(
    () => categories.filter((c) => !usedTypes.has(c.filterType)),
    [categories, usedTypes]
  );

  // Filtro inteligente com startsWith
  const filteredCategories = React.useMemo(() => {
    if (step !== 'categories' || !inputValue) return availableCategories;
    const s = inputValue.trim().toLowerCase();
    if (!s) return availableCategories;
    return availableCategories.filter((c) => c.filterType.startsWith(s));
  }, [step, inputValue, availableCategories]);

  // Valores diretos cross-category
  const directValueMatches = React.useMemo(() => {
    if (step !== 'categories' || !inputValue) return [];
    const s = inputValue.trim().toLowerCase();
    if (!s) return [];
    if (availableCategories.some((c) => c.filterType.startsWith(s))) return [];
    const matches: { cat: Category; value: string }[] = [];
    for (const cat of availableCategories) {
      for (const v of cat.values) {
        if (v.toLowerCase().includes(s)) {
          matches.push({ cat, value: v });
        }
      }
    }
    return matches;
  }, [step, inputValue, availableCategories]);

  // Auto-drill: espaço + .find()
  React.useEffect(() => {
    if (step === 'categories' && inputValue.endsWith(' ')) {
      const s = inputValue.trim().toLowerCase();
      if (!s) return;
      const match = availableCategories.find((c) => c.filterType.startsWith(s));
      if (match) {
        setSelectedCategory(match);
        setStep('values');
        setConsumedPrefix(inputValue);
      }
    }
  }, [step, inputValue, availableCategories]);

  // Valores filtrados
  const currentValues = React.useMemo(() => {
    if (step === 'values' && selectedCategory) {
      return selectedCategory.values;
    }
    if (step === 'assuntos' && selectedMateria) {
      return materiaAssuntos[selectedMateria] || [];
    }
    return [];
  }, [step, selectedCategory, selectedMateria, materiaAssuntos]);

  const valueSearchText = React.useMemo(() => {
    if (!consumedPrefix) return inputValue.trim();
    if (inputValue.startsWith(consumedPrefix)) {
      return inputValue.slice(consumedPrefix.length).trim();
    }
    return inputValue.trim();
  }, [inputValue, consumedPrefix]);

  const filteredValues = React.useMemo(() => {
    if (!valueSearchText) return currentValues;
    const search = valueSearchText.toLowerCase();
    const starts = currentValues.filter((v) => v.toLowerCase().startsWith(search));
    const contains = currentValues.filter(
      (v) => !v.toLowerCase().startsWith(search) && v.toLowerCase().includes(search)
    );
    return [...starts, ...contains];
  }, [currentValues, valueSearchText]);

  // Handlers
  const handleCategoryClick = React.useCallback((cat: Category) => {
    setSelectedCategory(cat);
    setStep('values');
    setConsumedPrefix(inputValue);
  }, [inputValue]);

  const handleValueClick = React.useCallback(
    (value: string) => {
      if (!selectedCategory || !filtersCtx) return;

      // Matéria com assuntos → drill-down SEM adicionar filtro ainda
      if (selectedCategory.filterType === 'materia' && materiaAssuntos[value]?.length > 0) {
        setSelectedMateria(value);
        setStep('assuntos');
        setConsumedPrefix(inputValue);
        return;
      }

      // Outros filtros: adiciona ao contexto, InlineComboboxItem fecha
      filtersCtx.addFilter(selectedCategory.filterType, value);
    },
    [selectedCategory, filtersCtx, materiaAssuntos, inputValue]
  );

  const handleAssuntoClick = React.useCallback(
    (assunto: string) => {
      if (!filtersCtx) return;
      // Insere matéria + assunto juntos
      if (selectedMateria) {
        filtersCtx.addFilter('materia', selectedMateria);
      }
      filtersCtx.addFilter('assunto', assunto);
    },
    [filtersCtx, selectedMateria]
  );

  const handleSkipAssunto = React.useCallback(() => {
    if (!filtersCtx || !selectedMateria) return;
    filtersCtx.addFilter('materia', selectedMateria);
  }, [filtersCtx, selectedMateria]);

  const handleBack = React.useCallback(() => {
    if (step === 'assuntos') {
      setStep('values');
      setSelectedMateria(null);
    } else if (step === 'values') {
      setStep('categories');
      setSelectedCategory(null);
      setConsumedPrefix('');
    }
  }, [step]);

  // Loading state
  if (!dicionario) {
    return (
      <PlateElement {...props} as="span">
        <InlineCombobox
          element={element}
          trigger="/"
          filter={false}
          value={inputValue}
          setValue={setInputValue}
        >
          <InlineComboboxInput />
          <InlineComboboxContent className="max-h-[340px] w-[260px] py-1">
            <div className="px-3 py-3 text-sm text-muted-foreground text-center">
              Carregando filtros...
            </div>
            <InlineComboboxItem value="__loading__" className="hidden" />
          </InlineComboboxContent>
        </InlineCombobox>
        {props.children}
      </PlateElement>
    );
  }

  return (
    <PlateElement {...props} as="span">
      <InlineCombobox
        element={element}
        trigger="/"
        filter={false}
        value={inputValue}
        setValue={setInputValue}
      >
        <InlineComboboxInput />

        <InlineComboboxContent className="max-h-[340px] w-[260px] py-1">

          {/* ============ STEP 1: Categorias ============ */}
          {step === 'categories' && (
            <>
              {filteredCategories.length > 0 && (
                <>
                  <div className="px-3 pt-1 pb-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    {inputValue ? 'Categorias' : 'Filtrar por'}
                  </div>

                  {filteredCategories.map((cat) => (
                    <CategoryItem
                      key={cat.filterType}
                      value={cat.filterType}
                      onClick={() => handleCategoryClick(cat)}
                    >
                      <span className="text-muted-foreground mr-2.5">{cat.icon}</span>
                      <span className="font-medium">{cat.label}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {cat.values.length}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 ml-1 text-muted-foreground/50" />
                    </CategoryItem>
                  ))}
                </>
              )}

              {directValueMatches.length > 0 && (
                <>
                  <div className={cn(
                    "px-3 pb-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider",
                    filteredCategories.length > 0 ? 'pt-2 mt-1 border-t border-border/50' : 'pt-1'
                  )}>
                    Resultados
                  </div>

                  {directValueMatches.map(({ cat, value: val }) => (
                    <InlineComboboxItem
                      key={`${cat.filterType}:${val}`}
                      value={`${cat.filterType}:${val}`}
                      label={val}
                      onClick={() => {
                        if (!filtersCtx) return;
                        filtersCtx.addFilter(cat.filterType, val);
                      }}
                    >
                      <span className="text-muted-foreground mr-2">{cat.icon}</span>
                      <span>{val}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground/70">
                        {cat.label}
                      </span>
                    </InlineComboboxItem>
                  ))}
                </>
              )}

              {filteredCategories.length === 0 && directValueMatches.length === 0 && (
                <div className="px-3 py-3 text-sm text-muted-foreground text-center">
                  {availableCategories.length === 0
                    ? 'Todos os filtros já aplicados'
                    : 'Nenhum filtro encontrado'}
                </div>
              )}

              <InlineComboboxItem value="__placeholder__" className="hidden" />
            </>
          )}

          {/* ============ STEP 2: Valores da categoria ============ */}
          {step === 'values' && selectedCategory && (
            <>
              <StepHeader
                label={selectedCategory.label}
                icon={selectedCategory.icon}
                onBack={handleBack}
              />

              <InlineComboboxEmpty>Nenhum resultado</InlineComboboxEmpty>

              {selectedCategory.filterType === 'materia'
                ? filteredValues.map((val) => (
                    <CategoryItem
                      key={val}
                      value={`materia:${val}`}
                      onClick={() => handleValueClick(val)}
                    >
                      <span className="text-muted-foreground mr-2">
                        <BookOpen className="h-3.5 w-3.5" />
                      </span>
                      {val}
                      {materiaAssuntos[val] && (
                        <span className="ml-auto flex items-center gap-0.5 text-xs text-muted-foreground">
                          {materiaAssuntos[val].length}
                          <ChevronRight className="h-3 w-3" />
                        </span>
                      )}
                    </CategoryItem>
                  ))
                : filteredValues.map((val) => (
                    <InlineComboboxItem
                      key={val}
                      value={`${selectedCategory.filterType}:${val}`}
                      label={val}
                      onClick={() => handleValueClick(val)}
                    >
                      <span className="text-muted-foreground mr-2">
                        {selectedCategory.icon}
                      </span>
                      {val}
                    </InlineComboboxItem>
                  ))}

              {selectedCategory.filterType === 'materia' && (
                <InlineComboboxItem value="__placeholder_materia__" className="hidden" />
              )}
            </>
          )}

          {/* ============ STEP 3: Assuntos da matéria ============ */}
          {step === 'assuntos' && selectedMateria && (
            <>
              <StepHeader
                label={selectedMateria}
                icon={<BookOpen className="h-3.5 w-3.5" />}
                onBack={handleBack}
              />

              <div className="px-3 pb-1 text-[11px] text-muted-foreground">
                Selecione o assunto (opcional)
              </div>

              <InlineComboboxEmpty>Nenhum assunto</InlineComboboxEmpty>

              {filteredValues.map((assunto) => (
                <InlineComboboxItem
                  key={assunto}
                  value={`assunto:${assunto}`}
                  label={assunto}
                  onClick={() => handleAssuntoClick(assunto)}
                >
                  {assunto}
                </InlineComboboxItem>
              ))}

              <InlineComboboxItem
                value="__skip_assunto__"
                label="Pular"
                className="mt-1 border-t border-border/50 pt-1 text-muted-foreground"
                onClick={handleSkipAssunto}
              >
                <span className="text-xs italic">Pular — só matéria</span>
              </InlineComboboxItem>
            </>
          )}

        </InlineComboboxContent>
      </InlineCombobox>

      {props.children}
    </PlateElement>
  );
}
