import React, { useState, useEffect, useMemo } from 'react';
import { ChevronRight, Clock, BookOpen, Loader2, Search, X, Box } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface Subtopic {
  id: string;
  title: string;
  estimated_duration_minutes?: number;
}

interface Topic {
  id: string;
  title: string;
  estimated_duration_minutes?: number;
  subtopics: Subtopic[];
}

interface Unit {
  id: string;
  title: string;
  topics: Topic[];
}

interface SubtopicSelectorProps {
  units: Unit[];
  selectedSubtopics: Set<string>;
  selectedTopics: Set<string>; // Para tópicos sem subtópicos
  onToggleSubtopic: (subtopicId: string) => void;
  onToggleTopic: (topicId: string) => void; // Para tópicos sem subtópicos
  onToggleAllSubtopics: (subtopicIds: string[]) => void; // Atalho para selecionar todos
  isLoading?: boolean;
}

export function SubtopicSelector({
  units,
  selectedSubtopics,
  selectedTopics,
  onToggleSubtopic,
  onToggleTopic,
  onToggleAllSubtopics,
  isLoading = false,
}: SubtopicSelectorProps) {
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-expand first unit on load
  useEffect(() => {
    if (units.length > 0 && expandedUnits.size === 0) {
      setExpandedUnits(new Set([units[0].id]));
    }
  }, [units]);

  const toggleUnit = (unitId: string) => {
    const newExpanded = new Set(expandedUnits);
    if (newExpanded.has(unitId)) {
      newExpanded.delete(unitId);
    } else {
      newExpanded.add(unitId);
    }
    setExpandedUnits(newExpanded);
  };

  const toggleTopic = (topicId: string) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicId)) {
      newExpanded.delete(topicId);
    } else {
      newExpanded.add(topicId);
    }
    setExpandedTopics(newExpanded);
  };

  const formatTime = (minutes?: number) => {
    if (!minutes) return null;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  // Filtrar units/topics/subtopics baseado na busca
  const filteredUnits = useMemo(() => {
    if (!searchQuery.trim()) return units;

    const query = searchQuery.toLowerCase();
    const newExpandedUnits = new Set<string>();
    const newExpandedTopics = new Set<string>();

    const filtered = units
      .map((unit) => {
        const unitMatches = unit.title.toLowerCase().includes(query);

        const filteredTopics = unit.topics
          .map((topic) => {
            const topicMatches = topic.title.toLowerCase().includes(query);

            const filteredSubtopics = topic.subtopics.filter((subtopic) =>
              subtopic.title.toLowerCase().includes(query)
            );

            // Incluir tópico se: (1) nome match, (2) tem subtópicos que match
            if (topicMatches || filteredSubtopics.length > 0) {
              newExpandedUnits.add(unit.id);
              if (filteredSubtopics.length > 0) {
                newExpandedTopics.add(topic.id);
              }
              return { ...topic, subtopics: filteredSubtopics };
            }
            return null;
          })
          .filter((t) => t !== null) as Topic[];

        // Incluir unidade se: (1) nome match, (2) tem tópicos que match
        if (unitMatches || filteredTopics.length > 0) {
          return { ...unit, topics: filteredTopics };
        }
        return null;
      })
      .filter((u) => u !== null) as Unit[];

    // Auto-expand matches
    setExpandedUnits(newExpandedUnits);
    setExpandedTopics(newExpandedTopics);

    return filtered;
  }, [units, searchQuery]);

  // Contador de resultados
  const resultsCount = useMemo(() => {
    let count = 0;
    filteredUnits.forEach((unit) => {
      unit.topics.forEach((topic) => {
        if (topic.subtopics.length > 0) {
          count += topic.subtopics.length;
        } else {
          count += 1; // tópico sem subtópico
        }
      });
    });
    return count;
  }, [filteredUnits]);

  // Calcular tempo total da unidade
  const calculateUnitDuration = (unit: Unit): number => {
    return unit.topics.reduce((total, topic) => {
      if (topic.subtopics.length > 0) {
        return total + topic.subtopics.reduce((sum, sub) => {
          return sum + (sub.estimated_duration_minutes || 90);
        }, 0);
      }
      return total + (topic.estimated_duration_minutes || 120);
    }, 0);
  };

  // Verificar se tópico tem subtópicos selecionados
  const hasSelectedSubtopics = (topic: Topic): boolean => {
    return topic.subtopics.some(sub => selectedSubtopics.has(sub.id));
  };

  // Contar subtópicos selecionados em um tópico
  const countSelectedSubtopics = (topic: Topic): number => {
    return topic.subtopics.filter(sub => selectedSubtopics.has(sub.id)).length;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (units.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Nenhuma unidade/tópico encontrado</p>
        <p className="text-sm mt-2">Crie unidades e tópicos primeiro</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Barra de Busca */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Buscar tópicos ou subtópicos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-9 h-9 text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Contador de Resultados */}
      {searchQuery && (
        <div className="text-xs text-gray-500 px-1">
          {resultsCount} resultado{resultsCount !== 1 ? 's' : ''} encontrado{resultsCount !== 1 ? 's' : ''}
        </div>
      )}

      {/* Mensagem vazia */}
      {searchQuery && filteredUnits.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          Nenhum resultado encontrado para "{searchQuery}"
        </div>
      )}

      {/* Lista de Units/Topics/Subtopics */}
      <div className="space-y-2">
        {filteredUnits.map((unit) => {
        const isUnitExpanded = expandedUnits.has(unit.id);
        const unitDuration = calculateUnitDuration(unit);

        return (
          <div key={unit.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            {/* Unit Header */}
            <button
              type="button"
              onClick={() => toggleUnit(unit.id)}
              className="w-full flex items-center gap-2.5 p-2.5 hover:bg-gray-50 transition-colors"
            >
              <ChevronRight
                className={`w-4 h-4 text-gray-400 transition-transform ${
                  isUnitExpanded ? 'rotate-90' : ''
                }`}
              />
              <Box className="w-4 h-4 text-gray-400" />
              <div className="flex-1 flex items-center justify-between text-left gap-2">
                <span className="font-medium text-sm text-gray-900">{unit.title}</span>
                {unitDuration > 0 && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3.5 h-3.5" />
                    {formatTime(unitDuration)}
                  </span>
                )}
              </div>
            </button>

            {/* Topics */}
            {isUnitExpanded && (
              <div className="px-2.5 pb-1.5 space-y-1 bg-gray-50/30">
                {unit.topics.map((topic) => {
                  const isTopicExpanded = expandedTopics.has(topic.id);
                  const hasSubtopics = topic.subtopics.length > 0;
                  const topicDuration = hasSubtopics
                    ? topic.subtopics.reduce((sum, sub) => sum + (sub.estimated_duration_minutes || 90), 0)
                    : topic.estimated_duration_minutes || 120;
                  const selectedCount = countSelectedSubtopics(topic);

                  return (
                    <div key={topic.id} className="ml-2 border-l border-gray-200 pl-3 py-0.5">
                      {/* Topic Header */}
                      <div className="flex items-center gap-2">
                        {hasSubtopics ? (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleTopic(topic.id)}
                              className="flex items-center gap-2 flex-1 hover:bg-white/60 rounded px-2 py-1.5 transition-colors"
                            >
                              <ChevronRight
                                className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
                                  isTopicExpanded ? 'rotate-90' : ''
                                }`}
                              />
                              <BookOpen className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-sm flex-1 text-left text-gray-700">
                                {topic.title}
                              </span>
                              {selectedCount > 0 && (
                                <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {selectedCount}/{topic.subtopics.length}
                                </span>
                              )}
                              {topicDuration > 0 && (
                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                  <Clock className="w-3.5 h-3.5" />
                                  {formatTime(topicDuration)}
                                </span>
                              )}
                            </button>
                            {/* Checkbox to select all subtopics (shortcut) */}
                            <Checkbox
                              checked={topic.subtopics.every(sub => selectedSubtopics.has(sub.id))}
                              onCheckedChange={() => onToggleAllSubtopics(topic.subtopics.map(s => s.id))}
                              title="Selecionar todos os subtópicos"
                            />
                          </>
                        ) : (
                          // Topic without subtopics - selectable (can be studied directly)
                          <div className="flex items-center gap-2 flex-1 hover:bg-white/60 rounded px-2 py-1.5 transition-colors">
                            <Checkbox
                              id={topic.id}
                              checked={selectedTopics.has(topic.id)}
                              onCheckedChange={() => onToggleTopic(topic.id)}
                            />
                            <BookOpen className="w-3.5 h-3.5 text-gray-400" />
                            <Label
                              htmlFor={topic.id}
                              className="cursor-pointer flex-1 text-sm flex items-center justify-between gap-2"
                            >
                              <span className="text-gray-700">{topic.title}</span>
                              {topicDuration > 0 && (
                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                  <Clock className="w-3.5 h-3.5" />
                                  {formatTime(topicDuration)}
                                </span>
                              )}
                            </Label>
                          </div>
                        )}
                      </div>

                      {/* Subtopics */}
                      {isTopicExpanded && hasSubtopics && (
                        <div className="ml-6 space-y-0.5 mt-1 pb-1">
                          {topic.subtopics.map((subtopic) => (
                            <div
                              key={subtopic.id}
                              className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-white/60 transition-colors"
                            >
                              <Checkbox
                                id={subtopic.id}
                                checked={selectedSubtopics.has(subtopic.id)}
                                onCheckedChange={() => onToggleSubtopic(subtopic.id)}
                              />
                              <Label
                                htmlFor={subtopic.id}
                                className="cursor-pointer flex-1 text-sm flex items-center justify-between gap-2"
                              >
                                <span className="text-gray-600">{subtopic.title}</span>
                                {subtopic.estimated_duration_minutes && (
                                  <span className="flex items-center gap-1 text-xs text-gray-500">
                                    <Clock className="w-3.5 h-3.5" />
                                    {formatTime(subtopic.estimated_duration_minutes)}
                                  </span>
                                )}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
