// src/components/questoes/objetivo/AreaTabs.tsx
'use client';

import { AREAS, AREA_LABELS, type Area } from '@/types/carreira';

interface AreaTabsProps {
  value: Area;
  onChange: (area: Area) => void;
  counts: Record<string, number>;
  /** Compact — padding/font reduzidos, sem border-b. Default: false. */
  compact?: boolean;
}

export function AreaTabs({ value, onChange, counts, compact = false }: AreaTabsProps) {
  return (
    <nav
      aria-label="Áreas de carreira"
      className={[
        'flex items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        compact ? 'gap-[2px]' : 'gap-[3px] border-b border-[#e2e8f0] mb-[14px]',
      ].join(' ')}
    >
      {AREAS.map((area) => {
        const active = area === value;
        const count = counts[area] ?? 0;
        return (
          <button
            key={area}
            type="button"
            onClick={() => onChange(area)}
            className={[
              'relative whitespace-nowrap',
              'inline-flex items-center bg-transparent transition-colors',
              compact
                ? [
                    'gap-[4px] px-[8px] py-[4px] text-[11px] rounded-md',
                    active
                      ? 'font-semibold text-[#0f172a] bg-[#f1f5f9]'
                      : 'font-medium text-[#64748b] hover:text-[#0f172a]',
                  ].join(' ')
                : [
                    '-mb-[1px] gap-[6px] px-[14px] pl-[12px] py-[10px] text-[12.5px]',
                    'border-b-2',
                    active
                      ? 'font-semibold text-[#0f172a] border-[#1e3a8a]'
                      : 'font-medium text-[#64748b] border-transparent hover:text-[#0f172a]',
                  ].join(' '),
            ].join(' ')}
          >
            {AREA_LABELS[area]}
            <span
              className={[
                compact ? 'text-[9px]' : 'text-[10px]',
                'font-medium',
                active ? 'text-[#1e3a8a]' : 'text-[#94a3b8]',
              ].join(' ')}
            >
              {count}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
