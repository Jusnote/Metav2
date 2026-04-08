import React, { useState, useEffect, useMemo } from 'react';
import { ChevronRight, Clock, BookOpen, Loader2, Search, X, Box } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface Subtopico {
  id: string;
  nome: string;
  estimated_duration_minutes?: number;
}

interface Topico {
  id: string;
  nome: string;
  estimated_duration_minutes?: number;
  subtopicos: Subtopico[];
}

interface Disciplina {
  id: string;
  nome: string;
  topicos: Topico[];
}

interface SubtopicSelectorProps {
  units: Disciplina[];
  selectedSubtopics: Set<string>;
  selectedTopics: Set<string>; // Para topicos sem subtopicos
  onToggleSubtopic: (subtopicId: string) => void;
  onToggleTopic: (topicId: string) => void; // Para topicos sem subtopicos
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
  const [expandedDisciplinas, setExpandedDisciplinas] = useState<Set<string>>(new Set());
  const [expandedTopicos, setExpandedTopicos] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-expand first disciplina on load
  useEffect(() => {
    if (units.length > 0 && expandedDisciplinas.size === 0) {
      setExpandedDisciplinas(new Set([units[0].id]));
    }
  }, [units]);

  const toggleDisciplina = (disciplinaId: string) => {
    const newExpanded = new Set(expandedDisciplinas);
    if (newExpanded.has(disciplinaId)) {
      newExpanded.delete(disciplinaId);
    } else {
      newExpanded.add(disciplinaId);
    }
    setExpandedDisciplinas(newExpanded);
  };

  const toggleTopico = (topicoId: string) => {
    const newExpanded = new Set(expandedTopicos);
    if (newExpanded.has(topicoId)) {
      newExpanded.delete(topicoId);
    } else {
      newExpanded.add(topicoId);
    }
    setExpandedTopicos(newExpanded);
  };

  const formatTime = (minutes?: number) => {
    if (!minutes) return null;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  // Filtrar disciplinas/topicos/subtopicos baseado na busca
  const filteredDisciplinas = useMemo(() => {
    if (!searchQuery.trim()) return units;

    const query = searchQuery.toLowerCase();
    const newExpandedDisciplinas = new Set<string>();
    const newExpandedTopicos = new Set<string>();

    const filtered = units
      .map((disciplina) => {
        const disciplinaMatches = disciplina.nome.toLowerCase().includes(query);

        const filteredTopicos = disciplina.topicos
          .map((topico) => {
            const topicoMatches = topico.nome.toLowerCase().includes(query);

            const filteredSubtopicos = topico.subtopicos.filter((subtopico) =>
              subtopico.nome.toLowerCase().includes(query)
            );

            // Incluir topico se: (1) nome match, (2) tem subtopicos que match
            if (topicoMatches || filteredSubtopicos.length > 0) {
              newExpandedDisciplinas.add(disciplina.id);
              if (filteredSubtopicos.length > 0) {
                newExpandedTopicos.add(topico.id);
              }
              return { ...topico, subtopicos: filteredSubtopicos };
            }
            return null;
          })
          .filter((t) => t !== null) as Topico[];

        // Incluir disciplina se: (1) nome match, (2) tem topicos que match
        if (disciplinaMatches || filteredTopicos.length > 0) {
          return { ...disciplina, topicos: filteredTopicos };
        }
        return null;
      })
      .filter((u) => u !== null) as Disciplina[];

    // Auto-expand matches
    setExpandedDisciplinas(newExpandedDisciplinas);
    setExpandedTopicos(newExpandedTopicos);

    return filtered;
  }, [units, searchQuery]);

  // Contador de resultados
  const resultsCount = useMemo(() => {
    let count = 0;
    filteredDisciplinas.forEach((disciplina) => {
      disciplina.topicos.forEach((topico) => {
        if (topico.subtopicos.length > 0) {
          count += topico.subtopicos.length;
        } else {
          count += 1; // topico sem subtopico
        }
      });
    });
    return count;
  }, [filteredDisciplinas]);

  // Calcular tempo total da disciplina
  const calculateDisciplinaDuration = (disciplina: Disciplina): number => {
    return disciplina.topicos.reduce((total, topico) => {
      if (topico.subtopicos.length > 0) {
        return total + topico.subtopicos.reduce((sum, sub) => {
          return sum + (sub.estimated_duration_minutes || 90);
        }, 0);
      }
      return total + (topico.estimated_duration_minutes || 120);
    }, 0);
  };

  // Verificar se topico tem subtopicos selecionados
  const hasSelectedSubtopicos = (topico: Topico): boolean => {
    return topico.subtopicos.some(sub => selectedSubtopics.has(sub.id));
  };

  // Contar subtopicos selecionados em um topico
  const countSelectedSubtopicos = (topico: Topico): number => {
    return topico.subtopicos.filter(sub => selectedSubtopics.has(sub.id)).length;
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
        <p>Nenhuma disciplina/topico encontrado</p>
        <p className="text-sm mt-2">Crie disciplinas e topicos primeiro</p>
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
      {searchQuery && filteredDisciplinas.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          Nenhum resultado encontrado para "{searchQuery}"
        </div>
      )}

      {/* Lista de Disciplinas/Topicos/Subtopicos */}
      <div className="space-y-2">
        {filteredDisciplinas.map((disciplina) => {
        const isDisciplinaExpanded = expandedDisciplinas.has(disciplina.id);
        const disciplinaDuration = calculateDisciplinaDuration(disciplina);

        return (
          <div key={disciplina.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            {/* Disciplina Header */}
            <button
              type="button"
              onClick={() => toggleDisciplina(disciplina.id)}
              className="w-full flex items-center gap-2.5 p-2.5 hover:bg-gray-50 transition-colors"
            >
              <ChevronRight
                className={`w-4 h-4 text-gray-400 transition-transform ${
                  isDisciplinaExpanded ? 'rotate-90' : ''
                }`}
              />
              <Box className="w-4 h-4 text-gray-400" />
              <div className="flex-1 flex items-center justify-between text-left gap-2">
                <span className="font-medium text-sm text-gray-900">{disciplina.nome}</span>
                {disciplinaDuration > 0 && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3.5 h-3.5" />
                    {formatTime(disciplinaDuration)}
                  </span>
                )}
              </div>
            </button>

            {/* Topicos */}
            {isDisciplinaExpanded && (
              <div className="px-2.5 pb-1.5 space-y-1 bg-gray-50/30">
                {disciplina.topicos.map((topico) => {
                  const isTopicoExpanded = expandedTopicos.has(topico.id);
                  const hasSubtopicos = topico.subtopicos.length > 0;
                  const topicoDuration = hasSubtopicos
                    ? topico.subtopicos.reduce((sum, sub) => sum + (sub.estimated_duration_minutes || 90), 0)
                    : topico.estimated_duration_minutes || 120;
                  const selectedCount = countSelectedSubtopicos(topico);

                  return (
                    <div key={topico.id} className="ml-2 border-l border-gray-200 pl-3 py-0.5">
                      {/* Topico Header */}
                      <div className="flex items-center gap-2">
                        {hasSubtopicos ? (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleTopico(topico.id)}
                              className="flex items-center gap-2 flex-1 hover:bg-white/60 rounded px-2 py-1.5 transition-colors"
                            >
                              <ChevronRight
                                className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
                                  isTopicoExpanded ? 'rotate-90' : ''
                                }`}
                              />
                              <BookOpen className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-sm flex-1 text-left text-gray-700">
                                {topico.nome}
                              </span>
                              {selectedCount > 0 && (
                                <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {selectedCount}/{topico.subtopicos.length}
                                </span>
                              )}
                              {topicoDuration > 0 && (
                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                  <Clock className="w-3.5 h-3.5" />
                                  {formatTime(topicoDuration)}
                                </span>
                              )}
                            </button>
                            {/* Checkbox to select all subtopicos (shortcut) */}
                            <Checkbox
                              checked={topico.subtopicos.every(sub => selectedSubtopics.has(sub.id))}
                              onCheckedChange={() => onToggleAllSubtopics(topico.subtopicos.map(s => s.id))}
                              title="Selecionar todos os subtopicos"
                            />
                          </>
                        ) : (
                          // Topico without subtopicos - selectable (can be studied directly)
                          <div className="flex items-center gap-2 flex-1 hover:bg-white/60 rounded px-2 py-1.5 transition-colors">
                            <Checkbox
                              id={topico.id}
                              checked={selectedTopics.has(topico.id)}
                              onCheckedChange={() => onToggleTopic(topico.id)}
                            />
                            <BookOpen className="w-3.5 h-3.5 text-gray-400" />
                            <Label
                              htmlFor={topico.id}
                              className="cursor-pointer flex-1 text-sm flex items-center justify-between gap-2"
                            >
                              <span className="text-gray-700">{topico.nome}</span>
                              {topicoDuration > 0 && (
                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                  <Clock className="w-3.5 h-3.5" />
                                  {formatTime(topicoDuration)}
                                </span>
                              )}
                            </Label>
                          </div>
                        )}
                      </div>

                      {/* Subtopicos */}
                      {isTopicoExpanded && hasSubtopicos && (
                        <div className="ml-6 space-y-0.5 mt-1 pb-1">
                          {topico.subtopicos.map((subtopico) => (
                            <div
                              key={subtopico.id}
                              className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-white/60 transition-colors"
                            >
                              <Checkbox
                                id={subtopico.id}
                                checked={selectedSubtopics.has(subtopico.id)}
                                onCheckedChange={() => onToggleSubtopic(subtopico.id)}
                              />
                              <Label
                                htmlFor={subtopico.id}
                                className="cursor-pointer flex-1 text-sm flex items-center justify-between gap-2"
                              >
                                <span className="text-gray-600">{subtopico.nome}</span>
                                {subtopico.estimated_duration_minutes && (
                                  <span className="flex items-center gap-1 text-xs text-gray-500">
                                    <Clock className="w-3.5 h-3.5" />
                                    {formatTime(subtopico.estimated_duration_minutes)}
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
