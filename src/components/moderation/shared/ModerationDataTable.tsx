'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  label: string;
  width?: string;
  render: (row: T) => React.ReactNode;
}

interface ModerationDataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  pageSize?: number;
}

export function ModerationDataTable<T>({
  columns,
  data,
  onRowClick,
  rowKey,
  emptyMessage = 'Nenhum resultado encontrado',
  emptyIcon,
  pageSize = 10,
}: ModerationDataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(0);
  const gridCols = columns.map((c) => c.width ?? '1fr').join(' ');
  const totalPages = Math.ceil(data.length / pageSize);
  const pagedData = data.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  // Keyboard navigation
  const [focusedRow, setFocusedRow] = useState(-1);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedRow((prev) => Math.min(prev + 1, pagedData.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedRow((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && focusedRow >= 0 && onRowClick) {
      e.preventDefault();
      onRowClick(pagedData[focusedRow]);
    }
  };

  if (data.length === 0) {
    return (
      <div className="rounded-[10px] border border-zinc-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col items-center justify-center py-16">
          {emptyIcon && <div className="mb-3 text-zinc-300">{emptyIcon}</div>}
          <p className="text-[13px] text-zinc-400">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-[10px] border border-zinc-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-violet-200"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div
        className="grid border-b border-zinc-100 bg-[#fafafa] px-[18px] py-[10px]"
        style={{ gridTemplateColumns: gridCols }}
      >
        {columns.map((col) => (
          <span
            key={col.key}
            className="text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-400"
          >
            {col.label}
          </span>
        ))}
      </div>

      {/* Rows */}
      {pagedData.map((row, index) => (
        <div
          key={rowKey(row)}
          className={cn(
            'grid items-center border-b border-[#fafafa] px-[18px] py-[13px] transition-colors',
            onRowClick && 'cursor-pointer hover:bg-[#faf8ff]',
            focusedRow === index && 'bg-violet-50',
          )}
          style={{ gridTemplateColumns: gridCols }}
          onClick={() => onRowClick?.(row)}
        >
          {columns.map((col) => (
            <div key={col.key}>{col.render(row)}</div>
          ))}
        </div>
      ))}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-100 px-[18px] py-3">
          <span className="text-[12px] text-zinc-400">
            {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, data.length)} de {data.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[60px] text-center text-[12px] font-medium tabular-nums text-zinc-600">
              {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
