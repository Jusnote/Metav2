// src/components/questoes/objetivo/CarreiraCarousel.tsx
'use client';

import { useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Carreira } from '@/types/carreira';
import { CarreiraCard, TodasCard } from './CarreiraCard';

interface CarreiraCarouselProps {
  carreiras: Carreira[];
  focosAtivos: string[];
  onToggleFoco: (id: string) => void;
  onClearFocos: () => void;
  areaLabel: string;
  loading?: boolean;
}

const SCROLL_STEP = 360;

export function CarreiraCarousel({
  carreiras,
  focosAtivos,
  onToggleFoco,
  onClearFocos,
  areaLabel,
  loading = false,
}: CarreiraCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasAnyFoco = focosAtivos.length > 0;

  const scrollForward = () =>
    scrollRef.current?.scrollBy({ left: SCROLL_STEP, behavior: 'smooth' });

  if (loading) {
    return (
      <div className="flex items-stretch gap-[10px]">
        <div className="flex-1 flex gap-[10px] py-[2px]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[112px] w-[112px] flex-shrink-0 animate-pulse rounded-[10px] bg-slate-100"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-stretch gap-[10px]">
      <div
        ref={scrollRef}
        className="flex-1 min-w-0 flex gap-[10px] overflow-x-auto py-[2px] px-[2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollBehavior: 'smooth' }}
      >
        <TodasCard active={!hasAnyFoco} onClick={onClearFocos} />

        {carreiras.length === 0 ? (
          <div className="flex items-center px-4 text-xs text-slate-400">
            Nenhuma carreira ativa em {areaLabel} ainda.
          </div>
        ) : (
          carreiras.map((c) => (
            <CarreiraCard
              key={c.id}
              carreira={c}
              active={focosAtivos.includes(c.id)}
              onToggle={() => onToggleFoco(c.id)}
            />
          ))
        )}
      </div>

      {carreiras.length > 0 && (
        <button
          type="button"
          onClick={scrollForward}
          aria-label="Rolar carrossel"
          className="flex-shrink-0 w-8 flex items-center justify-center rounded-[10px] border border-[#e2e8f0] bg-white text-[#64748b] transition-colors hover:bg-[#f8fafc] hover:text-[#0f172a] hover:border-[#cbd5e1]"
        >
          <ChevronRight className="h-[14px] w-[14px]" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
