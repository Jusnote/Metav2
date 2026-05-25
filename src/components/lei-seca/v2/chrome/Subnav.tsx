'use client';

export function Subnav() {
  return (
    <div className="border-b border-n-rule px-9 flex items-center gap-1.5 overflow-hidden text-[12px] text-n-ink-2">
      <span className="text-n-ink-3 mr-1">CTB</span>
      <Chip>Cap. III</Chip>
      <Chip>Normas Gerais</Chip>
      <Chip on>Art. 26</Chip>
      <span className="ml-auto flex items-center gap-[14px] text-[11.5px] text-n-ink-3">
        <span>14 / 42 estudados</span>
        <MiniProgress pct={33} />
      </span>
    </div>
  );
}

function Chip({ children, on }: { children: React.ReactNode; on?: boolean }) {
  return (
    <span
      className={
        'px-2.5 py-1 rounded-full ' +
        (on ? 'bg-n-accent-soft text-n-accent font-semibold' : 'bg-transparent text-n-ink-2')
      }
    >
      {children}
    </span>
  );
}

function MiniProgress({ pct }: { pct: number }) {
  return (
    <div className="w-20 h-1 bg-n-rule rounded-sm relative">
      <div className="absolute inset-0 bg-n-accent rounded-sm" style={{ width: `${pct}%` }} />
    </div>
  );
}
