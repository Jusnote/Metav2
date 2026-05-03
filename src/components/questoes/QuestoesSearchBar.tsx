"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useQuestoesContext } from "@/contexts/QuestoesContext";
import { useQuestoesFilterDraft } from "@/contexts/QuestoesFilterDraftContext";
import { useFiltrosDicionario } from "@/hooks/useFiltrosDicionario";
import { FILTER_CATEGORIES, getCategoryItems, type FilterItem } from "./filter-config";
import type { AppliedFilters } from "@/lib/questoes/filter-serialization";

/**
 * Mapeamento category.key → AppliedFilters key. Categorias usam plural
 * (`bancas`, `materias`); AppliedFilters usa as mesmas chaves, então
 * direto. `anos` é numérico, demais são string[].
 */
type AppliedFilterKey = 'bancas' | 'materias' | 'assuntos' | 'orgaos' | 'cargos' | 'anos';

const APPLIED_KEYS: ReadonlySet<string> = new Set([
  'bancas', 'materias', 'assuntos', 'orgaos', 'cargos', 'anos',
]);

interface SlashState {
  active: boolean;
  /** Posição do `/` no texto (índice do caractere). */
  slashIdx: number;
  /** Texto após o `/` até o primeiro espaço (= categoria sendo digitada). */
  catText: string;
  /** Texto após `/<categoria> ` até cursor (= valor sendo digitado). */
  valueText: string;
  matchedCategory: { key: AppliedFilterKey; label: string } | null;
}

const SLASH_INITIAL: SlashState = {
  active: false,
  slashIdx: -1,
  catText: '',
  valueText: '',
  matchedCategory: null,
};

/** Procura `/` no input e parseia categoria/valor. Retorna estado do slash. */
function parseSlash(input: string, cursor: number): SlashState {
  // Pega texto até cursor
  const before = input.slice(0, cursor);
  // Acha último `/` que está no início ou após espaço
  let slashIdx = -1;
  for (let i = before.length - 1; i >= 0; i--) {
    if (before[i] === '/' && (i === 0 || before[i - 1] === ' ')) {
      slashIdx = i;
      break;
    }
  }
  if (slashIdx === -1) return SLASH_INITIAL;

  const afterSlash = before.slice(slashIdx + 1);
  const spaceIdx = afterSlash.indexOf(' ');
  const catText = spaceIdx === -1 ? afterSlash : afterSlash.slice(0, spaceIdx);
  const valueText = spaceIdx === -1 ? '' : afterSlash.slice(spaceIdx + 1);

  // Match categoria (case-insensitive prefix ou contém)
  const lc = catText.toLowerCase();
  const matched = FILTER_CATEGORIES.find((c) => {
    if (!APPLIED_KEYS.has(c.key)) return false;
    const labelSingular = c.label.toLowerCase().replace(/s$/, '');
    return c.key.toLowerCase().startsWith(lc)
      || c.label.toLowerCase().startsWith(lc)
      || labelSingular.startsWith(lc);
  });

  return {
    active: true,
    slashIdx,
    catText,
    valueText,
    matchedCategory: matched && APPLIED_KEYS.has(matched.key)
      ? { key: matched.key as AppliedFilterKey, label: matched.label }
      : null,
  };
}

export interface QuestoesSearchBarProps {
  autoFocus?: boolean;
  placeholder?: string;
}

/**
 * Barra de busca semântica + slash filters.
 *
 * Texto livre → query semântica (via QuestoesContext.searchQuery).
 * `/banca CESPE` → adiciona filtro CESPE em bancas (via setPendentes + apply
 * do QuestoesFilterDraftContext).
 */
export function QuestoesSearchBar({
  autoFocus = false,
  placeholder = 'Buscar ou /banca, /materia, /ano…',
}: QuestoesSearchBarProps) {
  const { searchQuery, setSearchQuery, triggerSearch } = useQuestoesContext();
  const { pendentes, setPendentes, apply } = useQuestoesFilterDraft();
  const { dicionario } = useFiltrosDicionario();
  const inputRef = useRef<HTMLInputElement>(null);

  const [slash, setSlash] = useState<SlashState>(SLASH_INITIAL);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Reset highlight quando categoria/valor mudam
  useEffect(() => {
    setHighlight(0);
  }, [slash.catText, slash.valueText, slash.matchedCategory?.key]);

  const suggestions = useMemo<FilterItem[]>(() => {
    if (!slash.active) return [];

    if (!slash.matchedCategory) {
      // Fase categoria: mostra categorias que batem
      const lc = slash.catText.toLowerCase();
      return FILTER_CATEGORIES
        .filter((c) => APPLIED_KEYS.has(c.key))
        .filter((c) => {
          if (!lc) return true;
          return c.key.toLowerCase().startsWith(lc)
            || c.label.toLowerCase().startsWith(lc);
        })
        .map((c) => ({ label: c.label, value: c.key }));
    }

    // Fase valor: itens da categoria filtrados pelo texto
    const items = getCategoryItems(slash.matchedCategory.key, dicionario);
    const q = slash.valueText.toLowerCase();
    if (!q) return items.slice(0, 30);
    return items
      .filter((i) => i.label.toLowerCase().includes(q))
      .slice(0, 30);
  }, [slash, dicionario]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearchQuery(val);
    const cursor = e.target.selectionStart ?? val.length;
    setSlash(parseSlash(val, cursor));
  }

  function applyValueSelection(value: string) {
    if (!slash.matchedCategory) return;
    const key = slash.matchedCategory.key;
    const current = (pendentes[key] ?? []) as Array<string | number>;
    const coerced: string | number = key === 'anos' ? Number(value) : value;
    if (current.some((v) => v === coerced)) return; // já aplicado
    const nextArray = [...current, coerced] as AppliedFilters[typeof key];
    const nextPendentes: AppliedFilters = { ...pendentes, [key]: nextArray };
    setPendentes(nextPendentes);
    // Limpa o trecho /categoria valor do input
    const cleanedQuery = searchQuery.slice(0, slash.slashIdx).trimEnd();
    setSearchQuery(cleanedQuery);
    setSlash(SLASH_INITIAL);
    // Commit imediato — usuário queria filtrar agora
    setTimeout(() => apply(), 0);
  }

  function applyCategorySelection(catKey: string) {
    // Avança pra fase valor: substitui /<catText> por /<key> e mantém espaço
    const cat = FILTER_CATEGORIES.find((c) => c.key === catKey);
    if (!cat) return;
    const before = searchQuery.slice(0, slash.slashIdx);
    const after = searchQuery.slice(slash.slashIdx + 1 + slash.catText.length);
    const next = `${before}/${cat.key} ${after.replace(/^\s+/, '')}`;
    setSearchQuery(next);
    // Foca novamente; cursor vai pro fim por simplicidade
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        const pos = before.length + 1 + cat.key.length + 1;
        el.focus();
        el.setSelectionRange(pos, pos);
        setSlash(parseSlash(next, pos));
      }
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (slash.active && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlash(SLASH_INITIAL);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const item = suggestions[highlight];
        if (!item) return;
        if (slash.matchedCategory) {
          applyValueSelection(item.value);
        } else {
          applyCategorySelection(item.value);
        }
        return;
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerSearch();
    }
  }

  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        value={searchQuery}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full pl-10 pr-3 py-2.5 text-sm rounded-md border border-slate-200 outline-none focus:border-blue-400"
      />

      {slash.active && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-72 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
            {slash.matchedCategory
              ? `${slash.matchedCategory.label} · escolha um valor`
              : 'Categoria de filtro'}
          </div>
          <ul>
            {suggestions.map((item, i) => (
              <li
                key={`${item.value}-${i}`}
                className={[
                  'px-3 py-1.5 text-sm cursor-pointer flex items-center justify-between',
                  i === highlight ? 'bg-blue-50 text-slate-900' : 'text-slate-700 hover:bg-slate-50',
                ].join(' ')}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (slash.matchedCategory) {
                    applyValueSelection(item.value);
                  } else {
                    applyCategorySelection(item.value);
                  }
                }}
              >
                <span className="truncate">{item.label}</span>
                {!slash.matchedCategory && (
                  <span className="text-[10px] text-slate-400">/{item.value}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
