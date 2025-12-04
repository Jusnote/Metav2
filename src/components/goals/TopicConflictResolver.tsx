import { useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { TopicConflict } from '@/lib/schedule-distribution';

interface TopicConflictResolverProps {
  conflicts: TopicConflict[];
  manualItemsWithoutConflict: Array<{
    scheduled_date: string;
    estimated_duration: number;
    title: string;
  }>;
  onConflictResolutionChange: (conflicts: TopicConflict[]) => void;
}

export function TopicConflictResolver({
  conflicts,
  manualItemsWithoutConflict,
  onConflictResolutionChange,
}: TopicConflictResolverProps) {
  const [isExpanded, setIsExpanded] = useState(false); // ⬅️ COLLAPSED por padrão
  const [bulkAction, setBulkAction] = useState<'convert' | 'replace' | 'skip'>('convert');

  const parentRef = useRef<HTMLDivElement>(null);

  // Virtualizer para lista de conflitos
  const rowVirtualizer = useVirtualizer({
    count: conflicts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 160, // Altura estimada de cada card
    overscan: 3, // Renderizar 3 itens extras fora da viewport
  });

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}`;
  };

  const handleConflictActionChange = (index: number, action: 'convert' | 'replace' | 'skip') => {
    const updatedConflicts = [...conflicts];
    updatedConflicts[index].action = action;
    onConflictResolutionChange(updatedConflicts);
  };

  const handleApplyToAll = () => {
    const updatedConflicts = conflicts.map((conflict) => ({
      ...conflict,
      action: bulkAction,
    }));
    onConflictResolutionChange(updatedConflicts);
  };

  const getActionLabel = (action: 'convert' | 'replace' | 'skip') => {
    switch (action) {
      case 'convert':
        return 'Vincular à meta';
      case 'replace':
        return 'Substituir por novo agendamento';
      case 'skip':
        return 'Excluir da meta';
    }
  };

  const getActionDescription = (action: 'convert' | 'replace' | 'skip') => {
    switch (action) {
      case 'convert':
        return 'Item se torna parte da meta • Ativa FSRS • Progresso unificado';
      case 'replace':
        return 'Remove agendamentos manuais • Cria novo cronograma pela meta';
      case 'skip':
        return 'Mantém apenas itens manuais • Tópico não fará parte da meta';
    }
  };

  const totalItems = conflicts.length + manualItemsWithoutConflict.length;

  if (totalItems === 0) return null;

  return (
    <div className="border border-amber-200 rounded-lg bg-gradient-to-br from-amber-50/50 to-orange-50/30 overflow-hidden">
      {/* Header - Colapsável */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-amber-100/40 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="flex flex-col items-start">
            <h3 className="text-sm font-semibold text-amber-900">
              Resolver conflitos ({conflicts.length})
            </h3>
            <p className="text-xs text-amber-700">
              {conflicts.length} conflito{conflicts.length > 1 ? 's' : ''} de agendamento manual
              {manualItemsWithoutConflict.length > 0 && ` • ${manualItemsWithoutConflict.length} item${manualItemsWithoutConflict.length > 1 ? 's' : ''} sem conflito`}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-amber-600" />
        ) : (
          <ChevronDown className="w-5 h-5 text-amber-600" />
        )}
      </button>

      {/* Content - Expandido */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Botão "Aplicar para todos" - STICKY */}
          {conflicts.length > 1 && (
            <div className="sticky top-0 z-10 bg-gradient-to-br from-amber-50/50 to-orange-50/30 pb-3 border-b border-amber-200">
              <div className="flex items-center gap-2">
                <Select value={bulkAction} onValueChange={(value) => setBulkAction(value as any)}>
                  <SelectTrigger className="h-9 text-xs bg-white border-amber-200 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="convert" className="text-xs">
                      ✓ Vincular à meta
                    </SelectItem>
                    <SelectItem value="replace" className="text-xs">
                      ⟳ Substituir
                    </SelectItem>
                    <SelectItem value="skip" className="text-xs">
                      ⊘ Excluir da meta
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleApplyToAll}
                  className="h-9 text-xs border-amber-300 hover:bg-amber-100 text-amber-900"
                >
                  Aplicar para todos
                </Button>
              </div>
            </div>
          )}

          {/* Lista virtualizada de conflitos */}
          {conflicts.length > 0 && (
            <div
              ref={parentRef}
              className="max-h-80 overflow-y-auto"
              style={{ overscrollBehavior: 'contain' }}
            >
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const conflict = conflicts[virtualRow.index];
                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      className="pb-2.5"
                    >
                      <div className="group border-l-2 border-amber-400 bg-white pl-3 pr-3 py-2.5 rounded-r-md shadow-sm hover:shadow-md transition-all duration-200">
                        {/* Título e info do conflito */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{conflict.title}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                              {conflict.existingItems.map((item, idx) => (
                                <span key={idx} className="flex items-center gap-1">
                                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                                  {formatDate(item.scheduled_date)} • {formatDuration(item.estimated_duration)}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Select de ação */}
                        <Select
                          value={conflict.action}
                          onValueChange={(value) =>
                            handleConflictActionChange(virtualRow.index, value as 'convert' | 'replace' | 'skip')
                          }
                        >
                          <SelectTrigger className="h-9 text-xs bg-white border-amber-200 hover:border-amber-300 focus:ring-amber-400">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="convert" className="text-xs">
                              <div className="space-y-0.5">
                                <p className="font-medium text-green-700">✓ {getActionLabel('convert')}</p>
                                <p className="text-[10px] text-gray-600 leading-tight">
                                  {getActionDescription('convert')}
                                </p>
                              </div>
                            </SelectItem>
                            <SelectItem value="replace" className="text-xs">
                              <div className="space-y-0.5">
                                <p className="font-medium text-orange-700">⟳ {getActionLabel('replace')}</p>
                                <p className="text-[10px] text-gray-600 leading-tight">
                                  {getActionDescription('replace')}
                                </p>
                              </div>
                            </SelectItem>
                            <SelectItem value="skip" className="text-xs">
                              <div className="space-y-0.5">
                                <p className="font-medium text-gray-700">⊘ {getActionLabel('skip')}</p>
                                <p className="text-[10px] text-gray-600 leading-tight">
                                  {getActionDescription('skip')}
                                </p>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Preview da ação selecionada */}
                        <div className="mt-2 pt-2 border-t border-amber-100">
                          <p className="text-[10px] text-gray-600 leading-relaxed">
                            {getActionDescription(conflict.action)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Separador entre conflitos e não-conflitos */}
          {conflicts.length > 0 && manualItemsWithoutConflict.length > 0 && (
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-amber-200"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-gradient-to-br from-amber-50/50 to-orange-50/30 px-3 text-xs text-amber-700">
                  Sem conflito
                </span>
              </div>
            </div>
          )}

          {/* Itens sem conflito */}
          {manualItemsWithoutConflict.length > 0 && (
            <div className="space-y-1.5">
              {manualItemsWithoutConflict.map((item, index) => (
                <div
                  key={index}
                  className="pl-3 pr-2 py-1.5 text-xs text-gray-600 bg-white/40 rounded-md flex items-center gap-2"
                >
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  <span className="font-medium text-gray-700">{item.title}</span>
                  <span>•</span>
                  <span>{formatDate(item.scheduled_date)}</span>
                  <span>•</span>
                  <span>{formatDuration(item.estimated_duration)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Dica */}
          {conflicts.length > 0 && (
            <div className="mt-3 pt-3 border-t border-amber-200">
              <p className="text-[10px] text-amber-800 leading-relaxed">
                💡 <strong>Recomendado:</strong> Vincular à meta mantém o progresso e ativa FSRS automaticamente
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
