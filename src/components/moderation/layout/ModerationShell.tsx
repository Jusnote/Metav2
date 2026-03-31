'use client';

import { Outlet } from 'react-router-dom';
import { ModerationSidebar } from './ModerationSidebar';
import { useReportCount } from '@/hooks/moderation/useReports';
import { useReportsRealtime } from '@/hooks/moderation/useReportsRealtime';

export function ModerationShell() {
  const pendingCount = useReportCount();
  useReportsRealtime();

  return (
    <div className="flex h-screen bg-[#f8f8f8]">
      <ModerationSidebar pendingCount={pendingCount} />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
