// src/components/questoes/objetivo/CarreiraCard.tsx
'use client';

import { Check, ListChecks } from 'lucide-react';
import type { Carreira } from '@/types/carreira';

interface CarreiraCardProps {
  carreira: Carreira;
  active: boolean;
  onToggle: () => void;
}

export function CarreiraCard({ carreira, active, onToggle }: CarreiraCardProps) {
  const hasFoto = Boolean(carreira.foto_url);

  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'relative flex-shrink-0 w-[96px] h-[96px] rounded-[10px] overflow-hidden',
        'cursor-pointer transition-all duration-200 ease-out',
        'shadow-[0_1px_2px_rgba(15,23,42,0.08)] hover:-translate-y-[1px] hover:shadow-[0_4px_12px_rgba(15,23,42,0.15)]',
        'border-2',
        active
          ? 'border-[#1e3a8a] shadow-[0_0_0_3px_rgba(30,58,138,0.1)]'
          : 'border-transparent',
      ].join(' ')}
      style={
        active
          ? undefined
          : { filter: 'grayscale(0.35) brightness(0.97)', opacity: 0.78 }
      }
      aria-pressed={active}
      aria-label={`Foco: ${carreira.nome}`}
    >
      {hasFoto ? (
        <img
          src={carreira.foto_url!}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <FallbackBackground nome={carreira.nome} />
      )}

      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(15,23,42,0.1) 40%, rgba(15,23,42,0.88) 100%)',
        }}
      />

      {active && (
        <span className="absolute top-[6px] right-[6px] inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#1e3a8a] text-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
          <Check className="h-[10px] w-[10px]" strokeWidth={3} />
        </span>
      )}

      <div className="absolute bottom-0 left-0 right-0 px-2 pb-[6px] pt-[6px] text-white">
        <div
          className="text-[10px] font-bold uppercase tracking-[0.03em] leading-[1.15]"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {carreira.nome}
        </div>
      </div>
    </button>
  );
}

export function TodasCard({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative flex-shrink-0 w-[96px] h-[96px] rounded-[10px] overflow-hidden',
        'flex flex-col items-center justify-center gap-[6px]',
        'cursor-pointer transition-colors',
        'border-[1.5px]',
        active
          ? 'border-[#1e3a8a] bg-[#eff6ff]'
          : 'border-[#e2e8f0] bg-[#f8fafc] hover:bg-[#f1f5f9]',
      ].join(' ')}
      style={
        active
          ? undefined
          : { filter: 'grayscale(0.35) brightness(0.97)', opacity: 0.78 }
      }
      aria-pressed={active}
      aria-label="Todas as carreiras"
    >
      <ListChecks
        className={['h-7 w-7', active ? 'text-[#1e3a8a]' : 'text-[#64748b]'].join(' ')}
        strokeWidth={2}
      />
      <span
        className={[
          'text-[10px] font-bold uppercase tracking-[0.04em]',
          active ? 'text-[#1e3a8a]' : 'text-[#64748b]',
        ].join(' ')}
      >
        Todas
      </span>
    </button>
  );
}

function FallbackBackground({ nome }: { nome: string }) {
  const sigla = nome.split(/[·\-:\s]/)[0].toUpperCase().slice(0, 5);
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background:
          'linear-gradient(135deg, #1e3a5f 0%, #2c5282 50%, #2a4365 100%)',
      }}
    >
      <span
        className="text-white/40 font-serif font-bold"
        style={{ fontSize: '22px', letterSpacing: '0.05em' }}
      >
        {sigla}
      </span>
    </div>
  );
}
