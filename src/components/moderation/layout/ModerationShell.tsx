'use client';

import { Outlet } from 'react-router-dom';
import { ModerationSidebar } from './ModerationSidebar';

export function ModerationShell() {
  return (
    <div className="flex h-screen bg-[#f8f8f8]">
      <ModerationSidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
