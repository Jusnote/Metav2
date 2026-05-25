'use client';

import { useMemo } from 'react';

// TODO: integração real com API de questões — handoff próprio.
export interface QuestaoStub {
  id: string;
}

export function useDispositivoQuestions(_dispositivoId: string): {
  data: QuestaoStub[];
  isLoading: boolean;
} {
  return useMemo(() => ({ data: [], isLoading: false }), []);
}
