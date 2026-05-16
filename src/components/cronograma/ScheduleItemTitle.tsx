import { cn } from '@/lib/utils'

export interface ScheduleItemTitleProps {
  conceitoPai?: string | null
  nome: string
  /** Variante de tamanho. Default "default" pra cards normais. */
  size?: 'sm' | 'default' | 'lg'
  className?: string
}

const SIZES = {
  sm:      { parent: 'text-[9px]',  main: 'text-[13px]' },
  default: { parent: 'text-[10px]', main: 'text-sm'    },
  lg:      { parent: 'text-xs',     main: 'text-base'  },
}

export function ScheduleItemTitle({
  conceitoPai, nome, size = 'default', className,
}: ScheduleItemTitleProps) {
  const s = SIZES[size]
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      {conceitoPai && (
        <span className={cn(
          s.parent,
          'uppercase tracking-wider font-semibold text-slate-400',
        )}>
          {conceitoPai}
        </span>
      )}
      <span className={cn(s.main, 'font-medium text-slate-900 leading-snug')}>
        {nome}
      </span>
    </div>
  )
}
