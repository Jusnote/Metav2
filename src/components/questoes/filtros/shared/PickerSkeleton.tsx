'use client';
import React from 'react';

export interface PickerSkeletonProps {
  /** Número de linhas placeholder. Default 8. */
  rows?: number;
}

export function PickerSkeleton({ rows = 8 }: PickerSkeletonProps) {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          data-testid="skeleton-row"
          className="h-6 rounded bg-slate-200 animate-pulse"
          style={{ width: `${60 + ((i * 7) % 35)}%` }}
        />
      ))}
    </div>
  );
}
