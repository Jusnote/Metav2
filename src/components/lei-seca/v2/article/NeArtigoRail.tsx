'use client';

import { Flame, Scale, BookOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useDispositivoQuestions } from '@/hooks/useDispositivoQuestions';

interface Props {
  dispositivoId: string;
}

export function NeArtigoRail({ dispositivoId }: Props) {
  const { data: questoes } = useDispositivoQuestions(dispositivoId);
  const questoesCount = questoes.length;

  // TODO: integrar fontes reais quando handoff respectivos ficarem prontos
  const jurisprudenciaCount = 0;
  const doutrinaCount = 0;

  return (
    <div className="mt-3 flex items-center gap-2 flex-wrap">
      <span className="font-n-mono text-[10px] uppercase tracking-[0.12em] text-n-ink-3 mr-1">
        Neste artigo
      </span>
      <NeArtigoPill
        Icon={Flame}
        iconColor="#dc2626"
        label="Questões"
        count={questoesCount}
        onClick={() => {
          // eslint-disable-next-line no-console
          console.log('TODO: abrir questões para', dispositivoId);
        }}
      />
      <NeArtigoPill
        Icon={Scale}
        iconColor="#1e3a5f"
        label="Jurisprudência"
        count={jurisprudenciaCount}
        onClick={() => {
          // eslint-disable-next-line no-console
          console.log('TODO: jurisprudência para', dispositivoId);
        }}
      />
      <NeArtigoPill
        Icon={BookOpen}
        iconColor="#1e3a5f"
        label="Comentário doutrinário"
        count={doutrinaCount}
        onClick={() => {
          // eslint-disable-next-line no-console
          console.log('TODO: doutrina para', dispositivoId);
        }}
      />
    </div>
  );
}

interface NeArtigoPillProps {
  Icon: LucideIcon;
  iconColor: string;
  label: string;
  count: number;
  onClick: () => void;
}

function NeArtigoPill({ Icon, iconColor, label, count, onClick }: NeArtigoPillProps) {
  const empty = count === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={empty}
      className={
        'inline-flex items-center gap-1.5 h-6 px-2 rounded-full border border-n-rule text-[11px] font-medium transition-colors ' +
        (empty
          ? 'text-n-ink-3 opacity-50 cursor-default'
          : 'text-n-ink-2 hover:border-n-ink-3 hover:text-n-ink')
      }
    >
      <Icon size={12} strokeWidth={1.8} color={empty ? undefined : iconColor} fill={empty ? 'none' : iconColor} />
      <span>{label}</span>
      {!empty && (
        <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-[14px] px-1.5 rounded-full bg-n-ink-3 text-n-bg font-n-mono text-[10px] leading-none">
          {count}
        </span>
      )}
    </button>
  );
}
