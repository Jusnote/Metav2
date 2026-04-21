// src/components/questoes/objetivo/AreaTabs.tsx
'use client';

import { AREAS, AREA_LABELS, type Area } from '@/types/carreira';

interface AreaTabsProps {
  value: Area;
  onChange: (area: Area) => void;
  counts: Record<string, number>;
}

export function AreaTabs({ value, onChange, counts }: AreaTabsProps) {
  return (
    <nav
      aria-label="Áreas de carreira"
      className="flex items-center gap-[3px] border-b border-[#e2e8f0] mb-[14px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
              'relative whitespace-nowrap -mb-[1px]',
              'inline-flex items-center gap-[6px]',
              'px-[14px] pl-[12px] py-[10px] text-[12.5px]',
              'border-b-2 bg-transparent',
              'transition-colors',
              active
                ? 'font-semibold text-[#0f172a] border-[#1e3a8a]'
                : 'font-medium text-[#64748b] border-transparent hover:text-[#0f172a]',
            ].join(' ')}
          >
            {AREA_LABELS[area]}
            <span
              className={[
                'text-[10px] font-medium',
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
