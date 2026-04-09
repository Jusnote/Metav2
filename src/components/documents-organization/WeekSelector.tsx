interface WeekSelectorProps {
  week: Date;  // Monday of selected week
  onChange: (monday: Date) => void;
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startDay = monday.getDate();
  const endDay = sunday.getDate();
  const startMonth = MESES[monday.getMonth()];
  const endMonth = MESES[sunday.getMonth()];

  if (monday.getMonth() === sunday.getMonth()) {
    return `${startDay}\u2013${endDay} ${startMonth}`;
  }
  return `${startDay} ${startMonth}\u2013${endDay} ${endMonth}`;
}

export function WeekSelector({ week, onChange }: WeekSelectorProps) {
  const handlePrev = () => {
    const prev = new Date(week);
    prev.setDate(prev.getDate() - 7);
    onChange(prev);
  };

  const handleNext = () => {
    const next = new Date(week);
    next.setDate(next.getDate() + 7);
    onChange(next);
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handlePrev}
        className="w-6 h-6 flex items-center justify-center rounded-md border border-[#f0eef5] text-[#9e99ae] text-[11px] hover:border-[#9b8afb] transition-colors"
      >
        &lsaquo;
      </button>
      <span className="text-xs font-semibold text-[#1a1625] min-w-[100px] text-center">
        {formatWeekLabel(week)}
      </span>
      <button
        onClick={handleNext}
        className="w-6 h-6 flex items-center justify-center rounded-md border border-[#f0eef5] text-[#9e99ae] text-[11px] hover:border-[#9b8afb] transition-colors"
      >
        &rsaquo;
      </button>
    </div>
  );
}
