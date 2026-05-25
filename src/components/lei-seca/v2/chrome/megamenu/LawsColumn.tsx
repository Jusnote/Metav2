'use client';

import type { Lei } from '@/types/lei-api';
import { LawRow } from './LawRow';

interface Props {
  leis: Lei[];
  selectedLawId: string;
  currentLeiId: string;
  totalArtigosByLei: Record<string, number>;
  pctByLei: Record<string, number>;
  onSelect: (leiId: string) => void;
}

export function LawsColumn({
  leis,
  selectedLawId,
  currentLeiId,
  totalArtigosByLei,
  pctByLei,
  onSelect,
}: Props) {
  return (
    <div>
      <div className="text-[10.5px] text-n-ink-3 tracking-[0.12em] uppercase mb-3">
        Leis em estudo
      </div>
      {leis.length === 0 ? (
        <div className="text-[12px] text-n-ink-3">Nenhuma lei disponível.</div>
      ) : (
        <div className="flex flex-col">
          {leis.map((lei) => (
            <LawRow
              key={lei.id}
              lei={lei}
              isSelected={selectedLawId === lei.id}
              isCurrent={currentLeiId === lei.id}
              totalArtigos={totalArtigosByLei[lei.id] ?? null}
              pctEstudado={pctByLei[lei.id] ?? null}
              onClick={() => onSelect(lei.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
