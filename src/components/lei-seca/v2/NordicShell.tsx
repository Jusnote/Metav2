'use client';

import type { ReactNode } from 'react';

interface Props {
  topbar: ReactNode;
  subnav: ReactNode;
  main: ReactNode;
  aside?: ReactNode;
  drawer?: ReactNode;
}

export function NordicShell({ topbar, subnav, main, aside, drawer }: Props) {
  return (
    <div
      className="grid h-dvh w-full overflow-hidden bg-n-bg text-n-ink font-n-sans tracking-n-normal"
      style={{ gridTemplateRows: '56px 44px 1fr' }}
    >
      {topbar}
      {subnav}
      <div
        className="overflow-hidden grid"
        style={{ gridTemplateColumns: aside ? '1fr 360px' : '1fr' }}
      >
        {main}
        {aside}
      </div>
      {drawer}
    </div>
  );
}
