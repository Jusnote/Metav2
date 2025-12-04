import React from 'react';
import { Calendar, Edit3, Trash2, MoreVertical } from 'lucide-react';
import { QuickSchedulePopover } from './QuickSchedulePopover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CardActionBarProps {
  // Schedule props
  topicId?: string;
  subtopicId?: string;
  title: string;
  estimatedMinutes?: number;
  onSchedule: (data: {
    date: Date;
    durationMinutes: number;
    topicId?: string;
    subtopicId?: string;
  }) => void;

  // Edit/Delete props
  isEditMode: boolean;
  onEdit?: () => void;
  onDelete?: () => void;

  // Mobile detection
  isMobile: boolean;
}

export function CardActionBar({
  topicId,
  subtopicId,
  title,
  estimatedMinutes = 90,
  onSchedule,
  isEditMode,
  onEdit,
  onDelete,
  isMobile,
}: CardActionBarProps) {
  if (isMobile) {
    // Mobile: Dropdown menu (mantém design atual)
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors shrink-0"
          >
            <MoreVertical className="w-4 h-4 text-gray-600" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <QuickSchedulePopover
            topicId={topicId}
            subtopicId={subtopicId}
            title={title}
            estimatedMinutes={estimatedMinutes}
            onSchedule={onSchedule}
          >
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <Calendar className="w-4 h-4 mr-2" />
              Agendar estudo
            </DropdownMenuItem>
          </QuickSchedulePopover>
          {isEditMode && onEdit && onDelete && (
            <>
              <DropdownMenuItem onClick={onEdit}>
                <Edit3 className="w-4 h-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Deletar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Desktop: Action bar overlay (novo design premium)
  return (
    <div className="absolute top-0 left-0 right-0 z-10 opacity-0 group-hover:opacity-100 transition-all duration-200 ease-in-out pointer-events-none group-hover:pointer-events-auto">
      <div className="bg-gradient-to-b from-white/95 via-white/90 to-transparent backdrop-blur-sm px-3 py-2 rounded-t-md border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-2">
          {/* Schedule Button */}
          <QuickSchedulePopover
            topicId={topicId}
            subtopicId={subtopicId}
            title={title}
            estimatedMinutes={estimatedMinutes}
            onSchedule={onSchedule}
          >
            <button
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-md transition-colors shadow-sm"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Agendar</span>
            </button>
          </QuickSchedulePopover>

          {/* Edit/Delete buttons (only in edit mode) */}
          {isEditMode && onEdit && onDelete && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-md transition-colors"
                title="Editar"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium rounded-md transition-colors"
                title="Deletar"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Deletar</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
