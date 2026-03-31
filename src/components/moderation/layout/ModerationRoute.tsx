'use client';

import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/moderation/useUserRole';

export function ModerationRoute({ children }: { children: React.ReactNode }) {
  const { isModerator, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (!isModerator) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
