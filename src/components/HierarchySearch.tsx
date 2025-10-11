import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Search, X, ChevronRight } from 'lucide-react';
import { Unit, Topic, Subtopic } from '../hooks/useUnitsManager';

interface SearchResult {
  type: 'unit' | 'topic' | 'subtopic';
  id: string;
  title: string;
  path: string;
  unitId?: string;
  topicId?: string;
  item: Unit | Topic | Subtopic;
}

interface HierarchySearchProps {
  units: Unit[];
  onSelect: (result: SearchResult) => void;
  placeholder?: string;
}

export const HierarchySearch: React.FC<HierarchySearchProps> = ({
  units,
  onSelect,
  placeholder = 'Buscar unidades, tópicos ou subtópicos...'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim()) {
        performSearch(searchTerm);
      } else {
        setResults([]);
        setIsOpen(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, units]);

  const performSearch = (term: string) => {
    const lowerTerm = term.toLowerCase();
    const searchResults: SearchResult[] = [];

    units.forEach((unit) => {
      // Search in units
      if (unit.title.toLowerCase().includes(lowerTerm)) {
        searchResults.push({
          type: 'unit',
          id: unit.id,
          title: unit.title,
          path: unit.title,
          item: unit
        });
      }

      // Search in topics
      unit.topics.forEach((topic) => {
        if (topic.title.toLowerCase().includes(lowerTerm)) {
          searchResults.push({
            type: 'topic',
            id: topic.id,
            title: topic.title,
            path: `${unit.title} > ${topic.title}`,
            unitId: unit.id,
            item: topic
          });
        }

        // Search in subtopics
        topic.subtopics?.forEach((subtopic) => {
          if (subtopic.title.toLowerCase().includes(lowerTerm)) {
            searchResults.push({
              type: 'subtopic',
              id: subtopic.id,
              title: subtopic.title,
              path: `${unit.title} > ${topic.title} > ${subtopic.title}`,
              unitId: unit.id,
              topicId: topic.id,
              item: subtopic
            });
          }
        });
      });
    });

    setResults(searchResults);
    setIsOpen(searchResults.length > 0);
    setSelectedIndex(0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setSearchTerm('');
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelect = (result: SearchResult) => {
    onSelect(result);
    setSearchTerm('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setSearchTerm('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'unit':
        return '📚';
      case 'topic':
        return '📖';
      case 'subtopic':
        return '📄';
      default:
        return '•';
    }
  };

  const highlightMatch = (text: string, term: string) => {
    if (!term.trim()) return text;

    const parts = text.split(new RegExp(`(${term})`, 'gi'));
    return (
      <span>
        {parts.map((part, index) =>
          part.toLowerCase() === term.toLowerCase() ? (
            <mark
              key={index}
              className="bg-yellow-200 text-gray-900 font-semibold rounded px-0.5"
            >
              {part}
            </mark>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
      </span>
    );
  };

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && isOpen) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, isOpen]);

  return (
    <div className="relative w-full">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => searchTerm && setIsOpen(results.length > 0)}
          placeholder={placeholder}
          className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
        />
        {searchTerm && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded-full transition-colors"
            title="Limpar busca (Esc)"
          >
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden z-50 animate-fade-in">
          <div
            ref={resultsRef}
            className="max-h-64 overflow-y-auto"
          >
            {results.map((result, index) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleSelect(result)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-50 border-l-2 border-l-blue-500'
                    : 'hover:bg-gray-50 border-l-2 border-l-transparent'
                }`}
              >
                <span className="text-lg shrink-0 mt-0.5">{getResultIcon(result.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {highlightMatch(result.title, searchTerm)}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    {result.path.split(' > ').map((part, i, arr) => (
                      <React.Fragment key={i}>
                        <span className="truncate">{part}</span>
                        {i < arr.length - 1 && (
                          <ChevronRight className="w-3 h-3 shrink-0 text-gray-400" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Footer with shortcuts hint */}
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-3">
              <span>
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-xs">↑↓</kbd>{' '}
                navegar
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-xs">Enter</kbd>{' '}
                selecionar
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-xs">Esc</kbd>{' '}
                fechar
              </span>
            </div>
            <span>{results.length} resultados</span>
          </div>
        </div>
      )}

      {/* No results message */}
      {isOpen && searchTerm && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-2xl border border-gray-200 p-4 z-50 animate-fade-in">
          <div className="text-center text-gray-500 text-sm">
            <div className="text-2xl mb-2">🔍</div>
            Nenhum resultado encontrado para "{searchTerm}"
          </div>
        </div>
      )}
    </div>
  );
};
