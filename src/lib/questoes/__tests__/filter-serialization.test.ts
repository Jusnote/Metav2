import { describe, it, expect } from 'vitest';
import {
  EMPTY_FILTERS,
  type AppliedFilters,
  type VisibilityState,
} from '../filter-serialization';

describe('AppliedFilters — visibility toggles', () => {
  it('VisibilityState aceita "mostrar" e "esconder"', () => {
    const a: VisibilityState = 'mostrar';
    const b: VisibilityState = 'esconder';
    expect(a).toBe('mostrar');
    expect(b).toBe('esconder');
  });

  it('EMPTY_FILTERS tem visibility_anuladas e visibility_desatualizadas como undefined', () => {
    expect(EMPTY_FILTERS.visibility_anuladas).toBeUndefined();
    expect(EMPTY_FILTERS.visibility_desatualizadas).toBeUndefined();
  });
});
