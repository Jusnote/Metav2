'use client';

import { DispositivoCommunityComments } from './DispositivoCommunityComments';
import { DispositivoNote } from './DispositivoNote';

interface DispositivoCommentsSectionProps {
  dispositivoId: string;
  leiId: string;
  activeSection: 'comunidade' | 'nota' | null;
  leiUpdatedAt?: string;
}

export function DispositivoCommentsSection({
  dispositivoId,
  leiId,
  activeSection,
  leiUpdatedAt,
}: DispositivoCommentsSectionProps) {
  if (!activeSection) return null;

  return (
    <div style={{ animation: 'dispFootSlide 0.18s ease-out' }}>
      {activeSection === 'comunidade' && (
        <DispositivoCommunityComments
          dispositivoId={dispositivoId}
          leiId={leiId}
          leiUpdatedAt={leiUpdatedAt}
        />
      )}
      {activeSection === 'nota' && (
        <DispositivoNote dispositivoId={dispositivoId} leiId={leiId} />
      )}
    </div>
  );
}
