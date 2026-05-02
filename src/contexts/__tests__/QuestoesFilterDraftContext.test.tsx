import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFiltrosPendentes } from '@/hooks/useFiltrosPendentes';

describe('useFiltrosPendentes — fora do provider', () => {
  it('lança erro descritivo', () => {
    expect(() => renderHook(() => useFiltrosPendentes())).toThrow(
      /must be used within QuestoesFilterDraftProvider/,
    );
  });
});
