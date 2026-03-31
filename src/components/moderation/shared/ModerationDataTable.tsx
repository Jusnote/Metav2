'use client';

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
}

export function ModerationDataTable<T>({
  columns,
  data,
  onRowClick,
  rowKey,
  emptyMessage = 'Nenhum resultado encontrado',
}: ModerationDataTableProps<T>) {
  const gridCols = columns.map((c) => c.width ?? '1fr').join(' ');

  if (data.length === 0) {
    return (
      <div className="rounded-[10px] border border-zinc-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p className="py-12 text-center text-[13px] text-zinc-400">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[10px] border border-zinc-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
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
      {data.map((row) => (
        <div
          key={rowKey(row)}
          className={cn(
            'grid items-center border-b border-[#fafafa] px-[18px] py-[13px] transition-colors',
            onRowClick && 'cursor-pointer hover:bg-[#faf8ff]',
          )}
          style={{ gridTemplateColumns: gridCols }}
          onClick={() => onRowClick?.(row)}
        >
          {columns.map((col) => (
            <div key={col.key}>{col.render(row)}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
