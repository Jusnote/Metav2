'use client';

interface SheetToggleProps {
  active: boolean;
  labelA: string;
  labelB: string;
  iconA?: React.ReactNode;
  iconB?: React.ReactNode;
  onToggle: () => void;
}

export function SheetToggle({
  active,
  labelA,
  labelB,
  iconA,
  iconB,
  onToggle,
}: SheetToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-colors ${
        active
          ? 'bg-violet-600 text-white'
          : 'bg-zinc-100 border border-zinc-200 text-zinc-600 hover:bg-zinc-200'
      }`}
    >
      <span>{active ? iconB : iconA}</span>
      <span>{active ? labelB : labelA}</span>
    </button>
  );
}
